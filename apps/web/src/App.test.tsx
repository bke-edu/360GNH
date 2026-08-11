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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  localStorage.clear();
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
});
