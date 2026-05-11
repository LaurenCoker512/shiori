import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const mockTokenizeText = vi.hoisted(() => vi.fn());
const mockQuery = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/claude', () => ({
  tokenizeText: mockTokenizeText,
  buildLLMConfig: vi.fn(() => ({ apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6' })),
}));
vi.mock('@/lib/db', () => ({ query: mockQuery }));
vi.mock('@/lib/session', () => ({ getSession: mockGetSession }));

import { POST } from '@/app/api/texts/[id]/reparse/route';
import type { ParsedContent } from '@/lib/types';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

function makeRequest(body: object = {}): Request {
  return new Request('http://localhost/api/texts/1/reparse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string) {
  return { params: { id } };
}

const originalParsed: ParsedContent = [
  {
    sentence_index: 0,
    raw: '猫が好きです。',
    tokens: [
      { surface: '猫', dictionary_form: '猫', reading: 'ねこ', dict_reading: 'ねこ', is_content_word: true },
      { surface: '好き', dictionary_form: '好き', reading: 'すき', dict_reading: 'すき', is_content_word: true },
    ],
  },
];

const newParsed: ParsedContent = [
  {
    sentence_index: 0,
    raw: '犬が走ります。',
    tokens: [
      { surface: '犬', dictionary_form: '犬', reading: 'いぬ', dict_reading: 'いぬ', is_content_word: true },
      { surface: '走り', dictionary_form: '走る', reading: 'はしり', dict_reading: 'はしる', is_content_word: true },
    ],
  },
];

describeIfDb('POST /api/texts/[id]/reparse — integration', () => {
  let testPool: Pool;

  beforeAll(async () => {
    testPool = new Pool({ connectionString: TEST_DATABASE_URL });
    await testPool.query(
      'DROP TABLE IF EXISTS sentence_patterns, furigana_overrides, grammar_patterns, texts, words CASCADE',
    );
    const migration = readFileSync(join(process.cwd(), 'migrations/001_initial.sql'), 'utf-8');
    await testPool.query(migration);
    mockQuery.mockReset();
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => testPool.query(sql, params));
    mockGetSession.mockResolvedValue({
      id: 1, name: 'Test', email: 'test@example.com',
      
      openrouter_api_key: null, openrouter_model: 'anthropic/claude-sonnet-4-6', google_tts_api_key: null, tts_voice: 'ja-JP-Neural2-B', tts_speaking_rate: 1.0,
    });
  });

  afterEach(async () => {
    await testPool.query(
      'TRUNCATE TABLE sentence_patterns, furigana_overrides, grammar_patterns, words, texts RESTART IDENTITY CASCADE',
    );
    mockTokenizeText.mockReset();
  });

  afterAll(async () => {
    await testPool.query(
      'DROP TABLE IF EXISTS sentence_patterns, furigana_overrides, grammar_patterns, texts, words CASCADE',
    );
    await testPool.end();
  });

  async function seedText(): Promise<number> {
    const result = await testPool.query<{ id: number }>(
      `INSERT INTO texts (title, raw_content, parsed_content) VALUES ($1, $2, $3) RETURNING id`,
      ['テスト', '猫が好きです。', JSON.stringify(originalParsed)],
    );
    return result.rows[0].id;
  }

  it('re-tokenizes raw content, updates parsed_content, and returns { ok: true }', async () => {
    const textId = await seedText();
    mockTokenizeText.mockResolvedValue(newParsed);

    const response = await POST(makeRequest(), makeParams(String(textId)));
    expect(response.status).toBe(200);
    const data = await response.json() as { ok: boolean };
    expect(data.ok).toBe(true);

    const row = await testPool.query<{ parsed_content: ParsedContent }>(
      'SELECT parsed_content FROM texts WHERE id = $1',
      [textId],
    );
    expect(row.rows[0].parsed_content[0].tokens[0].dictionary_form).toBe('犬');
  });

  it('deletes all sentence_patterns for the text', async () => {
    const textId = await seedText();
    await testPool.query(
      'INSERT INTO sentence_patterns (text_id, sentence_index) VALUES ($1, 0)',
      [textId],
    );
    mockTokenizeText.mockResolvedValue(newParsed);

    await POST(makeRequest(), makeParams(String(textId)));

    const patterns = await testPool.query(
      'SELECT id FROM sentence_patterns WHERE text_id = $1',
      [textId],
    );
    expect(patterns.rows).toHaveLength(0);
  });

  it('deletes furigana_overrides for surface forms not in new parsed content', async () => {
    const textId = await seedText();
    const wordResult = await testPool.query<{ id: number }>(
      `INSERT INTO words (user_id, dictionary_form, reading) VALUES (1, '猫', 'ねこ') RETURNING id`,
    );
    await testPool.query(
      `INSERT INTO furigana_overrides (user_id, word_id, surface_form, corrected_reading) VALUES (1, $1, '猫', 'ねこ')`,
      [wordResult.rows[0].id],
    );
    mockTokenizeText.mockResolvedValue(newParsed);

    await POST(makeRequest(), makeParams(String(textId)));

    const overrides = await testPool.query(
      `SELECT id FROM furigana_overrides WHERE surface_form = '猫'`,
    );
    expect(overrides.rows).toHaveLength(0);
  });

  it('preserves furigana_overrides for surface forms still in new parsed content', async () => {
    const textId = await seedText();
    const wordResult = await testPool.query<{ id: number }>(
      `INSERT INTO words (user_id, dictionary_form, reading) VALUES (1, '犬', 'いぬ') RETURNING id`,
    );
    await testPool.query(
      `INSERT INTO furigana_overrides (user_id, word_id, surface_form, corrected_reading) VALUES (1, $1, '犬', 'いぬ')`,
      [wordResult.rows[0].id],
    );
    mockTokenizeText.mockResolvedValue(newParsed);

    await POST(makeRequest(), makeParams(String(textId)));

    const overrides = await testPool.query(
      `SELECT id FROM furigana_overrides WHERE surface_form = '犬'`,
    );
    expect(overrides.rows).toHaveLength(1);
  });

  it('upserts new content words into the words table', async () => {
    const textId = await seedText();
    mockTokenizeText.mockResolvedValue(newParsed);

    await POST(makeRequest(), makeParams(String(textId)));

    const words = await testPool.query<{ dictionary_form: string }>('SELECT dictionary_form FROM words');
    const forms = words.rows.map(r => r.dictionary_form);
    expect(forms).toContain('犬');
    expect(forms).toContain('走る');
    expect(forms).not.toContain('猫');
  });
});
