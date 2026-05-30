import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { IpadicFeatures } from '@patdx/kuromoji';

const mockKuromojiTokenize = vi.hoisted(() => vi.fn());
const mockAssignKanjiReadings = vi.hoisted(() => vi.fn());
const mockQuery = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/kuromoji', () => ({ kuromojiTokenize: mockKuromojiTokenize }));
vi.mock('@/lib/llm', () => ({
  assignKanjiReadings: mockAssignKanjiReadings,
  buildLLMConfig: vi.fn(() => ({ apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6' })),
}));
vi.mock('@/lib/db', () => ({ query: mockQuery }));
vi.mock('@/lib/session', () => ({ getSession: mockGetSession }));
vi.mock('@/lib/frequency', () => ({ lookupFrequencyTier: vi.fn().mockResolvedValue(null) }));

import { POST } from '@/app/api/texts/route';
import type { SessionUser } from '@/lib/session';

const FAKE_USER: SessionUser = {
  id: 1, name: 'Test', email: 'test@example.com',
  openrouter_api_key: null, openrouter_model: 'anthropic/claude-sonnet-4-6', google_tts_api_key: null, tts_voice: 'ja-JP-Neural2-B', tts_speaking_rate: 1.0,
};

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

function makeRequest(body: object): Request {
  return new Request('http://localhost/api/texts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// IpadicFeatures fixtures representing '猫が好きです。'
const nekoToken = { surface_form: '猫', basic_form: '猫', reading: 'ネコ', word_type: 'KNOWN', pos: '名詞' } as unknown as IpadicFeatures;
const gaToken = { surface_form: 'が', basic_form: 'が', reading: 'ガ', word_type: 'KNOWN', pos: '助詞' } as unknown as IpadicFeatures;
const sukiToken = { surface_form: '好き', basic_form: '好き', reading: 'スキ', word_type: 'KNOWN', pos: '名詞' } as unknown as IpadicFeatures;
const desuToken = { surface_form: 'です', basic_form: 'です', reading: 'デス', word_type: 'KNOWN', pos: '助動詞' } as unknown as IpadicFeatures;
const periodToken = { surface_form: '。', basic_form: '。', reading: '。', word_type: 'KNOWN', pos: '記号' } as unknown as IpadicFeatures;

const sampleTokens = [nekoToken, gaToken, sukiToken, desuToken, periodToken];
const sampleLlmReadings = [
  { surface: '猫', surface_reading: 'ねこ', dict_reading: 'ねこ' },
  { surface: '好き', surface_reading: 'すき', dict_reading: 'すき' },
];

describeIfDb('POST /api/texts — integration', () => {
  let testPool: Pool;

  beforeAll(async () => {
    testPool = new Pool({ connectionString: TEST_DATABASE_URL });
    await testPool.query(
      'DROP TABLE IF EXISTS sentence_patterns, furigana_overrides, grammar_patterns, texts, words CASCADE',
    );
    const migration = readFileSync(join(process.cwd(), 'migrations/001_initial.sql'), 'utf-8');
    await testPool.query(migration);
    const importStatus = readFileSync(join(process.cwd(), 'migrations/003_import_status.sql'), 'utf-8');
    await testPool.query(importStatus);
    const migration009 = readFileSync(join(process.cwd(), 'migrations/009_frequency.sql'), 'utf-8');
    await testPool.query(migration009);
    mockQuery.mockReset();
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => testPool.query(sql, params));
    mockGetSession.mockResolvedValue(FAKE_USER);
  });

  afterEach(async () => {
    await testPool.query('TRUNCATE TABLE sentence_patterns, words, texts RESTART IDENTITY CASCADE');
    mockKuromojiTokenize.mockReset();
    mockAssignKanjiReadings.mockReset();
  });

  afterAll(async () => {
    await testPool.query(
      'DROP TABLE IF EXISTS sentence_patterns, furigana_overrides, grammar_patterns, texts, words CASCADE',
    );
    await testPool.end();
  });

  it('returns 400 when title is missing', async () => {
    const response = await POST(makeRequest({ content: '猫が好きです。' }));
    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data).toHaveProperty('error');
  });

  it('inserts text and words for valid content, returns { id }', async () => {
    mockKuromojiTokenize.mockResolvedValue(sampleTokens);
    mockAssignKanjiReadings.mockResolvedValue(sampleLlmReadings);

    const response = await POST(makeRequest({ title: '猫の話', content: '猫が好きです。' }));
    expect(response.status).toBe(202);
    const data = await response.json() as { id: number };
    expect(typeof data.id).toBe('number');

    const texts = await testPool.query<{ title: string }>('SELECT title FROM texts');
    expect(texts.rows).toHaveLength(1);
    expect(texts.rows[0].title).toBe('猫の話');

    // Allow fire-and-forget processImport to complete before checking words
    await new Promise(resolve => { setTimeout(resolve, 50); });

    const words = await testPool.query<{ dictionary_form: string }>('SELECT dictionary_form FROM words');
    const forms = words.rows.map(r => r.dictionary_form);
    expect(forms).toContain('猫');
    expect(forms).toContain('好き');
    expect(forms).not.toContain('が');
  });

  it('returns 202 immediately even when tokenizer later throws; no words inserted', async () => {
    mockKuromojiTokenize.mockRejectedValue(new Error('tokenizer error'));

    const response = await POST(makeRequest({ title: 'Error Test', content: '猫が好きです。' }));
    expect(response.status).toBe(202);
    const data = await response.json() as { id: number };
    expect(typeof data.id).toBe('number');

    // Allow fire-and-forget processImport to complete before checking words
    await new Promise(resolve => { setTimeout(resolve, 50); });

    const words = await testPool.query('SELECT id FROM words');
    expect(words.rows).toHaveLength(0);
  });

  it('upserts duplicate words without error or duplication', async () => {
    const nekoToken2 = { surface_form: '猫', basic_form: '猫', reading: 'ネコ', word_type: 'KNOWN', pos: '名詞' } as unknown as IpadicFeatures;
    const dupeTokens = [nekoToken, gaToken, nekoToken2, desuToken, periodToken];
    const dupeLlmReadings = [
      { surface: '猫', surface_reading: 'ねこ', dict_reading: 'ねこ' },
      { surface: '猫', surface_reading: 'ねこ', dict_reading: 'ねこ' },
    ];

    mockKuromojiTokenize.mockResolvedValue(dupeTokens);
    mockAssignKanjiReadings.mockResolvedValue(dupeLlmReadings);

    const response = await POST(makeRequest({ title: '猫テスト', content: '猫が猫です。' }));
    expect(response.status).toBe(202);

    // Allow fire-and-forget processImport to complete before checking words
    await new Promise(resolve => { setTimeout(resolve, 50); });

    const words = await testPool.query<{ dictionary_form: string }>('SELECT dictionary_form FROM words');
    expect(words.rows.filter(r => r.dictionary_form === '猫')).toHaveLength(1);
  });
});
