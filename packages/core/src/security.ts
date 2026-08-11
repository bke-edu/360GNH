const MAX_SOURCE_CHARS = 250_000;
const MAX_QUERY_CHARS = 2_000;

const DIRECTIONAL_CONTROLS = /[\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g;

export function sanitizeSourceText(input: string): string {
  return normalizeUntrustedText(input, MAX_SOURCE_CHARS);
}

export function sanitizeQuery(input: string): string {
  return normalizeUntrustedText(input, MAX_QUERY_CHARS);
}

function normalizeUntrustedText(input: string, limit: number): string {
  return input
    .normalize('NFC')
    .split('')
    .filter(isAllowedCharacter)
    .join('')
    .replace(DIRECTIONAL_CONTROLS, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, limit);
}

function isAllowedCharacter(character: string): boolean {
  const code = character.charCodeAt(0);
  return code === 9 || code === 10 || code === 13 || (code > 31 && code !== 127);
}

/**
 * Delimits retrieved source material and labels it as untrusted data. This is
 * defense in depth; callers must still use a model prompt that refuses to obey
 * instructions found inside sources.
 */
export function wrapUntrustedContext(chunks: ReadonlyArray<{ id: string; text: string }>): string {
  return chunks
    .map(
      (chunk, index) =>
        `<source index="${index + 1}" id="${escapeXml(chunk.id)}">\n${escapeXml(chunk.text)}\n</source>`,
    )
    .join('\n\n');
}

export function wrapUntrustedTranscript(input: {
  title: string;
  sourceUrl?: string;
  text: string;
}): string {
  return [
    '<source kind="transcript">',
    `<title>${escapeXml(input.title)}</title>`,
    `<url>${escapeXml(input.sourceUrl ?? '')}</url>`,
    `<content>${escapeXml(input.text)}</content>`,
    '</source>',
  ].join('\n');
}

function escapeXml(value: string): string {
  return value.replace(/[&"<>]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '"': '&quot;',
      '<': '&lt;',
      '>': '&gt;',
    };
    return entities[character] ?? '';
  });
}
