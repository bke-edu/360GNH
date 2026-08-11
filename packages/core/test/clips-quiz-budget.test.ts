import { describe, expect, it } from 'vitest';
import {
  BudgetExceededError,
  UsageBudget,
  estimateTimestampRange,
  gradeQuiz,
  mergeAdjacentClips,
  resolveTimestampFromSegments,
  timestampedSourceUrl,
  toLearnerQuiz,
  validateQuizQuestions,
} from '../src/index.js';
import type { Quiz } from '../src/index.js';

describe('smart clips', () => {
  it('merges nearby ranges without mutating input', () => {
    const ranges = [
      { text: 'A', startSeconds: 10, endSeconds: 20 },
      { text: 'B', startSeconds: 35, endSeconds: 40 },
      { text: 'C', startSeconds: 100, endSeconds: 110 },
    ];
    const merged = mergeAdjacentClips(ranges, 20);
    expect(merged).toEqual([
      { text: 'A […] B', startSeconds: 10, endSeconds: 40 },
      { text: 'C', startSeconds: 100, endSeconds: 110 },
    ]);
    expect(ranges[0]?.text).toBe('A');
  });

  it('resolves timestamps from transcript segments and falls back to text position', () => {
    const resolved = resolveTimestampFromSegments('ôn cách quãng nhiều ngày', [
      { text: 'nhớ chủ động gọi kiến thức', startMs: 0, endMs: 10_000 },
      { text: 'ôn cách quãng qua nhiều ngày', startMs: 20_000, endMs: 30_000 },
    ]);
    expect(resolved).toEqual({ startSeconds: 20, endSeconds: 30 });
    expect(estimateTimestampRange('đoạn giữa', 'mở đầu đoạn giữa kết thúc', 100)).toEqual({
      startSeconds: 28,
      endSeconds: 64,
    });
  });

  it('adds timestamps only to explicitly allowed YouTube hosts', () => {
    const citation = {
      sourceId: 'source-1',
      sourceTitle: 'Video',
      excerpt: 'Excerpt',
      score: 1,
      startSeconds: 42,
    };

    expect(
      timestampedSourceUrl({
        ...citation,
        sourceUrl: 'https://m.youtube.com/watch?v=example',
      }),
    ).toBe('https://m.youtube.com/watch?v=example&t=42');
    expect(
      timestampedSourceUrl({
        ...citation,
        sourceUrl: 'https://notyoutube.com/watch?v=example',
      }),
    ).toBe('https://notyoutube.com/watch?v=example');
  });
});

describe('quiz grading and validation', () => {
  const quiz: Quiz = {
    id: 'q1',
    title: 'Quiz',
    sourceIds: ['s1'],
    createdAt: '2026-08-11T00:00:00.000Z',
    questions: [
      {
        id: 'a',
        format: 'true_false',
        difficulty: 'easy',
        question: 'Đúng hay sai?',
        correctAnswer: 'true',
        explanation: 'Nguồn nói vậy.',
        sourceExcerpt: 'Đoạn nguồn.',
      },
      {
        id: 'b',
        format: 'open_ended',
        difficulty: 'hard',
        question: 'Giải thích cơ chế.',
        correctAnswer: 'Chấm tay',
        explanation: 'Cần lập luận.',
        sourceExcerpt: 'Đoạn nguồn.',
      },
    ],
  };

  it('grades deterministic formats and leaves essays for manual review', () => {
    expect(gradeQuiz(quiz, { a: ' TRUE ', b: 'Bài tự luận' })).toMatchObject({
      score: 1,
      autoGradable: 1,
      total: 2,
      details: [{ isCorrect: true }, { isCorrect: null }],
    });
  });

  it('removes answer material from the learner-facing quiz shape', () => {
    const learnerQuiz = toLearnerQuiz(quiz);
    expect(learnerQuiz.questions[0]).not.toHaveProperty('correctAnswer');
    expect(learnerQuiz.questions[0]).not.toHaveProperty('explanation');
    expect(quiz.questions[0]).toHaveProperty('correctAnswer', 'true');
  });

  it('drops malformed multiple-choice questions', () => {
    const valid = validateQuizQuestions([
      {
        format: 'mcq',
        difficulty: 'easy',
        question: 'Chọn đáp án',
        options: ['A', 'B', 'C'],
        correctAnswer: 'A',
        explanation: 'Vì A.',
        sourceExcerpt: 'Nguồn.',
      },
    ]);
    expect(valid).toHaveLength(0);
  });
});

describe('usage budget', () => {
  it('fails closed before and after model spend exceeds the cap', () => {
    const budget = new UsageBudget(0.01);
    budget.assertCanSpend(0.009);
    budget.record({
      provider: 'test',
      model: 'test',
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUsd: 0.009,
      latencyMs: 1,
    });
    expect(() => budget.assertCanSpend(0.002)).toThrow(BudgetExceededError);
    expect(budget.snapshot()).toMatchObject({
      spentUsd: 0.009,
      remainingUsd: 0.001,
      calls: 1,
    });
  });

  it('reserves concurrent maximum costs before any model call starts', () => {
    const budget = new UsageBudget(0.01);
    const reservation = budget.reserve(0.008);
    expect(() => budget.reserve(0.003)).toThrow(BudgetExceededError);
    expect(budget.snapshot()).toMatchObject({
      reservedUsd: 0.008,
      remainingUsd: 0.002,
    });
    budget.settle(reservation, {
      provider: 'test',
      model: 'test',
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUsd: 0.006,
      latencyMs: 1,
    });
    expect(budget.snapshot()).toMatchObject({
      spentUsd: 0.006,
      reservedUsd: 0,
      calls: 1,
    });
  });

  it('keeps recorded spend when the per-process ceiling changes', () => {
    const budget = new UsageBudget(0.01);
    budget.record({
      provider: 'test',
      model: 'test',
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUsd: 0.006,
      latencyMs: 1,
    });

    budget.setLimit(0.005);

    expect(budget.snapshot()).toMatchObject({
      limitUsd: 0.005,
      spentUsd: 0.006,
      remainingUsd: 0,
      calls: 1,
    });
    expect(() => budget.reserve(0.001)).toThrow(BudgetExceededError);
  });

  it('lets an already reserved call settle after the ceiling is lowered', () => {
    const budget = new UsageBudget(0.01);
    const reservation = budget.reserve(0.008);
    budget.setLimit(0.005);

    expect(() =>
      budget.settle(reservation, {
        provider: 'test',
        model: 'test',
        inputTokens: 1,
        outputTokens: 1,
        estimatedCostUsd: 0.006,
        latencyMs: 1,
      }),
    ).not.toThrow();
    expect(budget.snapshot()).toMatchObject({ spentUsd: 0.006, remainingUsd: 0 });
  });
});
