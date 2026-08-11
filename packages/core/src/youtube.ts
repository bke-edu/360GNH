import type { TranscriptSegment } from './types.js';

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export interface ImportedYouTubeTranscript {
  title: string;
  sourceUrl: string;
  text: string;
  language?: string;
  availableLanguages?: string[];
  segments?: TranscriptSegment[];
  author?: string;
  thumbnailUrl?: string;
}

export interface YouTubeTranscriptProvider {
  readonly id: string;
  fetchTranscript(canonicalUrl: string, language?: string): Promise<ImportedYouTubeTranscript>;
}

export function extractYouTubeVideoId(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;

  const host = url.hostname.toLocaleLowerCase('en').replace(/^(www\.|m\.|music\.)/, '');
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && VIDEO_ID_PATTERN.test(id) ? id : null;
  }
  if (host !== 'youtube.com') return null;
  if (url.pathname === '/watch') {
    const id = url.searchParams.get('v');
    return id && VIDEO_ID_PATTERN.test(id) ? id : null;
  }
  const match = url.pathname.match(/^\/(?:shorts|embed|v)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
  return match?.[1] ?? null;
}

export function canonicalYouTubeUrl(value: string): string {
  const videoId = extractYouTubeVideoId(value);
  if (!videoId) throw new Error('A valid public YouTube video URL is required');
  return `https://www.youtube.com/watch?v=${videoId}`;
}
