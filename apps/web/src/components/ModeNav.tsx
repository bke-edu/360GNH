import {
  BookMarked,
  BrainCircuit,
  Clapperboard,
  FilePenLine,
  Headphones,
  Map,
  MessagesSquare,
  ScrollText,
} from 'lucide-react';
import type { StudioMode } from '../lib/types.js';
import { useI18n } from '../lib/i18n.js';

const modes: Array<{
  id: StudioMode;
  label: { vi: string; en: string };
  icon: typeof MessagesSquare;
}> = [
  { id: 'editor', label: { vi: 'Biên tập', en: 'Editor' }, icon: FilePenLine },
  { id: 'chat', label: { vi: 'Hỏi có nguồn', en: 'Cited chat' }, icon: MessagesSquare },
  { id: 'mindmap', label: { vi: 'Bản đồ', en: 'Mind map' }, icon: Map },
  { id: 'quiz', label: { vi: 'Tự kiểm tra', en: 'Quiz' }, icon: BrainCircuit },
  { id: 'guide', label: { vi: 'Hướng dẫn học', en: 'Study guide' }, icon: BookMarked },
  { id: 'clips', label: { vi: 'Đoạn thông minh', en: 'Smart clips' }, icon: Clapperboard },
  { id: 'audiobook', label: { vi: 'Sách nói', en: 'Audiobook' }, icon: Headphones },
  { id: 'agora', label: { vi: 'Quảng trường', en: 'Agora' }, icon: ScrollText },
];

interface ModeNavProps {
  active: StudioMode;
  onChange: (mode: StudioMode) => void;
}

export function ModeNav({ active, onChange }: ModeNavProps) {
  const { locale, pick } = useI18n();
  return (
    <nav
      className="min-w-0 px-4 pt-4 md:px-6"
      aria-label={pick('Công cụ tạo tri thức', 'Knowledge creation tools')}
    >
      <div
        className="grid min-w-0 grid-cols-2 border-y border-line sm:grid-cols-4 xl:grid-cols-8"
        role="tablist"
        aria-label={pick('Chế độ làm việc', 'Workspace mode')}
      >
        {modes.map(({ id, label, icon: Icon }) => (
          <button
            aria-selected={active === id}
            className={`flex min-w-0 min-h-13 items-center justify-center gap-2 border-b-2 px-2 py-2 text-xs leading-tight font-semibold transition duration-150 hover:bg-accent-soft hover:text-accent-hover ${active === id ? 'border-accent bg-accent-soft text-accent-hover' : 'border-transparent text-ink-faint'}`}
            key={id}
            onClick={() => onChange(id)}
            role="tab"
            type="button"
          >
            <Icon aria-hidden="true" className="shrink-0" size={17} />
            <span className="min-w-0 text-center">{label[locale]}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
