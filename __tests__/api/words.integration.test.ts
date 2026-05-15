import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const mockQuery = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ query: mockQuery }));
vi.mock('@/lib/session', () => ({ getSession: mockGetSession }));

import { PATCH } from '@/app/api/words/[id]/route';
import { GET } from '@/app/api/words/route';
import type { Word } from '@/lib/types';
import type { SessionUser } from '@/lib/session';

const FAKE_USER: SessionUser = {
  id: '00000000-0000-0000-0000-000000000001', name: 'Test', email: 'test@example.com',
  openrouter_api_key: null, openrouter_model: 'anthropic/claude-sonnet-4-6', google_tts_api_key: null, tts_voice: 'ja-JP-Neural2-B', tts_speaking_rate: 1.0,
};

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

function makePatchRequest(body: object): Request {
  return new Request('http://localhost/api/words/1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/words');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString());
}

function makeParams(id: string) {
  return { params: { id } };
}

describeIfDb('PATCH /api/words/[id] — integration', () => {
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
    mockGetSession.mockResolvedValue(FAKE_USER);
  });

  afterEach(async () => {
    await testPool.query(
      'TRUNCATE TABLE sentence_patterns, furigana_overrides, grammar_patterns, words, texts RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await testPool.query(
      'DROP TABLE IF EXISTS sentence_patterns, furigana_overrides, grammar_patterns, texts, words CASCADE',
    );
    await testPool.end();
  });

  async function seedWord(overrides: Partial<{ dictionary_form: string; reading: string }> = {}): Promise<number> {
    const result = await testPool.query<{ id: number }>(
      `INSERT INTO words (user_id, dictionary_form, reading) VALUES (1, $1, $2) RETURNING id`,
      [overrides.dictionary_form ?? '食べる', overrides.reading ?? 'たべる'],
    );
    return result.rows[0].id;
  }

  it('unseen → seen: sets seen_at, leaves known_at null', async () => {
    const wordId = await seedWord();

    const response = await PATCH(makePatchRequest({ status: 'seen' }), makeParams(String(wordId)));
    expect(response.status).toBe(200);
    const data = await response.json() as Word;

    expect(data.status).toBe('seen');
    expect(data.seen_at).not.toBeNull();
    expect(data.known_at).toBeNull();
  });

  it('seen → known: sets known_at', async () => {
    const wordId = await seedWord();
    await testPool.query(`UPDATE words SET status = 'seen', seen_at = NOW() WHERE id = $1`, [wordId]);

    const response = await PATCH(makePatchRequest({ status: 'known' }), makeParams(String(wordId)));
    expect(response.status).toBe(200);
    const data = await response.json() as Word;

    expect(data.status).toBe('known');
    expect(data.known_at).not.toBeNull();
  });

  it('known → seen (regression): clears known_at', async () => {
    const wordId = await seedWord();
    await testPool.query(
      `UPDATE words SET status = 'known', seen_at = NOW(), known_at = NOW() WHERE id = $1`,
      [wordId],
    );

    const response = await PATCH(makePatchRequest({ status: 'seen' }), makeParams(String(wordId)));
    expect(response.status).toBe(200);
    const data = await response.json() as Word;

    expect(data.status).toBe('seen');
    expect(data.known_at).toBeNull();
  });

  it('user_translation: null clears the field', async () => {
    const wordId = await seedWord();
    await testPool.query(`UPDATE words SET user_translation = 'custom' WHERE id = $1`, [wordId]);

    const response = await PATCH(makePatchRequest({ user_translation: null }), makeParams(String(wordId)));
    expect(response.status).toBe(200);
    const data = await response.json() as Word;

    expect(data.user_translation).toBeNull();
  });

  it('user_translation: "custom" sets the field', async () => {
    const wordId = await seedWord();

    const response = await PATCH(makePatchRequest({ user_translation: 'my translation' }), makeParams(String(wordId)));
    expect(response.status).toBe(200);
    const data = await response.json() as Word;

    expect(data.user_translation).toBe('my translation');
  });

  it('returns updated Word row', async () => {
    const wordId = await seedWord();

    const response = await PATCH(makePatchRequest({ status: 'seen' }), makeParams(String(wordId)));
    expect(response.status).toBe(200);
    const data = await response.json() as Word;

    expect(data.id).toBe(wordId);
    expect(data.dictionary_form).toBe('食べる');
    expect(data.reading).toBe('たべる');
  });
});

