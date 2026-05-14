import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LLMConfig } from '@/lib/llm';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: mockCreate } };
  }),
}));

import { tokenizeText, analyzeGrammar, describeGrammarPattern, translateWord } from '@/lib/llm';

const anthropicConfig: LLMConfig = { apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6' };

beforeEach(() => {
  mockCreate.mockReset();
});

describe('tokenizeText', () => {
  it('maps compact array-tuple response to ParsedContent', async () => {
    // Compact format: array of sentences, each sentence is array of [surface, dict, reading, is_content]
    const compact = [
      [
        ['猫', '猫', 'ねこ', 'ねこ', 1],
        ['が', 'が', 'が', 'が', 0],
        ['好き', '好き', 'すき', 'すき', 1],
        ['です', 'だ', 'です', 'だ', 0],
        ['。', '。', '。', '。', 0],
      ],
    ];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(compact) }],
      stop_reason: 'end_turn',
    });

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

  it('throws SyntaxError when mock returns invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not valid json' }],
      stop_reason: 'end_turn',
    });

    await expect(tokenizeText(anthropicConfig, 'テスト')).rejects.toThrow(SyntaxError);
  });
});

describe('analyzeGrammar', () => {
  it('returns empty array when mock returns []', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });

    const result = await analyzeGrammar(anthropicConfig, '猫です。');
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

    const result = await analyzeGrammar(anthropicConfig, '食べていたので疲れました。');
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

    const result = await describeGrammarPattern(anthropicConfig, '〜ていた');
    expect(result).toBe('Expresses a past ongoing action.');
  });
});

describe('translateWord', () => {
  it('returns TranslationResult when mock returns valid object', async () => {
    const payload = { translations: ['to eat', 'to consume'], jlpt_level: 'N5' };
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(payload) }],
    });

    const result = await translateWord(anthropicConfig, '食べる', '私はりんごを食べる。');
    expect(result.translations).toEqual(['to eat', 'to consume']);
    expect(result.jlpt_level).toBe('N5');
  });
});
