import type OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { OpenAISpeechProvider, SpeechProviderError } from '../src/openai-speech.js';
import {
  SupadataTranscriptProvider,
  TranscriptUnavailableError,
} from '../src/supadata-transcript.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('SupadataTranscriptProvider', () => {
  it('requests one native transcript and keeps timestamped segments', async () => {
    const fetchImpl = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.hostname === 'api.supadata.ai') {
        expect(url.pathname).toBe('/v1/transcript');
        expect(url.searchParams.get('url')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        expect(url.searchParams.get('mode')).toBe('native');
        expect(url.searchParams.get('text')).toBe('false');
        expect(url.searchParams.get('lang')).toBe('vi');
        expect(init?.headers).toEqual(
          expect.objectContaining({ 'x-api-key': 'test-supadata-key' }),
        );
        return Promise.resolve(
          jsonResponse({
            lang: 'vi',
            availableLangs: ['vi', 'en'],
            content: [
              { text: ' Câu thứ nhất. ', offset: 250, duration: 1_500, lang: 'vi' },
              { text: 'Câu thứ hai.', offset: 1_750, duration: 2_000, lang: 'vi' },
            ],
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({
          title: 'Video kiểm thử',
          author_name: 'Tác giả kiểm thử',
          thumbnail_url: 'https://i.ytimg.com/example.jpg',
        }),
      );
    });
    const provider = new SupadataTranscriptProvider({
      apiKey: 'test-supadata-key',
      fetchImpl,
    });

    const result = await provider.fetchTranscript(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'vi',
    );

    expect(result).toEqual(
      expect.objectContaining({
        title: 'Video kiểm thử',
        author: 'Tác giả kiểm thử',
        text: 'Câu thứ nhất. Câu thứ hai.',
        language: 'vi',
        availableLanguages: ['vi', 'en'],
      }),
    );
    expect(result.segments).toEqual([
      { text: 'Câu thứ nhất.', startMs: 250, endMs: 1_750 },
      { text: 'Câu thứ hai.', startMs: 1_750, endMs: 3_750 },
    ]);
  });

  it('polls an asynchronous transcript job and treats missing captions as unavailable', async () => {
    let jobPolls = 0;
    const sleep = vi.fn(() => Promise.resolve());
    const fetchImpl = vi.fn((input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === '/v1/transcript') {
        return Promise.resolve(jsonResponse({ jobId: 'job-123' }, 202));
      }
      if (url.pathname === '/v1/transcript/job-123') {
        jobPolls += 1;
        return Promise.resolve(
          jobPolls === 1
            ? jsonResponse({ status: 'queued' })
            : jsonResponse({ status: 'failed', error: 'caption-unavailable' }),
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    const provider = new SupadataTranscriptProvider({
      apiKey: 'test-supadata-key',
      fetchImpl,
      pollIntervalMs: 1,
      sleep,
    });

    await expect(
      provider.fetchTranscript('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ).rejects.toBeInstanceOf(TranscriptUnavailableError);
    expect(jobPolls).toBe(2);
    expect(sleep).toHaveBeenCalledOnce();
  });
});

describe('OpenAISpeechProvider', () => {
  it('requests WAV speech with the selected voice, instructions, speed and timeout', async () => {
    const bytes = new Uint8Array([82, 73, 70, 70]);
    const create = vi.fn((request: unknown, options?: unknown) => {
      void request;
      void options;
      return Promise.resolve({ arrayBuffer: () => Promise.resolve(bytes.buffer) });
    });
    const client = { audio: { speech: { create } } } as unknown as OpenAI;
    const provider = new OpenAISpeechProvider({
      apiKey: '',
      client,
      model: 'gpt-4o-mini-tts',
      timeoutMs: 12_345,
    });

    const result = await provider.synthesize({
      text: 'Đây là một đoạn ngắn để kiểm thử giọng đọc.',
      voice: 'coral',
      instructions: 'Đọc rõ ràng và ấm áp.',
      speed: 1.15,
    });

    expect(result).toEqual(Buffer.from(bytes));
    expect(create).toHaveBeenCalledWith(
      {
        model: 'gpt-4o-mini-tts',
        input: 'Đây là một đoạn ngắn để kiểm thử giọng đọc.',
        voice: 'coral',
        instructions: 'Đọc rõ ràng và ấm áp.',
        response_format: 'wav',
        speed: 1.15,
      },
      { timeout: 12_345 },
    );
  });

  it('turns provider authorization details into a safe public error', async () => {
    const create = vi.fn(() =>
      Promise.reject(
        Object.assign(new Error('private project identifier'), {
          status: 403,
          code: 'model_not_found',
        }),
      ),
    );
    const client = { audio: { speech: { create } } } as unknown as OpenAI;
    const provider = new OpenAISpeechProvider({ apiKey: '', client });

    const error = await provider
      .synthesize({
        text: 'Đây là một đoạn ngắn để kiểm thử lỗi quyền giọng đọc.',
        voice: 'coral',
        speed: 1,
      })
      .catch((reason: unknown) => reason);

    expect(error).toMatchObject({
      name: 'SpeechProviderError',
      code: 'SPEECH_MODEL_UNAVAILABLE',
      httpStatus: 503,
    } satisfies Partial<SpeechProviderError>);
    expect(error).toBeInstanceOf(SpeechProviderError);
    expect((error as Error).message).not.toContain('private project identifier');
  });

  it('omits unsupported style instructions for legacy TTS models', async () => {
    const bytes = new Uint8Array([82, 73, 70, 70]);
    const create = vi.fn((request: unknown, options?: unknown) => {
      void request;
      void options;
      return Promise.resolve({ arrayBuffer: () => Promise.resolve(bytes.buffer) });
    });
    const client = { audio: { speech: { create } } } as unknown as OpenAI;
    const provider = new OpenAISpeechProvider({ apiKey: '', client, model: 'tts-1' });

    await provider.synthesize({
      text: 'Đây là một đoạn ngắn để kiểm thử mô hình giọng đọc đời cũ.',
      voice: 'alloy',
      instructions: 'Đọc như kể chuyện.',
      speed: 1,
    });

    const request = create.mock.calls[0]?.[0];
    expect(request).toBeDefined();
    expect(request).not.toHaveProperty('instructions');
  });
});
