import { randomUUID } from 'node:crypto';
import { validateAgents } from './agora/personas.js';
import type { AgoraAgent, AgoraMessage, DebateResult, DebatePhase } from './agora/types.js';
import { chunkSource } from './chunking.js';
import { citationsFromChunks } from './citations.js';
import { clipsFromCitations } from './clips.js';
import { normalizeMindmap, mindmapToMarkdown } from './mindmap.js';
import type { KnowledgeModel } from './model.js';
import type { KnowledgeRepository } from './repository.js';
import { retrieve } from './retrieval.js';
import { gradeQuiz, validateQuizQuestions } from './quiz.js';
import { sanitizeQuery, sanitizeSourceText, wrapUntrustedContext } from './security.js';
import type {
  AnswerResult,
  KnowledgeSource,
  Mindmap,
  ModelUsage,
  ModelContext,
  Quiz,
  QuizGrade,
  SmartClip,
  StudyGuide,
  TranscriptSegment,
} from './types.js';

export interface IngestSourceInput {
  title: string;
  text: string;
  kind?: KnowledgeSource['kind'];
  sourceUrl?: string;
  segments?: TranscriptSegment[];
}

export interface SourceQuery {
  query: string;
  sourceIds?: string[];
}

export interface DebateOptions extends SourceQuery {
  agents: AgoraAgent[];
  collisionRounds?: number;
}

export class KnowledgeStudio {
  constructor(
    readonly repository: KnowledgeRepository,
    readonly model: KnowledgeModel,
  ) {}

  async ingest(input: IngestSourceInput): Promise<KnowledgeSource> {
    const title = sanitizeQuery(input.title).slice(0, 300);
    const text = sanitizeSourceText(input.text);
    if (!title) throw new Error('Source title is required');
    if (text.length < 40) throw new Error('Source text must contain at least 40 characters');
    const sourceUrl = input.sourceUrl ? normalizeHttpUrl(input.sourceUrl) : undefined;
    const segments = input.segments ? normalizeSegments(input.segments) : undefined;

    const source: KnowledgeSource = {
      id: randomUUID(),
      title,
      kind: input.kind ?? 'transcript',
      ...(sourceUrl ? { sourceUrl } : {}),
      text,
      ...(segments ? { segments } : {}),
      createdAt: new Date().toISOString(),
    };
    const chunks = chunkSource(source);
    if (chunks.length === 0) throw new Error('Source could not be split into searchable chunks');
    await this.repository.saveSource(source, chunks);
    return source;
  }

  async listSources(): Promise<KnowledgeSource[]> {
    return this.repository.listSources();
  }

  async answer(input: SourceQuery): Promise<AnswerResult> {
    const context = await this.contextFor(input, 6);
    const result = await this.model.answer(context);
    return {
      answer: result.value.answer,
      citations: citationsFromChunks(context.chunks),
      usage: result.usage,
    };
  }

  async generateMindmap(input: SourceQuery): Promise<Mindmap> {
    const context = await this.contextFor(input, 12, true);
    const result = await this.model.generateMindmap(context);
    const root = normalizeMindmap(result.value.root);
    return {
      root,
      markdown: mindmapToMarkdown(root),
      citations: citationsFromChunks(context.chunks),
    };
  }

  async generateQuiz(input: SourceQuery & { count?: number }): Promise<Quiz> {
    const count = Math.min(20, Math.max(1, Math.trunc(input.count ?? 5)));
    const context = await this.contextFor(input, 12, true);
    const result = await this.model.generateQuiz(context, count);
    const questions = validateQuizQuestions(result.value.questions).slice(0, count);
    if (questions.length === 0)
      throw new Error('The model did not return any valid quiz questions');

    return {
      id: randomUUID(),
      title: result.value.title,
      sourceIds: [...new Set(context.chunks.map((chunk) => chunk.sourceId))],
      questions: questions.map((question) => ({
        ...question,
        id: randomUUID(),
      })),
      createdAt: new Date().toISOString(),
    };
  }

