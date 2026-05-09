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

import { POST } from '@/app/api/texts/route';
import type { ParsedContent } from '@/lib/types';
import type { SessionUser } from '@/lib/session';

const FAKE_USER: SessionUser = {
  id: 1, name: 'Test', email: 'test@example.com',
  openrouter_api_key: null, openrouter_model: 'anthropic/claude-sonnet-4-6',
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

const sampleParsedContent: ParsedContent = [
  {
    sentence_index: 0,
    raw: '猫が好きです。',
    tokens: [
      { surface: '猫', dictionary_form: '猫', reading: 'ねこ', dict_reading: 'ねこ', is_content_word: true },
      { surface: 'が', dictionary_form: 'が', reading: 'が', dict_reading: 'が', is_content_word: false },
      { surface: '好き', dictionary_form: '好き', reading: 'すき', dict_reading: 'すき', is_content_word: true },
      { surface: 'です', dictionary_form: 'です', reading: 'です', dict_reading: 'です', is_content_word: false },
      { surface: '。', dictionary_form: '。', reading: '。', dict_reading: '。', is_content_word: false },
    ],
  },
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
    mockQuery.mockReset();
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => testPool.query(sql, params));
    mockGetSession.mockResolvedValue(FAKE_USER);
  });

  afterEach(async () => {
    await testPool.query('TRUNCATE TABLE sentence_patterns, words, texts RESTART IDENTITY CASCADE');
    mockTokenizeText.mockReset();
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
    mockTokenizeText.mockResolvedValue(sampleParsedContent);

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
    mockTokenizeText.mockRejectedValue(new Error('API error'));

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
    const contentWithDupe: ParsedContent = [
      {
        sentence_index: 0,
        raw: '猫が猫です。',
        tokens: [
          { surface: '猫', dictionary_form: '猫', reading: 'ねこ', dict_reading: 'ねこ', is_content_word: true },
          { surface: 'が', dictionary_form: 'が', reading: 'が', dict_reading: 'が', is_content_word: false },
          { surface: '猫', dictionary_form: '猫', reading: 'ねこ', dict_reading: 'ねこ', is_content_word: true },
          { surface: 'です', dictionary_form: 'です', reading: 'です', dict_reading: 'です', is_content_word: false },
          { surface: '。', dictionary_form: '。', reading: '。', dict_reading: '。', is_content_word: false },
        ],
      },
    ];
    mockTokenizeText.mockResolvedValue(contentWithDupe);

    const response = await POST(makeRequest({ title: '猫テスト', content: '猫が猫です。' }));
    expect(response.status).toBe(202);

    // Allow fire-and-forget processImport to complete before checking words
    await new Promise(resolve => { setTimeout(resolve, 50); });

    const words = await testPool.query<{ dictionary_form: string }>('SELECT dictionary_form FROM words');
    expect(words.rows.filter(r => r.dictionary_form === '猫')).toHaveLength(1);
  });
});
