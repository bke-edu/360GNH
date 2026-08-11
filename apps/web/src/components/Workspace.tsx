import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  Clapperboard,
  LoaderCircle,
  Map,
  MessageSquareQuote,
  Play,
} from 'lucide-react';
import type { FormEvent } from 'react';
import type { StudioSnapshot } from '../lib/types.js';
import { DebatePanel } from './DebatePanel.js';
import { MindmapTree } from './MindmapTree.js';
import { QuizPanel } from './QuizPanel.js';

interface WorkspaceProps {
  snapshot: StudioSnapshot;
  activeSourceTitle: string | null;
  onQueryChange: (query: string) => void;
  onRun: (agentIds?: string[]) => Promise<void>;
  onGrade: (answers: Record<string, string>) => Promise<void>;
}

export function Workspace({
  snapshot,
  activeSourceTitle,
  onQueryChange,
  onRun,
  onGrade,
}: WorkspaceProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onRun();
  };

  return (
    <section className="flex-1 px-4 pt-5 pb-8 md:px-8 2xl:px-10" aria-label="Bàn làm việc tri thức">
      <header className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <span className="mb-1 block text-xs tracking-[0.14em] text-amber-300 uppercase">
            Đang làm việc với
          </span>
          <h1 className="mb-0 max-w-4xl font-display text-4xl leading-none font-medium tracking-[-0.035em] md:text-5xl">
            {activeSourceTitle ?? 'Chưa có nguồn'}
          </h1>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border border-studio-700 px-3 py-2 font-mono text-xs text-linen-500">
          <span
            className={`size-2 rounded-full ${snapshot.meta?.provider === 'local' ? 'bg-mint-300 shadow-[0_0_0.75rem_var(--color-mint-300)]' : 'bg-amber-300 shadow-[0_0_0.75rem_var(--color-amber-300)]'}`}
          />
          {snapshot.meta
            ? `${snapshot.meta.provider} · ${snapshot.meta.model}`
            : 'đang nối máy chủ'}
        </div>
      </header>

      <form className="mb-6" onSubmit={submit}>
        <label className="mb-2 block text-xs text-linen-500" htmlFor="studio-query">
          Câu hỏi hoặc chủ đề
        </label>
        <div className="relative">
          <textarea
            className="min-h-21 w-full rounded-lg border border-studio-500 bg-studio-850 p-3 pr-17 text-base leading-relaxed text-linen-100 outline-amber-300 transition focus:border-amber-300"
            id="studio-query"
            maxLength={2_000}
            onChange={(event) => onQueryChange(event.target.value)}
            rows={2}
            value={snapshot.query}
          />
          <button
            aria-label="Chạy công cụ đang chọn"
            className="absolute right-3 bottom-3 grid size-11 place-items-center rounded-full bg-amber-300 text-studio-950 transition hover:translate-x-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-50"
            disabled={snapshot.busy || !snapshot.activeSourceId || snapshot.mode === 'agora'}
            type="submit"
          >
            {snapshot.busy ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={20} />
            ) : (
              <ArrowRight aria-hidden="true" size={20} />
            )}
          </button>
        </div>
      </form>

      <div
        className="min-h-88 rounded-xl border border-studio-700 bg-linear-to-br from-studio-800/80 to-studio-900/80 p-4 shadow-studio md:p-8"
        role="tabpanel"
      >
        {snapshot.busy ? <LoadingState /> : renderResult(snapshot, onRun, onGrade)}
      </div>
    </section>
  );
}

