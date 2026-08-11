const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'or',
  'that',
  'the',
  'this',
  'to',
  'with',
  'và',
  'là',
  'của',
  'có',
  'cho',
  'trong',
  'một',
  'những',
  'các',
  'được',
  'với',
  'khi',
  'thì',
  'để',
  'từ',
  'này',
  'đó',
  'như',
  'về',
]);

export function tokenize(text: string): string[] {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('vi')
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((term) => term.length >= 2 && !STOP_WORDS.has(term)) ?? []
  );
}

export function termFrequency(text: string): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const term of tokenize(text)) {
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return counts;
}
