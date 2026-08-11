import { BookOpenText, FilePlus2, Link2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { KnowledgeSource } from '../lib/types.js';

interface SourceRailProps {
  sources: KnowledgeSource[];
  activeSourceId: string | null;
  busy: boolean;
  onSelect: (id: string) => void;
  onAdd: (input: { title: string; text: string; sourceUrl?: string }) => Promise<boolean>;
}

export function SourceRail({ sources, activeSourceId, busy, onSelect, onAdd }: SourceRailProps) {
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [text, setText] = useState('');

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

  return (
    <aside
      className="border-b border-studio-700 bg-studio-900/70 p-4 xl:border-r xl:border-b-0 2xl:sticky 2xl:top-0 2xl:max-h-[calc(100dvh-4.25rem)] 2xl:min-h-[calc(100dvh-4.25rem)] 2xl:overflow-y-auto"
      aria-label="Nguồn tri thức"
    >
      <div className="mb-4 flex items-baseline justify-between text-xs tracking-[0.12em] text-linen-500 uppercase">
        <span>Nguồn đang mở</span>
        <strong className="font-display text-xl font-normal text-amber-300">
          {sources.length.toString().padStart(2, '0')}
        </strong>
      </div>

      <div className="grid gap-2" role="list">
        {sources.map((source, index) => (
          <button
            className={`group grid min-h-19 grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-lg border p-3 text-left transition duration-150 disabled:cursor-wait disabled:opacity-60 ${
              source.id === activeSourceId
                ? 'border-studio-500 bg-mint-300/10'
                : 'border-transparent bg-transparent hover:translate-x-0.5 hover:border-studio-700 hover:bg-studio-850'
            }`}
            disabled={busy}
            key={source.id}
            onClick={() => onSelect(source.id)}
            type="button"
          >
            <span className="pt-1 font-display text-sm text-linen-500">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="grid min-w-0 gap-2">
              <strong className="overflow-hidden text-sm leading-relaxed font-medium text-ellipsis">
                {source.title}
              </strong>
              <small className="flex items-center gap-1 text-xs text-linen-500 capitalize">
                <BookOpenText aria-hidden="true" size={13} /> {source.kind}
              </small>
            </span>
          </button>
        ))}
      </div>

      <details className="mt-4 border-t border-studio-700">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 text-sm text-amber-300 marker:hidden">
          <FilePlus2 aria-hidden="true" size={18} />
          Thêm văn bản của mày
        </summary>
        <form className="grid gap-2 py-3" onSubmit={(event) => void submit(event)}>
          <label className="mt-2 text-xs text-linen-400" htmlFor="source-title">
            Tên nguồn
          </label>
          <input
            className="min-h-11 rounded-sm border border-studio-700 bg-studio-950/70 px-3 text-base text-linen-100 outline-amber-300 transition focus:border-amber-300"
            id="source-title"
            maxLength={300}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ví dụ: Bài giảng tuần 3"
            required
            value={title}
          />
          <label
            className="mt-2 flex items-center gap-1 text-xs text-linen-400"
            htmlFor="source-url"
          >
            <Link2 aria-hidden="true" size={14} /> Đường dẫn gốc (không bắt buộc)
          </label>
          <input
            className="min-h-11 rounded-sm border border-studio-700 bg-studio-950/70 px-3 text-base text-linen-100 outline-amber-300 transition focus:border-amber-300"
            id="source-url"
            inputMode="url"
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://…"
            type="url"
            value={sourceUrl}
          />
          <label className="mt-2 text-xs text-linen-400" htmlFor="source-text">
            Nội dung
          </label>
          <textarea
            className="rounded-sm border border-studio-700 bg-studio-950/70 p-3 text-base leading-relaxed text-linen-100 outline-amber-300 transition focus:border-amber-300"
            id="source-text"
            minLength={40}
            onChange={(event) => setText(event.target.value)}
            placeholder="Dán bản ghi lời nói, bài viết hoặc ghi chú…"
            required
            rows={7}
            value={text}
          />
          <button
            className="mt-2 inline-flex min-h-11 items-center justify-center rounded-sm border border-amber-300 bg-amber-300 px-4 text-sm font-bold text-studio-950 transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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
