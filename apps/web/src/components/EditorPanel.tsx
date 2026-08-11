import { CheckCircle2, ExternalLink, FilePenLine, Languages, ScanText } from 'lucide-react';
import { useState } from 'react';
import type { TranscriptTargetLanguage } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import type { KnowledgeSource } from '../lib/types.js';

interface EditorPanelProps {
  source: KnowledgeSource | null;
  busy: boolean;
  onEdit: (sourceId: string, targetLanguage: TranscriptTargetLanguage) => Promise<boolean>;
}

export function EditorPanel({ source, busy, onEdit }: EditorPanelProps) {
  const { locale, pick } = useI18n();
  const [targetLanguage, setTargetLanguage] = useState<TranscriptTargetLanguage>('source');
  const [view, setView] = useState<'raw' | 'edited'>(source?.editedText ? 'edited' : 'raw');

  if (!source) {
    return (
      <EmptyEditor
        text={pick(
          'Nhập một video YouTube hoặc thêm văn bản trước, rồi quay lại đây để biên tập.',
          'Import a YouTube video or add text first, then return here to edit it.',
        )}
      />
    );
  }

  const rawText = source.rawText ?? source.text;
  const editedText = source.editedText;
  const displayedText = view === 'edited' && editedText ? editedText : rawText;
  const warnings = source.editStats?.warnings ?? [];

  return (
    <article className="grid gap-6">
      <header className="grid gap-4 border-b-4 border-double border-line-strong pb-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-accent uppercase">
            {pick('YouTube → tài liệu sạch', 'YouTube → clean source')}
          </span>
          <h2 className="m-0 font-display text-3xl font-semibold tracking-tight">
            {pick('Biên tập mà không làm rơi ý', 'Edit without losing meaning')}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
            {pick(
              'Bản thô luôn được giữ lại. AI chỉ chạy khi mày bấm nút, và bản sạch sau đó mới trở thành nguồn cho hỏi đáp, bản đồ, bài kiểm tra và sách nói.',
              'The raw transcript is always preserved. AI runs only when you press the button, and the clean version then becomes the source for chat, mind maps, quizzes, and audiobooks.',
            )}
          </p>
        </div>
        {source.sourceUrl ? (
          <a
            className="inline-flex min-h-11 w-fit items-center gap-2 border border-line-strong px-3 text-sm font-semibold text-accent no-underline hover:border-accent hover:text-accent-hover"
            href={source.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" size={15} /> {pick('Video gốc', 'Original video')}
          </a>
        ) : null}
      </header>

      <ol className="grid gap-px border border-line bg-line sm:grid-cols-3">
        <WorkflowStep
          done
          icon={ScanText}
          index="01"
          label={pick('Đã lấy phụ đề', 'Transcript imported')}
        />
        <WorkflowStep
          done={Boolean(editedText)}
          icon={FilePenLine}
          index="02"
          label={pick('Biên tập sạch', 'Clean edit')}
        />
        <WorkflowStep
          done={Boolean(editedText)}
          icon={CheckCircle2}
          index="03"
          label={pick('Sẵn sàng tái dùng', 'Ready to reuse')}
        />
      </ol>

      <div className="grid gap-3 border-y border-line py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="grid gap-2 text-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
          <span className="flex items-center gap-2">
            <Languages aria-hidden="true" size={15} />{' '}
            {pick('Ngôn ngữ bản sạch', 'Clean source language')}
          </span>
          <select
            className="min-h-11 w-full min-w-0 border border-line-strong bg-paper-raised px-3 text-sm text-ink outline-accent md:w-64"
            onChange={(event) => setTargetLanguage(event.target.value as TranscriptTargetLanguage)}
            value={targetLanguage}
          >
            <option value="source">{pick('Giữ ngôn ngữ nguồn', 'Keep source language')}</option>
            <option value="vi">{pick('Tiếng Việt', 'Vietnamese')}</option>
            <option value="en">{pick('Tiếng Anh', 'English')}</option>
          </select>
        </label>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 border border-accent bg-accent px-5 text-sm font-bold text-accent-contrast shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-x-px hover:-translate-y-px hover:bg-accent-hover hover:shadow-[3px_3px_0_var(--color-ink)] active:translate-x-px active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() =>
            void onEdit(source.id, targetLanguage).then((ok) => ok && setView('edited'))
          }
          type="button"
        >
          <FilePenLine aria-hidden="true" size={17} />
          {busy
            ? pick('Đang biên tập…', 'Editing…')
            : editedText
              ? pick('Biên tập lại', 'Edit again')
              : pick('Biên tập bằng AI', 'Edit with AI')}
        </button>
      </div>

      {source.editStats ? (
        <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-ink-faint">
          <span>
            {source.editStats.parts} {pick('phần', 'part(s)')}
          </span>
          <span>
            {pick('Tỷ lệ từ', 'Word ratio')}: {source.editStats.wordRatio.toFixed(2)}×
          </span>
          <span>
            {source.editStats.provider}/{source.editStats.model}
          </span>
          <span>≈ ${source.editStats.estimatedCostUsd.toFixed(4)}</span>
          {warnings.length > 0 ? (
            <strong className="text-danger">
              {pick('Cần rà lại độ dài', 'Review the output length')}:{' '}
              {warnings.map((warning) => warningLabel(warning, locale)).join(', ')}
            </strong>
          ) : (
            <strong className="text-success">
              {pick('Độ dài nằm trong vùng an toàn', 'Length is within the safe range')}
            </strong>
          )}
        </div>
      ) : null}

      <section>
        <div
          className="mb-3 flex border-b border-line"
          role="tablist"
          aria-label={pick('Bản nội dung', 'Document version')}
        >
          <DocumentTab active={view === 'raw'} onClick={() => setView('raw')}>
            {pick('Bản thô', 'Raw transcript')}
          </DocumentTab>
          <DocumentTab
            active={view === 'edited'}
            disabled={!editedText}
            onClick={() => setView('edited')}
          >
            {pick('Bản sạch', 'Clean source')}
          </DocumentTab>
        </div>
        <div className="max-h-[34rem] overflow-y-auto border border-line-strong bg-paper-deep/25 p-4 md:p-6">
          <p className="m-0 break-words whitespace-pre-wrap font-body text-base leading-[1.85] text-ink-soft">
            {displayedText}
          </p>
        </div>
      </section>
    </article>
  );
}

