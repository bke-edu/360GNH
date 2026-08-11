import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import OpenAI from 'openai';
import { z } from 'zod';
import type { RuntimeConfig } from './config.js';
import {
  createKnowledgeAndSpeechProviders,
  createRuntimeProviders,
  createRuntimeProviderUsage,
  createYouTubeTranscriptProvider,
  ProviderRegistry,
} from './provider-registry.js';
import type { RuntimeProviderUsage } from './provider-registry.js';

const MAX_SETTINGS_BYTES = 16 * 1024;
const SUPADATA_API_BASE = 'https://api.supadata.ai/v1';
const SUPADATA_CONNECTION_CHECK_JOB = '00000000-0000-4000-8000-000000000000';

export const OPENAI_MODELS = ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6', 'gpt-5.6-sol'] as const;
export const OPENAI_TTS_MODELS = ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'] as const;

const SecretSchema = z
  .string()
  .trim()
  .min(8)
  .max(500)
  .refine(
    (value) =>
      [...value].every((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint > 31 && codePoint !== 127;
      }),
    'Secret contains control characters',
  );

export const OpenAISettingsInputSchema = z
  .object({
    apiKey: SecretSchema,
    model: z.enum(OPENAI_MODELS),
    budgetUsd: z.number().finite().min(0.01).max(10_000),
    ttsModel: z.enum(OPENAI_TTS_MODELS),
  })
  .strict();

export const SupadataSettingsInputSchema = z
  .object({
    apiKey: SecretSchema,
  })
  .strict();

export type OpenAISettingsInput = z.infer<typeof OpenAISettingsInputSchema>;
export type SupadataSettingsInput = z.infer<typeof SupadataSettingsInputSchema>;

const StoredProviderSettingsSchema = z
  .object({
    version: z.literal(1),
    openai: OpenAISettingsInputSchema.extend({
      verifiedAt: z.iso.datetime().optional(),
    }).optional(),
    supadata: SupadataSettingsInputSchema.extend({
      verifiedAt: z.iso.datetime().optional(),
    }).optional(),
  })
  .strict();

export type StoredProviderSettings = z.infer<typeof StoredProviderSettingsSchema>;
export type ProviderSettingsSource = 'environment' | 'stored' | 'missing';

export interface ProviderSettingsStatus {
  setupRecommended: boolean;
  openai: {
    configured: boolean;
    source: ProviderSettingsSource;
    keyHint?: string;
    model: string;
    budgetUsd: number;
    ttsModel: string;
    knowledgeModelEnabled: boolean;
    verifiedAt?: string;
  };
  supadata: {
    configured: boolean;
    source: ProviderSettingsSource;
    keyHint?: string;
    verifiedAt?: string;
  };
}

export interface ProviderConnectionTester {
  testOpenAI(input: Pick<OpenAISettingsInput, 'apiKey' | 'model' | 'ttsModel'>): Promise<void>;
  testSupadata(input: SupadataSettingsInput): Promise<void>;
}

export interface ProviderSettingsStore {
  read(): Promise<StoredProviderSettings>;
  write(settings: StoredProviderSettings): Promise<void>;
}

export interface ProviderSettingsPort {
  status(): ProviderSettingsStatus;
  saveOpenAI(input: OpenAISettingsInput): Promise<ProviderSettingsStatus>;
  deleteOpenAI(): Promise<ProviderSettingsStatus>;
  saveSupadata(input: SupadataSettingsInput): Promise<ProviderSettingsStatus>;
  deleteSupadata(): Promise<ProviderSettingsStatus>;
}

export class ProviderSetupError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderSetupError';
  }
}

export class FileProviderSettingsStore implements ProviderSettingsStore {
  constructor(readonly path: string) {}

