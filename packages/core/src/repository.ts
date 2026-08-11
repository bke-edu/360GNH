import type { KnowledgeChunk, KnowledgeSource } from './types.js';

export interface KnowledgeRepository {
  saveSource(source: KnowledgeSource, chunks: KnowledgeChunk[]): Promise<void>;
  listSources(): Promise<KnowledgeSource[]>;
  getSource(id: string): Promise<KnowledgeSource | null>;
  getChunks(sourceIds?: string[]): Promise<KnowledgeChunk[]>;
  clear(): Promise<void>;
}

export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  readonly #sources = new Map<string, KnowledgeSource>();
  readonly #chunks = new Map<string, KnowledgeChunk[]>();

  saveSource(source: KnowledgeSource, chunks: KnowledgeChunk[]): Promise<void> {
    this.#sources.set(source.id, structuredClone(source));
    this.#chunks.set(
      source.id,
      chunks.map((chunk) => ({ ...chunk, terms: new Map(chunk.terms) })),
    );
    return Promise.resolve();
  }

  listSources(): Promise<KnowledgeSource[]> {
    return Promise.resolve(
      [...this.#sources.values()]
        .map((source) => structuredClone(source))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  getSource(id: string): Promise<KnowledgeSource | null> {
    const source = this.#sources.get(id);
    return Promise.resolve(source ? structuredClone(source) : null);
  }

  getChunks(sourceIds?: string[]): Promise<KnowledgeChunk[]> {
    const ids = sourceIds ?? [...this.#sources.keys()];
    return Promise.resolve(
      ids.flatMap((id) =>
        (this.#chunks.get(id) ?? []).map((chunk) => ({
          ...chunk,
          terms: new Map(chunk.terms),
        })),
      ),
    );
  }

  clear(): Promise<void> {
    this.#sources.clear();
    this.#chunks.clear();
    return Promise.resolve();
  }
}
