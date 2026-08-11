import {
  BookMarked,
  BrainCircuit,
  Clapperboard,
  Map,
  MessagesSquare,
  ScrollText,
} from 'lucide-react';
import type { StudioMode } from '../lib/types.js';

const modes: Array<{ id: StudioMode; label: string; icon: typeof MessagesSquare }> = [
  { id: 'chat', label: 'Hỏi có nguồn', icon: MessagesSquare },
  { id: 'mindmap', label: 'Bản đồ', icon: Map },
  { id: 'quiz', label: 'Tự kiểm tra', icon: BrainCircuit },
  { id: 'guide', label: 'Hướng dẫn học', icon: BookMarked },
  { id: 'clips', label: 'Đoạn thông minh', icon: Clapperboard },
  { id: 'agora', label: 'Quảng trường', icon: ScrollText },
];

interface ModeNavProps {
  active: StudioMode;
  onChange: (mode: StudioMode) => void;
}

export function ModeNav({ active, onChange }: ModeNavProps) {
  return (
    <nav className="px-4 pt-3" aria-label="Công cụ tạo tri thức">
      <div
        className="grid grid-cols-2 border-b border-studio-700 md:grid-cols-6"
        role="tablist"
        aria-label="Chế độ làm việc"
      >
        {modes.map(({ id, label, icon: Icon }) => (
          <button
            aria-selected={active === id}
            className={`flex min-h-13 items-center justify-center gap-2 border-b-2 px-2 py-2 text-xs transition hover:bg-mint-300/10 hover:text-linen-100 ${active === id ? 'border-amber-300 text-amber-300' : 'border-transparent text-linen-500'}`}
            key={id}
            onClick={() => onChange(id)}
            role="tab"
            type="button"
          >
            <Icon aria-hidden="true" size={17} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
