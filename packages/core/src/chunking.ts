import { termFrequency } from './tokenize.js';
import type { KnowledgeChunk, KnowledgeSource, TranscriptSegment } from './types.js';

export interface ChunkingOptions {
  targetCharacters?: number;
  overlapCharacters?: number;
}

const DEFAULT_TARGET = 1_200;
const DEFAULT_SEGMENT_TARGET = 260;
const DEFAULT_OVERLAP = 160;
const DEFAULT_SEGMENT_OVERLAP = 60;

export function chunkSource(
  source: KnowledgeSource,
  options: ChunkingOptions = {},
): KnowledgeChunk[] {
  const hasSegments = Boolean(source.segments && source.segments.length > 0);
  const target =
    options.targetCharacters ?? (hasSegments ? DEFAULT_SEGMENT_TARGET : DEFAULT_TARGET);
  const overlap =
    options.overlapCharacters ?? (hasSegments ? DEFAULT_SEGMENT_OVERLAP : DEFAULT_OVERLAP);
  assertChunkingOptions(target, overlap);

  if (source.segments && source.segments.length > 0) {
    return chunkSegments(source, source.segments, target, overlap);
  }

  return chunkPlainText(source, target, overlap);
}

function chunkSegments(
  source: KnowledgeSource,
  segments: TranscriptSegment[],
  target: number,
  overlap: number,
): KnowledgeChunk[] {
  const validSegments = segments.filter(
    (segment) =>
      segment.text.trim().length > 0 &&
      Number.isFinite(segment.startMs) &&
      Number.isFinite(segment.endMs) &&
      segment.startMs >= 0 &&
      segment.endMs >= segment.startMs,
  );

  const chunks: KnowledgeChunk[] = [];
  let cursor = 0;

  while (cursor < validSegments.length) {
    const collected: TranscriptSegment[] = [];
    let length = 0;
    let end = cursor;

    while (end < validSegments.length && (length < target || collected.length === 0)) {
      const segment = validSegments[end];
      if (!segment) break;
      collected.push(segment);
      length += segment.text.length + 1;
      end += 1;
    }

    const text = collected
      .map((segment) => segment.text.trim())
      .join(' ')
      .trim();
    if (text) {
      chunks.push(
        makeChunk(source, chunks.length, text, collected[0]?.startMs, collected.at(-1)?.endMs),
      );
    }

    if (end >= validSegments.length) break;

    let overlapLength = 0;
    let nextCursor = end;
    while (nextCursor > cursor + 1 && overlapLength < overlap) {
      nextCursor -= 1;
      overlapLength += validSegments[nextCursor]?.text.length ?? 0;
    }
    cursor = Math.max(cursor + 1, nextCursor);
  }

  return chunks;
}

function chunkPlainText(
  source: KnowledgeSource,
  target: number,
  overlap: number,
): KnowledgeChunk[] {
  const paragraphs = source.text
    .split(/\n{2,}/)
    .flatMap((paragraph) => splitOversizedParagraph(paragraph.trim(), target))
    .filter(Boolean);

  const chunks: KnowledgeChunk[] = [];
  let buffer = '';

  const flush = (): void => {
    const text = buffer.trim();
    if (!text) return;
    chunks.push(makeChunk(source, chunks.length, text));
    buffer = text.slice(Math.max(0, text.length - overlap));
  };

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length > target && buffer.length > 0) flush();
    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (buffer.length >= target) flush();
  }

  const tail = buffer.trim();
  if (tail && (chunks.length === 0 || chunks.at(-1)?.text !== tail)) {
    chunks.push(makeChunk(source, chunks.length, tail));
  }

  return chunks;
}

function splitOversizedParagraph(paragraph: string, target: number): string[] {
  if (paragraph.length <= target) return [paragraph];
  const sentences = paragraph.split(/(?<=[.!?。！？])\s+/u);
  if (sentences.length === 1) {
    return (
      paragraph.match(new RegExp(`.{1,${target}}(?:\\s|$)`, 'gu'))?.map((part) => part.trim()) ?? [
        paragraph,
      ]
    );
  }

  const parts: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && `${current} ${sentence}`.length > target) {
      parts.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function makeChunk(
  source: KnowledgeSource,
  ordinal: number,
  text: string,
  startMs?: number,
  endMs?: number,
): KnowledgeChunk {
  return {
    id: `${source.id}:${ordinal}`,
    sourceId: source.id,
    sourceTitle: source.title,
    ...(source.sourceUrl ? { sourceUrl: source.sourceUrl } : {}),
    ordinal,
    text,
    ...(startMs === undefined ? {} : { startMs }),
    ...(endMs === undefined ? {} : { endMs }),
    terms: termFrequency(text),
  };
}

function assertChunkingOptions(target: number, overlap: number): void {
  if (!Number.isInteger(target) || target < 200) {
    throw new RangeError('targetCharacters must be an integer of at least 200');
  }
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= target) {
    throw new RangeError('overlapCharacters must be an integer between 0 and targetCharacters - 1');
  }
}
