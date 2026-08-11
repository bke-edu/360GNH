export interface SpeechSynthesisInput {
  text: string;
  voice: string;
  instructions?: string;
  speed: number;
}

export interface SpeechProvider {
  readonly id: string;
  readonly model: string;
  readonly maxInputCharacters: number;
  synthesize(input: SpeechSynthesisInput): Promise<Buffer>;
}

export interface AudiobookRendererOptions {
  maxBookCharacters: number;
  maxSessionCharacters: number;
  usageBudget?: AudiobookUsageBudget;
}

export interface AudiobookRenderInput {
  text: string;
  voice: string;
  instructions?: string;
  speed: number;
}

export interface RenderedAudiobook {
  audio: Buffer;
  mimeType: 'audio/wav';
  chunkCount: number;
  characters: number;
  provider: string;
  model: string;
}

export interface AudiobookBudgetSnapshot {
  provider: string;
  model: string;
  maxBookCharacters: number;
  limitCharacters: number;
  spentCharacters: number;
  remainingCharacters: number;
  calls: number;
}

export interface AudiobookUsageSnapshot {
  limitCharacters: number;
  spentCharacters: number;
  remainingCharacters: number;
  calls: number;
}

export class AudiobookUsageBudget {
  #limitCharacters: number;
  #spentCharacters = 0;
  #calls = 0;

  constructor(limitCharacters: number) {
    this.#limitCharacters = validatedCharacterLimit(limitCharacters);
  }

  setLimit(limitCharacters: number): void {
    this.#limitCharacters = validatedCharacterLimit(limitCharacters);
  }

  reserve(characters: number): void {
    if (!Number.isInteger(characters) || characters < 0) {
      throw new RangeError('Reserved characters must be a non-negative integer');
    }
    if (this.#spentCharacters + characters > this.#limitCharacters) {
      throw new Error('Ngân sách ký tự sách nói của phiên máy chủ đã hết');
    }
    this.#spentCharacters += characters;
  }

  recordCall(): void {
    this.#calls += 1;
  }

  snapshot(): AudiobookUsageSnapshot {
    return {
      limitCharacters: this.#limitCharacters,
      spentCharacters: this.#spentCharacters,
      remainingCharacters: Math.max(0, this.#limitCharacters - this.#spentCharacters),
      calls: this.#calls,
    };
  }
}

export class AudiobookRenderer {
  readonly #provider: SpeechProvider;
  readonly #maxBookCharacters: number;
  readonly #usageBudget: AudiobookUsageBudget;

  constructor(provider: SpeechProvider, options: AudiobookRendererOptions) {
    if (!Number.isInteger(provider.maxInputCharacters) || provider.maxInputCharacters < 16) {
      throw new RangeError('Speech provider maxInputCharacters must be at least 16');
    }
    if (!Number.isInteger(options.maxBookCharacters) || options.maxBookCharacters < 40) {
      throw new RangeError('maxBookCharacters must be an integer of at least 40');
    }
    if (
      !Number.isInteger(options.maxSessionCharacters) ||
      options.maxSessionCharacters < options.maxBookCharacters
    ) {
      throw new RangeError('maxSessionCharacters must cover at least one full book');
    }
    this.#provider = provider;
    this.#maxBookCharacters = options.maxBookCharacters;
    this.#usageBudget =
      options.usageBudget ?? new AudiobookUsageBudget(options.maxSessionCharacters);
  }

  async render(input: AudiobookRenderInput): Promise<RenderedAudiobook> {
    const text = input.text.trim();
    if (text.length < 40) throw new Error('Audiobook text must contain at least 40 characters');
    if (text.length > this.#maxBookCharacters) {
      throw new Error(`Audiobook text cannot exceed ${this.#maxBookCharacters} characters`);
    }
    if (!input.voice.trim()) throw new Error('A speech voice is required');
    if (!Number.isFinite(input.speed) || input.speed < 0.25 || input.speed > 4) {
      throw new Error('Speech speed must be between 0.25 and 4');
    }

    // Reserve the whole job before the first paid call so concurrent requests
    // cannot both slip past the session cap. Failed calls remain counted as a
    // conservative cost guard because providers may still bill them.
    this.#usageBudget.reserve(text.length);
    const chunks = splitTextForSpeech(text, this.#provider.maxInputCharacters);
    const waveChunks: Buffer[] = [];
    for (const chunk of chunks) {
      this.#usageBudget.recordCall();
      waveChunks.push(
        await this.#provider.synthesize({
          text: chunk,
          voice: input.voice,
          ...(input.instructions ? { instructions: input.instructions } : {}),
          speed: input.speed,
        }),
      );
    }
    return {
      audio: mergeWaveAudio(waveChunks),
      mimeType: 'audio/wav',
      chunkCount: chunks.length,
      characters: text.length,
      provider: this.#provider.id,
      model: this.#provider.model,
    };
  }

