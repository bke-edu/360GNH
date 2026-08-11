import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AGENTS,
  DEMO_SOURCE,
  InMemoryKnowledgeRepository,
  KnowledgeStudio,
  MockKnowledgeModel,
} from '../src/index.js';

function makeStudio(): KnowledgeStudio {
  return new KnowledgeStudio(new InMemoryKnowledgeRepository(), new MockKnowledgeModel());
}

describe('KnowledgeStudio vertical slice', () => {
  it('ingests a timestamped source and answers with citations', async () => {
    const studio = makeStudio();
    const source = await studio.ingest(DEMO_SOURCE);
    const result = await studio.answer({
      query: 'Nhớ chủ động và ôn cách quãng khác nhau thế nào?',
      sourceIds: [source.id],
    });
    expect(result.answer).toContain('Nhớ chủ động');
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations.some((citation) => citation.startSeconds !== undefined)).toBe(true);
  });

  it('generates source-grounded artifacts without an API key', async () => {
    const studio = makeStudio();
    const source = await studio.ingest(DEMO_SOURCE);
    const input = { query: 'Học bền', sourceIds: [source.id] };
    const [mindmap, quiz, guide] = await Promise.all([
      studio.generateMindmap(input),
      studio.generateQuiz({ ...input, count: 4 }),
      studio.generateStudyGuide(input),
    ]);
    const linkedSource = await studio.ingest({
      ...DEMO_SOURCE,
      title: 'Linked demo source',
      sourceUrl: 'https://www.youtube.com/watch?v=example0000',
    });
    const clips = await studio.findClips({
      query: 'ôn cách quãng',
      sourceIds: [linkedSource.id],
    });
    expect(mindmap.markdown).toMatch(/^# /);
    expect(quiz.questions).toHaveLength(4);
    expect(guide.sections.length).toBeGreaterThan(0);
    expect(clips[0]?.deepLink).toContain('t=');
  });

  it('runs exploration, collision, and synthesis with bounded agents', async () => {
    const studio = makeStudio();
    const source = await studio.ingest(DEMO_SOURCE);
    const result = await studio.debate({
      query: 'Đọc lại nhiều lần có đủ để học bền không?',
      sourceIds: [source.id],
      agents: DEFAULT_AGENTS.slice(0, 3),
      collisionRounds: 1,
    });
    expect(result.messages).toHaveLength(6);
    expect(result.messages.map((message) => message.phase)).toContain('collision');
    expect(result.summary.commonGround.length).toBeGreaterThan(0);
    expect(result.usage.every((usage) => usage.estimatedCostUsd === 0)).toBe(true);
  });

  it('rejects URL credentials and empty source selections', async () => {
    const studio = makeStudio();
    await expect(
      studio.ingest({
        title: 'x',
        text: 'a'.repeat(80),
        sourceUrl: 'https://user:pass@192.0.2.1',
      }),
    ).rejects.toThrow(/credentials/);
    await expect(studio.answer({ query: 'anything' })).rejects.toThrow(/No sources/);
  });

  it('rejects invalid segment timing at the domain boundary', async () => {
    const studio = makeStudio();
    await expect(
      studio.ingest({
        title: 'Invalid timing',
        text: 'a'.repeat(80),
        segments: [{ text: 'segment', startMs: 10, endMs: 5 }],
      }),
    ).rejects.toThrow(/timestamps/);
  });
});
