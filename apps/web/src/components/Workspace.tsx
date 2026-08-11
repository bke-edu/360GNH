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
import type { TranscriptTargetLanguage } from '../lib/api.js';
import type { KnowledgeSource, StudioSnapshot } from '../lib/types.js';
import { AudiobookPanel } from './AudiobookPanel.js';
import { DebatePanel } from './DebatePanel.js';
import { EditorPanel } from './EditorPanel.js';
import { MindmapTree } from './MindmapTree.js';
import { QuizPanel } from './QuizPanel.js';

interface WorkspaceProps {
  snapshot: StudioSnapshot;
  activeSource: KnowledgeSource | null;
  onQueryChange: (query: string) => void;
  onRun: (agentIds?: string[]) => Promise<void>;
  onGrade: (answers: Record<string, string>) => Promise<void>;
  onEdit: (sourceId: string, targetLanguage: TranscriptTargetLanguage) => Promise<boolean>;
}

export function Workspace({
  snapshot,
  activeSource,
  onQueryChange,
  onRun,
  onGrade,
  onEdit,
}: WorkspaceProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onRun();
  };

  return (
    <section
      className="min-w-0 flex-1 px-4 pt-6 pb-10 md:px-6 xl:px-8"
      aria-label="Bàn làm việc tri thức"
    >
      <header className="mb-6 grid min-w-0 gap-5 border-b-4 border-double border-line-strong pb-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <span className="mb-3 block text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            Đang làm việc với
          </span>
          <h1 className="mb-0 max-w-4xl break-words font-display text-[clamp(2.35rem,1.7rem+2.6vw,4.6rem)] leading-[0.95] font-semibold tracking-[-0.045em]">
            {activeSource?.title ?? 'Chưa có nguồn'}
          </h1>
        </div>
        <div className="flex w-fit items-center gap-2 border border-line-strong bg-paper-raised px-3 py-2 font-mono text-xs text-ink-faint shadow-[2px_2px_0_var(--color-line)]">
          <span
            className={`size-2 rounded-full ${snapshot.meta?.provider === 'local' ? 'bg-success' : 'bg-accent'}`}
          />
          {snapshot.meta
            ? `${snapshot.meta.provider} · ${snapshot.meta.model}`
            : 'đang nối máy chủ'}
        </div>
      </header>

      {snapshot.mode !== 'editor' && snapshot.mode !== 'audiobook' ? (
        <form className="mb-6 min-w-0" onSubmit={submit}>
          <label
            className="mb-2 block text-xs font-semibold tracking-[0.08em] text-ink-faint uppercase"
            htmlFor="studio-query"
          >
            Câu hỏi hoặc chủ đề
          </label>
          <div className="relative min-w-0">
            <textarea
              className="min-h-24 w-full min-w-0 border border-line-strong bg-paper-raised p-4 pr-17 font-body text-[1.08rem] leading-relaxed text-ink shadow-[2px_2px_0_var(--color-line)] outline-accent transition placeholder:text-ink-faint focus:border-accent"
              id="studio-query"
              maxLength={2_000}
              onChange={(event) => onQueryChange(event.target.value)}
              rows={2}
              value={snapshot.query}
            />
            <button
              aria-label="Chạy công cụ đang chọn"
              className="absolute right-3 bottom-3 grid size-11 place-items-center border border-accent bg-accent text-accent-contrast shadow-[2px_2px_0_var(--color-ink)] transition duration-150 hover:-translate-x-px hover:-translate-y-px hover:bg-accent-hover hover:shadow-[3px_3px_0_var(--color-ink)] active:translate-x-px active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:grayscale disabled:opacity-50"
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
      ) : null}

      <div
        className="min-h-88 min-w-0 border border-line-strong bg-paper-raised p-4 shadow-paper md:p-8"
        role="tabpanel"
      >
        {snapshot.busy ? (
          <LoadingState />
        ) : (
          renderResult(snapshot, activeSource, onEdit, onRun, onGrade)
        )}
      </div>
    </section>
  );
}