  gradeQuiz(quiz: Quiz, answers: Readonly<Record<string, string>>): QuizGrade {
    return gradeQuiz(quiz, answers);
  }

  async generateStudyGuide(input: SourceQuery): Promise<StudyGuide> {
    const context = await this.contextFor(input, 16, true);
    const result = await this.model.generateStudyGuide(context);
    return { ...result.value, citations: citationsFromChunks(context.chunks) };
  }

  async findClips(input: SourceQuery): Promise<SmartClip[]> {
    const context = await this.contextFor(input, 10);
    return clipsFromCitations(context.query, citationsFromChunks(context.chunks));
  }

  async debate(options: DebateOptions): Promise<DebateResult> {
    const agents = validateAgents(options.agents);
    const collisionRounds = Math.min(3, Math.max(1, Math.trunc(options.collisionRounds ?? 1)));
    const context = await this.contextFor(options, 10);
    const messages: AgoraMessage[] = [];
    const usage: ModelUsage[] = [];

    await this.runDebatePhase('exploration', 1, agents, options.query, context, messages, usage);
    for (let round = 1; round <= collisionRounds; round += 1) {
      await this.runDebatePhase(
        'collision',
        round,
        agents,
        options.query,
        context,
        messages,
        usage,
      );
    }

    const allCitations = citationsFromChunks(context.chunks);
    const synthesis = await this.model.synthesizeDebate(options.query, messages, allCitations);
    usage.push(synthesis.usage);
    return { topic: context.query, messages, summary: synthesis.value, usage };
  }

  private async contextFor(
    input: SourceQuery,
    limit: number,
    useAllWhenQueryMisses = false,
  ): Promise<ModelContext> {
    const query = sanitizeQuery(input.query);
    if (!query) throw new Error('Query is required');

    const chunks = await this.repository.getChunks(input.sourceIds);
    if (chunks.length === 0) throw new Error('No sources are available for this request');
    let selected = retrieve(query, chunks, { limit });
    if (selected.length === 0 && useAllWhenQueryMisses) {
      selected = chunks.slice(0, limit).map((chunk) => ({ ...chunk, score: 0 }));
    }

    return {
      query,
      chunks: selected,
      untrustedContext: wrapUntrustedContext(selected),
    };
  }

  private async runDebatePhase(
    phase: DebatePhase,
    round: number,
    agents: AgoraAgent[],
    topic: string,
    context: ModelContext,
    messages: AgoraMessage[],
    usage: ModelUsage[],
  ): Promise<void> {
    for (const agent of agents) {
      const result = await this.model.debateTurn({
        topic,
        phase,
        round,
        agent,
        transcript: messages,
        context,
      });
      const citations = result.value.citationIndexes
        .map((index) => context.chunks[index - 1])
        .filter((chunk): chunk is (typeof context.chunks)[number] => chunk !== undefined);
      messages.push({
        id: randomUUID(),
        agentId: agent.id,
        agentName: agent.name,
        phase,
        round,
        content: result.value.content,
        citations: citationsFromChunks(citations),
        createdAt: new Date().toISOString(),
      });
      usage.push(result.usage);
    }
  }
}

function normalizeHttpUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('sourceUrl must be a valid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('sourceUrl must use http or https');
  }
  if (url.username || url.password) throw new Error('sourceUrl must not contain credentials');
  return url.toString();
}

function normalizeSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (segments.length > 20_000) throw new Error('Source cannot contain more than 20000 segments');
  return segments.map((segment) => {
    const text = sanitizeSourceText(segment.text).slice(0, 10_000);
    if (!text) throw new Error('Transcript segments must contain text');
    if (
      !Number.isInteger(segment.startMs) ||
      !Number.isInteger(segment.endMs) ||
      segment.startMs < 0 ||
      segment.endMs < segment.startMs
    ) {
      throw new Error('Transcript segment timestamps must be ordered non-negative integers');
    }
    return { text, startMs: segment.startMs, endMs: segment.endMs };
  });
}
