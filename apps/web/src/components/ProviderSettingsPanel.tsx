import { ArrowLeft, CheckCircle2, KeyRound, ShieldCheck, Youtube } from 'lucide-react';
import { useEffect, useReducer } from 'react';
import { useI18n } from '../lib/i18n.js';
import type { OpenAISettingsDraft, ProviderNotice } from '../lib/useProviderSettings.js';
import type { ProviderSettingsStatus } from '../lib/types.js';
import {
  EnvironmentManaged,
  fieldClass,
  ProviderActions,
  ProviderCard,
  SecretField,
  SelectField,
} from './ProviderSettingsControls.js';

type OpenAIModel = OpenAISettingsDraft['model'];
type TtsModel = OpenAISettingsDraft['ttsModel'];
type ConfirmDelete = 'openai' | 'supadata' | null;

interface FormState {
  openaiKey: string;
  openaiModel: OpenAIModel;
  budgetUsd: string;
  ttsModel: TtsModel;
  supadataKey: string;
  confirmDelete: ConfirmDelete;
}

type FormAction =
  | { type: 'sync'; status: ProviderSettingsStatus }
  | { type: 'openai-key'; value: string }
  | { type: 'openai-model'; value: OpenAIModel }
  | { type: 'budget'; value: string }
  | { type: 'tts-model'; value: TtsModel }
  | { type: 'supadata-key'; value: string }
  | { type: 'clear-openai-key' }
  | { type: 'clear-supadata-key' }
  | { type: 'confirm-delete'; value: ConfirmDelete };

const initialForm: FormState = {
  openaiKey: '',
  openaiModel: 'gpt-5.6-luna',
  budgetUsd: '1',
  ttsModel: 'gpt-4o-mini-tts',
  supadataKey: '',
  confirmDelete: null,
};

interface ProviderSettingsPanelProps {
  status: ProviderSettingsStatus | null;
  busy: boolean;
  error: string | null;
  notice: ProviderNotice | null;
  onClose: () => void;
  onRetry: () => Promise<void>;
  onSaveOpenAI: (draft: OpenAISettingsDraft) => Promise<boolean>;
  onDeleteOpenAI: () => Promise<boolean>;
  onSaveSupadata: (apiKey: string) => Promise<boolean>;
  onDeleteSupadata: () => Promise<boolean>;
}

