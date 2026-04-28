import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: mockCreate } };
  }),
}));

import { tokenizeText, analyzeGrammar, describeGrammarPattern, translateWord } from '@/lib/claude';
import type { ParsedContent } from '@/lib/types';

beforeEach(() => {
  mockCreate.mockReset();
});

describe('tokenizeText', () => {
  it('returns ParsedContent when mock returns valid JSON array', async () => {
    const payload: ParsedContent = [
      {
        sentence_index: 0,
        raw: '猫が好きです。',
        tokens: [
          { surface: '猫', dictionary_form: '猫', reading: 'ねこ', pos: 'noun', is_content_word: true },
        ],
      },
    ];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(payload) }],
    });

    const result = await tokenizeText('猫が好きです。');
    expect(result).toEqual(payload);
    expect(result[0].sentence_index).toBe(0);
    expect(result[0].tokens[0].surface).toBe('猫');
  });

  it('throws SyntaxError when mock returns invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not valid json' }],
    });

    await expect(tokenizeText('テスト')).rejects.toThrow(SyntaxError);
  });
});

describe('analyzeGrammar', () => {
  it('returns empty array when mock returns []', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });

    const result = await analyzeGrammar('猫です。');
    expect(result).toEqual([]);
  });

  it('returns typed pattern array when mock returns patterns', async () => {
    const patterns = [
      { pattern: '〜ていた', jlpt_level: 'N4' },
      { pattern: '〜ので', jlpt_level: 'N4' },
    ];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(patterns) }],
    });

    const result = await analyzeGrammar('食べていたので疲れました。');
    expect(result).toHaveLength(2);
    expect(result[0].pattern).toBe('〜ていた');
    expect(result[0].jlpt_level).toBe('N4');
  });
});

describe('describeGrammarPattern', () => {
  it('returns trimmed string from mock response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '  Expresses a past ongoing action.  ' }],
    });

    const result = await describeGrammarPattern('〜ていた');
    expect(result).toBe('Expresses a past ongoing action.');
  });
});

describe('translateWord', () => {
  it('returns TranslationResult when mock returns valid object', async () => {
    const payload = { translations: ['to eat', 'to consume'], jlpt_level: 'N5' };
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(payload) }],
    });

    const result = await translateWord('食べる', '私はりんごを食べる。');
    expect(result.translations).toEqual(['to eat', 'to consume']);
    expect(result.jlpt_level).toBe('N5');
  });
});
