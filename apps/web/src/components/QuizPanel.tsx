import { Check, CircleHelp, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Quiz, QuizGrade } from '../lib/types.js';

interface QuizPanelProps {
  quiz: Quiz;
  grade: QuizGrade | null;
  busy: boolean;
  onGrade: (answers: Record<string, string>) => Promise<void>;
}

export function QuizPanel({ quiz, grade, busy, onGrade }: QuizPanelProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onGrade(answers);
  };

  return (
    <form onSubmit={submit}>
      <div className="mb-6">
        <span className="mb-1 block text-xs tracking-[0.14em] text-amber-300 uppercase">
          Bài kiểm tra
        </span>
        <h2 className="mb-0 font-display text-3xl font-medium tracking-tight">{quiz.title}</h2>
      </div>
      {quiz.questions.map((question, index) => {
        const result = grade?.details.find((detail) => detail.questionId === question.id);
        return (
          <fieldset className="mb-8 border-0 p-0" key={question.id}>
            <legend className="mb-4 grid grid-cols-[2rem_minmax(0,1fr)] gap-3 font-display text-xl leading-relaxed">
              <span className="font-mono text-sm text-amber-300">
                {String(index + 1).padStart(2, '0')}
              </span>
              {question.question}
            </legend>
            {question.options?.length ? (
              <div className="mb-3 grid gap-2">
                {question.options.map((option) => (
                  <label
                    className="flex min-h-13 cursor-pointer items-center gap-3 rounded-sm border border-studio-700 p-3 text-linen-400 transition hover:border-amber-300 hover:bg-amber-300/10 has-checked:border-amber-300 has-checked:bg-amber-300/10 has-checked:text-linen-100"
                    key={option}
                  >
                    <input
                      checked={answers[question.id] === option}
                      name={question.id}
                      onChange={() =>
                        setAnswers((current) => ({ ...current, [question.id]: option }))
                      }
                      className="size-4 min-h-0 accent-amber-300"
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
                    className="flex min-h-13 cursor-pointer items-center gap-3 rounded-sm border border-studio-700 p-3 text-linen-400 transition hover:border-amber-300 hover:bg-amber-300/10 has-checked:border-amber-300 has-checked:bg-amber-300/10 has-checked:text-linen-100"
                    key={option}
                  >
                    <input
                      checked={answers[question.id] === option}
                      name={question.id}
                      onChange={() =>
                        setAnswers((current) => ({ ...current, [question.id]: option }))
                      }
                      className="size-4 min-h-0 accent-amber-300"
                      type="radio"
                      value={option}
                    />
                    <span>{option === 'true' ? 'Đúng' : 'Sai'}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                aria-label={`Câu trả lời cho câu ${index + 1}`}
                className="w-full rounded-sm border border-studio-700 bg-studio-950/70 p-3 text-base leading-relaxed text-linen-100 outline-amber-300 focus:border-amber-300"
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                }
                rows={3}
                value={answers[question.id] ?? ''}
              />
            )}
            <blockquote className="my-3 border-l-2 border-studio-500 px-4 py-3 text-xs leading-relaxed text-linen-500 italic">
              {question.sourceExcerpt}
            </blockquote>
            {result ? (
              <div
                className={`mt-3 flex items-start gap-2 rounded-sm border p-3 text-sm ${result.isCorrect === false ? 'border-danger-400 bg-danger-400/10 text-danger-200' : 'border-mint-300 bg-mint-300/10 text-mint-300'}`}
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
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-studio-700 pt-5">
        {grade ? (
          <p className="m-0 text-sm text-linen-500">
            <strong className="text-xl text-amber-300">
              {grade.score}/{grade.autoGradable}
            </strong>{' '}
            câu tự chấm đúng
            {grade.total > grade.autoGradable
              ? ` · ${grade.total - grade.autoGradable} câu chấm tay`
              : ''}
          </p>
        ) : (
          <p className="m-0 text-sm text-linen-500">
            Đáp án được giữ ở máy chủ; trình duyệt không thể sửa đúng sai.
          </p>
        )}
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-sm border border-amber-300 bg-amber-300 px-4 text-sm font-bold text-studio-950 transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy ? 'Đang chấm…' : grade ? 'Chấm lại' : 'Chấm bài'}
        </button>
      </div>
    </form>
  );
}
