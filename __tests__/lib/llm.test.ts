import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LLMConfig } from '@/lib/llm';

export const anthropicCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: anthropicCreate } };
  }),
}));

import { analyzeGrammar, describeGrammarPattern, translateWord, assignKanjiReadings } from '@/lib/llm';

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

describe('assignKanjiReadings', () => {
  it('returns surface_reading and dict_reading for flagged tokens', async () => {
    mockFetch(JSON.stringify([
      { surface: '食べた', surface_reading: 'たべた', dict_reading: 'たべる' },
    ]));

    const result = await assignKanjiReadings(anthropicConfig, [
      { surface: '食べた', dictionary_form: '食べる', sentence_context: '昨日食べた。' },
    ]);

    expect(result).toEqual([
      { surface: '食べた', surface_reading: 'たべた', dict_reading: 'たべる' },
    ]);
  });

  it('returns empty array when called with no tokens', async () => {
    const result = await assignKanjiReadings(anthropicConfig, []);
    expect(result).toEqual([]);
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
