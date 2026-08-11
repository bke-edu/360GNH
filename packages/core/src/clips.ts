import { timestampedSourceUrl } from './citations.js';
import { tokenize } from './tokenize.js';
import type { Citation, SmartClip, TranscriptSegment } from './types.js';

export interface ClipRange {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export function clipsFromCitations(topic: string, citations: Citation[]): SmartClip[] {
  return citations.map((citation, index) => {
    const deepLink = timestampedSourceUrl(citation);
    return {
      id: `${citation.sourceId}:${index}`,
      topic,
      sourceId: citation.sourceId,
      sourceTitle: citation.sourceTitle,
      text: citation.excerpt,
      startSeconds: citation.startSeconds ?? 0,
      endSeconds: citation.endSeconds ?? citation.startSeconds ?? 0,
      ...(deepLink ? { deepLink } : {}),
    };
  });
}

export function mergeAdjacentClips(ranges: ClipRange[], windowSeconds = 30): ClipRange[] {
  if (ranges.length === 0) return [];
  const sorted = ranges
    .map((range) => ({ ...range }))
    .sort((a, b) => a.startSeconds - b.startSeconds);
  const merged: ClipRange[] = [sorted[0]!];

  for (const range of sorted.slice(1)) {
    const previous = merged.at(-1);
    if (!previous) continue;
    if (range.startSeconds - previous.endSeconds <= windowSeconds) {
      previous.endSeconds = Math.max(previous.endSeconds, range.endSeconds);
      previous.text = `${previous.text} […] ${range.text}`;
    } else {
      merged.push(range);
    }
  }

  return merged;
}

export function resolveTimestampFromSegments(
  excerpt: string,
  segments: TranscriptSegment[],
): { startSeconds: number; endSeconds: number } | null {
  const queryTerms = new Set(tokenize(excerpt));
  if (queryTerms.size === 0 || segments.length === 0) return null;

  const scored = segments
    .filter((segment) => segment.endMs >= segment.startMs && segment.startMs >= 0)
    .map((segment) => {
      const terms = new Set(tokenize(segment.text));
      let score = 0;
      for (const term of terms) if (queryTerms.has(term)) score += 1;
      return { segment, score };
    })
    .filter((item) => item.score >= 2);

  if (scored.length === 0) return null;
  const bestScore = Math.max(...scored.map((item) => item.score));
  const threshold = Math.max(2, Math.floor(bestScore * 0.5));
  const matches = scored.filter((item) => item.score >= threshold);

  return {
    startSeconds: Math.floor(Math.min(...matches.map((item) => item.segment.startMs)) / 1000),
    endSeconds: Math.ceil(Math.max(...matches.map((item) => item.segment.endMs)) / 1000),
  };
}

export function estimateTimestampRange(
  excerpt: string,
  transcript: string,
  durationSeconds: number,
): { startSeconds: number; endSeconds: number } {
  if (!transcript || durationSeconds <= 0) return { startSeconds: 0, endSeconds: 0 };

  const offset = bestWordWindowOffset(excerpt, transcript);
  const safeOffset = offset < 0 ? 0 : offset;
  const startSeconds = Math.floor((safeOffset / transcript.length) * durationSeconds);
  const endSeconds = Math.min(
    durationSeconds,
    Math.ceil(((safeOffset + excerpt.length) / transcript.length) * durationSeconds),
  );
  return { startSeconds, endSeconds };
}

function bestWordWindowOffset(excerpt: string, transcript: string): number {
  const exactProbe = excerpt.slice(0, 100).trim();
  const exact = transcript.indexOf(exactProbe);
  if (exact >= 0) return exact;

  const probe = [...new Set(tokenize(excerpt).slice(0, 12))];
  if (probe.length < 3) return -1;
  const probeSet = new Set(probe);
  const matches = [...transcript.matchAll(/[\p{L}\p{N}]+/gu)].map((match) => ({
    term: tokenize(match[0] ?? '')[0] ?? '',
    offset: match.index ?? 0,
  }));
  const windowSize = Math.max(probe.length * 2, 16);
  let best = { score: 0, offset: -1 };

  for (let index = 0; index < matches.length; index += Math.max(1, Math.floor(windowSize / 2))) {
    const found = new Set<string>();
    for (const item of matches.slice(index, index + windowSize)) {
      if (probeSet.has(item.term)) found.add(item.term);
    }
    if (found.size > best.score) best = { score: found.size, offset: matches[index]?.offset ?? -1 };
  }

  return best.score >= Math.ceil(probe.length / 2) ? best.offset : -1;
}
