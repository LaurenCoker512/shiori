import type { Sentence } from './types';

// Converts full-width katakana (U+30A1–U+30F6) to hiragana (U+3041–U+3096).
// Used to normalise LLM-returned readings before storage and lookup, since the
// LLM occasionally returns katakana despite being instructed to use hiragana.
export function toHiragana(str: string): string {
  return str.replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

const HEADING_SENTINEL = /^__HEADING_([1-6])__(.*)$/;

export function parseHeadingSentinels(sentences: Sentence[]): Sentence[] {
  return sentences.map(s => {
    const match = HEADING_SENTINEL.exec(s.raw);
    if (!match) return s;
    const level = parseInt(match[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
    const cleanRaw = match[2].trim();
    return {
      ...s,
      raw: cleanRaw,
      is_heading: true,
      heading_level: level,
      tokens: s.tokens.map(t => ({
        ...t,
        surface: t.surface.replace(HEADING_SENTINEL, '$2'),
        dictionary_form: t.dictionary_form.replace(HEADING_SENTINEL, '$2'),
      })),
    };
  });
}
