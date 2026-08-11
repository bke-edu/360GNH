import {
  AudiobookRenderer,
  InMemoryKnowledgeRepository,
  KnowledgeStudio,
  MockKnowledgeModel,
} from '@360gnh/core';
import type {
  AnswerResult,
  KnowledgeSource,
  LearnerQuiz,
  QuizGrade,
  SpeechProvider,
  YouTubeTranscriptProvider,
} from '@360gnh/core';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { SpeechProviderError } from '../src/openai-speech.js';

function makeApp(
  apiToken?: string,
  media?: {
    youtubeTranscriptProvider?: YouTubeTranscriptProvider;
    audiobookRenderer?: AudiobookRenderer;
  },
) {
  const studio = new KnowledgeStudio(new InMemoryKnowledgeRepository(), new MockKnowledgeModel());
  return createApp({ studio, ...(apiToken ? { apiToken } : {}), ...media });
}

function pcmWave(samples: number[]): Buffer {
  const data = Buffer.from(samples);
  const wave = Buffer.alloc(44 + data.length);
  wave.write('RIFF', 0, 'ascii');
  wave.writeUInt32LE(36 + data.length, 4);
  wave.write('WAVE', 8, 'ascii');
  wave.write('fmt ', 12, 'ascii');
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(24_000, 24);
  wave.writeUInt32LE(48_000, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write('data', 36, 'ascii');
  wave.writeUInt32LE(data.length, 40);
  data.copy(wave, 44);
  return wave;
}

interface DataEnvelope<T> {
  data: T;
}

interface ErrorEnvelope {
  error: { code: string; message: string };
}

function parseBody<T>(response: { text: string }): T {
  const parsed: unknown = JSON.parse(response.text);
  return parsed as T;
}

describe('HTTP API', () => {
  it('reports health without exposing framework metadata', async () => {
    const response = await request(makeApp()).get('/health').expect(200);
    expect(parseBody<{ status: string }>(response)).toEqual({ status: 'ok' });
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('seeds an original demo source and answers with citations', async () => {
    const app = makeApp();
    const seed = await request(app).post('/api/v1/demo/seed').send({}).expect(201);
    const sourceId = parseBody<DataEnvelope<KnowledgeSource>>(seed).data.id;
    const answer = await request(app)
      .post('/api/v1/chat')
      .send({
        query: 'Ôn cách quãng hoạt động thế nào?',
        sourceIds: [sourceId],
      })
      .expect(200);
    const answerBody = parseBody<DataEnvelope<AnswerResult>>(answer);
    expect(answerBody.data.answer).toContain('Ôn cách quãng');
    expect(answerBody.data.citations.length).toBeGreaterThan(0);
  });

  it('validates input before ingest and does not fetch source URLs', async () => {
    const app = makeApp();
    const invalid = await request(app)
      .post('/api/v1/sources')
      .send({
        title: 'Quá ngắn',
        text: 'vài chữ',
        sourceUrl: 'file:///etc/passwd',
      })
      .expect(400);
    expect(parseBody<ErrorEnvelope>(invalid).error.code).toBe('VALIDATION_ERROR');
  });

  it('keeps quiz answers on the server before grading', async () => {
    const app = makeApp();
    const seed = await request(app).post('/api/v1/demo/seed').send({}).expect(201);
    const quizResponse = await request(app)
      .post('/api/v1/quiz')
      .send({
        query: 'học bền',
        sourceIds: [parseBody<DataEnvelope<KnowledgeSource>>(seed).data.id],
        count: 3,
      })
      .expect(200);
    const quiz = parseBody<DataEnvelope<LearnerQuiz>>(quizResponse).data;
    const first = quiz.questions[0];
    if (!first) throw new Error('Expected at least one quiz question');
    const selectedAnswer = first.options?.[0];
    if (!selectedAnswer) throw new Error('Expected a multiple-choice answer');
    expect(first).not.toHaveProperty('correctAnswer');
    expect(first).not.toHaveProperty('explanation');
    const grade = await request(app)
      .post(`/api/v1/quiz/${quiz.id}/grade`)
      .send({ answers: { [first.id]: selectedAnswer } })
      .expect(200);
    const gradeBody = parseBody<DataEnvelope<QuizGrade>>(grade);
    expect(gradeBody.data.score).toBe(1);
    expect(gradeBody.data.details[0]).toHaveProperty('correctAnswer');
    await request(app)
      .post('/api/v1/quiz/00000000-0000-0000-0000-000000000000/grade')
      .send({ answers: {} })
      .expect(404);
  });

  it('requires a bearer token when configured', async () => {
    const app = makeApp('not-a-real-secret');
    await request(app).get('/api/v1/sources').expect(401);
    await request(app)
      .get('/api/v1/sources')
      .set('Authorization', 'Bearer not-a-real-secret')
      .expect(200);
  });

  it('rejects unknown debate personas', async () => {
    const app = makeApp();
    const seed = await request(app).post('/api/v1/demo/seed').send({}).expect(201);
    const response = await request(app)
      .post('/api/v1/debate')
      .send({
        query: 'Đọc lại có đủ không?',
        sourceIds: [parseBody<DataEnvelope<KnowledgeSource>>(seed).data.id],
        agentIds: ['evidence-auditor', 'invented-agent'],
      })
      .expect(400);
    expect(parseBody<ErrorEnvelope>(response).error.code).toBe('UNKNOWN_AGENT');
  });

  it('does not expose internal failures to callers', async () => {
    const model = new MockKnowledgeModel();
    model.answer = () => Promise.reject(new Error('provider-internal-detail'));
    const studio = new KnowledgeStudio(new InMemoryKnowledgeRepository(), model);
    const app = createApp({ studio });
    const seed = await request(app).post('/api/v1/demo/seed').send({}).expect(201);
    const response = await request(app)
      .post('/api/v1/chat')
      .send({
        query: 'Một câu hỏi hợp lệ',
        sourceIds: [parseBody<DataEnvelope<KnowledgeSource>>(seed).data.id],
      })
      .expect(500);

    expect(parseBody<ErrorEnvelope>(response)).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' },
    });
    expect(response.text).not.toContain('provider-internal-detail');
  });

  it('imports one YouTube transcript and edits it only after an explicit request', async () => {
    const youtubeTranscriptProvider: YouTubeTranscriptProvider = {
      id: 'test-transcript',
      fetchTranscript: (sourceUrl) =>
        Promise.resolve({
          title: 'Video nhập thử',
          sourceUrl,
          text: 'Đây là nội dung phụ đề đủ dài để đi qua cửa kiểm tra và được biên tập thành tài liệu.',
          language: 'vi',
          availableLanguages: ['vi'],
          segments: [
            {
              text: 'Đây là nội dung phụ đề đủ dài để đi qua cửa kiểm tra.',
              startMs: 0,
              endMs: 5_000,
            },
          ],
        }),
    };
    const app = makeApp(undefined, { youtubeTranscriptProvider });

    const importedResponse = await request(app)
      .post('/api/v1/youtube/import')
      .send({ url: 'https://youtu.be/dQw4w9WgXcQ', language: 'vi' })
      .expect(201);
    const imported = parseBody<DataEnvelope<KnowledgeSource>>(importedResponse).data;
    expect(imported.rawText).toBe(imported.text);
    expect(imported.editedText).toBeUndefined();

    const editedResponse = await request(app)
      .post(`/api/v1/sources/${imported.id}/edit`)
      .send({ targetLanguage: 'source' })
      .expect(200);
    const edited = parseBody<DataEnvelope<KnowledgeSource>>(editedResponse).data;
    expect(edited.editedText).toContain('Đây là nội dung phụ đề');
    expect(edited.rawText).toBe(imported.rawText);
  });

  it('renders one audiobook file and leaves bulk download out of the public API', async () => {
    const speechProvider: SpeechProvider = {
      id: 'test-speech',
      model: 'test-voice',
      maxInputCharacters: 4_096,
      synthesize: () => Promise.resolve(pcmWave([1, 2, 3, 4])),
    };
    const audiobookRenderer = new AudiobookRenderer(speechProvider, {
      maxBookCharacters: 20_000,
      maxSessionCharacters: 40_000,
    });
    const app = makeApp(undefined, { audiobookRenderer });
    const sourceResponse = await request(app)
      .post('/api/v1/sources')
      .send({
        title: 'Nguồn để đọc',
        text: 'Đây là nội dung dùng để dựng một tệp sách nói duy nhất và kiểm tra phản hồi nhị phân.',
      })
      .expect(201);
    const source = parseBody<DataEnvelope<KnowledgeSource>>(sourceResponse).data;

    const audio = await request(app)
      .post('/api/v1/audiobooks/render')
      .send({ sourceId: source.id, voice: 'coral', style: 'narrative', speed: 1 })
      .expect(200)
      .expect('Content-Type', /audio\/wav/);

    expect(audio.headers['content-disposition']).toContain('360gnh-audiobook.wav');
    expect(audio.headers['x-audiobook-chunks']).toBe('1');
    await request(app).post('/api/v1/audiobooks/bulk-download').send({}).expect(404);
  });

  it('returns a safe actionable error when the speech model is not authorized', async () => {
    const speechProvider: SpeechProvider = {
      id: 'test-speech',
      model: 'restricted-voice',
      maxInputCharacters: 4_096,
      synthesize: () =>
        Promise.reject(
          new SpeechProviderError(
            'SPEECH_MODEL_UNAVAILABLE',
            'Khóa máy chủ chưa được cấp quyền cho mô hình giọng đọc đã chọn.',
            503,
          ),
        ),
    };
    const app = makeApp(undefined, {
      audiobookRenderer: new AudiobookRenderer(speechProvider, {
        maxBookCharacters: 20_000,
        maxSessionCharacters: 40_000,
      }),
    });
    const sourceResponse = await request(app)
      .post('/api/v1/sources')
      .send({
        title: 'Nguồn lỗi quyền',
        text: 'Đây là nội dung đủ dài để đi đến nhà cung cấp giọng đọc và kiểm tra lỗi quyền.',
      })
      .expect(201);
    const source = parseBody<DataEnvelope<KnowledgeSource>>(sourceResponse).data;

    const response = await request(app)
      .post('/api/v1/audiobooks/render')
      .send({ sourceId: source.id, voice: 'coral', style: 'narrative', speed: 1 })
      .expect(503);

    expect(parseBody<ErrorEnvelope>(response)).toEqual({
      error: {
        code: 'SPEECH_MODEL_UNAVAILABLE',
        message: 'Khóa máy chủ chưa được cấp quyền cho mô hình giọng đọc đã chọn.',
      },
    });
  });

  it('reports unavailable media adapters without pretending the workflow succeeded', async () => {
    const app = makeApp();
    const meta = await request(app).get('/api/v1/meta').expect(200);
    expect(
      parseBody<DataEnvelope<{ features: Record<string, boolean> }>>(meta).data.features,
    ).toEqual(expect.objectContaining({ youtubeImport: false, audiobook: false }));
    await request(app)
      .post('/api/v1/youtube/import')
      .send({ url: 'https://youtu.be/dQw4w9WgXcQ' })
      .expect(503);
  });
});

describe('runtime configuration', () => {
  it('fails closed when exposed on the network without a token', () => {
    expect(() => loadConfig({ HOST: '0.0.0.0', AI_PROVIDER: 'mock' })).toThrow(/API_TOKEN/);
  });

  it('requires an OpenAI key only for the real provider', () => {
    expect(() =>
      loadConfig({
        HOST: '127.0.0.1',
        AI_PROVIDER: 'openai',
        AI_BUDGET_USD: '1',
      }),
    ).toThrow(/OPENAI_API_KEY/);
    expect(loadConfig({ HOST: '127.0.0.1', AI_PROVIDER: 'mock' }).aiProvider).toBe('mock');
  });
});
