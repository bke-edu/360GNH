import { Github, LibraryBig, ShieldCheck, X } from 'lucide-react';
import { CitationRail } from './components/CitationRail.js';
import { ModeNav } from './components/ModeNav.js';
import { SourceRail } from './components/SourceRail.js';
import { Workspace } from './components/Workspace.js';
import { useStudio } from './lib/useStudio.js';

export function App() {
  const {
    snapshot,
    activeSource,
    setMode,
    setQuery,
    selectSource,
    addSource,
    run,
    grade,
    clearError,
  } = useStudio();

  return (
    <div className="min-h-dvh bg-studio-950 font-sans text-linen-100">
      <a
        className="fixed top-3 left-3 z-50 -translate-y-40 rounded-sm bg-amber-300 px-4 py-3 font-bold text-studio-950 transition-transform focus:translate-y-0"
        href="#main-workspace"
      >
        Đi tới bàn làm việc
      </a>
      <header className="flex min-h-17 items-center gap-5 border-b border-studio-700/70 bg-studio-950/90 px-4 py-3 backdrop-blur-xl md:px-6">
        <a
          className="flex shrink-0 items-center gap-3 no-underline"
          href="/"
          aria-label="360GNH Knowledge Studio"
        >
          <span className="font-display text-3xl font-semibold tracking-[-0.08em] text-amber-300">
            360
          </span>
          <span className="h-8 w-px bg-studio-600" />
          <span className="grid leading-none">
            <strong className="text-sm tracking-[0.24em]">GNH</strong>
            <small className="mt-1 text-[0.68rem] tracking-[0.06em] text-linen-500 uppercase">
              Knowledge Studio
            </small>
          </span>
        </a>
        <div className="hidden items-center gap-2 text-sm text-linen-400 lg:flex">
          <LibraryBig aria-hidden="true" size={16} />
          <span>Nguồn dài vào. Hiểu biết có dấu vết ra.</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-2 text-xs text-mint-300 md:inline-flex">
            <ShieldCheck aria-hidden="true" size={15} /> không cần khóa để thử
          </span>
          <a
            aria-label="Mở kho mã GitHub"
            className="grid size-11 place-items-center rounded-full border border-studio-700 bg-studio-850 transition hover:-translate-y-0.5 hover:border-amber-300"
            href="https://github.com/nguyenduyhung1989/360GNH"
            rel="noreferrer"
            target="_blank"
          >
            <Github aria-hidden="true" size={18} />
          </a>
        </div>
      </header>

      {snapshot.error ? (
        <div
          className="flex items-center justify-between gap-4 border-b border-danger-400 bg-danger-400/10 px-4 py-3 text-sm text-danger-200"
          role="alert"
        >
          <span>{snapshot.error}</span>
          <button
            className="grid size-11 shrink-0 place-items-center bg-transparent"
            aria-label="Đóng thông báo lỗi"
            onClick={clearError}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </div>
      ) : null}

      <main
        className="grid min-h-[calc(100dvh-4.25rem)] grid-cols-1 xl:grid-cols-[17.5rem_minmax(0,1fr)] 2xl:grid-cols-[17.5rem_minmax(42rem,1fr)_18.5rem]"
        id="main-workspace"
      >
        <SourceRail
          activeSourceId={snapshot.activeSourceId}
          busy={snapshot.busy}
          onAdd={addSource}
          onSelect={selectSource}
          sources={snapshot.sources}
        />
        <div className="flex min-w-0 flex-col">
          <ModeNav active={snapshot.mode} onChange={setMode} />
          <Workspace
            activeSourceTitle={activeSource?.title ?? null}
            onGrade={grade}
            onQueryChange={setQuery}
            onRun={run}
            snapshot={snapshot}
          />
        </div>
        <CitationRail citations={snapshot.citations} />
      </main>

      <footer className="flex flex-wrap justify-between gap-2 border-t border-studio-700 px-4 py-4 text-xs text-linen-500">
        <span>360GNH · nguồn mở · MIT</span>
        <span>Máy giả lập cục bộ là mặc định. Không gửi dữ liệu đi đâu cả.</span>
      </footer>
    </div>
  );
}
