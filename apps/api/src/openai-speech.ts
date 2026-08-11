import type { SpeechProvider, SpeechSynthesisInput } from '@360gnh/core';
import OpenAI from 'openai';

export interface OpenAISpeechProviderOptions {
  apiKey: string;
  model?: string;
  client?: OpenAI;
  timeoutMs?: number;
}

export class SpeechProviderError extends Error {
  constructor(
    readonly code: 'SPEECH_MODEL_UNAVAILABLE' | 'SPEECH_PROVIDER_ERROR',
    message: string,
    readonly httpStatus: 502 | 503,
  ) {
    super(message);
    this.name = 'SpeechProviderError';
  }
}

export class OpenAISpeechProvider implements SpeechProvider {
  readonly id = 'openai';
  readonly model: string;
  // The installed SDK currently accepts 4096 characters. Leave headroom for
  // normalization differences and future provider-side validation changes.
  readonly maxInputCharacters = 3_500;
  readonly #client: OpenAI;
  readonly #timeoutMs: number;

  constructor(options: OpenAISpeechProviderOptions) {
    if (!options.apiKey.trim() && !options.client) throw new Error('OpenAI API key is required');
    this.model = options.model?.trim() || 'gpt-4o-mini-tts';
    this.#client = options.client ?? new OpenAI({ apiKey: options.apiKey });
    this.#timeoutMs = options.timeoutMs ?? 180_000;
  }

  async synthesize(input: SpeechSynthesisInput): Promise<Buffer> {
    try {
      const supportsInstructions = !['tts-1', 'tts-1-hd'].includes(this.model);
      const response = await withTransientRetry(() =>
        this.#client.audio.speech.create(
          {
            model: this.model,
            input: input.text,
            voice: input.voice,
            ...(input.instructions && supportsInstructions
              ? { instructions: input.instructions }
              : {}),
            response_format: 'wav',
            speed: input.speed,
          },
          { timeout: this.#timeoutMs },
        ),
      );
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw publicSpeechError(error);
    }
  }
}

function publicSpeechError(error: unknown): SpeechProviderError {
  const status = numericProperty(error, 'status');
  const code = stringProperty(error, 'code');
  if (status === 403 || code === 'model_not_found') {
    return new SpeechProviderError(
      'SPEECH_MODEL_UNAVAILABLE',
      'Khóa máy chủ chưa được cấp quyền cho mô hình giọng đọc đã chọn.',
      503,
    );
  }
  return new SpeechProviderError(
    'SPEECH_PROVIDER_ERROR',
    'Dịch vụ giọng đọc đang bận hoặc trả về dữ liệu không hợp lệ.',
    502,
  );
}

function numericProperty(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== 'object' || !(key in value)) return undefined;
  const property = (value as Record<string, unknown>)[key];
  return typeof property === 'number' ? property : undefined;
}

function stringProperty(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object' || !(key in value)) return undefined;
  const property = (value as Record<string, unknown>)[key];
  return typeof property === 'string' ? property : undefined;
}

async function withTransientRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** attempt));
    }
  }
  throw lastError;
}

function isTransient(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = 'status' in error && typeof error.status === 'number' ? error.status : undefined;
  return (
    status === 408 || status === 409 || status === 429 || (status !== undefined && status >= 500)
  );
}
