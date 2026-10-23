import { Github, LibraryBig, Settings2, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { CitationRail } from './components/CitationRail.js';
import { LocaleToggle } from './components/LocaleToggle.js';
import { ModeNav } from './components/ModeNav.js';
import { ProviderSettingsPanel } from './components/ProviderSettingsPanel.js';
import { SourceRail } from './components/SourceRail.js';
import { ThemeToggle } from './components/ThemeToggle.js';
import { Workspace } from './components/Workspace.js';
import { I18nProvider } from './lib/I18nProvider.js';
import { useI18n } from './lib/i18n.js';
import { useStudio } from './lib/useStudio.js';
import { useProviderSettings } from './lib/useProviderSettings.js';

type StudioTheme = 'light' | 'dark';

function initialTheme(): StudioTheme {
  try {
    const stored = localStorage.getItem('360gnh-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    // Storage can be unavailable; the studio still works with the paper theme.
  }
  return 'light';
}

export function App() {
  return (
    <I18nProvider>
      <StudioApp />
    </I18nProvider>
  );
}

function StudioApp() {
  const { locale, pick } = useI18n();
  const {
    snapshot,
    activeSource,
    setMode,
    setQuery,
    selectSource,
    addSource,
    importYouTube,
    editSource,
    run,
    grade,
    clearError,
    refreshMeta,
  } = useStudio(locale);
  const providerSettings = useProviderSettings(locale, refreshMeta);
  const [theme, setTheme] = useState(initialTheme);
  const hasExternalFeature = Boolean(
    snapshot.meta &&
    (snapshot.meta.provider !== 'local' ||
      snapshot.meta.features?.youtubeImport ||
      snapshot.meta.features?.audiobook),
  );

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('360gnh-theme', next);
      } catch {
        // Storage can be unavailable; the current page still changes theme.
      }
      return next;
    });
  };

  return (
    <div
      className={`${theme === 'dark' ? '[color-scheme:dark]' : '[color-scheme:light]'} min-h-dvh min-w-0 bg-paper font-sans text-ink transition-colors duration-200 before:pointer-events-none before:fixed before:inset-0 before:z-50 before:bg-[radial-gradient(circle,var(--color-texture-dot)_0_0.45px,transparent_0.6px)] before:opacity-20 before:content-[''] before:[background-size:7px_9px]`}
    >
      <a
        className="fixed top-3 left-3 z-60 -translate-y-40 border border-ink bg-paper-raised px-4 py-3 font-bold text-ink shadow-paper transition-transform focus:translate-y-0"
        href={providerSettings.open ? '#provider-settings' : '#main-workspace'}
      >
        {pick('Đi tới bàn làm việc', 'Skip to workspace')}
      </a>
      <header className="sticky top-0 z-30 border-b-4 border-double border-line-strong bg-paper">
        <div className="mx-auto flex min-h-17 max-w-[96rem] items-center gap-4 px-4 py-3 md:px-6">
          <a
            className="flex shrink-0 items-baseline gap-2 no-underline"
            href="/"
            aria-label="360GNH Knowledge Studio"
          >
            <strong className="font-display text-[1.55rem] font-semibold tracking-[-0.045em]">
              360GNH
            </strong>
            <span className="hidden text-[0.65rem] font-semibold tracking-[0.18em] text-ink-faint uppercase sm:inline">
              Knowledge Studio
            </span>
          </a>
          <div className="hidden items-center gap-2 text-sm text-ink-soft lg:flex">
            <LibraryBig aria-hidden="true" size={16} />
            <span>
              {pick(
                'Video dài vào. Tài liệu sạch và giọng đọc ra.',
                'Long video in. Clean source and narration out.',
              )}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-2 text-xs font-medium text-ink-faint md:inline-flex">
              <ShieldCheck aria-hidden="true" className="text-success" size={15} />
              {snapshot.meta?.provider === 'local'
                ? pick('không cần khóa để thử', 'no key needed to try')
                : pick('khóa mô hình nằm ở máy chủ', 'model key stays server-side')}
            </span>
            <LocaleToggle />
            <ThemeToggle onToggle={toggleTheme} theme={theme} />
            <button
              aria-label={pick('Thiết lập nhà cung cấp', 'Configure providers')}
              aria-pressed={providerSettings.open}
              className="grid size-11 shrink-0 place-items-center rounded-full border border-line-strong bg-transparent text-ink-soft transition duration-150 hover:-rotate-2 hover:border-accent hover:bg-accent-soft hover:text-accent-hover active:scale-95"
              onClick={
                providerSettings.open ? providerSettings.closePanel : providerSettings.openPanel
              }
              title={pick('Thiết lập khóa API', 'API key settings')}
              type="button"
            >
              <Settings2 aria-hidden="true" size={17} />
            </button>
            <a
              aria-label={pick('Mở kho mã GitHub', 'Open GitHub repository')}
              className="hidden size-11 place-items-center rounded-full border border-line-strong bg-transparent text-ink-soft transition duration-150 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-soft hover:text-accent-hover active:scale-95 sm:grid"
              href="https://github.com/bke-edu/360GNH"
              rel="noreferrer"
              target="_blank"
            >
              <Github aria-hidden="true" size={18} />
            </a>
          </div>
        </div>
      </header>

      {snapshot.error ? (
        <div
          className="mx-auto flex max-w-[96rem] items-center justify-between gap-4 border-x border-b border-danger bg-danger-soft px-4 py-3 text-sm text-danger"
          role="alert"
        >
          <span>{snapshot.error}</span>
          <button
            className="grid size-11 shrink-0 place-items-center bg-transparent transition hover:text-accent"
            aria-label={pick('Đóng thông báo lỗi', 'Dismiss error')}
            onClick={clearError}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </div>
      ) : null}

      {providerSettings.open ? (
        <ProviderSettingsPanel
          busy={providerSettings.busy}
          error={providerSettings.error}
          notice={providerSettings.notice}
          onClose={providerSettings.closePanel}
          onDeleteOpenAI={providerSettings.deleteOpenAI}
          onDeleteSupadata={providerSettings.deleteSupadata}
          onRetry={providerSettings.reload}
          onSaveOpenAI={providerSettings.saveOpenAI}
          onSaveSupadata={providerSettings.saveSupadata}
          status={providerSettings.status}
        />
      ) : (
        <main
          className="mx-auto grid min-h-[calc(100dvh-4.25rem)] w-full min-w-0 max-w-[96rem] grid-cols-1 border-x border-line lg:grid-cols-[16rem_minmax(0,1fr)] 2xl:grid-cols-[16rem_minmax(42rem,1fr)_18rem]"
          id="main-workspace"
        >
          <SourceRail
            activeSourceId={snapshot.activeSourceId}
            busy={snapshot.busy}
            onAdd={addSource}
            onImportYouTube={importYouTube}
            onSelect={selectSource}
            sources={snapshot.sources}
            youtubeImportAvailable={Boolean(snapshot.meta?.features?.youtubeImport)}
          />
          <div className="flex min-w-0 flex-col">
            <ModeNav active={snapshot.mode} onChange={setMode} />
            <Workspace
              activeSource={activeSource}
              onEdit={editSource}
              onGrade={grade}
              onQueryChange={setQuery}
              onRun={run}
              snapshot={snapshot}
            />
          </div>
          <CitationRail citations={snapshot.citations} />
        </main>
      )}

      <footer className="mx-auto flex max-w-[96rem] flex-wrap justify-between gap-2 border-x border-t-4 border-double border-line-strong px-4 py-6 text-xs text-ink-faint md:px-6">
        <span className="font-semibold tracking-[0.12em] uppercase">
          360GNH · {pick('nguồn mở', 'open source')} · MIT
        </span>
        <span>
          {hasExternalFeature
            ? pick(
                'Chỉ gửi dữ liệu ra ngoài khi mày chủ động nhập YouTube, gọi mô hình ngoài hoặc dựng sách nói.',
                'Data leaves this device only when you import YouTube, call an external model, or render an audiobook.',
              )
            : pick(
                'Máy giả lập cục bộ là mặc định. Không gửi dữ liệu đi đâu cả.',
                'The local deterministic model is the default. No data is sent anywhere.',
              )}
        </span>
      </footer>
    </div>
  );
}
