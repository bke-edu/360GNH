import type {
  AnswerResult,
  DebateResult,
  KnowledgeSource,
  Mindmap,
  Quiz,
  QuizGrade,
  SmartClip,
  StudioMeta,
  StudyGuide,
} from './types.js';

interface Envelope<T> {
  data: T;
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as Envelope<T> & ErrorEnvelope;
  if (!response.ok) {
    throw new ApiError(
      body.error?.message ?? `Yêu cầu thất bại (${response.status})`,
      response.status,
      body.error?.code,
    );
  }
  return body.data;
}

const post = <T>(path: string, body: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const studioApi = {
  meta: (): Promise<StudioMeta> => request('/api/v1/meta'),
  listSources: (): Promise<KnowledgeSource[]> => request('/api/v1/sources'),
  seedDemo: (): Promise<KnowledgeSource> => post('/api/v1/demo/seed', {}),
  addSource: (input: {
    title: string;
    text: string;
    sourceUrl?: string;
  }): Promise<KnowledgeSource> => post('/api/v1/sources', input),
  answer: (query: string, sourceIds: string[]): Promise<AnswerResult> =>
    post('/api/v1/chat', { query, sourceIds }),
  mindmap: (query: string, sourceIds: string[]): Promise<Mindmap> =>
    post('/api/v1/mindmap', { query, sourceIds }),
  quiz: (query: string, sourceIds: string[]): Promise<Quiz> =>
    post('/api/v1/quiz', { query, sourceIds, count: 5 }),
  gradeQuiz: (id: string, answers: Record<string, string>): Promise<QuizGrade> =>
    post(`/api/v1/quiz/${encodeURIComponent(id)}/grade`, { answers }),
  studyGuide: (query: string, sourceIds: string[]): Promise<StudyGuide> =>
    post('/api/v1/study-guide', { query, sourceIds }),
  clips: (query: string, sourceIds: string[]): Promise<SmartClip[]> =>
    post('/api/v1/clips', { query, sourceIds }),
  debate: (query: string, sourceIds: string[], agentIds: string[]): Promise<DebateResult> =>
    post('/api/v1/debate', { query, sourceIds, agentIds, collisionRounds: 1 }),
};
