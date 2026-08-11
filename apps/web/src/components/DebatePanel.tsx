import { MessageCircleMore, Scale, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../lib/i18n.js';
import type { AgoraAgent, DebateResult } from '../lib/types.js';

interface DebatePanelProps {
  agents: AgoraAgent[];
  debate: DebateResult | null;
  busy: boolean;
  onRun: (agentIds: string[]) => Promise<void>;
}

export function DebatePanel({ agents, debate, busy, onRun }: DebatePanelProps) {
  const { locale, pick } = useI18n();
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
      <div
        className="grid gap-4"
        aria-label={pick('Chọn người tranh luận', 'Choose debate perspectives')}
      >
        <div>
          <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-accent uppercase">
            {pick('Hội đồng', 'Panel')}
          </span>
          <small className="font-body text-sm text-ink-faint">
            {pick(
              'Chọn 2–4 góc nhìn. Mỗi bên phải trích nguồn.',
              'Choose 2–4 perspectives. Every side must cite the source.',
            )}
          </small>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {agents.map((agent) => (
            <label
              className={`grid min-h-18 cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-1 border p-3 transition duration-150 ${selected.includes(agent.id) ? 'border-accent bg-accent-soft shadow-[2px_2px_0_var(--color-line)]' : 'border-line-strong hover:border-accent hover:bg-paper-deep'}`}
              key={agent.id}
            >
              <input
                checked={selected.includes(agent.id)}
                onChange={() => toggle(agent.id)}
                className="row-span-2 size-4 min-h-0 accent-accent"
                type="checkbox"
              />
              <strong className="text-sm">{agentCopy(agent, locale).name}</strong>
              <small className="font-body text-xs leading-relaxed text-ink-faint">
                {agentCopy(agent, locale).description}
              </small>
            </label>
          ))}
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 border border-accent bg-accent px-4 text-sm font-bold text-accent-contrast shadow-[2px_2px_0_var(--color-ink)] transition duration-150 hover:-translate-x-px hover:-translate-y-px hover:bg-accent-hover hover:shadow-[3px_3px_0_var(--color-ink)] active:translate-x-px active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || selected.length < 2}
          onClick={() => void onRun(selected)}
          type="button"
        >
          <MessageCircleMore aria-hidden="true" size={17} />
          {busy
            ? pick('Đang mở phiên…', 'Opening session…')
            : pick('Mở phiên tranh luận', 'Start debate')}
        </button>
      </div>

      {debate ? (
        <div
          className="mt-8 grid gap-3 border-t-4 border-double border-line-strong pt-6"
          aria-live="polite"
        >
          {debate.messages.map((message) => (
            <article
              className={`border-l-4 p-4 ${message.phase === 'collision' ? 'border-accent bg-accent-soft' : 'border-success bg-success-soft'}`}
              key={message.id}
            >
              <header className="mb-3 flex items-baseline justify-between gap-3">
                <span className="font-display text-xl font-semibold">
                  {agentName(message.agentId, message.agentName, locale)}
                </span>
                <small className="text-xs text-ink-faint">
                  {message.phase === 'exploration'
                    ? pick('Mở góc nhìn', 'Exploration')
                    : pick('Va chạm', 'Challenge')}{' '}
                  · {pick('vòng', 'round')} {message.round}
                </small>
              </header>
              <p className="font-body leading-relaxed text-ink-soft">{message.content}</p>
              {message.citations.length > 0 ? (
                <footer className="text-xs text-ink-faint">
                  {message.citations.map((citation) => citation.sourceTitle).join(' · ')}
                </footer>
              ) : null}
            </article>
          ))}
          <section className="mt-5 border border-line-strong bg-paper-deep p-5 shadow-paper">
            <div className="mb-5 flex items-center gap-3 text-accent">
              <Scale aria-hidden="true" size={22} />
              <div>
                <span className="mb-1 block text-xs tracking-[0.14em] uppercase">
                  {pick('Tổng hợp sau va chạm', 'Synthesis after challenge')}
                </span>
                <h2 className="m-0 font-display text-3xl font-semibold text-ink">
                  {pick('Không chọn phe hộ mày', 'No winner picked for you')}
                </h2>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-ink-soft">
                  {pick('Điểm cùng đứng được', 'Common ground')}
                </h3>
                <ul className="pl-5 font-body text-sm leading-relaxed text-ink-faint marker:text-accent">
                  {debate.summary.commonGround.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink-soft">
                  {pick('Câu còn mở', 'Open questions')}
                </h3>
                <ul className="pl-5 font-body text-sm leading-relaxed text-ink-faint marker:text-accent">
                  {debate.summary.openQuestions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-5 flex items-start gap-2 border-t border-line pt-4 font-body leading-relaxed text-accent">
              <Sparkles aria-hidden="true" size={18} /> {debate.summary.decisionFramework}
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}

const ENGLISH_AGENTS: Record<string, { name: string; description: string }> = {
  'evidence-auditor': {
    name: 'Evidence auditor',
    description: 'Separates facts from inference, demands sources, and flags weak evidence.',
  },
  'systems-critic': {
    name: 'Systems critic',
    description: 'Looks for side effects, feedback loops, and hidden assumptions.',
  },
  'field-practitioner': {
    name: 'Field practitioner',
    description: 'Tests every claim against real situations, costs, and feasibility.',
  },
  'curious-learner': {
    name: 'Curious learner',
    description: 'Asks simple-looking questions that force the underlying mechanism into view.',
  },
};

function agentCopy(agent: AgoraAgent, locale: 'vi' | 'en') {
  return locale === 'en' ? (ENGLISH_AGENTS[agent.id] ?? agent) : agent;
}

function agentName(id: string, fallback: string, locale: 'vi' | 'en'): string {
  return locale === 'en' ? (ENGLISH_AGENTS[id]?.name ?? fallback) : fallback;
}
