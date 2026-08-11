import type {
  ImportedYouTubeTranscript,
  TranscriptSegment,
  YouTubeTranscriptProvider,
} from '@360gnh/core';
import { extractYouTubeVideoId } from '@360gnh/core';
import { z } from 'zod';

const SUPADATA_API_BASE = 'https://api.supadata.ai/v1';
const MAX_TRANSCRIPT_CHARACTERS = 250_000;

const SegmentSchema = z.object({
  text: z.string().max(10_000),
  offset: z.number().nonnegative(),
  duration: z.number().nonnegative(),
  lang: z.string().optional(),
});
const PayloadSchema = z
  .object({
    content: z.union([z.string().max(250_000), z.array(SegmentSchema).max(20_000)]).optional(),
    jobId: z.string().min(1).optional(),
    status: z.enum(['queued', 'active', 'completed', 'failed']).optional(),
    error: z.unknown().optional(),
    lang: z.string().optional(),
    availableLangs: z.array(z.string()).optional(),
  })
  .passthrough();

type TranscriptPayload = z.infer<typeof PayloadSchema>;

export class TranscriptUnavailableError extends Error {
  readonly code = 'TRANSCRIPT_UNAVAILABLE';

  constructor() {
    super('Video này không có phụ đề công khai để nhập.');
    this.name = 'TranscriptUnavailableError';
  }
}

export class TranscriptProviderError extends Error {
  readonly code = 'TRANSCRIPT_PROVIDER_ERROR';

  constructor() {
    super('Dịch vụ lấy phụ đề đang bận hoặc phản hồi sai. Hãy thử lại sau.');
    this.name = 'TranscriptProviderError';
  }
}

export interface SupadataTranscriptProviderOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  jobTimeoutMs?: number;
  pollIntervalMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export class SupadataTranscriptProvider implements YouTubeTranscriptProvider {
  readonly id = 'supadata';
  readonly #apiKey: string;
  readonly #fetch: typeof fetch;
  readonly #requestTimeoutMs: number;
  readonly #jobTimeoutMs: number;
  readonly #pollIntervalMs: number;
  readonly #sleep: (milliseconds: number) => Promise<void>;

  constructor(options: SupadataTranscriptProviderOptions) {
    const apiKey = options.apiKey.trim();
    if (!apiKey) throw new Error('Supadata API key is required');
    this.#apiKey = apiKey;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    this.#jobTimeoutMs = options.jobTimeoutMs ?? 120_000;
    this.#pollIntervalMs = options.pollIntervalMs ?? 1_000;
    this.#sleep =
      options.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async fetchTranscript(
    canonicalUrl: string,
    language?: string,
  ): Promise<ImportedYouTubeTranscript> {
    const videoId = extractYouTubeVideoId(canonicalUrl);
    if (!videoId) throw new Error('A canonical YouTube URL is required');
    const params = new URLSearchParams({ url: canonicalUrl, text: 'false', mode: 'native' });
    if (language) params.set('lang', language);
    const payload = await this.#resolvePayload(params);
    const normalized = normalizeContent(payload.content);
    const preview = await this.#fetchPreview(canonicalUrl);
    return {
      title: preview?.title ?? `YouTube Video ${videoId}`,
      sourceUrl: canonicalUrl,
      text: normalized.text,
      ...(payload.lang ? { language: payload.lang } : {}),
      ...(payload.availableLangs ? { availableLanguages: payload.availableLangs } : {}),
      ...(normalized.segments ? { segments: normalized.segments } : {}),
      ...(preview?.author ? { author: preview.author } : {}),
      ...(preview?.thumbnailUrl ? { thumbnailUrl: preview.thumbnailUrl } : {}),
    };
  }

  async #resolvePayload(params: URLSearchParams): Promise<TranscriptPayload> {
    const initial = await this.#request('/transcript', params);
    if (!initial.jobId) return requireContent(initial);

    const deadline = Date.now() + this.#jobTimeoutMs;
    while (Date.now() < deadline) {
      const result = await this.#request(`/transcript/${encodeURIComponent(initial.jobId)}`);
      if (result.status === 'completed') return requireContent(result);
      if (result.status === 'failed') {
        if (isUnavailableError(result.error)) throw new TranscriptUnavailableError();
        throw new TranscriptProviderError();
      }
      await this.#sleep(this.#pollIntervalMs);
    }
    throw new TranscriptProviderError();
  }

  async #request(path: string, params?: URLSearchParams): Promise<TranscriptPayload> {
    const url = new URL(`${SUPADATA_API_BASE}${path}`);
    if (params) url.search = params.toString();
    let response: Response;
    try {
      response = await this.#fetch(url, {
        headers: { accept: 'application/json', 'x-api-key': this.#apiKey },
        signal: AbortSignal.timeout(this.#requestTimeoutMs),
      });
    } catch {
      throw new TranscriptProviderError();
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (response.status === 206 || isUnavailableError(body)) throw new TranscriptUnavailableError();
    if (!response.ok) throw new TranscriptProviderError();
    const parsed = PayloadSchema.safeParse(body);
    if (!parsed.success) throw new TranscriptProviderError();
    return parsed.data;
  }

  async #fetchPreview(
    canonicalUrl: string,
  ): Promise<{ title: string; author: string; thumbnailUrl?: string } | null> {
    const url = new URL('https://www.youtube.com/oembed');
    url.search = new URLSearchParams({ url: canonicalUrl, format: 'json' }).toString();
    try {
      const response = await this.#fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(Math.min(this.#requestTimeoutMs, 10_000)),
      });
      if (!response.ok) return null;
      const body = z
        .object({
          title: z.string().trim().min(1),
          author_name: z.string().trim().min(1),
          thumbnail_url: z.url().optional(),
        })
        .safeParse(await response.json());
      if (!body.success) return null;
      return {
        title: body.data.title.trim(),
        author: body.data.author_name.trim(),
        ...(body.data.thumbnail_url ? { thumbnailUrl: body.data.thumbnail_url } : {}),
      };
    } catch {
      return null;
    }
  }
}

function requireContent(payload: TranscriptPayload): TranscriptPayload {
  if (payload.content === undefined) throw new TranscriptProviderError();
  return payload;
}

function normalizeContent(content: TranscriptPayload['content']): {
  text: string;
  segments?: TranscriptSegment[];
} {
  if (typeof content === 'string') {
    const text = content.replace(/\s+/gu, ' ').trim();
    if (!text) throw new TranscriptUnavailableError();
    return { text };
  }
  if (!Array.isArray(content)) throw new TranscriptProviderError();
  let totalCharacters = 0;
  const segments = content.flatMap((segment) => {
    const text = segment.text.replace(/\s+/gu, ' ').trim();
    if (!text) return [];
    totalCharacters += text.length;
    if (totalCharacters > MAX_TRANSCRIPT_CHARACTERS) throw new TranscriptProviderError();
    return [
      {
        text,
        startMs: Math.round(segment.offset),
        endMs: Math.round(segment.offset + segment.duration),
      },
    ];
  });
  const text = segments
    .map((segment) => segment.text)
    .join(' ')
    .trim();
  if (!text) throw new TranscriptUnavailableError();
  return { text, segments };
}

function isUnavailableError(value: unknown): boolean {
  if (typeof value === 'string') return /transcript-unavailable|caption-unavailable/i.test(value);
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(
    (item) => typeof item === 'string' && /transcript-unavailable|caption-unavailable/i.test(item),
  );
}
