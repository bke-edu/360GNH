import { timingSafeEqual } from 'node:crypto';
import {
  DEFAULT_AGENTS,
  DEMO_SOURCE,
  canonicalYouTubeUrl,
  InMemoryKnowledgeRepository,
  KnowledgeStudio,
  toLearnerQuiz,
} from '@360gnh/core';
import type { IngestSourceInput, Quiz, SourceQuery } from '@360gnh/core';
import type { AudiobookRenderer, YouTubeTranscriptProvider } from '@360gnh/core';
import cors from 'cors';
import express from 'express';
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z, ZodError } from 'zod';
import { TranscriptProviderError, TranscriptUnavailableError } from './supadata-transcript.js';
import { SpeechProviderError } from './openai-speech.js';
import {
  OpenAISettingsInputSchema,
  ProviderSetupError,
  SupadataSettingsInputSchema,
} from './provider-settings.js';
import type { ProviderSettingsPort } from './provider-settings.js';
import type { ProviderRegistry } from './provider-registry.js';

const SourceIdsSchema = z.array(z.string().uuid()).min(1).max(50).optional();
const QuerySchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  sourceIds: SourceIdsSchema,
});

const IngestSchema = z.object({
  title: z.string().trim().min(1).max(300),
  text: z.string().min(40).max(250_000),
  kind: z.enum(['transcript', 'article', 'note']).optional(),
  sourceUrl: z.url().max(2_000).optional(),
  segments: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(10_000),
        startMs: z.number().int().nonnegative(),
        endMs: z.number().int().nonnegative(),
      }),
    )
    .max(20_000)
    .optional(),
});

const QuizSchema = QuerySchema.extend({
  count: z.number().int().min(1).max(20).optional(),
});
const GradeSchema = z.object({
  answers: z.record(z.string(), z.string().max(10_000)),
});
const DebateSchema = QuerySchema.extend({
  agentIds: z.array(z.string()).min(2).max(4),
  collisionRounds: z.number().int().min(1).max(2).optional(),
});
const YouTubeImportSchema = z.object({
  url: z
    .string()
    .max(2_000)
    .refine((value) => {
      try {
        canonicalYouTubeUrl(value);
        return true;
      } catch {
        return false;
      }
    }, 'A valid public YouTube video URL is required'),
  language: z.enum(['vi', 'en']).optional(),
});
const EditSourceSchema = z.object({
  targetLanguage: z.enum(['source', 'vi', 'en']).default('source'),
});
const AudiobookSchema = z.object({
  sourceId: z.string().uuid(),
  voice: z.enum([
    'alloy',
    'ash',
    'ballad',
    'coral',
    'echo',
    'fable',
    'onyx',
    'nova',
    'sage',
    'shimmer',
    'verse',
    'marin',
    'cedar',
  ]),
  style: z.enum(['narrative', 'calm', 'educational', 'cheerful']).default('narrative'),
  speed: z.number().min(0.5).max(2).default(1),
});

export interface AppOptions {
  studio: KnowledgeStudio;
  apiToken?: string;
  webOrigins?: string[];
  youtubeTranscriptProvider?: ProviderAccessor<YouTubeTranscriptProvider>;
  audiobookRenderer?: ProviderAccessor<AudiobookRenderer>;
  providerSettings?: ProviderSettingsPort;
  providerRegistry?: Pick<ProviderRegistry, 'withSnapshot'>;
}

type ProviderAccessor<T> = T | (() => T | undefined);

export function createDefaultStudio(model: KnowledgeStudio['model']): KnowledgeStudio {
  return new KnowledgeStudio(new InMemoryKnowledgeRepository(), model);
}

