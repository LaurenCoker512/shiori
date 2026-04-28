import { describe, it, expect } from 'vitest';
import { processMarkdown, processHtml, parseHeadingSentinels } from '@/lib/text-processing';
import type { Sentence } from '@/lib/types';

describe('processMarkdown', () => {
  it('strips **bold** to plain text', async () => {
    const result = await processMarkdown('これは**太字**です。');
    expect(result).toBe('これは太字です。');
  });

  it('converts # Heading to __HEADING_1__Heading', async () => {
    const result = await processMarkdown('# タイトル');
    expect(result).toBe('__HEADING_1__タイトル');
  });

  it('converts ## Sub to __HEADING_2__Sub', async () => {
    const result = await processMarkdown('## サブ');
    expect(result).toBe('__HEADING_2__サブ');
  });

  it('does not sentinel non-heading lines', async () => {
    const result = await processMarkdown('普通の文章です。');
    expect(result).not.toContain('__HEADING_');
    expect(result).toBe('普通の文章です。');
  });

  it('preserves paragraph separation', async () => {
    const result = await processMarkdown('段落1。\n\n段落2。');
    expect(result).toContain('\n\n');
  });
});

describe('processHtml', () => {
  it('strips tags from <p>text</p>', () => {
    expect(processHtml('<p>テキスト</p>')).toBe('テキスト');
  });

  it('converts <br> to newline', () => {
    const result = processHtml('行1<br>行2');
    expect(result).toBe('行1\n行2');
  });

  it('adds \\n\\n after block elements', () => {
    const result = processHtml('<p>段落1</p><p>段落2</p>');
    expect(result).toContain('\n\n');
    expect(result).toContain('段落1');
    expect(result).toContain('段落2');
  });

  it('collapses 3+ newlines to \\n\\n', () => {
    const result = processHtml('<p>a</p><p>b</p><p>c</p>');
    expect(result).not.toMatch(/\n{3,}/);
  });
});

describe('parseHeadingSentinels', () => {
  const makeToken = (surface: string) => ({
    surface,
    dictionary_form: surface,
    reading: surface,
    pos: 'noun',
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