describeIfDb('GET /api/words — integration', () => {
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
    mockGetSession.mockResolvedValue(FAKE_USER);
  });

  afterEach(async () => {
    await testPool.query(
      'TRUNCATE TABLE sentence_patterns, furigana_overrides, grammar_patterns, words, texts RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await testPool.query(
      'DROP TABLE IF EXISTS sentence_patterns, furigana_overrides, grammar_patterns, texts, words CASCADE',
    );
    await testPool.end();
  });

  async function seedWords(): Promise<void> {
    await testPool.query(`
      INSERT INTO words (user_id, dictionary_form, reading, status, jlpt_level) VALUES
        (1, '食べる', 'たべる', 'seen', 'N5'),
        (1, '走る', 'はしる', 'known', 'N3'),
        (1, '猫', 'ねこ', 'unseen', 'N3'),
        (1, '犬', 'いぬ', 'seen', 'N5')
    `);
  }

  it('no filters → returns first page of 50 and total', async () => {
    await seedWords();

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json() as { words: Word[]; total: number };

    expect(data.total).toBe(4);
    expect(data.words).toHaveLength(4);
  });

  it('status=seen filters correctly', async () => {
    await seedWords();

    const response = await GET(makeGetRequest({ status: 'seen' }));
    expect(response.status).toBe(200);
    const data = await response.json() as { words: Word[]; total: number };

    expect(data.total).toBe(2);
    expect(data.words.every(w => w.status === 'seen')).toBe(true);
  });

  it('jlpt_level=N3 filters correctly', async () => {
    await seedWords();

    const response = await GET(makeGetRequest({ jlpt_level: 'N3' }));
    expect(response.status).toBe(200);
    const data = await response.json() as { words: Word[]; total: number };

    expect(data.total).toBe(2);
    expect(data.words.every(w => w.jlpt_level === 'N3')).toBe(true);
  });

  it('search=食べ matches dictionary_form with ILIKE', async () => {
    await seedWords();

    const response = await GET(makeGetRequest({ search: '食べ' }));
    expect(response.status).toBe(200);
    const data = await response.json() as { words: Word[]; total: number };

    expect(data.total).toBe(1);
    expect(data.words[0].dictionary_form).toBe('食べる');
  });

  it('returns { words, total } with correct total', async () => {
    await seedWords();

    const response = await GET(makeGetRequest({ status: 'unseen' }));
    expect(response.status).toBe(200);
    const data = await response.json() as { words: Word[]; total: number };

    expect(data).toHaveProperty('words');
    expect(data).toHaveProperty('total');
    expect(data.total).toBe(1);
    expect(data.words[0].dictionary_form).toBe('猫');
  });

  it('page=2&pageSize=2 returns correct offset', async () => {
    await seedWords();

    const page1 = await GET(makeGetRequest({ page: '1', pageSize: '2' }));
    const page2 = await GET(makeGetRequest({ page: '2', pageSize: '2' }));

    const data1 = await page1.json() as { words: Word[]; total: number };
    const data2 = await page2.json() as { words: Word[]; total: number };

    expect(data1.words).toHaveLength(2);
    expect(data2.words).toHaveLength(2);
    expect(data1.total).toBe(4);
    expect(data2.total).toBe(4);

    const ids1 = data1.words.map(w => w.id);
    const ids2 = data2.words.map(w => w.id);
    expect(ids1.some(id => ids2.includes(id))).toBe(false);
  });
});