function warningLabel(
  warning: 'possible-compression' | 'possible-expansion',
  locale: 'vi' | 'en',
): string {
  if (warning === 'possible-compression') {
    return locale === 'vi' ? 'có thể bị rút quá mạnh' : 'possibly over-compressed';
  }
  return locale === 'vi' ? 'có thể bị thêm quá nhiều' : 'possibly over-expanded';
}

function WorkflowStep({
  done,
  icon: Icon,
  index,
  label,
}: {
  done: boolean;
  icon: typeof ScanText;
  index: string;
  label: string;
}) {
  return (
    <li className="flex min-h-20 items-center gap-3 bg-paper-raised p-4">
      <Icon aria-hidden="true" className={done ? 'text-success' : 'text-ink-faint'} size={20} />
      <span className="grid gap-1">
        <small className="font-display text-sm text-accent">{index}</small>
        <strong className="text-sm font-semibold text-ink-soft">{label}</strong>
      </span>
    </li>
  );
}

function DocumentTab({
  active,
  children,
  disabled,
  onClick,
}: {
  active: boolean;
  children: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={`min-h-11 border-b-2 px-5 text-sm font-semibold ${
        active ? 'border-accent text-accent' : 'border-transparent text-ink-faint'
      } disabled:cursor-not-allowed disabled:opacity-35`}
      disabled={disabled}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {children}
    </button>
  );
}

function EmptyEditor({ text }: { text: string }) {
  return (
    <div className="grid min-h-64 place-content-center justify-items-center p-6 text-center">
      <FilePenLine aria-hidden="true" className="mb-3 text-accent" size={30} />
      <p className="max-w-xl font-body text-lg leading-relaxed text-ink-soft">{text}</p>
    </div>
  );
}
