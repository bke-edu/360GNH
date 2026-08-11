import { timingSafeEqual } from 'node:crypto';
import {
  DEFAULT_AGENTS,
  DEMO_SOURCE,
  InMemoryKnowledgeRepository,
  KnowledgeStudio,
  toLearnerQuiz,
} from '@360gnh/core';
import type { IngestSourceInput, Quiz, SourceQuery } from '@360gnh/core';
import cors from 'cors';
import express from 'express';
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z, ZodError } from 'zod';

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

export interface AppOptions {
  studio: KnowledgeStudio;
  apiToken?: string;
  webOrigins?: string[];
}

export function createDefaultStudio(model: KnowledgeStudio['model']): KnowledgeStudio {
  return new KnowledgeStudio(new InMemoryKnowledgeRepository(), model);
}

export function createApp(options: AppOptions): express.Express {
  const app = express();
  const quizStore = new Map<string, { quiz: Quiz; expiresAt: number }>();
  const origins = new Set(options.webOrigins ?? ['http://127.0.0.1:4311']);

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

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/api/v1/meta', (_request, response) => {
    response.json({
      data: {
        provider: options.studio.model.provider,
        model: options.studio.model.model,
        debateAgents: DEFAULT_AGENTS,
      },
    });
  });

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

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.issues,
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
