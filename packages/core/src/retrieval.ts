import { tokenize } from './tokenize.js';
import type { KnowledgeChunk, RetrievedChunk } from './types.js';

export interface RetrievalOptions {
  limit?: number;
  minimumScore?: number;
}

const K1 = 1.2;
const B = 0.75;

/** Lightweight BM25 retrieval keeps the public demo useful without an API key. */
export function retrieve(
  query: string,
  chunks: KnowledgeChunk[],
  options: RetrievalOptions = {},
): RetrievedChunk[] {
  const limit = options.limit ?? 6;
  const minimumScore = options.minimumScore ?? 0.05;
  if (chunks.length === 0 || limit <= 0) return [];

  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0) return [];

  const averageLength =
    chunks.reduce((sum, chunk) => sum + documentLength(chunk), 0) / Math.max(chunks.length, 1);

  const documentFrequency = new Map<string, number>();
  for (const term of queryTerms) {
    documentFrequency.set(term, chunks.filter((chunk) => chunk.terms.has(term)).length);
  }

  return chunks
    .map((chunk) => ({
      ...chunk,
      score: bm25Score(chunk, queryTerms, documentFrequency, chunks.length, averageLength),
    }))
    .filter((chunk) => chunk.score >= minimumScore)
    .sort((a, b) => b.score - a.score || a.ordinal - b.ordinal)
    .slice(0, limit);
}

function bm25Score(
  chunk: KnowledgeChunk,
  queryTerms: string[],
  documentFrequency: ReadonlyMap<string, number>,
  corpusSize: number,
  averageLength: number,
): number {
  const length = documentLength(chunk);
  let score = 0;

  for (const term of queryTerms) {
    const frequency = chunk.terms.get(term) ?? 0;
    if (frequency === 0) continue;
    const frequencyInDocuments = documentFrequency.get(term) ?? 0;
    const inverseDocumentFrequency = Math.log(
      1 + (corpusSize - frequencyInDocuments + 0.5) / (frequencyInDocuments + 0.5),
    );
    const normalization = frequency + K1 * (1 - B + B * (length / Math.max(averageLength, 1)));
    score += inverseDocumentFrequency * ((frequency * (K1 + 1)) / normalization);
  }

  return Number(score.toFixed(6));
}

function documentLength(chunk: KnowledgeChunk): number {
  let length = 0;
  for (const count of chunk.terms.values()) length += count;
  return length;
}
