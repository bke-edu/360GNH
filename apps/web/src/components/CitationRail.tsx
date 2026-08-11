import { ExternalLink, Quote } from 'lucide-react';
import type { Citation } from '../lib/types.js';

interface CitationRailProps {
  citations: Citation[];
}

export function CitationRail({ citations }: CitationRailProps) {
  const unique = citations.filter(
    (citation, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.sourceId === citation.sourceId && candidate.excerpt === citation.excerpt,
      ) === index,
  );

  return (
    <aside
      className="border-t border-studio-700 bg-studio-900/70 p-4 xl:col-span-2 2xl:sticky 2xl:top-0 2xl:col-span-1 2xl:max-h-[calc(100dvh-4.25rem)] 2xl:min-h-[calc(100dvh-4.25rem)] 2xl:overflow-y-auto 2xl:border-t-0 2xl:border-l"
      aria-label="Bằng chứng được dùng"
    >
      <div className="mb-4 flex items-baseline justify-between text-xs tracking-[0.12em] text-linen-500 uppercase">
        <span>Bằng chứng</span>
        <strong className="font-display text-xl font-normal text-amber-300">
          {unique.length.toString().padStart(2, '0')}
        </strong>
      </div>
      {unique.length === 0 ? (
        <div className="grid min-h-48 place-content-center justify-items-center px-0 py-6 text-center text-linen-500">
          <Quote className="mb-3 text-amber-300" aria-hidden="true" size={22} />
          <p className="max-w-xs text-sm leading-relaxed text-linen-400">
            Chạy một công cụ. Đoạn nguồn chống “AI chém gió” sẽ hiện ở đây.
          </p>
        </div>
      ) : (
        <ol className="grid list-none gap-4 p-0">
          {unique.map((citation, index) => (
            <li
              className="relative border-b border-studio-700 py-4 pl-6"
              key={`${citation.sourceId}-${citation.excerpt}`}
            >
              <span className="absolute top-4 left-0 font-mono text-xs text-amber-300">
                [{index + 1}]
              </span>
              <p className="mb-3 font-display text-sm leading-relaxed text-linen-400">
                {citation.excerpt}
              </p>
              <div className="flex items-center justify-between gap-2">
                <small className="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-linen-500">
                  {citation.sourceTitle}
                </small>
                {citation.sourceUrl ? (
                  <a
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-mint-300 no-underline"
                    href={citation.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Mở nguồn <ExternalLink aria-hidden="true" size={12} />
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
