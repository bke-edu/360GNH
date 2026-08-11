import { Download, Headphones, LoaderCircle, Mic2, ShieldCheck, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { studioApi } from '../lib/api.js';
import type { AudiobookStyle } from '../lib/api.js';
import { localizedError, useI18n } from '../lib/i18n.js';
import type { KnowledgeSource, StudioMeta } from '../lib/types.js';

interface AudiobookPanelProps {
  source: KnowledgeSource | null;
  meta: StudioMeta | null;
}

const STYLE_OPTIONS: Array<{
  value: AudiobookStyle;
  label: { vi: string; en: string };
  note: { vi: string; en: string };
}> = [
  {
    value: 'narrative',
    label: { vi: 'Kể chuyện', en: 'Narrative' },
    note: { vi: 'ấm, có nhịp', en: 'warm and paced' },
  },
  {
    value: 'educational',
    label: { vi: 'Giảng bài', en: 'Educational' },
    note: { vi: 'rõ thuật ngữ', en: 'clear terminology' },
  },
  {
    value: 'calm',
    label: { vi: 'Bình tĩnh', en: 'Calm' },
    note: { vi: 'chậm và dịu', en: 'slow and gentle' },
  },
  {
    value: 'cheerful',
    label: { vi: 'Tươi sáng', en: 'Cheerful' },
    note: { vi: 'thân thiện', en: 'friendly' },
  },
];

export function AudiobookPanel({ source, meta }: AudiobookPanelProps) {
  const { locale, pick } = useI18n();
  const voices = meta?.audiobook?.voices ?? ['coral'];
  const [voice, setVoice] = useState(voices.includes('coral') ? 'coral' : (voices[0] ?? 'coral'));
  const [style, setStyle] = useState<AudiobookStyle>('narrative');
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  const text = source?.editedText ?? source?.text ?? '';
  const maxCharacters = meta?.audiobook?.maxBookCharacters ?? 0;
  const tooLong = maxCharacters > 0 && text.length > maxCharacters;
  const supportsReadingStyle = !['tts-1', 'tts-1-hd'].includes(meta?.audiobook?.model ?? '');
  const sourceLabel = useMemo(
    () =>
      source?.editedText
        ? pick('bản sạch đã biên tập', 'the edited clean source')
        : pick('nội dung nguồn hiện tại', 'the current source'),
    [pick, source?.editedText],
  );

  const render = async () => {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      const audio = await studioApi.renderAudiobook({ sourceId: source.id, voice, style, speed });
      setAudioUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(audio);
      });
    } catch (reason) {
      setError(
        localizedError(
          reason,
          locale,
          pick('Chưa dựng được sách nói.', 'The audiobook could not be rendered.'),
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!source) {
    return (
      <EmptyAudiobook
        text={pick(
          'Chọn một nguồn trước; sách nói sẽ đọc đúng nguồn đó.',
          'Select a source first; the audiobook will read that exact source.',
        )}
      />
    );
  }
  if (!meta?.features.audiobook || !meta.audiobook) {
    return (
      <EmptyAudiobook
        text={pick(
          'Máy chủ chưa có OPENAI_API_KEY nên chưa thể dựng giọng đọc thật.',
          'OPENAI_API_KEY is not configured, so real speech rendering is unavailable.',
        )}
      />
    );
  }

  return (
    <article className="grid gap-6">
      <header className="border-b-4 border-double border-line-strong pb-5">
        <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-accent uppercase">
          {pick('Tài liệu → một tệp âm thanh', 'Source → one audio file')}
        </span>
        <h2 className="m-0 font-display text-3xl font-semibold tracking-tight">
          {pick('Dựng sách nói', 'Render an audiobook')}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          {pick('Đọc', 'Reads')} {sourceLabel}.{' '}
          {pick(
            'Văn bản được chia ở ranh giới câu, dựng tuần tự rồi ráp thành đúng một tệp WAV — không có tải hàng loạt.',
            'Text is split at sentence boundaries, rendered sequentially, and merged into exactly one WAV file—there is no bulk workflow.',
          )}
        </p>
      </header>

      <div className="grid gap-px border border-line bg-line md:grid-cols-3">
        <Metric label={pick('Nguồn', 'Source')} value={source.title} />
        <Metric
          label={pick('Độ dài', 'Length')}
          value={`${text.length.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} ${pick('ký tự', 'characters')}`}
        />
        <Metric
          label={pick('Máy đọc', 'Speech engine')}
          value={`${meta.audiobook.provider}/${meta.audiobook.model}`}
        />
      </div>

      {tooLong ? (
        <p className="m-0 border border-danger bg-danger-soft p-3 text-sm text-danger" role="alert">
          {pick(
            `Nguồn dài hơn giới hạn ${maxCharacters.toLocaleString('vi-VN')} ký tự của bản trình diễn. Hãy chia thành chương trước khi dựng.`,
            `The source exceeds the demo limit of ${maxCharacters.toLocaleString('en-US')} characters. Split it into chapters before rendering.`,
          )}
        </p>
      ) : null}

      <div className="grid gap-5 border-y border-line py-5 lg:grid-cols-2">
        <label className="grid gap-2 text-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
          {pick('Giọng đọc', 'Voice')}
          <select
            className="min-h-11 w-full min-w-0 border border-line-strong bg-paper-raised px-3 text-sm text-ink outline-accent"
            onChange={(event) => setVoice(event.target.value)}
            value={voice}
          >
            {voices.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
          {pick('Tốc độ', 'Speed')}
          <select
            className="min-h-11 w-full min-w-0 border border-line-strong bg-paper-raised px-3 text-sm text-ink outline-accent"
            onChange={(event) => setSpeed(Number(event.target.value))}
            value={speed}
          >
            <option value={0.85}>{pick('Chậm', 'Slow')}</option>
            <option value={1}>{pick('Tự nhiên', 'Natural')}</option>
            <option value={1.15}>{pick('Nhanh', 'Fast')}</option>
          </select>
        </label>
        <fieldset
          className="grid gap-2 disabled:opacity-55 lg:col-span-2"
          disabled={!supportsReadingStyle}
        >
          <legend className="mb-2 text-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
            {pick('Cách đọc', 'Reading style')}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {STYLE_OPTIONS.map((option) => (
              <button
                aria-pressed={style === option.value}
                className={`min-h-16 border p-3 text-left transition ${
                  style === option.value
                    ? 'border-accent bg-accent-soft text-accent-hover shadow-[2px_2px_0_var(--color-line)]'
                    : 'border-line-strong bg-paper-raised text-ink-soft hover:border-accent'
                }`}
                key={option.value}
                onClick={() => setStyle(option.value)}
                type="button"
              >
                <strong className="block text-sm">{option.label[locale]}</strong>
                <small className="text-xs text-ink-faint">{option.note[locale]}</small>
              </button>
            ))}
          </div>
          {!supportsReadingStyle ? (
            <small className="normal-case text-ink-faint">
              {pick(
                'Mô hình giọng đọc này chỉ hỗ trợ chọn giọng và tốc độ.',
                'This speech model supports only voice and speed controls.',
              )}
            </small>
          ) : null}
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 border border-accent bg-accent px-5 text-sm font-bold text-accent-contrast shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-x-px hover:-translate-y-px hover:bg-accent-hover hover:shadow-[3px_3px_0_var(--color-ink)] active:translate-x-px active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || tooLong}
          onClick={() => void render()}
          type="button"
        >
          {busy ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
          ) : (
            <Mic2 aria-hidden="true" size={17} />
          )}
          {busy
            ? pick('Đang dựng và ráp…', 'Rendering and merging…')
            : pick('Dựng sách nói', 'Render audiobook')}
        </button>
        <span className="flex items-center gap-2 text-xs text-ink-faint">
          <ShieldCheck aria-hidden="true" className="text-success" size={15} />
          {pick(
            'Giọng đọc do AI tạo; khóa chỉ nằm ở máy chủ.',
            'AI-generated voice; the key stays server-side.',
          )}
        </span>
      </div>

      {error ? (
        <p className="m-0 border border-danger bg-danger-soft p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {audioUrl ? (
        <section className="grid gap-4 border border-line-strong bg-paper-deep/25 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <span className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-success uppercase">
              <Volume2 aria-hidden="true" size={15} />{' '}
              {pick('Đã ráp xong một tệp', 'One file is ready')}
            </span>
            <audio className="w-full" controls src={audioUrl}>
              {pick('Trình duyệt không phát được tệp WAV.', 'Your browser cannot play WAV audio.')}
            </audio>
          </div>
          <a
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-line-strong bg-paper-raised px-4 text-sm font-bold text-accent no-underline hover:border-accent hover:text-accent-hover"
            download="360gnh-audiobook.wav"
            href={audioUrl}
          >
            <Download aria-hidden="true" size={17} /> {pick('Tải tệp WAV', 'Download WAV')}
          </a>
        </section>
      ) : null}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-paper-raised p-4">
      <small className="mb-1 block text-xs tracking-[0.1em] text-ink-faint uppercase">
        {label}
      </small>
      <strong className="block truncate text-sm font-semibold text-ink-soft">{value}</strong>
    </div>
  );
}

function EmptyAudiobook({ text }: { text: string }) {
  return (
    <div className="grid min-h-64 place-content-center justify-items-center p-6 text-center">
      <Headphones aria-hidden="true" className="mb-3 text-accent" size={30} />
      <p className="max-w-xl font-body text-lg leading-relaxed text-ink-soft">{text}</p>
    </div>
  );
}
