import { Moon, Sun } from 'lucide-react';
import { useI18n } from '../lib/i18n.js';

type StudioTheme = 'light' | 'dark';

export function ThemeToggle({ theme, onToggle }: { theme: StudioTheme; onToggle: () => void }) {
  const dark = theme === 'dark';
  const { pick } = useI18n();
  return (
    <button
      aria-label={
        dark
          ? pick('Chuyển sang nền giấy sáng', 'Switch to light paper theme')
          : pick('Chuyển sang nền tối', 'Switch to dark theme')
      }
      aria-pressed={dark}
      className="grid size-11 shrink-0 place-items-center rounded-full border border-line-strong bg-transparent text-ink-soft transition duration-150 hover:-rotate-2 hover:border-accent hover:bg-accent-soft hover:text-accent-hover active:scale-95"
      onClick={onToggle}
      title={dark ? pick('Nền giấy sáng', 'Light paper theme') : pick('Nền tối', 'Dark theme')}
      type="button"
    >
      {dark ? <Sun aria-hidden="true" size={17} /> : <Moon aria-hidden="true" size={17} />}
    </button>
  );
}
