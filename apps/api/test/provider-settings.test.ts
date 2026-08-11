import { chmod, mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIKnowledgeModel } from '@360gnh/core';
import { loadConfig } from '../src/config.js';
import {
  FileProviderSettingsStore,
  ProviderSettingsService,
  ProviderSetupError,
  RemoteProviderConnectionTester,
} from '../src/provider-settings.js';
import type { ProviderConnectionTester } from '../src/provider-settings.js';
import {
  createKnowledgeAndSpeechProviders,
  createRuntimeProviderUsage,
} from '../src/provider-registry.js';

const temporaryDirectories: string[] = [];

async function temporarySettingsPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), '360gnh-provider-settings-'));
  temporaryDirectories.push(directory);
  return join(directory, 'provider-settings.json');
}

function connectionTester(): {
  tester: ProviderConnectionTester;
  testOpenAI: ReturnType<typeof vi.fn<ProviderConnectionTester['testOpenAI']>>;
  testSupadata: ReturnType<typeof vi.fn<ProviderConnectionTester['testSupadata']>>;
} {
  const testOpenAI = vi.fn<ProviderConnectionTester['testOpenAI']>(() => Promise.resolve());
  const testSupadata = vi.fn<ProviderConnectionTester['testSupadata']>(() => Promise.resolve());
  return { tester: { testOpenAI, testSupadata }, testOpenAI, testSupadata };
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('ProviderSettingsService', () => {
  it('starts key-free, persists a verified OpenAI key with private permissions, and reloads it', async () => {
    const settingsPath = await temporarySettingsPath();
    const connection = connectionTester();
    const config = loadConfig({
      HOST: '127.0.0.1',
      AI_PROVIDER: 'mock',
      PROVIDER_SETTINGS_PATH: settingsPath,
    });
    const service = await ProviderSettingsService.bootstrap(config, { tester: connection.tester });

    expect(service.registry.provider).toBe('local');
    const initialStatus = service.status();
    expect(initialStatus.setupRecommended).toBe(true);
    expect(initialStatus.openai).toMatchObject({ configured: false, source: 'missing' });
    expect(initialStatus.supadata).toMatchObject({ configured: false, source: 'missing' });

    const status = await service.saveOpenAI({
      apiKey: 'test-openai-key-12345678',
      model: 'gpt-5.6-luna',
      budgetUsd: 2,
      ttsModel: 'gpt-4o-mini-tts',
    });

    expect(connection.testOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-openai-key-12345678',
      model: 'gpt-5.6-luna',
      ttsModel: 'gpt-4o-mini-tts',
    });
    expect(service.registry.provider).toBe('openai');
    expect(service.registry.audiobookRenderer).toBeDefined();
    expect(status.openai).toEqual(
      expect.objectContaining({
        configured: true,
        source: 'stored',
        keyHint: '••••5678',
        model: 'gpt-5.6-luna',
        budgetUsd: 2,
      }),
    );
    expect(JSON.stringify(status)).not.toContain('test-openai-key');

    const storedText = await readFile(settingsPath, 'utf8');
    expect(storedText).toContain('test-openai-key-12345678');
    expect((await stat(settingsPath)).mode & 0o777).toBe(0o600);

    const restarted = await ProviderSettingsService.bootstrap(config, {
      tester: connectionTester().tester,
    });
    expect(restarted.registry.provider).toBe('openai');
    expect(restarted.status().openai.keyHint).toBe('••••5678');
  });

  it('keeps the current runtime and file unchanged when provider verification fails', async () => {
    const settingsPath = await temporarySettingsPath();
    const tester: ProviderConnectionTester = {
      testOpenAI: vi.fn(() =>
        Promise.reject(
          new ProviderSetupError(
            422,
            'PROVIDER_AUTH_FAILED',
            'The provider rejected these credentials.',
          ),
        ),
      ),
      testSupadata: vi.fn(() => Promise.resolve()),
    };
    const service = await ProviderSettingsService.bootstrap(
      loadConfig({
        HOST: '127.0.0.1',
        AI_PROVIDER: 'mock',
        PROVIDER_SETTINGS_PATH: settingsPath,
      }),
      { tester },
    );

    await expect(
      service.saveOpenAI({
        apiKey: 'rejected-openai-key',
        model: 'gpt-5.6-luna',
        budgetUsd: 1,
        ttsModel: 'gpt-4o-mini-tts',
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_AUTH_FAILED' });

    expect(service.registry.provider).toBe('local');
    expect(service.status().openai.configured).toBe(false);
    await expect(readFile(settingsPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('uses environment credentials as read-only overrides', async () => {
    const settingsPath = await temporarySettingsPath();
    const connection = connectionTester();
    const service = await ProviderSettingsService.bootstrap(
      loadConfig({
        HOST: '127.0.0.1',
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'environment-openai-key',
        SUPADATA_API_KEY: 'environment-supadata-key',
        PROVIDER_SETTINGS_PATH: settingsPath,
      }),
      { tester: connection.tester },
    );

    const status = service.status();
    expect(status.setupRecommended).toBe(false);
    expect(status.openai).toMatchObject({ configured: true, source: 'environment' });
    expect(status.supadata).toMatchObject({ configured: true, source: 'environment' });
    expect(JSON.stringify(service.status())).not.toContain('environment-openai-key');

    await expect(
      service.saveOpenAI({
        apiKey: 'replacement-openai-key',
        model: 'gpt-5.6-luna',
        budgetUsd: 1,
        ttsModel: 'gpt-4o-mini-tts',
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_MANAGED_BY_ENVIRONMENT', status: 409 });
    await expect(service.deleteSupadata()).rejects.toMatchObject({
      code: 'PROVIDER_MANAGED_BY_ENVIRONMENT',
      status: 409,
    });
    expect(connection.testOpenAI).not.toHaveBeenCalled();
  });

  it('reports an environment OpenAI key as speech-only when the knowledge model stays local', async () => {
    const service = await ProviderSettingsService.bootstrap(
      loadConfig({
        HOST: '127.0.0.1',
        AI_PROVIDER: 'mock',
        OPENAI_API_KEY: 'environment-openai-key',
        PROVIDER_SETTINGS_PATH: await temporarySettingsPath(),
      }),
      { tester: connectionTester().tester },
    );

    expect(service.registry.provider).toBe('local');
    expect(service.registry.audiobookRenderer).toBeDefined();
    expect(service.status().openai).toMatchObject({
      configured: true,
      source: 'environment',
      knowledgeModelEnabled: false,
    });
  });

  it('applies and removes stored Supadata and OpenAI providers without restarting', async () => {
    const settingsPath = await temporarySettingsPath();
    const connection = connectionTester();
    const service = await ProviderSettingsService.bootstrap(
      loadConfig({
        HOST: '127.0.0.1',
        AI_PROVIDER: 'mock',
        PROVIDER_SETTINGS_PATH: settingsPath,
      }),
      { tester: connection.tester },
    );

    await service.saveSupadata({ apiKey: 'test-supadata-key-87654321' });
    expect(service.registry.youtubeTranscriptProvider).toBeDefined();
    expect(service.status().supadata.keyHint).toBe('••••4321');

    await service.saveOpenAI({
      apiKey: 'test-openai-key-12345678',
      model: 'gpt-5.6-terra',
      budgetUsd: 3,
      ttsModel: 'tts-1',
    });
    expect(service.registry.provider).toBe('openai');
    const audiobookRenderer = service.registry.audiobookRenderer;

    await service.deleteSupadata();
    expect(service.registry.youtubeTranscriptProvider).toBeUndefined();
    expect(service.registry.audiobookRenderer).toBe(audiobookRenderer);
    expect(service.status().supadata.configured).toBe(false);

    await service.deleteOpenAI();
    expect(service.registry.provider).toBe('local');
    expect(service.registry.audiobookRenderer).toBeUndefined();
    expect(service.status().openai.configured).toBe(false);
  });

  it('rejects malformed or oversized stored settings before constructing providers', async () => {
    const settingsPath = await temporarySettingsPath();
    const store = new FileProviderSettingsStore(settingsPath);
    await expect(
      store.write({
        version: 1,
        openai: {
          apiKey: 'x'.repeat(501),
          model: 'gpt-5.6-luna',
          budgetUsd: 1,
          ttsModel: 'gpt-4o-mini-tts',
        },
      }),
    ).rejects.toThrow(/settings/i);
  });
});

describe('RemoteProviderConnectionTester', () => {
  it('checks both selected OpenAI models without creating billable content', async () => {
    const retrieve = vi.fn(() => Promise.resolve({ id: 'available-model' }));
    const tester = new RemoteProviderConnectionTester({
      openAIClientFactory: () => ({ models: { retrieve } }),
      timeoutMs: 1_234,
    });

    await tester.testOpenAI({
      apiKey: 'test-openai-key',
      model: 'gpt-5.6-luna',
      ttsModel: 'gpt-4o-mini-tts',
    });

    expect(retrieve).toHaveBeenCalledTimes(2);
    expect(retrieve).toHaveBeenCalledWith('gpt-5.6-luna', {
      maxRetries: 0,
      timeout: 1_234,
    });
    expect(retrieve).toHaveBeenCalledWith('gpt-4o-mini-tts', {
      maxRetries: 0,
      timeout: 1_234,
    });
  });

  it('maps OpenAI authentication details to a safe public error', async () => {
    const tester = new RemoteProviderConnectionTester({
      openAIClientFactory: () => ({
        models: {
          retrieve: () =>
            Promise.reject(
              Object.assign(new Error('secret project and account details'), { status: 401 }),
            ),
        },
      }),
    });

    const error = await tester
      .testOpenAI({
        apiKey: 'rejected-openai-key',
        model: 'gpt-5.6-luna',
        ttsModel: 'gpt-4o-mini-tts',
      })
      .catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code: 'PROVIDER_AUTH_FAILED', status: 422 });
    expect((error as Error).message).not.toContain('project');
    expect((error as Error).message).not.toContain('account');
  });

  it('verifies Supadata through the free missing-job path and never puts the key in the URL', async () => {
    const fetchImpl = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      expect(url.origin).toBe('https://api.supadata.ai');
      expect(url.pathname).toBe('/v1/transcript/00000000-0000-4000-8000-000000000000');
      expect(url.toString()).not.toContain('test-supadata-key');
      expect(init?.headers).toEqual(expect.objectContaining({ 'x-api-key': 'test-supadata-key' }));
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
    const tester = new RemoteProviderConnectionTester({ fetchImpl });

    await tester.testSupadata({ apiKey: 'test-supadata-key' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe('provider-settings secret packaging boundary', () => {
  it('excludes the entire runtime settings directory from Git and Docker contexts', async () => {
    const [gitIgnore, dockerIgnore] = await Promise.all([
      readFile(new URL('../../../.gitignore', import.meta.url), 'utf8'),
      readFile(new URL('../../../.dockerignore', import.meta.url), 'utf8'),
    ]);

    expect(gitIgnore).toMatch(/^apps\/api\/data\/\*\*$/m);
    expect(dockerIgnore).toMatch(/^apps\/api\/data\/\*\*$/m);
  });

  it('uses a package-anchored default when the optional environment value is blank', async () => {
    const originalWorkingDirectory = process.cwd();
    const unrelatedDirectory = await mkdtemp(join(tmpdir(), '360gnh-unrelated-cwd-'));
    temporaryDirectories.push(unrelatedDirectory);
    try {
      process.chdir(unrelatedDirectory);
      const config = loadConfig({ HOST: '127.0.0.1', PROVIDER_SETTINGS_PATH: '   ' });
      expect(config.providerSettingsPath).toBe(
        fileURLToPath(new URL('../data/provider-settings.json', import.meta.url)),
      );
    } finally {
      process.chdir(originalWorkingDirectory);
    }
  });

  it('does not change permissions on an existing operator-selected parent directory', async () => {
    const settingsPath = await temporarySettingsPath();
    const directory = dirname(settingsPath);
    await chmod(directory, 0o755);

    await new FileProviderSettingsStore(settingsPath).write({ version: 1 });

    expect((await stat(directory)).mode & 0o777).toBe(0o755);
    expect((await stat(settingsPath)).mode & 0o777).toBe(0o600);
  });

  it('makes a newly created dedicated settings directory private', async () => {
    const root = await mkdtemp(join(tmpdir(), '360gnh-provider-root-'));
    temporaryDirectories.push(root);
    const directory = join(root, 'private-settings');
    const settingsPath = join(directory, 'provider-settings.json');

    await new FileProviderSettingsStore(settingsPath).write({ version: 1 });

    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(settingsPath)).mode & 0o777).toBe(0o600);
  });
});

describe('provider runtime usage continuity', () => {
  it('keeps OpenAI spend when a provider object is rebuilt', () => {
    const config = loadConfig({
      HOST: '127.0.0.1',
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'test-openai-key',
      AI_BUDGET_USD: '1',
    });
    const usage = createRuntimeProviderUsage(config);
    usage.knowledge.record({
      provider: 'openai',
      model: config.openaiModel,
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUsd: 0.25,
      latencyMs: 1,
    });

    const replacement = createKnowledgeAndSpeechProviders(config, usage).model;

    expect(replacement).toBeInstanceOf(OpenAIKnowledgeModel);
    if (!(replacement instanceof OpenAIKnowledgeModel)) {
      throw new Error('Expected the OpenAI model adapter');
    }
    expect(replacement.budgetSnapshot()).toMatchObject({
      limitUsd: 1,
      spentUsd: 0.25,
      remainingUsd: 0.75,
      calls: 1,
    });
  });
});
