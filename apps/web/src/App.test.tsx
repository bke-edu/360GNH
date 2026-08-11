import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

const source = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Nguồn thử nghiệm',
  kind: 'transcript',
  text: 'Nhớ chủ động buộc người học tự gọi kiến thức ra khỏi trí nhớ để kiểm tra hiểu biết.',
  createdAt: '2026-08-11T00:00:00.000Z',
};

const importedSource = {
  ...source,
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Video nhập thử',
  sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  rawText: 'Bản phụ đề thô vẫn còn nguyên để người dùng đối chiếu trước khi cho AI biên tập.',
  text: 'Bản phụ đề thô vẫn còn nguyên để người dùng đối chiếu trước khi cho AI biên tập.',
  transcriptLanguage: 'vi',
  availableTranscriptLanguages: ['vi'],
};

const editedSource = {
  ...importedSource,
  text: 'Bản sạch đã được biên tập nhưng vẫn giữ nguyên ý nghĩa của nguồn.',
  editedText: 'Bản sạch đã được biên tập nhưng vẫn giữ nguyên ý nghĩa của nguồn.',
  editStats: {
    parts: 1,
    wordRatio: 0.88,
    inputTokens: 120,
    outputTokens: 110,
    provider: 'openai',
    model: 'gpt-5.6-luna',
    estimatedCostUsd: 0.001,
    warnings: [],
  },
};

const agents = [
  {
    id: 'evidence-auditor',
    name: 'Người kiểm chứng',
    role: 'scientist',
    lens: 'evidence',
    tone: 'skeptical',
    description: 'Đòi nguồn.',
  },
  {
    id: 'systems-critic',
    name: 'Kẻ soi hệ thống',
    role: 'critic',
    lens: 'systems',
    tone: 'direct',
    description: 'Tìm giả định.',
  },
  {
    id: 'field-practitioner',
    name: 'Người thực hành',
    role: 'practitioner',
    lens: 'practice',
    tone: 'calm',
    description: 'Đem xuống đời thật.',
  },
];

let providerSettingsStatus: {
  setupRecommended: boolean;
  openai: {
    configured: boolean;
    source: 'environment' | 'stored' | 'missing';
    keyHint?: string;
    model: string;
    budgetUsd: number;
    ttsModel: string;
    knowledgeModelEnabled: boolean;
  };
  supadata: {
    configured: boolean;
    source: 'environment' | 'stored' | 'missing';
    keyHint?: string;
  };
};

