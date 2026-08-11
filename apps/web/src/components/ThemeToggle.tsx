import { Moon, Sun } from 'lucide-react';

type StudioTheme = 'light' | 'dark';

export function ThemeToggle({ theme, onToggle }: { theme: StudioTheme; onToggle: () => void }) {
  const dark = theme === 'dark';
  return (
    <button
      aria-label={dark ? 'Chuyển sang nền giấy sáng' : 'Chuyển sang nền tối'}
      aria-pressed={dark}
      className="grid size-11 shrink-0 place-items-center rounded-full border border-line-strong bg-transparent text-ink-soft transition duration-150 hover:-rotate-2 hover:border-accent hover:bg-accent-soft hover:text-accent-hover active:scale-95"
      onClick={onToggle}
      title={dark ? 'Nền giấy sáng' : 'Nền tối'}
      type="button"
    >
      {dark ? <Sun aria-hidden="true" size={17} /> : <Moon aria-hidden="true" size={17} />}
    </button>
  );
}
