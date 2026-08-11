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

export type TranscriptTargetLanguage = 'source' | 'vi' | 'en';
export type AudiobookStyle = 'narrative' | 'calm' | 'educational' | 'cheerful';

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
      body.error?.message ?? `Request failed (${response.status})`,
      response.status,
      body.error?.code,
    );
  }
  return body.data;
}

async function requestBlob(path: string, init: RequestInit): Promise<Blob> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'audio/wav, application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorEnvelope;
    throw new ApiError(
      body.error?.message ?? `Request failed (${response.status})`,
      response.status,
      body.error?.code,
    );
  }
  return response.blob();
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
  importYouTube: (input: { url: string; language?: 'vi' | 'en' }): Promise<KnowledgeSource> =>
    post('/api/v1/youtube/import', input),
  editSource: (
    sourceId: string,
    targetLanguage: TranscriptTargetLanguage,
  ): Promise<KnowledgeSource> =>
    post(`/api/v1/sources/${encodeURIComponent(sourceId)}/edit`, { targetLanguage }),
  renderAudiobook: (input: {
    sourceId: string;
    voice: string;
    style: AudiobookStyle;
    speed: number;
  }): Promise<Blob> =>
    requestBlob('/api/v1/audiobooks/render', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
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
