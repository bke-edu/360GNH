import type { Citation, RetrievedChunk } from './types.js';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
]);

export function citationsFromChunks(chunks: RetrievedChunk[], maxExcerpt = 240): Citation[] {
  return chunks.map((chunk) => ({
    sourceId: chunk.sourceId,
    sourceTitle: chunk.sourceTitle,
    ...(chunk.sourceUrl ? { sourceUrl: chunk.sourceUrl } : {}),
    excerpt: compactExcerpt(chunk.text, maxExcerpt),
    ...(chunk.startMs === undefined ? {} : { startSeconds: Math.floor(chunk.startMs / 1000) }),
    ...(chunk.endMs === undefined ? {} : { endSeconds: Math.ceil(chunk.endMs / 1000) }),
    score: chunk.score,
  }));
}

export function compactExcerpt(text: string, maxCharacters: number): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxCharacters) return compact;
  const candidate = compact.slice(0, Math.max(0, maxCharacters - 1));
  const lastSpace = candidate.lastIndexOf(' ');
  return `${candidate.slice(0, lastSpace > maxCharacters * 0.6 ? lastSpace : candidate.length)}…`;
}

export function timestampedSourceUrl(citation: Citation): string | undefined {
  if (!citation.sourceUrl) return undefined;
  if (citation.startSeconds === undefined) return citation.sourceUrl;
  try {
    const url = new URL(citation.sourceUrl);
    if (url.hostname === 'youtu.be') {
      url.searchParams.set('t', String(citation.startSeconds));
      return url.toString();
    }
    if (YOUTUBE_HOSTS.has(url.hostname)) {
      url.searchParams.set('t', String(citation.startSeconds));
      return url.toString();
    }
    return citation.sourceUrl;
  } catch {
    return citation.sourceUrl;
  }
}
