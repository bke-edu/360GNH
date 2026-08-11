import { describe, expect, it, vi } from 'vitest';
import {
  AudiobookRenderer,
  AudiobookUsageBudget,
  InMemoryKnowledgeRepository,
  KnowledgeStudio,
  MockKnowledgeModel,
  canonicalYouTubeUrl,
  mergeWaveAudio,
  splitTextForSpeech,
} from '../src/index.js';
import type { SpeechProvider, YouTubeTranscriptProvider } from '../src/index.js';

function pcmWave(samples: number[]): Buffer {
  const data = Buffer.from(samples);
  const wave = Buffer.alloc(44 + data.length);
  wave.write('RIFF', 0, 'ascii');
  wave.writeUInt32LE(36 + data.length, 4);
  wave.write('WAVE', 8, 'ascii');
  wave.write('fmt ', 12, 'ascii');
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(24_000, 24);
  wave.writeUInt32LE(48_000, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write('data', 36, 'ascii');
  wave.writeUInt32LE(data.length, 40);
  data.copy(wave, 44);
  return wave;
}

describe('YouTube transcript and editorial workflow', () => {
  it('canonicalizes one YouTube URL, keeps the raw transcript, then indexes the edited copy', async () => {
    const fetchTranscript = vi.fn<YouTubeTranscriptProvider['fetchTranscript']>((url) =>
      Promise.resolve({
        title: 'Bài giảng thử nghiệm',
        sourceUrl: url,
        text: 'Đây là phần nội dung thô đủ dài để kiểm tra luồng nhập phụ đề và biên tập tài liệu.',
        language: 'vi',
        availableLanguages: ['vi', 'en'],
        segments: [
          {
            text: 'Đây là phần nội dung thô đủ dài để kiểm tra luồng nhập phụ đề và biên tập tài liệu.',
            startMs: 0,
            endMs: 8_000,
          },
        ],
      }),
    );
    const provider: YouTubeTranscriptProvider = { id: 'test-transcript', fetchTranscript };
    const studio = new KnowledgeStudio(new InMemoryKnowledgeRepository(), new MockKnowledgeModel());

    const imported = await studio.importYouTube(
      { url: 'https://youtu.be/dQw4w9WgXcQ?t=4', language: 'vi' },
      provider,
    );
    const edited = await studio.editSource({ sourceId: imported.id, targetLanguage: 'source' });

    expect(fetchTranscript).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'vi',
    );
    expect(imported.rawText).toBe(imported.text);
    expect(imported.editedText).toBeUndefined();
    expect(edited.rawText).toBe(imported.rawText);
    expect(edited.editedText).toContain('Đây là phần nội dung thô');
    expect(edited.text).toBe(edited.editedText);
    expect(edited.editStats?.parts).toBe(1);
    const clips = await studio.findClips({ query: 'phụ đề', sourceIds: [edited.id] });
    expect(clips[0]).toEqual(
      expect.objectContaining({
        startSeconds: 0,
        endSeconds: 8,
        deepLink: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0',
      }),
    );
  });

  it('rejects non-YouTube and credential-bearing URLs before calling a provider', async () => {
    const fetchTranscript = vi.fn<YouTubeTranscriptProvider['fetchTranscript']>();
    const provider: YouTubeTranscriptProvider = { id: 'test-transcript', fetchTranscript };
    const studio = new KnowledgeStudio(new InMemoryKnowledgeRepository(), new MockKnowledgeModel());

    expect(() => canonicalYouTubeUrl('https://example.com/watch?v=dQw4w9WgXcQ')).toThrow(/YouTube/);
    await expect(
      studio.importYouTube({ url: 'https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ' }, provider),
    ).rejects.toThrow(/YouTube/);
    expect(fetchTranscript).not.toHaveBeenCalled();
  });

  it('rejects an oversized provider response at the domain boundary', async () => {
    const provider: YouTubeTranscriptProvider = {
      id: 'oversized-transcript',
      fetchTranscript: (sourceUrl) =>
        Promise.resolve({
          title: 'Nguồn quá khổ',
          sourceUrl,
          text: 'x'.repeat(250_001),
        }),
    };
    const studio = new KnowledgeStudio(new InMemoryKnowledgeRepository(), new MockKnowledgeModel());

    await expect(
      studio.importYouTube({ url: 'https://youtu.be/dQw4w9WgXcQ' }, provider),
    ).rejects.toThrow(/250000/);
    expect(await studio.listSources()).toHaveLength(0);
  });
});

