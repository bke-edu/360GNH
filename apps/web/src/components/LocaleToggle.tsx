import { Languages } from 'lucide-react';
import { useI18n } from '../lib/i18n.js';

export function LocaleToggle() {
  const { locale, setLocale, pick } = useI18n();

  return (
    <div
      aria-label={pick('Chọn ngôn ngữ', 'Choose language')}
      className="flex h-11 items-center rounded-full border border-line-strong bg-paper-deep/40"
      role="group"
    >
      <Languages aria-hidden="true" className="ml-2 hidden text-ink-faint sm:block" size={15} />
      {(['vi', 'en'] as const).map((item) => (
        <button
          aria-label={item === 'vi' ? 'Tiếng Việt' : 'English'}
          aria-pressed={locale === item}
          className={`grid h-11 min-w-11 place-items-center rounded-full px-2 text-[0.68rem] font-bold tracking-[0.08em] transition ${
            locale === item
              ? 'bg-accent text-accent-contrast shadow-[1px_1px_0_var(--color-ink)]'
              : 'text-ink-faint hover:bg-accent-soft hover:text-accent-hover'
          }`}
          key={item}
          onClick={() => setLocale(item)}
          type="button"
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