export function createApp(options: AppOptions): express.Express {
  const app = express();
  const quizStore = new Map<string, { quiz: Quiz; expiresAt: number }>();
  const origins = new Set(options.webOrigins ?? ['http://127.0.0.1:4311']);
  const expensiveOperationLimit = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
  const providerSettingsLimit = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origins.has(origin)) callback(null, true);
        else callback(new Error('Origin is not allowed'));
      },
    }),
  );
  app.use(express.json({ limit: '256kb', strict: true }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 60,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: (request) => request.path === '/health',
    }),
  );
  app.use(authentication(options.apiToken));
  if (options.providerRegistry) {
    app.use((_request, _response, next) => options.providerRegistry?.withSnapshot(next));
  }
  app.use('/api/v1/settings/providers', (_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/api/v1/meta', (_request, response) => {
    const audiobookRenderer = resolveProvider(options.audiobookRenderer);
    const youtubeTranscriptProvider = resolveProvider(options.youtubeTranscriptProvider);
    response.json({
      data: {
        provider: options.studio.model.provider,
        model: options.studio.model.model,
        debateAgents: DEFAULT_AGENTS,
        features: {
          youtubeImport: Boolean(youtubeTranscriptProvider),
          transcriptEditing: true,
          audiobook: Boolean(audiobookRenderer),
        },
        ...(audiobookRenderer
          ? { audiobook: { ...audiobookRenderer.snapshot(), voices: AUDIOBOOK_VOICES } }
          : {}),
      },
    });
  });

  app.get('/api/v1/settings/providers', providerSettingsLimit, (_request, response) => {
    const providerSettings = requireProviderSettings(options.providerSettings);
    noStore(response).json({ data: providerSettings.status() });
  });

  app.put(
    '/api/v1/settings/providers/openai',
    providerSettingsLimit,
    asyncRoute(async (request, response) => {
      const providerSettings = requireProviderSettings(options.providerSettings);
      const input = OpenAISettingsInputSchema.parse(request.body);
      noStore(response).json({ data: await providerSettings.saveOpenAI(input) });
    }),
  );

  app.delete(
    '/api/v1/settings/providers/openai',
    providerSettingsLimit,
    asyncRoute(async (_request, response) => {
      const providerSettings = requireProviderSettings(options.providerSettings);
      noStore(response).json({ data: await providerSettings.deleteOpenAI() });
    }),
  );

  app.put(
    '/api/v1/settings/providers/supadata',
    providerSettingsLimit,
    asyncRoute(async (request, response) => {
      const providerSettings = requireProviderSettings(options.providerSettings);
      const input = SupadataSettingsInputSchema.parse(request.body);
      noStore(response).json({ data: await providerSettings.saveSupadata(input) });
    }),
  );

  app.delete(
    '/api/v1/settings/providers/supadata',
    providerSettingsLimit,
    asyncRoute(async (_request, response) => {
      const providerSettings = requireProviderSettings(options.providerSettings);
      noStore(response).json({ data: await providerSettings.deleteSupadata() });
    }),
  );

  app.get(
    '/api/v1/sources',
    asyncRoute(async (_request, response) => {
      response.json({ data: await options.studio.listSources() });
    }),
  );

  app.post(
    '/api/v1/sources',
    asyncRoute(async (request, response) => {
      const input = IngestSchema.parse(request.body);
      const source = await options.studio.ingest(toIngestInput(input));
      response.status(201).json({ data: source });
    }),
  );

  app.post(
    '/api/v1/youtube/import',
    expensiveOperationLimit,
    asyncRoute(async (request, response) => {
      const youtubeTranscriptProvider = resolveProvider(options.youtubeTranscriptProvider);
      if (!youtubeTranscriptProvider) {
        throw new HttpError(
          503,
          'FEATURE_UNAVAILABLE',
          'Máy chủ chưa được cấu hình để lấy phụ đề YouTube.',
        );
      }
      const input = YouTubeImportSchema.parse(request.body);
      const source = await options.studio.importYouTube(
        {
          url: input.url,
          ...(input.language ? { language: input.language } : {}),
        },
        youtubeTranscriptProvider,
      );
      response.status(201).json({ data: source });
    }),
  );

  app.post(
    '/api/v1/sources/:id/edit',
    expensiveOperationLimit,
    asyncRoute(async (request, response) => {
      const sourceId = z.string().uuid().parse(parameter(request.params['id']));
      const input = EditSourceSchema.parse(request.body);
      response.json({
        data: await options.studio.editSource({
          sourceId,
          targetLanguage: input.targetLanguage,
        }),
      });
    }),
  );

  app.post(
    '/api/v1/audiobooks/render',
    expensiveOperationLimit,
    asyncRoute(async (request, response) => {
      const audiobookRenderer = resolveProvider(options.audiobookRenderer);
      if (!audiobookRenderer) {
        throw new HttpError(
          503,
          'FEATURE_UNAVAILABLE',
          'Máy chủ chưa được cấu hình để dựng sách nói.',
        );
      }
      const input = AudiobookSchema.parse(request.body);
      const source = await options.studio.repository.getSource(input.sourceId);
      if (!source) throw new HttpError(404, 'SOURCE_NOT_FOUND', 'Nguồn không còn tồn tại.');
      const rendered = await audiobookRenderer.render({
        text: source.editedText ?? source.text,
        voice: input.voice,
        instructions: AUDIOBOOK_STYLE_INSTRUCTIONS[input.style],
        speed: input.speed,
      });
      response
        .status(200)
        .set({
          'Content-Type': rendered.mimeType,
          'Content-Disposition': 'attachment; filename="360gnh-audiobook.wav"',
          'Cache-Control': 'no-store',
          'X-Audiobook-Chunks': String(rendered.chunkCount),
          'X-Content-Type-Options': 'nosniff',
        })
        .send(rendered.audio);
    }),
  );

  app.post(
    '/api/v1/demo/seed',
    asyncRoute(async (_request, response) => {
      const sources = await options.studio.listSources();
      const existing = sources.find((source) => source.title === DEMO_SOURCE.title);
      const source = existing ?? (await options.studio.ingest(DEMO_SOURCE));
      response.status(existing ? 200 : 201).json({ data: source });
    }),
  );

  app.post(
    '/api/v1/chat',
    asyncRoute(async (request, response) => {
      const input = QuerySchema.parse(request.body);
      response.json({
        data: await options.studio.answer(toSourceQuery(input)),
      });
    }),
  );

  app.post(
    '/api/v1/mindmap',
    asyncRoute(async (request, response) => {
      const input = QuerySchema.parse(request.body);
      response.json({
        data: await options.studio.generateMindmap(toSourceQuery(input)),
      });
    }),
  );

  app.post(
    '/api/v1/quiz',
    asyncRoute(async (request, response) => {
      const input = QuizSchema.parse(request.body);
      const quiz = await options.studio.generateQuiz({
        ...toSourceQuery(input),
        ...(input.count === undefined ? {} : { count: input.count }),
      });
      storeQuiz(quizStore, quiz);
      response.json({ data: toLearnerQuiz(quiz) });
    }),
  );

  app.post(
    '/api/v1/quiz/:id/grade',
    asyncRoute((request, response) => {
      const idParameter = request.params['id'];
      const quizId = Array.isArray(idParameter) ? (idParameter[0] ?? '') : (idParameter ?? '');
      purgeExpiredQuizzes(quizStore);
      const stored = quizStore.get(quizId);
      if (!stored) {
        response.status(404).json({
          error: {
            code: 'QUIZ_NOT_FOUND',
            message: 'Quiz not found or expired',
          },
        });
        return;
      }
      const { answers } = GradeSchema.parse(request.body);
      response.json({ data: options.studio.gradeQuiz(stored.quiz, answers) });
    }),
  );

  app.post(
    '/api/v1/study-guide',
    asyncRoute(async (request, response) => {
      const input = QuerySchema.parse(request.body);
      response.json({
        data: await options.studio.generateStudyGuide(toSourceQuery(input)),
      });
    }),
  );

  app.post(
    '/api/v1/clips',
    asyncRoute(async (request, response) => {
      const input = QuerySchema.parse(request.body);
      response.json({
        data: await options.studio.findClips(toSourceQuery(input)),
      });
    }),
  );

  app.post(
    '/api/v1/debate',
    asyncRoute(async (request, response) => {
      const input = DebateSchema.parse(request.body);
      const requested = input.agentIds.map((id) => DEFAULT_AGENTS.find((agent) => agent.id === id));
      if (requested.some((agent) => agent === undefined)) {
        response.status(400).json({
          error: { code: 'UNKNOWN_AGENT', message: 'Unknown debate agent' },
        });
        return;
      }
      const agents = requested.filter((agent): agent is (typeof DEFAULT_AGENTS)[number] =>
        Boolean(agent),
      );
      response.json({
        data: await options.studio.debate({
          query: input.query,
          ...(input.sourceIds ? { sourceIds: input.sourceIds } : {}),
          agents: [...agents],
          ...(input.collisionRounds === undefined
            ? {}
            : { collisionRounds: input.collisionRounds }),
        }),
      });
    }),
  );

  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
    if (error instanceof ProviderSetupError) {
      noStore(response)
        .status(error.status)
        .json({
          error: { code: error.code, message: error.message },
        });
      return;
    }
    if (error instanceof HttpError) {
      response.status(error.status).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }
    if (error instanceof TranscriptUnavailableError) {
      response.status(422).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }
    if (error instanceof TranscriptProviderError) {
      response.status(502).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }
    if (error instanceof SpeechProviderError) {
      response.status(error.httpStatus).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }
    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          ...(request.path.startsWith('/api/v1/settings/providers')
            ? {}
            : { details: error.issues }),
        },
      });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body is not valid JSON',
        },
      });
      return;
    }
    const internalMessage = error instanceof Error ? error.message : 'Unexpected error';
    const status =
      internalMessage.includes('No sources') || internalMessage.includes('not available')
        ? 404
        : 500;
    response.status(status).json({
      error: {
        code: status === 404 ? 'SOURCE_NOT_FOUND' : 'INTERNAL_ERROR',
        message: status === 404 ? internalMessage : 'Unexpected server error',
      },
    });
  };
  app.use(errorHandler);
  return app;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const AUDIOBOOK_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'onyx',
  'nova',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar',
] as const;

