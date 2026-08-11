import { MessageCircleMore, Scale, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { AgoraAgent, DebateResult } from '../lib/types.js';

interface DebatePanelProps {
  agents: AgoraAgent[];
  debate: DebateResult | null;
  busy: boolean;
  onRun: (agentIds: string[]) => Promise<void>;
}

export function DebatePanel({ agents, debate, busy, onRun }: DebatePanelProps) {
  const [selected, setSelected] = useState(() => agents.slice(0, 3).map((agent) => agent.id));

  const toggle = (id: string) => {
    setSelected((current) => {
      if (current.includes(id))
        return current.length <= 2 ? current : current.filter((item) => item !== id);
      return current.length >= 4 ? current : [...current, id];
    });
  };

  return (
    <div>
      <div className="grid gap-4" aria-label="Chọn người tranh luận">
        <div>
          <span className="mb-1 block text-xs tracking-[0.14em] text-amber-300 uppercase">
            Hội đồng
          </span>
          <small className="text-sm text-linen-500">
            Chọn 2–4 góc nhìn. Mỗi bên phải trích nguồn.
          </small>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {agents.map((agent) => (
            <label
              className={`grid min-h-18 cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-sm border p-3 ${selected.includes(agent.id) ? 'border-amber-300 bg-amber-300/10' : 'border-studio-700'}`}
              key={agent.id}
            >
              <input
                checked={selected.includes(agent.id)}
                onChange={() => toggle(agent.id)}
                className="row-span-2 size-4 min-h-0 accent-amber-300"
                type="checkbox"
              />
              <strong className="text-sm">{agent.name}</strong>
              <small className="text-xs leading-relaxed text-linen-500">{agent.description}</small>
            </label>
          ))}
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-amber-300 bg-amber-300 px-4 text-sm font-bold text-studio-950 transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || selected.length < 2}
          onClick={() => void onRun(selected)}
          type="button"
        >
          <MessageCircleMore aria-hidden="true" size={17} />
          {busy ? 'Đang mở phiên…' : 'Mở phiên tranh luận'}
        </button>
      </div>

      {debate ? (
        <div className="mt-8 grid gap-3 border-t border-studio-700 pt-6" aria-live="polite">
          {debate.messages.map((message) => (
            <article
              className={`border-l-3 p-4 ${message.phase === 'collision' ? 'border-amber-300 bg-amber-300/10' : 'border-mint-300 bg-mint-300/10'}`}
              key={message.id}
            >
              <header className="mb-3 flex items-baseline justify-between gap-3">
                <span className="font-display text-xl">{message.agentName}</span>
                <small className="text-xs text-linen-500">
                  {message.phase === 'exploration' ? 'Mở góc nhìn' : 'Va chạm'} · vòng{' '}
                  {message.round}
                </small>
              </header>
              <p className="text-linen-400 leading-relaxed">{message.content}</p>
              {message.citations.length > 0 ? (
                <footer className="text-xs text-linen-500">
                  {message.citations.map((citation) => citation.sourceTitle).join(' · ')}
                </footer>
              ) : null}
            </article>
          ))}
          <section className="mt-5 border border-studio-500 bg-studio-850 p-5">
            <div className="mb-5 flex items-center gap-3 text-amber-300">
              <Scale aria-hidden="true" size={22} />
              <div>
                <span className="mb-1 block text-xs tracking-[0.14em] uppercase">
                  Tổng hợp sau va chạm
                </span>
                <h2 className="m-0 font-display text-3xl font-medium text-linen-100">
                  Không chọn phe hộ mày
                </h2>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm text-linen-400">Điểm cùng đứng được</h3>
                <ul className="pl-5 text-sm leading-relaxed text-linen-500">
                  {debate.summary.commonGround.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm text-linen-400">Câu còn mở</h3>
                <ul className="pl-5 text-sm leading-relaxed text-linen-500">
                  {debate.summary.openQuestions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-5 flex items-start gap-2 border-t border-studio-700 pt-4 leading-relaxed text-amber-300">
              <Sparkles aria-hidden="true" size={18} /> {debate.summary.decisionFramework}
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
