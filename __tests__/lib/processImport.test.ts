import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LLMConfig } from '@/lib/llm';
import type { IpadicFeatures } from '@patdx/kuromoji';

vi.mock('@/lib/kuromoji', () => ({
  kuromojiTokenize: vi.fn(),
}));

vi.mock('@/lib/llm', () => ({
  assignKanjiReadings: vi.fn(),
}));

vi.mock('@/lib/frequency', () => ({
  lookupFrequencyTier: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('@/lib/importAbortControllers', () => ({
  registerImportAbort: vi.fn(),
  unregisterImportAbort: vi.fn(),
}));

import { kuromojiTokenize } from '@/lib/kuromoji';
import { assignKanjiReadings } from '@/lib/llm';
import { lookupFrequencyTier } from '@/lib/frequency';
import { query } from '@/lib/db';
import { processImport } from '@/lib/processImport';

const mockConfig: LLMConfig = { apiKey: 'sk-or-test', model: 'claude-sonnet-4-6' };

const pureKanaToken = {
  surface_form: 'です',
  basic_form: 'です',
  reading: 'デス',
  word_type: 'KNOWN',
  pos: '助動詞',
} as unknown as IpadicFeatures;

const kanjiToken = {
  surface_form: '食べた',
  basic_form: '食べる',
  reading: 'タベタ',
  word_type: 'KNOWN',
  pos: '動詞',
} as unknown as IpadicFeatures;

function getInsertCall() {
  return vi.mocked(query).mock.calls.find(([sql]) =>
    typeof sql === 'string' && sql.includes('INSERT INTO words'),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(query).mockResolvedValue({ rows: [] });
  vi.mocked(lookupFrequencyTier).mockResolvedValue(null);
});

describe('processImport', () => {
  it('kanji tokens are sent to assignKanjiReadings; pure-kana tokens are not', async () => {
    vi.mocked(kuromojiTokenize).mockResolvedValue([pureKanaToken, kanjiToken]);
    vi.mocked(assignKanjiReadings).mockResolvedValue([
      { surface: '食べた', surface_reading: 'たべた', dict_reading: 'たべる' },
    ]);

    await processImport(1, 1, 'テスト', mockConfig);

    expect(assignKanjiReadings).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ surface: '食べた' })]),
      expect.anything(),
    );
    expect(assignKanjiReadings).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ surface: 'です' })]),
      expect.anything(),
    );
  });

  it('LLM readings written to DB', async () => {
    vi.mocked(kuromojiTokenize).mockResolvedValue([kanjiToken]);
    vi.mocked(assignKanjiReadings).mockResolvedValue([
      { surface: '食べた', surface_reading: 'たべた', dict_reading: 'たべる' },
    ]);

    await processImport(1, 1, 'テスト', mockConfig);

    const insertCall = getInsertCall();
    expect(insertCall).toBeDefined();
    const [, rawParams] = insertCall!;
    const [, forms, readings] = rawParams as unknown[];
    expect(forms).toContain('食べる');
    expect(readings).toContain('たべる');
  });

  it('frequency_tier populated on inserted words', async () => {
    vi.mocked(kuromojiTokenize).mockResolvedValue([kanjiToken]);
    vi.mocked(assignKanjiReadings).mockResolvedValue([
      { surface: '食べた', surface_reading: 'たべた', dict_reading: 'たべる' },
    ]);
    vi.mocked(lookupFrequencyTier).mockResolvedValue('common');

    await processImport(1, 1, 'テスト', mockConfig);

    expect(lookupFrequencyTier).toHaveBeenCalledWith('食べる', 'たべる');
    const insertCall = getInsertCall();
    const [sql] = insertCall!;
    expect(sql).toContain('frequency_tier');
  });

  it('graceful degradation: assignKanjiReadings throws → Kuromoji reading used, import succeeds', async () => {
    vi.mocked(kuromojiTokenize).mockResolvedValue([kanjiToken]);
    vi.mocked(assignKanjiReadings).mockRejectedValue(new Error('no api key'));

    await expect(processImport(1, 1, 'テスト', mockConfig)).resolves.not.toThrow();

    const insertCall = getInsertCall();
    expect(insertCall).toBeDefined();
    // Fallback: toHiragana('タベタ') = 'たべた'
    const [, rawParams] = insertCall!;
    const [, , readings] = rawParams as unknown[];
    expect(readings).toContain('たべた');
  });
});