const AUDIOBOOK_STYLE_INSTRUCTIONS = {
  narrative: 'Read like a warm audiobook narrator, preserving punctuation and natural pauses.',
  calm: 'Read calmly and gently with unhurried pauses and clear pronunciation.',
  educational: 'Read like a clear teacher. Emphasize key terms without sounding theatrical.',
  cheerful: 'Read with a warm, friendly, lightly cheerful tone and natural pacing.',
} as const;

function authentication(expectedToken?: string): express.RequestHandler {
  if (!expectedToken) return (_request, _response, next) => next();
  return (request, response, next) => {
    const provided = request.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!safeEqual(provided, expectedToken)) {
      response.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Valid bearer token required',
        },
      });
      return;
    }
    next();
  };
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parameter(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function resolveProvider<T>(accessor?: ProviderAccessor<T>): T | undefined {
  return typeof accessor === 'function' ? (accessor as () => T | undefined)() : accessor;
}

function requireProviderSettings(providerSettings?: ProviderSettingsPort): ProviderSettingsPort {
  if (providerSettings) return providerSettings;
  throw new ProviderSetupError(
    503,
    'PROVIDER_SETTINGS_UNAVAILABLE',
    'Provider settings are unavailable in this runtime.',
  );
}

function noStore(response: Response): Response {
  return response.set('Cache-Control', 'no-store');
}

function asyncRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void> | void,
): express.RequestHandler {
  return (request, response, next) => {
    void Promise.resolve()
      .then(() => handler(request, response, next))
      .catch(next);
  };
}

function toSourceQuery(input: z.infer<typeof QuerySchema>): SourceQuery {
  return {
    query: input.query,
    ...(input.sourceIds ? { sourceIds: input.sourceIds } : {}),
  };
}

function toIngestInput(input: z.infer<typeof IngestSchema>): IngestSourceInput {
  return {
    title: input.title,
    text: input.text,
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
    ...(input.segments ? { segments: input.segments } : {}),
  };
}

const QUIZ_TTL_MS = 60 * 60 * 1_000;
const MAX_STORED_QUIZZES = 100;

function storeQuiz(store: Map<string, { quiz: Quiz; expiresAt: number }>, quiz: Quiz): void {
  purgeExpiredQuizzes(store);
  while (store.size >= MAX_STORED_QUIZZES) {
    const oldestId = store.keys().next().value;
    if (!oldestId) break;
    store.delete(oldestId);
  }
  store.set(quiz.id, { quiz, expiresAt: Date.now() + QUIZ_TTL_MS });
}

function purgeExpiredQuizzes(store: Map<string, { quiz: Quiz; expiresAt: number }>): void {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.expiresAt <= now) store.delete(id);
  }
}
