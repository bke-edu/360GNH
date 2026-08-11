import type { ModelUsage, SourceEditStats } from './types.js';

const DEFAULT_EDIT_PART_CHARACTERS = 12_000;

export function splitTranscriptForEditing(
  input: string,
  maxCharacters = DEFAULT_EDIT_PART_CHARACTERS,
): string[] {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1_000) {
    throw new RangeError('maxCharacters must be an integer of at least 1000');
  }
  const paragraphs = input
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const units = paragraphs.flatMap((paragraph) => splitOversizedUnit(paragraph, maxCharacters));
  const parts: string[] = [];
  let current = '';

  for (const unit of units) {
    const candidate = current ? `${current}\n\n${unit}` : unit;
    if (current && candidate.length > maxCharacters) {
      parts.push(current);
      current = unit;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  return parts;
}

export function sourceEditStats(
  rawText: string,
  editedText: string,
  usage: ModelUsage[],
  parts: number,
): SourceEditStats {
  const rawWords = countWords(rawText);
  const editedWords = countWords(editedText);
  const wordRatio = rawWords === 0 ? 0 : editedWords / rawWords;
  const warnings: SourceEditStats['warnings'] = [];
  if (wordRatio < 0.65) warnings.push('possible-compression');
  if (wordRatio > 1.35) warnings.push('possible-expansion');
  return {
    parts,
    wordRatio,
    inputTokens: usage.reduce((total, item) => total + item.inputTokens, 0),
    outputTokens: usage.reduce((total, item) => total + item.outputTokens, 0),
    estimatedCostUsd: usage.reduce((total, item) => total + item.estimatedCostUsd, 0),
    provider: usage[0]?.provider ?? 'unknown',
    model: usage[0]?.model ?? 'unknown',
    warnings,
  };
}

function splitOversizedUnit(text: string, maxCharacters: number): string[] {
  if (text.length <= maxCharacters) return [text];
  const sentences = text.split(/(?<=[.!?…])\s+/u).filter(Boolean);
  if (sentences.length > 1) {
    return sentences.flatMap((sentence) => splitOversizedUnit(sentence, maxCharacters));
  }

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxCharacters) {
    const space = remaining.lastIndexOf(' ', maxCharacters);
    const cut = space >= Math.floor(maxCharacters * 0.5) ? space : maxCharacters;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}
