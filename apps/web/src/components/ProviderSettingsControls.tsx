import { LoaderCircle, ServerCog, ShieldCheck, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../lib/i18n.js';
import type { ProviderSettingsSource } from '../lib/types.js';

export function ProviderCard({
  title,
  description,
  icon,
  source,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  source: ProviderSettingsSource;
  children: ReactNode;
}) {
  const { pick } = useI18n();
  return (
    <article className="border border-line-strong bg-paper-raised p-5 shadow-paper md:p-7">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center border border-line-strong bg-paper-deep text-accent">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.025em]">{title}</h2>
            <StatusBadge source={source} />
          </div>
          <p className="mt-1 text-sm leading-6 text-ink-soft">{description}</p>
        </div>
      </div>
      {children}
      {source === 'missing' ? (
        <p className="mt-4 flex items-center gap-2 text-xs font-medium text-ink-faint">
          <ServerCog aria-hidden="true" size={15} />
          {pick('Chưa cấu hình; bản demo vẫn hoạt động.', 'Not configured; the demo still works.')}
        </p>
      ) : null}
    </article>
  );
}

function StatusBadge({ source }: { source: ProviderSettingsSource }) {
  const { pick } = useI18n();
  const copy =
    source === 'environment'
      ? pick('Biến môi trường', 'Environment')
      : source === 'stored'
        ? pick('Đã lưu', 'Stored')
        : pick('Chưa có khóa', 'No key');
  return (
    <span
      className={`border px-2 py-1 text-[0.65rem] font-bold tracking-[0.1em] uppercase ${
        source === 'missing'
          ? 'border-line text-ink-faint'
          : 'border-success bg-success-soft text-success'
      }`}
    >
      {copy}
    </span>
  );
}

export function EnvironmentManaged({ hint }: { hint: string | undefined }) {
  const { pick } = useI18n();
  return (
    <div className="mt-6 flex flex-col gap-3 border-l-4 border-success bg-success-soft px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-bold text-success">
          {pick('Máy chủ đang quản lý khóa này', 'This key is managed by the server')}
        </p>
        <p className="mt-1 text-xs leading-5 text-ink-soft">
          {pick(
            'Muốn đổi khóa, hãy sửa biến môi trường và khởi động lại container API.',
            'To replace it, update the environment variable and restart the API container.',
          )}
        </p>
      </div>
      {hint ? <code className="shrink-0 text-sm font-bold text-ink">{hint}</code> : null}
    </div>
  );
}

export function SecretField({
  id,
  label,
  value,
  placeholder,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  hint: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
        <span>{label}</span>
        {hint ? <code className="text-xs text-success">{hint}</code> : null}
      </span>
      <input
        autoCapitalize="off"
        autoComplete="off"
        className={fieldClass}
        id={id}
        maxLength={500}
        minLength={8}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        spellCheck={false}
        type="password"
        value={value}
      />
    </label>
  );
}

export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <select
        className={fieldClass}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ProviderActions({
  busy,
  disabled,
  canDelete,
  confirmDelete,
  submitLabel,
  onDelete,
}: {
  busy: boolean;
  disabled: boolean;
  canDelete: boolean;
  confirmDelete: boolean;
  submitLabel: string;
  onDelete: () => void;
}) {
  const { pick } = useI18n();
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      {canDelete ? (
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 border border-danger px-4 text-sm font-bold text-danger transition hover:bg-danger-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={onDelete}
          type="button"
        >
          <Trash2 aria-hidden="true" size={16} />
          {confirmDelete
            ? pick('Bấm lần nữa để xóa', 'Press again to delete')
            : pick('Xóa khóa đã lưu', 'Delete stored key')}
        </button>
      ) : (
        <span />
      )}
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 bg-accent px-5 text-sm font-bold text-accent-contrast shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:bg-accent-hover active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy || disabled}
        type="submit"
      >
        {busy ? (
          <LoaderCircle
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
            size={17}
          />
        ) : (
          <ShieldCheck aria-hidden="true" size={17} />
        )}
        {busy ? pick('Đang kiểm tra…', 'Verifying…') : submitLabel}
      </button>
    </div>
  );
}

export const fieldClass =
  'min-h-11 w-full min-w-0 border border-line-strong bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent-soft';
