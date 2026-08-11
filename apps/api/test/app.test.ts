import { InMemoryKnowledgeRepository, KnowledgeStudio, MockKnowledgeModel } from '@360gnh/core';
import type { AnswerResult, KnowledgeSource, LearnerQuiz, QuizGrade } from '@360gnh/core';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

function makeApp(apiToken?: string) {
  const studio = new KnowledgeStudio(new InMemoryKnowledgeRepository(), new MockKnowledgeModel());
  return createApp({ studio, ...(apiToken ? { apiToken } : {}) });
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
