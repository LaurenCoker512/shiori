import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const mockQuery = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ query: mockQuery }));
vi.mock('@/lib/session', () => ({ getSession: mockGetSession }));

import { POST } from '@/app/api/furigana-overrides/route';
import type { SessionUser } from '@/lib/session';

const FAKE_USER: SessionUser = {
  id: 1, name: 'Test', email: 'test@example.com',
  anthropic_api_key: null, ai_provider: 'anthropic', anthropic_model: 'claude-sonnet-4-6',
  openrouter_api_key: null, openrouter_model: 'anthropic/claude-sonnet-4-6',
};

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/furigana-overrides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describeIfDb('POST /api/furigana-overrides — integration', () => {
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

  async function seedWord(): Promise<number> {
    const result = await testPool.query<{ id: number }>(
      `INSERT INTO words (user_id, dictionary_form, reading) VALUES (1, '食べる', 'たべる') RETURNING id`,
    );
    return result.rows[0].id;
  }

  it('upserts furigana override and returns { ok: true }', async () => {
    const wordId = await seedWord();

    const response = await POST(makePostRequest({ word_id: wordId, surface_form: '食べ', corrected_reading: 'た' }));
    expect(response.status).toBe(200);
    const data = await response.json() as { ok: boolean };
    expect(data.ok).toBe(true);

    const rows = await testPool.query(
      'SELECT * FROM furigana_overrides WHERE word_id = $1',
      [wordId],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].corrected_reading).toBe('た');
  });

  it('duplicate upsert updates corrected_reading, does not create a second row', async () => {
    const wordId = await seedWord();
    await POST(makePostRequest({ word_id: wordId, surface_form: '食べ', corrected_reading: 'た' }));

    const response = await POST(makePostRequest({ word_id: wordId, surface_form: '食べ', corrected_reading: 'たべ' }));
    expect(response.status).toBe(200);

    const rows = await testPool.query(
      'SELECT * FROM furigana_overrides WHERE word_id = $1',
      [wordId],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].corrected_reading).toBe('たべ');
  });
});