function missingProviderSettingsStatus(): typeof providerSettingsStatus {
  return {
    setupRecommended: true,
    openai: {
      configured: false,
      source: 'missing',
      model: 'gpt-5.6-luna',
      budgetUsd: 1,
      ttsModel: 'gpt-4o-mini-tts',
      knowledgeModelEnabled: false,
    },
    supadata: { configured: false, source: 'missing' },
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('360gnh-locale', 'vi');
  providerSettingsStatus = {
    setupRecommended: false,
    openai: {
      configured: true,
      source: 'environment',
      keyHint: '••••5678',
      model: 'gpt-5.6-luna',
      budgetUsd: 1,
      ttsModel: 'gpt-4o-mini-tts',
      knowledgeModelEnabled: true,
    },
    supadata: { configured: true, source: 'environment', keyHint: '••••4321' },
  };
  const NativeURL = globalThis.URL;
  class TestURL extends NativeURL {
    static override createObjectURL = vi.fn(() => 'blob:360gnh-audiobook');
    static override revokeObjectURL = vi.fn();
  }
  vi.stubGlobal('URL', TestURL);
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (path === '/api/v1/meta') {
        return Promise.resolve(
          json({
            data: {
              provider: 'local',
              model: 'deterministic-demo-v1',
              debateAgents: agents,
              features: { youtubeImport: true, transcriptEditing: true, audiobook: true },
              audiobook: {
                provider: 'openai',
                model: 'gpt-4o-mini-tts',
                maxBookCharacters: 20_000,
                limitCharacters: 100_000,
                spentCharacters: 0,
                remainingCharacters: 100_000,
                calls: 0,
                voices: ['coral', 'marin'],
              },
            },
          }),
        );
      }
      if (path === '/api/v1/settings/providers' && !init?.method) {
        return Promise.resolve(json({ data: providerSettingsStatus }));
      }
      if (path === '/api/v1/settings/providers/openai' && init?.method === 'PUT') {
        providerSettingsStatus = {
          ...providerSettingsStatus,
          setupRecommended: false,
          openai: {
            configured: true,
            source: 'stored',
            keyHint: '••••5678',
            model: 'gpt-5.6-luna',
            budgetUsd: 1,
            ttsModel: 'gpt-4o-mini-tts',
            knowledgeModelEnabled: true,
          },
        };
        return Promise.resolve(json({ data: providerSettingsStatus }));
      }
      if (path === '/api/v1/sources' && !init?.method) return Promise.resolve(json({ data: [] }));
      if (path === '/api/v1/demo/seed') return Promise.resolve(json({ data: source }, 201));
      if (path === '/api/v1/youtube/import') {
        return Promise.resolve(json({ data: importedSource }, 201));
      }
      if (path === `/api/v1/sources/${importedSource.id}/edit`) {
        return Promise.resolve(json({ data: editedSource }));
      }
      if (path === '/api/v1/audiobooks/render') {
        return Promise.resolve(
          new Response(new Uint8Array([82, 73, 70, 70]), {
            status: 200,
            headers: { 'Content-Type': 'audio/wav' },
          }),
        );
      }
      if (path === '/api/v1/mindmap') {
        return Promise.resolve(
          json({
            data: {
              root: {
                id: 'root',
                label: 'Học bền',
                children: [
                  {
                    id: 'root.1',
                    label: 'Nhớ chủ động',
                    sourceExcerpt: 'Tự gọi kiến thức ra.',
                  },
                ],
              },
              markdown: '# Học bền',
              citations: [],
            },
          }),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Knowledge Studio app', () => {
  it('boots into a no-key demo and exposes the eight Studio tools', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Nguồn thử nghiệm' })).toBeInTheDocument();
    expect(screen.getByText('local · deterministic-demo-v1')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(8);
    expect(screen.getByText(/không cần khóa để thử/i)).toBeInTheDocument();
    expect(screen.getByText(/chủ động nhập YouTube/i)).toBeInTheDocument();
  });

  it('switches tools and renders a source-grounded mindmap', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Nguồn thử nghiệm' });
    await user.click(screen.getByRole('tab', { name: 'Bản đồ' }));
    await user.click(screen.getByRole('button', { name: 'Chạy công cụ đang chọn' }));
    expect(await screen.findByText('Học bền')).toBeInTheDocument();
    expect(screen.getByText('Tự gọi kiến thức ra.')).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/v1/mindmap', expect.anything()));
  });

  it('runs the explicit YouTube edit and single-file audiobook workflow', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Nguồn thử nghiệm' });

    fireEvent.change(screen.getByRole('textbox', { name: 'Đường dẫn video' }), {
      target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
    });
    await user.click(screen.getByRole('button', { name: 'Lấy một video' }));
    expect(await screen.findByRole('heading', { name: 'Video nhập thử' })).toBeInTheDocument();
    expect(screen.getByText(importedSource.rawText)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Biên tập bằng AI' }));
    expect(await screen.findByText(editedSource.editedText)).toBeInTheDocument();
    expect(screen.getByText('Độ dài nằm trong vùng an toàn')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Nguồn thử nghiệm/ }));
    expect(screen.getByRole('tab', { name: 'Bản thô' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: /Video nhập thử/ }));
    expect(screen.getByText(editedSource.editedText)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Sách nói' }));
    await user.click(screen.getByRole('button', { name: 'Dựng sách nói' }));
    expect(await screen.findByText('Đã ráp xong một tệp')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tải tệp WAV' })).toHaveAttribute(
      'href',
      'blob:360gnh-audiobook',
    );
    expect(screen.queryByRole('button', { name: /hàng loạt/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Nguồn thử nghiệm/ }));
    expect(screen.queryByRole('link', { name: 'Tải tệp WAV' })).not.toBeInTheDocument();
  });

  it('remembers the Paper & Ink theme selected by the user', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Nguồn thử nghiệm' });
    await user.click(screen.getByRole('button', { name: 'Chuyển sang nền tối' }));
    expect(screen.getByRole('button', { name: 'Chuyển sang nền giấy sáng' })).toBeInTheDocument();
    expect(localStorage.getItem('360gnh-theme')).toBe('dark');
  });

  it('opens first-run setup, saves a key server-side, and never persists it in the browser', async () => {
    providerSettingsStatus = missingProviderSettingsStatus();
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Kết nối dịch vụ' })).toBeInTheDocument();
    const keyInput = screen.getByLabelText('Khóa API OpenAI');
    await user.type(keyInput, 'test-openai-key-12345678');
    await user.click(screen.getByRole('button', { name: 'Kiểm tra và lưu OpenAI' }));

    expect(
      await screen.findByText(
        'Đã xác minh khóa và quyền xem mô hình. Quyền tạo nội dung sẽ được kiểm tra khi dùng.',
      ),
    ).toBeInTheDocument();
    expect(keyInput).toHaveValue('');
    expect(screen.getByText('••••5678')).toBeInTheDocument();
    const openAIRequest = vi
      .mocked(fetch)
      .mock.calls.find(
        ([path, init]) => path === '/api/v1/settings/providers/openai' && init?.method === 'PUT',
      );
    expect(openAIRequest).toBeDefined();
    const requestBody = openAIRequest?.[1]?.body;
    expect(typeof requestBody).toBe('string');
    if (typeof requestBody !== 'string') throw new Error('Expected a JSON request body');
    expect(JSON.parse(requestBody) as unknown).toEqual({
      apiKey: 'test-openai-key-12345678',
      model: 'gpt-5.6-luna',
      budgetUsd: 1,
      ttsModel: 'gpt-4o-mini-tts',
    });
    const browserValues = Array.from({ length: localStorage.length }, (_value, index) =>
      localStorage.getItem(localStorage.key(index) ?? ''),
    );
    expect(browserValues.join(' ')).not.toContain('test-openai-key');

    await user.click(screen.getByRole('button', { name: 'Vào xưởng' }));
    expect(await screen.findByRole('heading', { name: 'Nguồn thử nghiệm' })).toBeInTheDocument();
  });

  it('renders the complete provider setup in English', async () => {
    localStorage.setItem('360gnh-locale', 'en');
    providerSettingsStatus = missingProviderSettingsStatus();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Connect providers' })).toBeInTheDocument();
    expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument();
    expect(screen.getByLabelText('Supadata API key')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify and save OpenAI' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter the studio' })).toBeInTheDocument();
  });

  it('explains when an environment key powers speech but not the knowledge model', async () => {
    providerSettingsStatus.openai.knowledgeModelEnabled = false;
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Nguồn thử nghiệm' });
    await user.click(screen.getByRole('button', { name: 'Thiết lập nhà cung cấp' }));

    expect(
      await screen.findByText(
        'Khóa này hiện chỉ dùng cho giọng đọc. Máy chủ đang dùng mô hình demo cục bộ cho các công cụ tri thức.',
      ),
    ).toBeInTheDocument();
  });

  it('switches the complete interface to English and remembers the choice', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Nguồn thử nghiệm' });

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByRole('tab', { name: 'Mind map' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run selected tool' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Question or topic' })).toHaveValue(
      'How do active recall and spaced practice work together?',
    );
    expect(screen.getByText(/no key needed to try/i)).toBeInTheDocument();
    expect(localStorage.getItem('360gnh-locale')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('360GNH · Knowledge Studio');
  });
});
