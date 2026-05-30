import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LLMConfig } from '@/lib/llm';

export const anthropicCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: anthropicCreate } };
  }),
}));

import { analyzeGrammar, describeGrammarPattern, translateWord, tokenizeText } from '@/lib/llm';

const anthropicConfig: LLMConfig = { apiKey: 'sk-or-test', model: 'anthropic/claude-sonnet-4-6' };

function mockFetch(content: string, status = 200) {
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status },
    ),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('tokenizeText', () => {
  it('maps compact array-tuple response to ParsedContent', async () => {
    const compact = [
      [
        ['猫', '猫', 'ねこ', 'ねこ', 1],
        ['が', 'が', 'が', 'が', 0],
        ['好き', '好き', 'すき', 'すき', 1],
        ['です', 'だ', 'です', 'だ', 0],
        ['。', '。', '。', '。', 0],
      ],
    ];
    mockFetch(JSON.stringify(compact));

    const result = await tokenizeText(anthropicConfig, '猫が好きです。');
    expect(result).toHaveLength(1);
    expect(result[0].sentence_index).toBe(0);
    expect(result[0].raw).toBe('猫が好きです。');
    expect(result[0].tokens[0].surface).toBe('猫');
    expect(result[0].tokens[0].dictionary_form).toBe('猫');
    expect(result[0].tokens[0].reading).toBe('ねこ');
    expect(result[0].tokens[0].dict_reading).toBe('ねこ');
    expect(result[0].tokens[0].is_content_word).toBe(true);
    expect(result[0].tokens[1].is_content_word).toBe(false);
  });

  it('throws when mock returns invalid JSON', async () => {
    mockFetch('no json here at all');

    await expect(tokenizeText(anthropicConfig, 'テスト')).rejects.toThrow();
  });
});

describe('analyzeGrammar', () => {
  it('returns empty array when mock returns []', async () => {
    mockFetch('[]');

    const result = await analyzeGrammar(anthropicConfig, '猫です。');
    expect(result).toEqual([]);
  });

  it('returns typed pattern array when mock returns patterns', async () => {
    const patterns = [
      { pattern: '〜ていた', jlpt_level: 'N4' },
      { pattern: '〜ので', jlpt_level: 'N4' },
    ];
    mockFetch(JSON.stringify(patterns));

    const result = await analyzeGrammar(anthropicConfig, '食べていたので疲れました。');
    expect(result).toHaveLength(2);
    expect(result[0].pattern).toBe('〜ていた');
    expect(result[0].jlpt_level).toBe('N4');
  });
});

describe('describeGrammarPattern', () => {
  it('returns trimmed string from mock response', async () => {
    mockFetch('  Expresses a past ongoing action.  ');

    const result = await describeGrammarPattern(anthropicConfig, '〜ていた');
    expect(result).toBe('Expresses a past ongoing action.');
  });
});

describe('translateWord', () => {
  it('returns TranslationResult when mock returns valid object', async () => {
    const payload = { translations: ['to eat', 'to consume'], jlpt_level: 'N5' };
    mockFetch(JSON.stringify(payload));

    const result = await translateWord(anthropicConfig, '食べる', '私はりんごを食べる。');
    expect(result.translations).toEqual(['to eat', 'to consume']);
    expect(result.jlpt_level).toBe('N5');
  });
});
