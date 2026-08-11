import { Check, CircleHelp, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Quiz, QuizGrade } from '../lib/types.js';
import { useI18n } from '../lib/i18n.js';

interface QuizPanelProps {
  quiz: Quiz;
  grade: QuizGrade | null;
  busy: boolean;
  onGrade: (answers: Record<string, string>) => Promise<void>;
}

export function QuizPanel({ quiz, grade, busy, onGrade }: QuizPanelProps) {
  const { pick } = useI18n();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onGrade(answers);
  };

  return (
    <form onSubmit={submit}>
      <div className="mb-6">
        <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-accent uppercase">
          {pick('Bài kiểm tra', 'Quiz')}
        </span>
        <h2 className="mb-0 font-display text-3xl font-semibold tracking-tight">{quiz.title}</h2>
      </div>
      {quiz.questions.map((question, index) => {
        const result = grade?.details.find((detail) => detail.questionId === question.id);
        return (
          <fieldset className="mb-8 border-0 p-0" key={question.id}>
            <legend className="mb-4 grid grid-cols-[2rem_minmax(0,1fr)] gap-3 font-display text-xl leading-relaxed font-semibold">
              <span className="font-mono text-sm text-accent">
                {String(index + 1).padStart(2, '0')}
              </span>
              {question.question}
            </legend>
            {question.options?.length ? (
              <div className="mb-3 grid gap-2">
                {question.options.map((option) => (
                  <label
                    className="flex min-h-13 cursor-pointer items-center gap-3 border border-line-strong p-3 font-body text-ink-soft transition duration-150 hover:border-accent hover:bg-accent-soft has-checked:border-accent has-checked:bg-accent-soft has-checked:text-ink"
                    key={option}
                  >
                    <input
                      checked={answers[question.id] === option}
                      name={question.id}
                      onChange={() =>
                        setAnswers((current) => ({ ...current, [question.id]: option }))
                      }
                      className="size-4 min-h-0 accent-accent"
                      type="radio"
                      value={option}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            ) : question.format === 'true_false' ? (
              <div className="mb-3 grid gap-2 md:grid-cols-2">
                {['true', 'false'].map((option) => (
                  <label
                    className="flex min-h-13 cursor-pointer items-center gap-3 border border-line-strong p-3 font-body text-ink-soft transition duration-150 hover:border-accent hover:bg-accent-soft has-checked:border-accent has-checked:bg-accent-soft has-checked:text-ink"
                    key={option}
                  >
                    <input
                      checked={answers[question.id] === option}
                      name={question.id}
                      onChange={() =>
                        setAnswers((current) => ({ ...current, [question.id]: option }))
                      }
                      className="size-4 min-h-0 accent-accent"
                      type="radio"
                      value={option}
                    />
                    <span>{option === 'true' ? pick('Đúng', 'True') : pick('Sai', 'False')}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                aria-label={pick(
                  `Câu trả lời cho câu ${index + 1}`,
                  `Answer for question ${index + 1}`,
                )}
                className="w-full border border-line-strong bg-paper p-3 font-body text-base leading-relaxed text-ink outline-accent focus:border-accent"
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                }
                rows={3}
                value={answers[question.id] ?? ''}
              />
            )}
            <blockquote className="my-3 border-y border-line-strong px-4 py-3 font-body text-xs leading-relaxed text-ink-faint italic">
              {question.sourceExcerpt}
            </blockquote>
            {result ? (
              <div
                className={`mt-3 flex items-start gap-2 border p-3 text-sm ${result.isCorrect === false ? 'border-danger bg-danger-soft text-danger' : 'border-success bg-success-soft text-success'}`}
              >
                {result.isCorrect === null ? (
                  <CircleHelp aria-hidden="true" size={18} />
                ) : result.isCorrect ? (
                  <Check aria-hidden="true" size={18} />
                ) : (
                  <X aria-hidden="true" size={18} />
                )}
                <span>{result.explanation}</span>
              </div>
            ) : null}
          </fieldset>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t-4 border-double border-line-strong pt-5">
        {grade ? (
          <p className="m-0 text-sm text-ink-faint">
            <strong className="font-display text-xl text-accent">
              {grade.score}/{grade.autoGradable}
            </strong>{' '}
            {pick('câu tự chấm đúng', 'auto-graded correct')}
            {grade.total > grade.autoGradable
              ? pick(
                  ` · ${grade.total - grade.autoGradable} câu chấm tay`,
                  ` · ${grade.total - grade.autoGradable} manual review`,
                )
              : ''}
          </p>
        ) : (
          <p className="m-0 text-sm text-ink-faint">
            {pick(
              'Đáp án được giữ ở máy chủ; trình duyệt không thể sửa đúng sai.',
              'Answer keys stay on the server; the browser cannot tamper with grading.',
            )}
          </p>
        )}
        <button
          className="inline-flex min-h-11 items-center justify-center border border-accent bg-accent px-4 text-sm font-bold text-accent-contrast shadow-[2px_2px_0_var(--color-ink)] transition duration-150 hover:-translate-x-px hover:-translate-y-px hover:bg-accent-hover hover:shadow-[3px_3px_0_var(--color-ink)] active:translate-x-px active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy
            ? pick('Đang chấm…', 'Grading…')
            : grade
              ? pick('Chấm lại', 'Grade again')
              : pick('Chấm bài', 'Grade quiz')}
        </button>
      </div>
    </form>
  );
}