export function ProviderSettingsPanel({
  status,
  busy,
  error,
  notice,
  onClose,
  onRetry,
  onSaveOpenAI,
  onDeleteOpenAI,
  onSaveSupadata,
  onDeleteSupadata,
}: ProviderSettingsPanelProps) {
  const { pick } = useI18n();
  const [form, dispatch] = useReducer(formReducer, initialForm);

  useEffect(() => {
    if (status) dispatch({ type: 'sync', status });
  }, [status]);

  const submitOpenAI = async () => {
    const saved = await onSaveOpenAI({
      apiKey: form.openaiKey,
      model: form.openaiModel,
      budgetUsd: Number(form.budgetUsd),
      ttsModel: form.ttsModel,
    });
    if (saved) dispatch({ type: 'clear-openai-key' });
  };

  const submitSupadata = async () => {
    const saved = await onSaveSupadata(form.supadataKey);
    if (saved) dispatch({ type: 'clear-supadata-key' });
  };

  const deleteProvider = async (provider: Exclude<ConfirmDelete, null>) => {
    if (form.confirmDelete !== provider) {
      dispatch({ type: 'confirm-delete', value: provider });
      return;
    }
    const deleted = provider === 'openai' ? await onDeleteOpenAI() : await onDeleteSupadata();
    if (deleted) dispatch({ type: 'confirm-delete', value: null });
  };

  return (
    <main
      className="mx-auto min-h-[calc(100dvh-4.25rem)] w-full max-w-[96rem] border-x border-line bg-paper"
      id="provider-settings"
    >
      <div className="grid min-h-[calc(100dvh-4.25rem)] content-start grid-cols-1 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(38rem,1.28fr)]">
        <section className="border-b-4 border-double border-line-strong px-5 py-8 md:px-10 md:py-12 xl:border-r xl:border-b-0">
          <button
            className="mb-10 inline-flex min-h-11 items-center gap-2 border-b border-transparent px-1 text-sm font-semibold text-ink-soft transition hover:border-accent hover:text-accent active:scale-[0.98]"
            onClick={onClose}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={17} />
            {pick('Quay lại xưởng', 'Back to the studio')}
          </button>
          <p className="mb-3 text-xs font-bold tracking-[0.18em] text-accent uppercase">
            {pick('Thiết lập một lần', 'One-time setup')}
          </p>
          <h1 className="max-w-xl font-display text-[clamp(2.6rem,8vw,5.5rem)] leading-[0.9] font-semibold tracking-[-0.055em] text-ink">
            {pick('Kết nối dịch vụ', 'Connect providers')}
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-ink-soft md:text-lg md:leading-8">
            {pick(
              'Thêm khóa để mở biên tập AI, lấy phụ đề YouTube và dựng sách nói. Không thêm gì vẫn dùng được bản demo cục bộ.',
              'Add keys for AI editing, YouTube transcripts, and audiobook rendering. The local demo still works without them.',
            )}
          </p>

          <div className="mt-10 border-y border-line py-6">
            <div className="flex gap-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-success" size={21} />
              <div>
                <h2 className="font-display text-xl font-semibold">
                  {pick('Khóa không ở lại trình duyệt', 'Keys do not stay in the browser')}
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  {pick(
                    'Giao diện chỉ gửi khóa một lần đến API. Máy chủ lưu trong kho riêng có quyền đọc giới hạn và chỉ trả lại bốn ký tự cuối.',
                    'The interface sends each key once to the API. The server stores it in a restricted private file and returns only the last four characters.',
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="min-w-0 px-4 py-7 md:px-8 md:py-10 lg:px-12" aria-busy={busy}>
          <div className="mx-auto max-w-3xl space-y-7">
            {error ? (
              <div
                className="flex items-start justify-between gap-4 border border-danger bg-danger-soft px-4 py-3 text-sm text-danger"
                role="alert"
              >
                <span>{error}</span>
                {!status ? (
                  <button
                    className="min-h-11 shrink-0 px-3 font-bold underline underline-offset-4"
                    onClick={() => void onRetry()}
                    type="button"
                  >
                    {pick('Thử lại', 'Retry')}
                  </button>
                ) : null}
              </div>
            ) : null}

            {notice ? (
              <div
                className="flex items-center gap-3 border border-success bg-success-soft px-4 py-3 text-sm font-semibold text-success"
                aria-live="polite"
              >
                <CheckCircle2 aria-hidden="true" size={18} />
                {noticeCopy(notice, pick)}
              </div>
            ) : null}

            <ProviderCard
              description={pick(
                'Dùng cho biên tập nguồn, hỏi đáp, bản đồ, bài kiểm tra, hướng dẫn học và giọng đọc.',
                'Powers source editing, answers, mind maps, quizzes, study guides, and speech.',
              )}
              icon={<KeyRound aria-hidden="true" size={22} />}
              source={status?.openai.source ?? 'missing'}
              title="OpenAI"
            >
              {status?.openai.source === 'environment' ? (
                <EnvironmentManaged hint={status.openai.keyHint} />
              ) : (
                <form
                  className="mt-6 space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitOpenAI();
                  }}
                >
                  <SecretField
                    hint={status?.openai.keyHint}
                    id="openai-api-key"
                    label={pick('Khóa API OpenAI', 'OpenAI API key')}
                    onChange={(value) => dispatch({ type: 'openai-key', value })}
                    placeholder={
                      status?.openai.configured
                        ? pick('Nhập khóa mới để thay', 'Enter a new key to replace')
                        : 'sk-…'
                    }
                    value={form.openaiKey}
                  />

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <SelectField
                      id="openai-model"
                      label={pick('Mô hình tri thức', 'Knowledge model')}
                      onChange={(value) =>
                        dispatch({ type: 'openai-model', value: value as OpenAIModel })
                      }
                      options={['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6', 'gpt-5.6-sol']}
                      value={form.openaiModel}
                    />
                    <SelectField
                      id="openai-tts-model"
                      label={pick('Mô hình giọng đọc', 'Speech model')}
                      onChange={(value) =>
                        dispatch({ type: 'tts-model', value: value as TtsModel })
                      }
                      options={['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd']}
                      value={form.ttsModel}
                    />
                  </div>

                  <label className="block" htmlFor="openai-budget">
                    <span className="mb-2 block text-sm font-bold">
                      {pick('Trần chi phí mỗi tiến trình (USD)', 'Per-process cost ceiling (USD)')}
                    </span>
                    <input
                      className={fieldClass}
                      id="openai-budget"
                      inputMode="decimal"
                      max="10000"
                      min="0.01"
                      onChange={(event) => dispatch({ type: 'budget', value: event.target.value })}
                      required
                      step="0.01"
                      type="number"
                      value={form.budgetUsd}
                    />
                  </label>

                  <p className="text-xs leading-5 text-ink-faint">
                    {pick(
                      'Kiểm tra chỉ đọc thông tin hai mô hình đã chọn; không tạo nội dung tính phí.',
                      'Verification only reads metadata for the two selected models; it creates no billable content.',
                    )}
                  </p>
                  <ProviderActions
                    busy={busy}
                    canDelete={status?.openai.source === 'stored'}
                    confirmDelete={form.confirmDelete === 'openai'}
                    disabled={!form.openaiKey || !Number.isFinite(Number(form.budgetUsd))}
                    onDelete={() => void deleteProvider('openai')}
                    submitLabel={pick('Kiểm tra và lưu OpenAI', 'Verify and save OpenAI')}
                  />
                </form>
              )}
              {status?.openai.configured && !status.openai.knowledgeModelEnabled ? (
                <div className="mt-4 border-l-4 border-accent bg-accent-soft px-4 py-3 text-sm leading-6 text-ink-soft">
                  {pick(
                    'Khóa này hiện chỉ dùng cho giọng đọc. Máy chủ đang dùng mô hình demo cục bộ cho các công cụ tri thức.',
                    'This key currently powers speech only. Knowledge tools are still using the local demo model.',
                  )}
                </div>
              ) : null}
            </ProviderCard>

            <ProviderCard
              description={pick(
                'Lấy phụ đề gốc có mốc thời gian cho từng video. Không có khóa này vẫn dán văn bản thủ công được.',
                'Imports timestamped native captions one video at a time. Manual text input still works without it.',
              )}
              icon={<Youtube aria-hidden="true" size={22} />}
              source={status?.supadata.source ?? 'missing'}
              title="Supadata"
            >
              {status?.supadata.source === 'environment' ? (
                <EnvironmentManaged hint={status.supadata.keyHint} />
              ) : (
                <form
                  className="mt-6 space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitSupadata();
                  }}
                >
                  <SecretField
                    hint={status?.supadata.keyHint}
                    id="supadata-api-key"
                    label={pick('Khóa API Supadata', 'Supadata API key')}
                    onChange={(value) => dispatch({ type: 'supadata-key', value })}
                    placeholder={
                      status?.supadata.configured
                        ? pick('Nhập khóa mới để thay', 'Enter a new key to replace')
                        : pick('Dán khóa Supadata', 'Paste Supadata key')
                    }
                    value={form.supadataKey}
                  />
                  <p className="text-xs leading-5 text-ink-faint">
                    {pick(
                      'Kiểm tra bằng trạng thái một công việc không tồn tại; Supadata không tính lượt cho việc xem trạng thái công việc.',
                      'Verification checks a deliberately absent job; Supadata does not bill job-status checks.',
                    )}
                  </p>
                  <ProviderActions
                    busy={busy}
                    canDelete={status?.supadata.source === 'stored'}
                    confirmDelete={form.confirmDelete === 'supadata'}
                    disabled={!form.supadataKey}
                    onDelete={() => void deleteProvider('supadata')}
                    submitLabel={pick('Kiểm tra và lưu Supadata', 'Verify and save Supadata')}
                  />
                </form>
              )}
            </ProviderCard>

            <div className="flex flex-col gap-3 border-t-4 border-double border-line-strong pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-xs leading-5 text-ink-faint">
                {pick(
                  'Nếu Docker hoặc tài khoản hệ điều hành đã bị chiếm quyền, kẻ tấn công vẫn có thể đọc khóa máy chủ. Kho này bảo vệ khỏi rò rỉ qua mã nguồn và trình duyệt, không phải phép thuật chống quản trị viên máy.',
                  'A compromised Docker daemon or operating-system account can still read server secrets. This store prevents source and browser leaks; it cannot defeat a machine administrator.',
                )}
              </p>
              <button
                className="min-h-11 shrink-0 border border-line-strong bg-paper-raised px-5 text-sm font-bold shadow-paper transition hover:-translate-y-0.5 hover:border-accent hover:text-accent active:scale-[0.98]"
                onClick={onClose}
                type="button"
              >
                {pick('Vào xưởng', 'Enter the studio')}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function noticeCopy(
  notice: ProviderNotice,
  pick: (vietnamese: string, english: string) => string,
): string {
  switch (notice) {
    case 'openai_saved':
      return pick(
        'Đã xác minh khóa và quyền xem mô hình. Quyền tạo nội dung sẽ được kiểm tra khi dùng.',
        'The key and model visibility are verified. Content-generation permission will be checked when used.',
      );
    case 'openai_deleted':
      return pick(
        'Đã xóa khóa OpenAI; mô hình cục bộ đang hoạt động.',
        'OpenAI key deleted; the local model is active.',
      );
    case 'supadata_saved':
      return pick('Đã xác minh khóa Supadata.', 'Supadata key verified.');
    case 'supadata_deleted':
      return pick('Đã xóa khóa Supadata.', 'Supadata key deleted.');
  }
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'sync':
      return {
        ...state,
        openaiModel: toOpenAIModel(action.status.openai.model),
        budgetUsd: String(action.status.openai.budgetUsd),
        ttsModel: toTtsModel(action.status.openai.ttsModel),
      };
    case 'openai-key':
      return { ...state, openaiKey: action.value };
    case 'openai-model':
      return { ...state, openaiModel: action.value };
    case 'budget':
      return { ...state, budgetUsd: action.value };
    case 'tts-model':
      return { ...state, ttsModel: action.value };
    case 'supadata-key':
      return { ...state, supadataKey: action.value };
    case 'clear-openai-key':
      return { ...state, openaiKey: '' };
    case 'clear-supadata-key':
      return { ...state, supadataKey: '' };
    case 'confirm-delete':
      return { ...state, confirmDelete: action.value };
  }
}

function toOpenAIModel(value: string): OpenAIModel {
  return ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6', 'gpt-5.6-sol'].includes(value)
    ? (value as OpenAIModel)
    : 'gpt-5.6-luna';
}

function toTtsModel(value: string): TtsModel {
  return ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'].includes(value)
    ? (value as TtsModel)
    : 'gpt-4o-mini-tts';
}