  async read(): Promise<StoredProviderSettings> {
    try {
      const metadata = await stat(this.path);
      if (metadata.size > MAX_SETTINGS_BYTES)
        throw new Error('Provider settings file is too large');
      const raw = await readFile(this.path, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      const result = StoredProviderSettingsSchema.safeParse(parsed);
      if (!result.success) throw new Error('Provider settings file is invalid');
      return result.data;
    } catch (error) {
      if (hasCode(error, 'ENOENT')) return { version: 1 };
      if (error instanceof SyntaxError) throw new Error('Provider settings file is invalid');
      throw error;
    }
  }

  async write(settings: StoredProviderSettings): Promise<void> {
    const result = StoredProviderSettingsSchema.safeParse(settings);
    if (!result.success) throw new Error('Provider settings are invalid');
    const payload = `${JSON.stringify(result.data, null, 2)}\n`;
    if (Buffer.byteLength(payload, 'utf8') > MAX_SETTINGS_BYTES) {
      throw new Error('Provider settings are too large');
    }

    const directory = dirname(this.path);
    const temporaryPath = join(directory, `.${basename(this.path)}.${randomUUID()}.temporary`);
    const createdDirectory = await mkdir(directory, { recursive: true, mode: 0o700 });
    if (createdDirectory !== undefined) await chmod(directory, 0o700);
    try {
      await writeFile(temporaryPath, payload, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      await rename(temporaryPath, this.path);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }
}

interface OpenAIValidationClient {
  models: {
    retrieve(model: string, options: { maxRetries: number; timeout: number }): Promise<unknown>;
  };
}

export interface RemoteProviderConnectionTesterOptions {
  fetchImpl?: typeof fetch;
  openAIClientFactory?: (apiKey: string) => OpenAIValidationClient;
  timeoutMs?: number;
}

export class RemoteProviderConnectionTester implements ProviderConnectionTester {
  readonly #fetch: typeof fetch;
  readonly #openAIClientFactory: (apiKey: string) => OpenAIValidationClient;
  readonly #timeoutMs: number;

  constructor(options: RemoteProviderConnectionTesterOptions = {}) {
    this.#fetch = options.fetchImpl ?? fetch;
    this.#openAIClientFactory = options.openAIClientFactory ?? ((apiKey) => new OpenAI({ apiKey }));
    this.#timeoutMs = options.timeoutMs ?? 15_000;
  }

  async testOpenAI(
    input: Pick<OpenAISettingsInput, 'apiKey' | 'model' | 'ttsModel'>,
  ): Promise<void> {
    const client = this.#openAIClientFactory(input.apiKey);
    try {
      await Promise.all(
        [...new Set([input.model, input.ttsModel])].map((model) =>
          client.models.retrieve(model, { maxRetries: 0, timeout: this.#timeoutMs }),
        ),
      );
    } catch (error) {
      throw safeOpenAISetupError(error);
    }
  }

  async testSupadata(input: SupadataSettingsInput): Promise<void> {
    const url = `${SUPADATA_API_BASE}/transcript/${SUPADATA_CONNECTION_CHECK_JOB}`;
    let response: Response;
    try {
      response = await this.#fetch(url, {
        headers: { accept: 'application/json', 'x-api-key': input.apiKey },
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch {
      throw providerUnavailable();
    }

    // Supadata documents job-status checks as free. A deliberately absent job should
    // return 404 after authentication, so no transcript credit is consumed.
    if (response.status === 404 || response.ok) return;
    if (response.status === 401 || response.status === 403) {
      throw new ProviderSetupError(
        422,
        'PROVIDER_AUTH_FAILED',
        'The provider rejected these credentials.',
      );
    }
    if (response.status === 402) {
      throw new ProviderSetupError(
        422,
        'PROVIDER_PLAN_REQUIRED',
        'The provider account needs an active plan.',
      );
    }
    if (response.status === 429) {
      throw new ProviderSetupError(
        429,
        'PROVIDER_RATE_LIMITED',
        'The provider rate limit prevented verification. Try again later.',
      );
    }
    if (response.status >= 500) throw providerUnavailable();
    // A non-authentication 4xx response proves the fixed endpoint accepted the key
    // before rejecting the deliberately absent job identifier.
  }
}

export interface ProviderSettingsBootstrapOptions {
  store?: ProviderSettingsStore;
  tester?: ProviderConnectionTester;
}

export class ProviderSettingsService implements ProviderSettingsPort {
  readonly registry: ProviderRegistry;
  readonly #baseConfig: RuntimeConfig;
  readonly #store: ProviderSettingsStore;
  readonly #tester: ProviderConnectionTester;
  readonly #usage: RuntimeProviderUsage;
  #stored: StoredProviderSettings;
  #mutation: Promise<void> = Promise.resolve();

  private constructor(
    config: RuntimeConfig,
    stored: StoredProviderSettings,
    store: ProviderSettingsStore,
    tester: ProviderConnectionTester,
  ) {
    const effectiveConfig = resolveEffectiveConfig(config, stored);
    this.#baseConfig = config;
    this.#stored = stored;
    this.#store = store;
    this.#tester = tester;
    this.#usage = createRuntimeProviderUsage(effectiveConfig);
    this.registry = new ProviderRegistry(createRuntimeProviders(effectiveConfig, this.#usage));
  }

  static async bootstrap(
    config: RuntimeConfig,
    options: ProviderSettingsBootstrapOptions = {},
  ): Promise<ProviderSettingsService> {
    const store = options.store ?? new FileProviderSettingsStore(config.providerSettingsPath);
    const stored = await store.read();
    return new ProviderSettingsService(
      config,
      stored,
      store,
      options.tester ?? new RemoteProviderConnectionTester(),
    );
  }

  status(): ProviderSettingsStatus {
    const effectiveConfig = resolveEffectiveConfig(this.#baseConfig, this.#stored);
    const environmentOpenAI = this.#baseConfig.openaiApiKey;
    const storedOpenAI = this.#stored.openai;
    const openAIKey = environmentOpenAI ?? storedOpenAI?.apiKey;
    const environmentSupadata = this.#baseConfig.supadataApiKey;
    const storedSupadata = this.#stored.supadata;
    const supadataKey = environmentSupadata ?? storedSupadata?.apiKey;
    const openAISource = sourceOf(environmentOpenAI, storedOpenAI?.apiKey);
    const supadataSource = sourceOf(environmentSupadata, storedSupadata?.apiKey);
    const model = environmentOpenAI
      ? this.#baseConfig.openaiModel
      : (storedOpenAI?.model ?? this.#baseConfig.openaiModel);
    const budgetUsd = environmentOpenAI
      ? this.#baseConfig.aiBudgetUsd
      : (storedOpenAI?.budgetUsd ?? this.#baseConfig.aiBudgetUsd);
    const ttsModel = environmentOpenAI
      ? this.#baseConfig.openaiTtsModel
      : (storedOpenAI?.ttsModel ?? this.#baseConfig.openaiTtsModel);

    return {
      setupRecommended: !openAIKey && !supadataKey,
      openai: {
        configured: Boolean(openAIKey),
        source: openAISource,
        ...(openAIKey ? { keyHint: keyHint(openAIKey) } : {}),
        model,
        budgetUsd,
        ttsModel,
        knowledgeModelEnabled: effectiveConfig.aiProvider === 'openai',
        ...(openAISource === 'stored' && storedOpenAI?.verifiedAt
          ? { verifiedAt: storedOpenAI.verifiedAt }
          : {}),
      },
      supadata: {
        configured: Boolean(supadataKey),
        source: supadataSource,
        ...(supadataKey ? { keyHint: keyHint(supadataKey) } : {}),
        ...(supadataSource === 'stored' && storedSupadata?.verifiedAt
          ? { verifiedAt: storedSupadata.verifiedAt }
          : {}),
      },
    };
  }

  saveOpenAI(input: OpenAISettingsInput): Promise<ProviderSettingsStatus> {
    return this.#enqueue(async () => {
      this.#assertManageable(this.#baseConfig.openaiApiKey);
      const validated = parseOpenAIInput(input);
      await this.#tester.testOpenAI({
        apiKey: validated.apiKey,
        model: validated.model,
        ttsModel: validated.ttsModel,
      });
      const nextStored: StoredProviderSettings = {
        ...this.#stored,
        openai: { ...validated, verifiedAt: new Date().toISOString() },
      };
      await this.#apply(nextStored, 'openai');
      return this.status();
    });
  }

  deleteOpenAI(): Promise<ProviderSettingsStatus> {
    return this.#enqueue(async () => {
      this.#assertManageable(this.#baseConfig.openaiApiKey);
      const { openai: removed, ...nextStored } = this.#stored;
      void removed;
      await this.#apply(nextStored, 'openai');
      return this.status();
    });
  }

  saveSupadata(input: SupadataSettingsInput): Promise<ProviderSettingsStatus> {
    return this.#enqueue(async () => {
      this.#assertManageable(this.#baseConfig.supadataApiKey);
      const validated = parseSupadataInput(input);
      await this.#tester.testSupadata(validated);
      const nextStored: StoredProviderSettings = {
        ...this.#stored,
        supadata: { ...validated, verifiedAt: new Date().toISOString() },
      };
      await this.#apply(nextStored, 'supadata');
      return this.status();
    });
  }

  deleteSupadata(): Promise<ProviderSettingsStatus> {
    return this.#enqueue(async () => {
      this.#assertManageable(this.#baseConfig.supadataApiKey);
      const { supadata: removed, ...nextStored } = this.#stored;
      void removed;
      await this.#apply(nextStored, 'supadata');
      return this.status();
    });
  }

  async #apply(
    nextStored: StoredProviderSettings,
    changedProvider: 'openai' | 'supadata',
  ): Promise<void> {
    const effectiveConfig = resolveEffectiveConfig(this.#baseConfig, nextStored);
    const nextKnowledgeAndSpeech =
      changedProvider === 'openai'
        ? createKnowledgeAndSpeechProviders(effectiveConfig, this.#usage)
        : undefined;
    const nextYouTubeTranscriptProvider =
      changedProvider === 'supadata' ? createYouTubeTranscriptProvider(effectiveConfig) : undefined;
    try {
      await this.#store.write(nextStored);
    } catch {
      throw new ProviderSetupError(
        500,
        'PROVIDER_SETTINGS_WRITE_FAILED',
        'Provider settings could not be saved.',
      );
    }
    this.#stored = nextStored;
    if (nextKnowledgeAndSpeech) {
      this.#usage.knowledge.setLimit(effectiveConfig.aiBudgetUsd);
      this.#usage.audiobook.setLimit(effectiveConfig.audiobookSessionCharacterBudget);
      this.registry.replaceKnowledgeAndSpeech(nextKnowledgeAndSpeech);
    } else {
      this.registry.replaceYouTubeTranscriptProvider(nextYouTubeTranscriptProvider);
    }
  }

  #assertManageable(environmentKey?: string): void {
    if (!environmentKey) return;
    throw new ProviderSetupError(
      409,
      'PROVIDER_MANAGED_BY_ENVIRONMENT',
      'This provider is managed by the server environment.',
    );
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutation.then(operation, operation);
    this.#mutation = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function resolveEffectiveConfig(
  base: RuntimeConfig,
  stored: StoredProviderSettings,
): RuntimeConfig {
  const environmentOpenAI = base.openaiApiKey;
  const storedOpenAI = stored.openai;
  const openaiApiKey = environmentOpenAI ?? storedOpenAI?.apiKey;
  const environmentSupadata = base.supadataApiKey;
  const supadataApiKey = environmentSupadata ?? stored.supadata?.apiKey;
  const storedProviderEnabled = !environmentOpenAI && Boolean(storedOpenAI?.apiKey);
  const aiProvider =
    openaiApiKey && (base.aiProvider === 'openai' || storedProviderEnabled) ? 'openai' : 'mock';
  const {
    openaiApiKey: omittedOpenAIKey,
    supadataApiKey: omittedSupadataKey,
    ...baseWithoutProviderKeys
  } = base;
  void omittedOpenAIKey;
  void omittedSupadataKey;

  return {
    ...baseWithoutProviderKeys,
    aiProvider,
    ...(openaiApiKey ? { openaiApiKey } : {}),
    openaiModel: environmentOpenAI ? base.openaiModel : (storedOpenAI?.model ?? base.openaiModel),
    aiBudgetUsd: environmentOpenAI
      ? base.aiBudgetUsd
      : (storedOpenAI?.budgetUsd ?? base.aiBudgetUsd),
    openaiTtsModel: environmentOpenAI
      ? base.openaiTtsModel
      : (storedOpenAI?.ttsModel ?? base.openaiTtsModel),
    ...(supadataApiKey ? { supadataApiKey } : {}),
  };
}

function parseOpenAIInput(input: OpenAISettingsInput): OpenAISettingsInput {
  const result = OpenAISettingsInputSchema.safeParse(input);
  if (result.success) return result.data;
  throw new ProviderSetupError(400, 'VALIDATION_ERROR', 'Provider settings are invalid.');
}

function parseSupadataInput(input: SupadataSettingsInput): SupadataSettingsInput {
  const result = SupadataSettingsInputSchema.safeParse(input);
  if (result.success) return result.data;
  throw new ProviderSetupError(400, 'VALIDATION_ERROR', 'Provider settings are invalid.');
}

function sourceOf(environmentKey?: string, storedKey?: string): ProviderSettingsSource {
  if (environmentKey) return 'environment';
  if (storedKey) return 'stored';
  return 'missing';
}

function keyHint(key: string): string {
  return `••••${key.slice(-4)}`;
}

function safeOpenAISetupError(error: unknown): ProviderSetupError {
  const status = numericProperty(error, 'status');
  if (status === 401 || status === 403) {
    return new ProviderSetupError(
      422,
      'PROVIDER_AUTH_FAILED',
      'The provider rejected these credentials or model permissions.',
    );
  }
  if (status === 400 || status === 404 || status === 422) {
    return new ProviderSetupError(
      422,
      'PROVIDER_MODEL_UNAVAILABLE',
      'One of the selected provider models is unavailable.',
    );
  }
  if (status === 429) {
    return new ProviderSetupError(
      429,
      'PROVIDER_RATE_LIMITED',
      'The provider quota or rate limit prevented verification.',
    );
  }
  return providerUnavailable();
}

function providerUnavailable(): ProviderSetupError {
  return new ProviderSetupError(
    502,
    'PROVIDER_UNAVAILABLE',
    'The provider could not be reached for verification.',
  );
}

function numericProperty(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== 'object' || !(key in value)) return undefined;
  const property = (value as Record<string, unknown>)[key];
  return typeof property === 'number' ? property : undefined;
}

function hasCode(value: unknown, code: string): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'code' in value &&
    (value as Record<string, unknown>).code === code,
  );
}
