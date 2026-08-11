import { BookOpenText, FilePlus2, Link2, Youtube } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { KnowledgeSource } from '../lib/types.js';

interface SourceRailProps {
  sources: KnowledgeSource[];
  activeSourceId: string | null;
  busy: boolean;
  youtubeImportAvailable: boolean;
  onSelect: (id: string) => void;
  onAdd: (input: { title: string; text: string; sourceUrl?: string }) => Promise<boolean>;
  onImportYouTube: (input: { url: string; language?: 'vi' | 'en' }) => Promise<boolean>;
}

export function SourceRail({
  sources,
  activeSourceId,
  busy,
  youtubeImportAvailable,
  onSelect,
  onAdd,
  onImportYouTube,
}: SourceRailProps) {
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [text, setText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeLanguage, setYoutubeLanguage] = useState<'' | 'vi' | 'en'>('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await onAdd({
      title,
      text,
      ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
    });
    if (created) {
      setTitle('');
      setSourceUrl('');
      setText('');
    }
  };

  const importVideo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const imported = await onImportYouTube({
      url: youtubeUrl,
      ...(youtubeLanguage ? { language: youtubeLanguage } : {}),
    });
    if (imported) setYoutubeUrl('');
  };

  return (
    <aside
      className="min-w-0 overflow-x-hidden border-b border-line bg-paper-deep/45 p-4 lg:border-r lg:border-b-0 2xl:sticky 2xl:top-17 2xl:max-h-[calc(100dvh-4.25rem)] 2xl:min-h-[calc(100dvh-4.25rem)] 2xl:overflow-y-auto"
      aria-label="Nguồn tri thức"
    >
      <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3 text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">
        <span>Nguồn đang mở</span>
        <strong className="font-display text-xl font-semibold text-accent">
          {sources.length.toString().padStart(2, '0')}
        </strong>
      </div>

      <div className="grid gap-2" role="list">
        {sources.map((source, index) => (
          <button
            className={`group grid min-h-19 grid-cols-[2rem_minmax(0,1fr)] gap-3 border-l-4 px-3 py-3 text-left transition duration-150 disabled:cursor-wait disabled:opacity-60 ${
              source.id === activeSourceId
                ? 'border-accent bg-paper-raised text-ink shadow-[2px_2px_0_var(--color-line)]'
                : 'border-transparent bg-transparent text-ink-soft hover:translate-x-0.5 hover:border-line-strong hover:bg-paper-raised'
            }`}
            disabled={busy}
            key={source.id}
            onClick={() => onSelect(source.id)}
            type="button"
          >
            <span className="pt-1 font-display text-sm text-ink-faint">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="grid min-w-0 gap-2">
              <strong className="overflow-hidden text-sm leading-relaxed font-medium text-ellipsis">
                {source.title}
              </strong>
              <small className="flex items-center gap-1 text-xs text-ink-faint capitalize">
                <BookOpenText aria-hidden="true" size={13} /> {sourceKindLabel(source.kind)}
              </small>
            </span>
          </button>
        ))}
      </div>

      <section className="mt-5 border-t-4 border-double border-line-strong pt-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent">
          <Youtube aria-hidden="true" size={18} />
          Lấy nội dung từ YouTube
        </div>
        <p className="mb-3 text-xs leading-relaxed text-ink-faint">
          Mỗi lượt một video. Hệ thống giữ bản thô để mày đối chiếu trước khi biên tập.
        </p>
        <form className="grid min-w-0 gap-2" onSubmit={(event) => void importVideo(event)}>
          <label className="text-xs font-semibold text-ink-soft" htmlFor="youtube-url">
            Đường dẫn video
          </label>
          <input
            className="min-h-11 w-full min-w-0 border border-line-strong bg-paper-raised px-3 text-base text-ink outline-accent transition placeholder:text-ink-faint focus:border-accent"
            disabled={busy || !youtubeImportAvailable}
            id="youtube-url"
            inputMode="url"
            onChange={(event) => setYoutubeUrl(event.target.value)}
            placeholder="https://youtu.be/…"
            required
            type="url"
            value={youtubeUrl}
          />
          <label className="mt-1 text-xs font-semibold text-ink-soft" htmlFor="youtube-language">
            Phụ đề ưu tiên
          </label>
          <select
            className="min-h-11 w-full min-w-0 border border-line-strong bg-paper-raised px-3 text-sm text-ink outline-accent"
            disabled={busy || !youtubeImportAvailable}
            id="youtube-language"
            onChange={(event) => setYoutubeLanguage(event.target.value as '' | 'vi' | 'en')}
            value={youtubeLanguage}
          >
            <option value="">Bản gốc tốt nhất</option>
            <option value="vi">Tiếng Việt</option>
            <option value="en">Tiếng Anh</option>
          </select>
          <button
            className="mt-2 inline-flex min-h-11 items-center justify-center border border-accent bg-accent px-4 text-sm font-bold text-accent-contrast shadow-[2px_2px_0_var(--color-ink)] transition duration-150 hover:-translate-x-px hover:-translate-y-px hover:bg-accent-hover hover:shadow-[3px_3px_0_var(--color-ink)] active:translate-x-px active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || !youtubeImportAvailable}
            type="submit"
          >
            {busy ? 'Đang xử lý…' : 'Lấy một video'}
          </button>
          {!youtubeImportAvailable ? (
            <small className="leading-relaxed text-ink-faint">
              Máy chủ chưa có SUPADATA_API_KEY; mày vẫn có thể dán văn bản bên dưới.
            </small>
          ) : null}
        </form>
      </section>

      <details className="mt-5 border-t-4 border-double border-line-strong">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-accent marker:hidden hover:text-accent-hover">
          <FilePlus2 aria-hidden="true" size={18} />
          Thêm văn bản của mày
        </summary>
        <form className="grid gap-2 py-3" onSubmit={(event) => void submit(event)}>
          <label className="mt-2 text-xs font-semibold text-ink-soft" htmlFor="source-title">
            Tên nguồn
          </label>
          <input
            className="min-h-11 w-full min-w-0 border border-line-strong bg-paper-raised px-3 text-base text-ink outline-accent transition placeholder:text-ink-faint focus:border-accent"
            id="source-title"
            maxLength={300}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ví dụ: Bài giảng tuần 3"
            required
            value={title}
          />
          <label
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-ink-soft"
            htmlFor="source-url"
          >
            <Link2 aria-hidden="true" size={14} /> Đường dẫn gốc (không bắt buộc)
          </label>
          <input
            className="min-h-11 w-full min-w-0 border border-line-strong bg-paper-raised px-3 text-base text-ink outline-accent transition placeholder:text-ink-faint focus:border-accent"
            id="source-url"
            inputMode="url"
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://…"
            type="url"
            value={sourceUrl}
          />
          <label className="mt-2 text-xs font-semibold text-ink-soft" htmlFor="source-text">
            Nội dung
          </label>
          <textarea
            className="w-full min-w-0 border border-line-strong bg-paper-raised p-3 text-base leading-relaxed text-ink outline-accent transition placeholder:text-ink-faint focus:border-accent"
            id="source-text"
            minLength={40}
            onChange={(event) => setText(event.target.value)}
            placeholder="Dán bản ghi lời nói, bài viết hoặc ghi chú…"
            required
            rows={7}
            value={text}
          />
          <button
            className="mt-2 inline-flex min-h-11 items-center justify-center border border-accent bg-accent px-4 text-sm font-bold text-accent-contrast shadow-[2px_2px_0_var(--color-ink)] transition duration-150 hover:-translate-x-px hover:-translate-y-px hover:bg-accent-hover hover:shadow-[3px_3px_0_var(--color-ink)] active:translate-x-px active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? 'Đang đưa vào…' : 'Đưa vào bàn làm việc'}
          </button>
        </form>
      </details>
    </aside>
  );
}

function sourceKindLabel(kind: KnowledgeSource['kind']): string {
  if (kind === 'transcript') return 'bản ghi';
  if (kind === 'article') return 'bài viết';
  return 'ghi chú';
}
