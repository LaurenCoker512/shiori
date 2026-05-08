import { describe, it, expect } from 'vitest';
import { parseHeadingSentinels } from '@/lib/text-processing';
import type { Sentence } from '@/lib/types';

describe('parseHeadingSentinels', () => {
  const makeToken = (surface: string) => ({
    surface,
    dictionary_form: surface,
    reading: surface,
    is_content_word: true,
  });

  const makeSentence = (raw: string, tokens?: Sentence['tokens']): Sentence => ({
    sentence_index: 0,
    raw,
    tokens: tokens ?? [makeToken(raw)],
  });

  it('marks heading sentence with is_heading and strips sentinel from raw', () => {
    const result = parseHeadingSentinels([makeSentence('__HEADING_1__タイトル')]);
    expect(result[0].is_heading).toBe(true);
    expect(result[0].heading_level).toBe(1);
    expect(result[0].raw).toBe('タイトル');
  });

  it('returns non-heading sentence unchanged', () => {
    const sentence = makeSentence('普通の文章です。');
    const result = parseHeadingSentinels([sentence]);
    expect(result[0]).toEqual(sentence);
  });

  it('strips sentinel from token surface and dictionary_form', () => {
    const sentence = makeSentence('__HEADING_2__見出し', [makeToken('__HEADING_2__見出し')]);
    const result = parseHeadingSentinels([sentence]);
    expect(result[0].tokens[0].surface).toBe('見出し');
    expect(result[0].tokens[0].dictionary_form).toBe('見出し');
  });

  it('heading_level matches depth 1-6', () => {
    for (let depth = 1; depth <= 6; depth++) {
      const result = parseHeadingSentinels([makeSentence(`__HEADING_${depth}__テスト`)]);
      expect(result[0].heading_level).toBe(depth);
    }
  });
});
