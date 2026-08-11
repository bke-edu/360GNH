import type { LearnerQuiz, Quiz, QuizGrade, QuizQuestion } from './types.js';

export function toLearnerQuiz(quiz: Quiz): LearnerQuiz {
  return {
    id: quiz.id,
    title: quiz.title,
    sourceIds: [...quiz.sourceIds],
    createdAt: quiz.createdAt,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      format: question.format,
      difficulty: question.difficulty,
      question: question.question,
      ...(question.options ? { options: [...question.options] } : {}),
      sourceExcerpt: question.sourceExcerpt,
    })),
  };
}

export function gradeQuiz(quiz: Quiz, answers: Readonly<Record<string, string>>): QuizGrade {
  let score = 0;
  let autoGradable = 0;

  const details = quiz.questions.map((question) => {
    const userAnswer = answers[question.id]?.trim() ?? '';
    const isOpenEnded = question.format === 'open_ended';
    const isCorrect = isOpenEnded
      ? null
      : normalizeAnswer(userAnswer) === normalizeAnswer(question.correctAnswer);

    if (!isOpenEnded) autoGradable += 1;
    if (isCorrect) score += 1;

    return {
      questionId: question.id,
      userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      explanation: question.explanation,
    };
  });

  return { score, autoGradable, total: quiz.questions.length, details };
}

export function validateQuizQuestions(
  questions: Array<Omit<QuizQuestion, 'id'>>,
): Array<Omit<QuizQuestion, 'id'>> {
  return questions.filter((question) => {
    if (
      !question.question.trim() ||
      !question.correctAnswer.trim() ||
      !question.explanation.trim() ||
      !question.sourceExcerpt.trim()
    ) {
      return false;
    }
    if (question.format === 'mcq') {
      return (
        question.options?.length === 4 &&
        question.options.every((option) => option.trim().length > 0) &&
        question.options.some(
          (option) => normalizeAnswer(option) === normalizeAnswer(question.correctAnswer),
        )
      );
    }
    if (question.format === 'true_false') {
      return ['true', 'false'].includes(normalizeAnswer(question.correctAnswer));
    }
    if (question.format === 'fill_blank') {
      return question.question.includes('___');
    }
    return true;
  });
}

function normalizeAnswer(answer: string): string {
  return answer.normalize('NFC').trim().toLocaleLowerCase('vi').replace(/\s+/g, ' ');
}