function renderResult(
  snapshot: StudioSnapshot,
  onRun: (agentIds?: string[]) => Promise<void>,
  onGrade: (answers: Record<string, string>) => Promise<void>,
) {
  switch (snapshot.mode) {
    case 'chat':
      return snapshot.answer ? (
        <article>
          <div className="mb-6">
            <span className="mb-1 block text-xs tracking-[0.14em] text-amber-300 uppercase">
              Trả lời có căn cứ
            </span>
            <h2 className="mb-0 font-display text-3xl font-medium tracking-tight">
              Không biết thì nói không biết
            </h2>
          </div>
          <p className="font-display text-xl leading-loose">{snapshot.answer.answer}</p>
          <footer className="flex items-center gap-2 border-t border-studio-700 pt-4 font-mono text-xs text-linen-500">
            <Bot aria-hidden="true" size={15} />
            {snapshot.answer.usage.provider}/{snapshot.answer.usage.model} ·{' '}
            {snapshot.answer.citations.length} đoạn nguồn
          </footer>
        </article>
      ) : (
        <EmptyResult
          icon={MessageSquareQuote}
          text="Đặt câu hỏi; câu trả lời sẽ kéo theo đúng đoạn nguồn đã dùng."
        />
      );
    case 'mindmap':
      return snapshot.mindmap ? (
        <div className="overflow-hidden">
          <div className="mb-6">
            <span className="mb-1 block text-xs tracking-[0.14em] text-amber-300 uppercase">
              Cấu trúc ý
            </span>
            <h2 className="mb-0 font-display text-3xl font-medium tracking-tight">
              Bản đồ có dấu vết nguồn
            </h2>
          </div>
          <MindmapTree node={snapshot.mindmap.root} />
        </div>
      ) : (
        <EmptyResult
          icon={Map}
          text="Rút cấu trúc nhiều tầng mà vẫn giữ đoạn nguồn phía sau mỗi nhánh."
        />
      );
    case 'quiz':
      return snapshot.quiz ? (
        <QuizPanel
          busy={snapshot.busy}
          grade={snapshot.quizGrade}
          key={snapshot.quiz.id}
          onGrade={onGrade}
          quiz={snapshot.quiz}
        />
      ) : (
        <EmptyResult
          icon={BookOpenCheck}
          text="Tạo câu hỏi, làm ngay và chấm bằng đáp án giữ ở máy chủ."
        />
      );
    case 'guide':
      return snapshot.guide ? (
        <article>
          <div className="mb-6">
            <span className="mb-1 block text-xs tracking-[0.14em] text-amber-300 uppercase">
              Lộ trình đọc
            </span>
            <h2 className="mb-0 font-display text-3xl font-medium tracking-tight">
              {snapshot.guide.title}
            </h2>
          </div>
          <p className="font-display text-xl leading-relaxed text-linen-400">
            {snapshot.guide.overview}
          </p>
          <ol className="grid gap-6 pl-5 marker:font-display marker:text-amber-300">
            {snapshot.guide.sections.map((section) => (
              <li key={section.heading}>
                <h3 className="mb-2 font-display text-xl font-medium">{section.heading}</h3>
                <p className="leading-loose text-linen-400">{section.explanation}</p>
                <blockquote className="my-3 border-l-2 border-studio-500 px-4 py-3 text-xs leading-relaxed text-linen-500 italic">
                  {section.sourceExcerpt}
                </blockquote>
              </li>
            ))}
          </ol>
        </article>
      ) : (
        <EmptyResult
          icon={BookOpenCheck}
          text="Biến nguồn dài thành mục tiêu, cơ chế, đoạn học và câu tự kiểm tra."
        />
      );
    case 'clips':
      return snapshot.clips.length > 0 ? (
        <div className="grid gap-3">
          <div className="mb-6">
            <span className="mb-1 block text-xs tracking-[0.14em] text-amber-300 uppercase">
              Mốc đáng xem
            </span>
            <h2 className="mb-0 font-display text-3xl font-medium tracking-tight">
              Đoạn thông minh: {snapshot.query}
            </h2>
          </div>
          {snapshot.clips.map((clip) => (
            <article
              className="grid gap-3 border-t border-studio-700 py-4 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-center"
              key={clip.id}
            >
              <span className="font-mono text-xs text-amber-300">
                {formatTime(clip.startSeconds)}—{formatTime(clip.endSeconds)}
              </span>
              <p className="m-0 leading-relaxed text-linen-400">{clip.text}</p>
              {clip.deepLink ? (
                <a
                  className="inline-flex w-fit items-center gap-1 text-sm text-mint-300 no-underline"
                  href={clip.deepLink}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Play aria-hidden="true" size={14} /> Mở đúng mốc
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyResult
          icon={Clapperboard}
          text="Tìm chủ đề trong bản ghi và nhảy về đúng khoảng thời gian của nguồn."
        />
      );
    case 'agora':
      return (
        <DebatePanel
          agents={snapshot.meta?.debateAgents ?? []}
          busy={snapshot.busy}
          debate={snapshot.debate}
          key={snapshot.meta?.model ?? 'agents'}
          onRun={(agentIds) => onRun(agentIds)}
        />
      );
  }
}

function EmptyResult({ icon: Icon, text }: { icon: typeof Map; text: string }) {
  return (
    <div className="grid min-h-64 place-content-center justify-items-center p-6 text-center text-linen-500">
      <Icon className="mb-3 text-amber-300" aria-hidden="true" size={30} />
      <p className="mb-2 max-w-xl leading-relaxed text-linen-400">{text}</p>
      <small className="text-xs">Nhập chủ đề phía trên rồi bấm mũi tên.</small>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      className="grid min-h-64 place-content-center justify-items-center p-6 text-center text-linen-500"
      aria-live="polite"
    >
      <LoaderCircle aria-hidden="true" className="mb-3 animate-spin text-amber-300" size={28} />
      <p className="max-w-xl leading-relaxed text-linen-400">Đang lục nguồn và ráp kết quả…</p>
    </div>
  );
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.max(0, seconds % 60)).padStart(2, '0')}`;
}