function renderResult(
  snapshot: StudioSnapshot,
  activeSource: KnowledgeSource | null,
  onEdit: (sourceId: string, targetLanguage: TranscriptTargetLanguage) => Promise<boolean>,
  onRun: (agentIds?: string[]) => Promise<void>,
  onGrade: (answers: Record<string, string>) => Promise<void>,
) {
  switch (snapshot.mode) {
    case 'editor':
      return (
        <EditorPanel
          busy={snapshot.busy}
          key={activeSource?.id ?? 'no-source'}
          onEdit={onEdit}
          source={activeSource}
        />
      );
    case 'chat':
      return snapshot.answer ? (
        <article>
          <div className="mb-6">
            <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-accent uppercase">
              Trả lời có căn cứ
            </span>
            <h2 className="mb-0 font-display text-3xl font-semibold tracking-tight">
              Không biết thì nói không biết
            </h2>
          </div>
          <p className="max-w-[68ch] font-body text-[clamp(1.08rem,1.02rem+0.28vw,1.24rem)] leading-[1.8] text-ink-soft">
            {snapshot.answer.answer}
          </p>
          <footer className="flex items-center gap-2 border-t border-line pt-4 font-mono text-xs text-ink-faint">
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
            <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-accent uppercase">
              Cấu trúc ý
            </span>
            <h2 className="mb-0 font-display text-3xl font-semibold tracking-tight">
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
            <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-accent uppercase">
              Lộ trình đọc
            </span>
            <h2 className="mb-0 font-display text-3xl font-semibold tracking-tight">
              {snapshot.guide.title}
            </h2>
          </div>
          <p className="max-w-[68ch] border-l-2 border-accent pl-5 font-body text-xl leading-relaxed text-ink-soft">
            {snapshot.guide.overview}
          </p>
          <ol className="grid gap-6 pl-5 marker:font-display marker:text-accent">
            {snapshot.guide.sections.map((section) => (
              <li key={section.heading}>
                <h3 className="mb-2 font-display text-xl font-semibold">{section.heading}</h3>
                <p className="font-body leading-loose text-ink-soft">{section.explanation}</p>
                <blockquote className="my-3 border-y border-line-strong px-4 py-3 font-body text-xs leading-relaxed text-ink-faint italic">
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
            <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-accent uppercase">
              Mốc đáng xem
            </span>
            <h2 className="mb-0 font-display text-3xl font-semibold tracking-tight">
              Đoạn thông minh: {snapshot.query}
            </h2>
          </div>
          {snapshot.clips.map((clip) => (
            <article
              className="grid gap-3 border-t border-line py-4 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-center"
              key={clip.id}
            >
              <span className="font-mono text-xs text-accent">
                {formatTime(clip.startSeconds)}—{formatTime(clip.endSeconds)}
              </span>
              <p className="m-0 font-body leading-relaxed text-ink-soft">{clip.text}</p>
              {clip.deepLink ? (
                <a
                  className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-accent no-underline hover:text-accent-hover"
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
    case 'audiobook':
      return (
        <AudiobookPanel
          key={activeSource?.id ?? 'no-source'}
          meta={snapshot.meta}
          source={activeSource}
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
    <div className="grid min-h-64 place-content-center justify-items-center p-6 text-center text-ink-faint">
      <Icon className="mb-3 text-accent" aria-hidden="true" size={30} />
      <p className="mb-2 max-w-xl font-body text-lg leading-relaxed text-ink-soft">{text}</p>
      <small className="text-xs">Nhập chủ đề phía trên rồi bấm mũi tên.</small>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      className="grid min-h-64 place-content-center justify-items-center p-6 text-center text-ink-faint"
      aria-live="polite"
    >
      <LoaderCircle aria-hidden="true" className="mb-3 animate-spin text-accent" size={28} />
      <p className="max-w-xl font-body text-lg leading-relaxed text-ink-soft">
        Đang lục nguồn và ráp kết quả…
      </p>
    </div>
  );
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.max(0, seconds % 60)).padStart(2, '0')}`;
}
