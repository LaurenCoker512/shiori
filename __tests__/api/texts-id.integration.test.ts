import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const mockQuery = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ query: mockQuery }));
vi.mock('@/lib/session', () => ({ getSession: mockGetSession }));

import { GET, PATCH, DELETE } from '@/app/api/texts/[id]/route';
import type { ParsedContent, Word } from '@/lib/types';
import type { SessionUser } from '@/lib/session';

const FAKE_USER: SessionUser = {
  id: 1, name: 'Test', email: 'test@example.com',
  anthropic_api_key: null, ai_provider: 'anthropic', anthropic_model: 'claude-sonnet-4-6',
  openrouter_api_key: null, openrouter_model: 'anthropic/claude-sonnet-4-6',
};

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

function makeRequest(method: string, body?: object): Request {
  return new Request('http://localhost/api/texts/1', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeParams(id: string) {
  return { params: { id } };
}

const sampleParsedContent: ParsedContent = [
  {
    sentence_index: 0,
    raw: '猫が好きです。',
    tokens: [
      { surface: '猫', dictionary_form: '猫', reading: 'ねこ', dict_reading: 'ねこ', is_content_word: true },
    ],
  },
];

describeIfDb('GET/PATCH/DELETE /api/texts/[id] — integration', () => {
  let testPool: Pool;
  let textId: number;
  let wordId: number;

  beforeAll(async () => {
    testPool = new Pool({ connectionString: TEST_DATABASE_URL });
    await testPool.query(
      'DROP TABLE IF EXISTS sentence_patterns, furigana_overrides, grammar_patterns, texts, words CASCADE',
    );
    const migration = readFileSync(join(process.cwd(), 'migrations/001_initial.sql'), 'utf-8');
    await testPool.query(migration);
    mockQuery.mockReset();
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => testPool.query(sql, params));
    mockGetSession.mockResolvedValue(FAKE_USER);
  });

  afterEach(async () => {
    await testPool.query('TRUNCATE TABLE sentence_patterns, furigana_overrides, grammar_patterns, words, texts RESTART IDENTITY CASCADE');
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
      ['テスト', '猫が好きです。', JSON.stringify(sampleParsedContent)],
    );
    return result.rows[0].id;
  }

  async function seedWord(): Promise<number> {
    const result = await testPool.query<{ id: number }>(
      `INSERT INTO words (user_id, dictionary_form, reading) VALUES (1, '猫', 'ねこ') RETURNING id`,
    );
    return result.rows[0].id;
  }

  it('GET existing text returns { text, wordStatusMap, furiganaOverrides } and updates last_read_at', async () => {
    textId = await seedText();
    wordId = await seedWord();

    const before = await testPool.query<{ last_read_at: string | null }>('SELECT last_read_at FROM texts WHERE id = $1', [textId]);
    expect(before.rows[0].last_read_at).toBeNull();

    const response = await GET(makeRequest('GET'), makeParams(String(textId)));
    expect(response.status).toBe(200);
    const data = await response.json() as { text: { title: string; last_read_at: string }; wordStatusMap: Record<string, Word>; furiganaOverrides: unknown[] };

    expect(data.text.title).toBe('テスト');

    const after = await testPool.query<{ last_read_at: string | null }>('SELECT last_read_at FROM texts WHERE id = $1', [textId]);
    expect(after.rows[0].last_read_at).not.toBeNull();

    expect(data.wordStatusMap['猫|ねこ']).toBeDefined();
    expect(data.wordStatusMap['猫|ねこ'].status).toBe('unseen');
    expect(data.furiganaOverrides).toEqual([]);
  });

  it('GET non-existent text returns 404', async () => {
    const response = await GET(makeRequest('GET'), makeParams('99999'));
    expect(response.status).toBe(404);
    const data = await response.json() as { error: string };
    expect(data).toHaveProperty('error');
  });

  it('PATCH with new title updates texts.title and returns { id, title }', async () => {
    textId = await seedText();

    const response = await PATCH(makeRequest('PATCH', { title: '新しいタイトル' }), makeParams(String(textId)));
    expect(response.status).toBe(200);
    const data = await response.json() as { id: number; title: string };
    expect(data.id).toBe(textId);
    expect(data.title).toBe('新しいタイトル');

    const row = await testPool.query<{ title: string }>('SELECT title FROM texts WHERE id = $1', [textId]);
    expect(row.rows[0].title).toBe('新しいタイトル');
  });

  it('PATCH with empty title returns 400', async () => {
    textId = await seedText();

    const response = await PATCH(makeRequest('PATCH', { title: '  ' }), makeParams(String(textId)));
    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data).toHaveProperty('error');
  });

  it('DELETE removes text row; sentence_patterns cascade; words preserved', async () => {
    textId = await seedText();
    wordId = await seedWord();

    await testPool.query(
      `INSERT INTO sentence_patterns (text_id, sentence_index) VALUES ($1, 0)`,
      [textId],
    );

    const response = await DELETE(makeRequest('DELETE'), makeParams(String(textId)));
    expect(response.status).toBe(200);

    const texts = await testPool.query('SELECT id FROM texts WHERE id = $1', [textId]);
    expect(texts.rows).toHaveLength(0);

    const patterns = await testPool.query('SELECT id FROM sentence_patterns WHERE text_id = $1', [textId]);
    expect(patterns.rows).toHaveLength(0);

    const words = await testPool.query('SELECT id FROM words WHERE id = $1', [wordId]);
    expect(words.rows).toHaveLength(1);
  });

  it('wordStatusMap is keyed by dictionary_form|reading for every word', async () => {
    textId = await seedText();
    await testPool.query(
      `INSERT INTO words (user_id, dictionary_form, reading) VALUES (1, '食べる', 'たべる'), (1, '猫', 'ねこ')`,
    );

    const response = await GET(makeRequest('GET'), makeParams(String(textId)));
    expect(response.status).toBe(200);
    const data = await response.json() as { wordStatusMap: Record<string, Word> };

    expect(data.wordStatusMap['食べる|たべる']).toBeDefined();
    expect(data.wordStatusMap['猫|ねこ']).toBeDefined();
    expect(Object.keys(data.wordStatusMap)).toHaveLength(2);
  });
});
