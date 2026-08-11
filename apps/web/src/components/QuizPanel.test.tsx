import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuizPanel } from './QuizPanel.js';

const quiz = {
  id: 'quiz-1',
  title: 'Bài kiểm tra mẫu',
  sourceIds: ['source-1'],
  createdAt: '2026-08-11T00:00:00.000Z',
  questions: [
    {
      id: 'question-1',
      format: 'mcq' as const,
      difficulty: 'easy' as const,
      question: 'Cách nào buộc người học tự nhớ?',
      options: ['Nhớ chủ động', 'Đọc lướt', 'Tô màu', 'Nghe thụ động'],
      sourceExcerpt: 'Đóng tài liệu và tự gọi kiến thức ra.',
    },
  ],
};

describe('QuizPanel', () => {
  it('submits the chosen answer and shows server grading', async () => {
    const onGrade = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    const { rerender } = render(
      <QuizPanel busy={false} grade={null} onGrade={onGrade} quiz={quiz} />,
    );
    await user.click(screen.getByLabelText('Nhớ chủ động'));
    await user.click(screen.getByRole('button', { name: 'Chấm bài' }));
    expect(onGrade).toHaveBeenCalledWith({ 'question-1': 'Nhớ chủ động' });

    rerender(
      <QuizPanel
        busy={false}
        grade={{
          score: 1,
          autoGradable: 1,
          total: 1,
          details: [
            {
              questionId: 'question-1',
              userAnswer: 'Nhớ chủ động',
              correctAnswer: 'Nhớ chủ động',
              isCorrect: true,
              explanation: 'Nguồn mô tả việc tự gọi kiến thức ra.',
            },
          ],
        }}
        onGrade={onGrade}
        quiz={quiz}
      />,
    );
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });
});