describe('audiobook workflow', () => {
  it('splits at readable boundaries without dropping text', () => {
    const input =
      'Câu đầu tiên đủ dài để thử. Câu thứ hai tiếp tục ý đang kể. Câu cuối cùng khép lại.';
    const chunks = splitTextForSpeech(input, 42);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 42)).toBe(true);
    expect(chunks.join(' ').replace(/\s+/g, ' ').trim()).toBe(input);
  });

  it('merges compatible WAV chunks into one playable WAV body', () => {
    const merged = mergeWaveAudio([pcmWave([1, 2, 3, 4]), pcmWave([5, 6])]);

    expect(merged.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(merged.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(merged.readUInt32LE(40)).toBe(6);
    expect([...merged.subarray(44)]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('renders chunks sequentially and enforces both book and session budgets', async () => {
    const synthesize = vi.fn<SpeechProvider['synthesize']>(({ text }) =>
      Promise.resolve(pcmWave([...Buffer.from(text)])),
    );
    const provider: SpeechProvider = {
      id: 'test-speech',
      model: 'test-voice',
      maxInputCharacters: 32,
      synthesize,
    };
    const renderer = new AudiobookRenderer(provider, {
      maxBookCharacters: 90,
      maxSessionCharacters: 100,
    });
    const text = 'Một đoạn sách nói có độ dài vượt quá một lần gọi nhưng vẫn nằm trong hạn mức.';

    const rendered = await renderer.render({
      text,
      voice: 'coral',
      instructions: 'Đọc rõ ràng.',
      speed: 1,
    });

    expect(rendered.mimeType).toBe('audio/wav');
    expect(rendered.chunkCount).toBeGreaterThan(1);
    expect(synthesize).toHaveBeenCalledTimes(rendered.chunkCount);
    expect(renderer.snapshot().spentCharacters).toBe(text.length);
    await expect(
      renderer.render({ text: 'x'.repeat(91), voice: 'coral', speed: 1 }),
    ).rejects.toThrow(/90/);
    await expect(
      renderer.render({ text: 'y'.repeat(40), voice: 'coral', speed: 1 }),
    ).rejects.toThrow(/ngân sách/i);
  });

  it('keeps audiobook spend when the speech renderer is replaced', async () => {
    const usageBudget = new AudiobookUsageBudget(120);
    const provider: SpeechProvider = {
      id: 'test-speech',
      model: 'voice-v1',
      maxInputCharacters: 100,
      synthesize: ({ text }) => Promise.resolve(pcmWave([...Buffer.from(text)])),
    };
    const first = new AudiobookRenderer(provider, {
      maxBookCharacters: 100,
      maxSessionCharacters: 120,
      usageBudget,
    });
    const text = 'Đây là đoạn đầu tiên đủ dài để được dựng thành một tệp sách nói hoàn chỉnh.';
    await first.render({ text, voice: 'coral', speed: 1 });

    const replacement = new AudiobookRenderer(
      { ...provider, model: 'voice-v2' },
      {
        maxBookCharacters: 100,
        maxSessionCharacters: 120,
        usageBudget,
      },
    );

    expect(replacement.snapshot().spentCharacters).toBe(text.length);
    await expect(
      replacement.render({ text: 'x'.repeat(50), voice: 'coral', speed: 1 }),
    ).rejects.toThrow(/ngân sách/i);
  });
});
