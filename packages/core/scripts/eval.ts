import { DEFAULT_AGENTS } from '../src/agora/personas.js';
import { DEMO_SOURCE } from '../src/demo.js';
import { MockKnowledgeModel } from '../src/providers/mock-model.js';
import { InMemoryKnowledgeRepository } from '../src/repository.js';
import { KnowledgeStudio } from '../src/studio.js';

interface EvalCase {
  name: string;
  run: () => Promise<boolean>;
}

const studio = new KnowledgeStudio(new InMemoryKnowledgeRepository(), new MockKnowledgeModel());
const source = await studio.ingest({
  ...DEMO_SOURCE,
  sourceUrl: 'https://youtu.be/example0000',
});
const sourceIds = [source.id];

const cases: EvalCase[] = [
  {
    name: 'cited-answer',
    run: async () => {
      const result = await studio.answer({
        query: 'Nhớ chủ động khác đọc lại ở điểm nào?',
        sourceIds,
      });
      return result.citations.length > 0 && result.answer.toLocaleLowerCase('vi').includes('nhớ');
    },
  },
  {
    name: 'timestamped-clip',
    run: async () => {
      const result = await studio.findClips({ query: 'ôn cách quãng', sourceIds });
      return result.some((clip) => clip.startSeconds > 0 && Boolean(clip.deepLink));
    },
  },
  {
    name: 'valid-quiz',
    run: async () => {
      const result = await studio.generateQuiz({ query: 'học bền', sourceIds, count: 4 });
      return (
        result.questions.length === 4 &&
        result.questions.every((question) => question.sourceExcerpt.length > 0)
      );
    },
  },
  {
    name: 'bounded-debate',
    run: async () => {
      const result = await studio.debate({
        query: 'Đọc lại có đủ không?',
        sourceIds,
        agents: DEFAULT_AGENTS.slice(0, 3),
      });
      return result.messages.length === 6 && result.summary.openQuestions.length > 0;
    },
  },
];

const outcomes = [];
for (const evaluation of cases) {
  const startedAt = performance.now();
  try {
    const passed = await evaluation.run();
    outcomes.push({
      name: evaluation.name,
      passed,
      latencyMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    outcomes.push({
      name: evaluation.name,
      passed: false,
      latencyMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const passed = outcomes.filter((outcome) => outcome.passed).length;
const report = {
  suite: 'knowledge-studio-local-capability',
  passAt1: passed / outcomes.length,
  passed,
  total: outcomes.length,
  outcomes,
};
console.log(JSON.stringify(report, null, 2));
if (passed !== outcomes.length) process.exitCode = 1;
