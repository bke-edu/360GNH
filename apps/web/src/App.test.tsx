import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (path === '/api/v1/meta') {
        return Promise.resolve(
          json({
            data: { provider: 'local', model: 'deterministic-demo-v1', debateAgents: agents },
          }),
        );
      }
      if (path === '/api/v1/sources' && !init?.method) return Promise.resolve(json({ data: [] }));
      if (path === '/api/v1/demo/seed') return Promise.resolve(json({ data: source }, 201));
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
  it('boots into a no-key demo and exposes the six Studio tools', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Nguồn thử nghiệm' })).toBeInTheDocument();
    expect(screen.getByText('local · deterministic-demo-v1')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(screen.getByText(/không cần khóa để thử/i)).toBeInTheDocument();
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
});
