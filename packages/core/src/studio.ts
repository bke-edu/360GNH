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
import { sourceEditStats, splitTranscriptForEditing } from './transcript-editing.js';
import { canonicalYouTubeUrl } from './youtube.js';
import type { YouTubeTranscriptProvider } from './youtube.js';
import type { TranscriptTargetLanguage } from './model.js';
import type {
  AnswerResult,
  KnowledgeChunk,
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

const MAX_SOURCE_CHARACTERS = 250_000;
const MAX_SOURCE_URL_CHARACTERS = 2_000;
const MAX_TRANSCRIPT_SEGMENTS = 20_000;
const MAX_SEGMENT_CHARACTERS = 10_000;

export interface IngestSourceInput {
  title: string;
  text: string;
  kind?: KnowledgeSource['kind'];
  sourceUrl?: string;
  segments?: TranscriptSegment[];
  rawText?: string;
  editedText?: string;
  transcriptLanguage?: string;
  availableTranscriptLanguages?: string[];
}

export interface ImportYouTubeInput {
  url: string;
  language?: string;
}

export interface EditSourceInput {
  sourceId: string;
  targetLanguage?: TranscriptTargetLanguage;
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
    const text = sanitizeBoundedText(input.text, MAX_SOURCE_CHARACTERS, 'Source text');
    if (!title) throw new Error('Source title is required');
    if (text.length < 40) throw new Error('Source text must contain at least 40 characters');
    const sourceUrl = input.sourceUrl ? normalizeHttpUrl(input.sourceUrl) : undefined;
    const segments = input.segments ? normalizeSegments(input.segments) : undefined;
    const rawText = input.rawText
      ? sanitizeBoundedText(input.rawText, MAX_SOURCE_CHARACTERS, 'Raw source text')
      : undefined;
    const editedText = input.editedText
      ? sanitizeBoundedText(input.editedText, MAX_SOURCE_CHARACTERS, 'Edited source text')
      : undefined;

    const source: KnowledgeSource = {
      id: randomUUID(),
      title,
      kind: input.kind ?? 'transcript',
      ...(sourceUrl ? { sourceUrl } : {}),
      text,
      ...(rawText ? { rawText } : {}),
      ...(editedText ? { editedText } : {}),
      ...(input.transcriptLanguage ? { transcriptLanguage: input.transcriptLanguage } : {}),
      ...(input.availableTranscriptLanguages
        ? { availableTranscriptLanguages: [...new Set(input.availableTranscriptLanguages)] }
        : {}),
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

  async importYouTube(
    input: ImportYouTubeInput,
    provider: YouTubeTranscriptProvider,
  ): Promise<KnowledgeSource> {
    const sourceUrl = canonicalYouTubeUrl(input.url);
    const transcript = await provider.fetchTranscript(sourceUrl, input.language);
    return this.ingest({
      title: transcript.title,
      text: transcript.text,
      rawText: transcript.text,
      kind: 'transcript',
      sourceUrl,
      ...(transcript.segments ? { segments: transcript.segments } : {}),
      ...(transcript.language ? { transcriptLanguage: transcript.language } : {}),
      ...(transcript.availableLanguages
        ? { availableTranscriptLanguages: transcript.availableLanguages }
        : {}),
    });
  }

  async editSource(input: EditSourceInput): Promise<KnowledgeSource> {
    const source = await this.repository.getSource(input.sourceId);
    if (!source) throw new Error('Source is not available');
    const rawText = source.rawText ?? source.text;
    const parts = splitTranscriptForEditing(rawText);
    const results = [];
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      if (!part) continue;
      results.push(
        await this.model.editTranscript({
          title: source.title,
          ...(source.sourceUrl ? { sourceUrl: source.sourceUrl } : {}),
          text: part,
          targetLanguage: input.targetLanguage ?? 'source',
          part: index + 1,
          totalParts: parts.length,
        }),
      );
    }
    const editedText = sanitizeBoundedText(
      results.map((result) => result.value.editedText.trim()).join('\n\n'),
      MAX_SOURCE_CHARACTERS,
      'Edited source text',
    );
    if (editedText.length < 40) throw new Error('Edited source is unexpectedly short');
    const updated: KnowledgeSource = {
      ...source,
      text: editedText,
      rawText,
      editedText,
      editStats: sourceEditStats(
        rawText,
        editedText,
        results.map((result) => result.usage),
        parts.length,
      ),
    };
    await this.repository.saveSource(updated, chunkSource(updated));
    return updated;
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
    const query = sanitizeQuery(input.query);
    if (!query) throw new Error('Query is required');
    const sourcePromise = input.sourceIds
      ? Promise.all(input.sourceIds.map((sourceId) => this.repository.getSource(sourceId))).then(
          (sources) => sources.filter((source): source is KnowledgeSource => source !== null),
        )
      : this.repository.listSources();
    const [currentChunks, sources] = await Promise.all([
      this.repository.getChunks(input.sourceIds),
      sourcePromise,
    ]);
    const timestampedSources = sources.filter(
      (source) => source.segments && source.segments.length > 0,
    );
    const timestampedSourceIds = new Set(timestampedSources.map((source) => source.id));
    const chunks = [
      ...currentChunks.filter((chunk) => !timestampedSourceIds.has(chunk.sourceId)),
      ...timestampedSources.flatMap(rawTimestampChunks),
    ];
    if (chunks.length === 0) throw new Error('No sources are available for this request');
    const selected = retrieve(query, chunks, { limit: 10 });
    return clipsFromCitations(query, citationsFromChunks(selected));
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

function rawTimestampChunks(source: KnowledgeSource): KnowledgeChunk[] {
  const rawSource: KnowledgeSource = {
    ...source,
    text: source.rawText ?? source.text,
  };
  delete rawSource.editedText;
  return chunkSource(rawSource);
}

function normalizeHttpUrl(value: string): string {
  if (value.length > MAX_SOURCE_URL_CHARACTERS) {
    throw new Error(`sourceUrl cannot exceed ${MAX_SOURCE_URL_CHARACTERS} characters`);
  }
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
  const normalized = url.toString();
  if (normalized.length > MAX_SOURCE_URL_CHARACTERS) {
    throw new Error(`sourceUrl cannot exceed ${MAX_SOURCE_URL_CHARACTERS} characters`);
  }
  return normalized;
}

function normalizeSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (segments.length > MAX_TRANSCRIPT_SEGMENTS) {
    throw new Error(`Source cannot contain more than ${MAX_TRANSCRIPT_SEGMENTS} segments`);
  }
  let totalCharacters = 0;
  return segments.map((segment) => {
    const text = sanitizeBoundedText(segment.text, MAX_SEGMENT_CHARACTERS, 'Transcript segments');
    if (!text) throw new Error('Transcript segments must contain text');
    totalCharacters += text.length;
    if (totalCharacters > MAX_SOURCE_CHARACTERS) {
      throw new Error(
        `Transcript segment text cannot exceed ${MAX_SOURCE_CHARACTERS} characters in total`,
      );
    }
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

function sanitizeBoundedText(value: string, limit: number, label: string): string {
  if (value.length > limit) throw new Error(`${label} cannot exceed ${limit} characters`);
  const sanitized = sanitizeSourceText(value);
  if (sanitized.length > limit) throw new Error(`${label} cannot exceed ${limit} characters`);
  return sanitized;
}
