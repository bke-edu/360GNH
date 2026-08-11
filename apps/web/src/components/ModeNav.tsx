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

const modes: Array<{ id: StudioMode; label: string; icon: typeof MessagesSquare }> = [
  { id: 'editor', label: 'Biên tập', icon: FilePenLine },
  { id: 'chat', label: 'Hỏi có nguồn', icon: MessagesSquare },
  { id: 'mindmap', label: 'Bản đồ', icon: Map },
  { id: 'quiz', label: 'Tự kiểm tra', icon: BrainCircuit },
  { id: 'guide', label: 'Hướng dẫn học', icon: BookMarked },
  { id: 'clips', label: 'Đoạn thông minh', icon: Clapperboard },
  { id: 'audiobook', label: 'Sách nói', icon: Headphones },
  { id: 'agora', label: 'Quảng trường', icon: ScrollText },
];

interface ModeNavProps {
  active: StudioMode;
  onChange: (mode: StudioMode) => void;
}

export function ModeNav({ active, onChange }: ModeNavProps) {
  return (
    <nav className="min-w-0 px-4 pt-4 md:px-6" aria-label="Công cụ tạo tri thức">
      <div
        className="grid min-w-0 grid-cols-2 border-y border-line sm:grid-cols-4 xl:grid-cols-8"
        role="tablist"
        aria-label="Chế độ làm việc"
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
            <span className="min-w-0 text-center">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