  snapshot(): AudiobookBudgetSnapshot {
    const usage = this.#usageBudget.snapshot();
    return {
      provider: this.#provider.id,
      model: this.#provider.model,
      maxBookCharacters: this.#maxBookCharacters,
      ...usage,
    };
  }
}

function validatedCharacterLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError('Character budget limit must be a positive integer');
  }
  return value;
}

export function splitTextForSpeech(input: string, maxCharacters: number): string[] {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 16) {
    throw new RangeError('maxCharacters must be an integer of at least 16');
  }
  let remaining = input.trim().replace(/\s+/gu, ' ');
  if (!remaining) return [];
  const chunks: string[] = [];

  while (remaining.length > maxCharacters) {
    const window = remaining.slice(0, maxCharacters + 1);
    const punctuation = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('! '),
      window.lastIndexOf('? '),
      window.lastIndexOf('… '),
    );
    const lastSpace = window.lastIndexOf(' ');
    let cut = punctuation >= Math.floor(maxCharacters * 0.35) ? punctuation + 1 : lastSpace;
    if (cut < Math.floor(maxCharacters * 0.35)) cut = maxCharacters;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function mergeWaveAudio(waves: Buffer[]): Buffer {
  if (waves.length === 0) throw new Error('At least one WAV chunk is required');
  const parsed = waves.map(parseWave);
  const format = parsed[0]?.format;
  if (!format) throw new Error('WAV format chunk is missing');
  for (const item of parsed.slice(1)) {
    if (!item.format.equals(format)) throw new Error('WAV chunks use incompatible formats');
  }

  const data = Buffer.concat(parsed.map((item) => item.data));
  const formatPadding = format.length % 2;
  const dataPadding = data.length % 2;
  const riffSize = 4 + 8 + format.length + formatPadding + 8 + data.length + dataPadding;
  if (riffSize > 0xffff_ffff) throw new Error('Merged WAV exceeds the RIFF size limit');

  const output = Buffer.alloc(8 + riffSize);
  output.write('RIFF', 0, 'ascii');
  output.writeUInt32LE(riffSize, 4);
  output.write('WAVE', 8, 'ascii');
  output.write('fmt ', 12, 'ascii');
  output.writeUInt32LE(format.length, 16);
  format.copy(output, 20);
  const cursor = 20 + format.length + formatPadding;
  output.write('data', cursor, 'ascii');
  output.writeUInt32LE(data.length, cursor + 4);
  data.copy(output, cursor + 8);
  return output;
}

function parseWave(wave: Buffer): { format: Buffer; data: Buffer } {
  if (
    wave.length < 20 ||
    wave.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    wave.subarray(8, 12).toString('ascii') !== 'WAVE'
  ) {
    throw new Error('Speech provider returned an invalid WAV file');
  }
  let cursor = 12;
  let format: Buffer | undefined;
  const dataParts: Buffer[] = [];
  while (cursor + 8 <= wave.length) {
    const id = wave.subarray(cursor, cursor + 4).toString('ascii');
    const size = wave.readUInt32LE(cursor + 4);
    const start = cursor + 8;
    const end = start + size;
    if (end > wave.length) throw new Error('Speech provider returned a truncated WAV file');
    if (id === 'fmt ') format = Buffer.from(wave.subarray(start, end));
    if (id === 'data') dataParts.push(Buffer.from(wave.subarray(start, end)));
    cursor = end + (size % 2);
  }
  if (!format || dataParts.length === 0)
    throw new Error('Speech provider WAV is missing audio data');
  return { format, data: Buffer.concat(dataParts) };
}
