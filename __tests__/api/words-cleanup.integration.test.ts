import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const mockQuery = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());
const mockLookupFrequencyTier = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ query: mockQuery }));
vi.mock('@/lib/session', () => ({ getSession: mockGetSession }));
vi.mock('@/lib/frequency', () => ({ lookupFrequencyTier: mockLookupFrequencyTier }));

import { POST } from '@/app/api/words/cleanup/route';
import type { SessionUser } from '@/lib/session';

const FAKE_USER: SessionUser = {
  id: 1, name: 'Test', email: 'test@example.com',
  openrouter_api_key: null, openrouter_model: 'anthropic/claude-sonnet-4-6', google_tts_api_key: null, tts_voice: 'ja-JP-Neural2-B', tts_speaking_rate: 1.0,
};

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

function makePostRequest(body: object): Request {
  return new Request('http://localhost/api/words/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describeIfDb('POST /api/words/cleanup — integration', () => {
  let testPool: Pool;

  beforeAll(async () => {
    testPool = new Pool({ connectionString: TEST_DATABASE_URL });
    await testPool.query(
      'DROP TABLE IF EXISTS sentence_patterns, furigana_overrides, grammar_patterns, texts, words CASCADE',
    );
    const migration = readFileSync(join(process.cwd(), 'migrations/001_initial.sql'), 'utf-8');
    await testPool.query(migration);
    const migration009 = readFileSync(join(process.cwd(), 'migrations/009_frequency.sql'), 'utf-8');
    await testPool.query(migration009);
    mockQuery.mockReset();
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => testPool.query(sql, params));
    mockGetSession.mockResolvedValue(FAKE_USER);
    mockLookupFrequencyTier.mockResolvedValue(null);
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

  async function seedWord(overrides: Partial<{
    dictionary_form: string;
    reading: string;
    status: string;
    user_translation: string | null;
  }> = {}): Promise<number> {
    const result = await testPool.query<{ id: number }>(
      `INSERT INTO words (user_id, dictionary_form, reading, status, user_translation)
       VALUES (1, $1, $2, $3, $4) RETURNING id`,
      [
        overrides.dictionary_form ?? '食べる',
        overrides.reading ?? 'たべる',
        overrides.status ?? 'unseen',
        overrides.user_translation ?? null,
      ],
    );
    return result.rows[0].id;
  }

  it('POST with normalization → dictionary_form updated in DB', async () => {
    const id = await seedWord({ dictionary_form: '食べ', reading: 'たべる' });

    const response = await POST(makePostRequest({
      normalizations: [{ id, canonical_dictionary_form: '食べる' }],
      frequency_backfill_ids: [],
    }));

    expect(response.status).toBe(200);
    const data = await response.json() as { normalized: number; merged: number; frequencyBackfilled: number };
    expect(data.normalized).toBe(1);
    expect(data.merged).toBe(0);

    const row = await testPool.query<{ dictionary_form: string }>(`SELECT dictionary_form FROM words WHERE id = $1`, [id]);
    expect(row.rows[0].dictionary_form).toBe('食べる');
  });

  it('POST: two words share canonical form after normalization → duplicate merged; higher-status survives', async () => {
    const idSeen = await seedWord({ dictionary_form: '食べ', reading: 'たべる', status: 'seen' });
    const idKnown = await seedWord({ dictionary_form: '食べる', reading: 'たべる', status: 'known' });

    const response = await POST(makePostRequest({
      normalizations: [{ id: idSeen, canonical_dictionary_form: '食べる' }],
      frequency_backfill_ids: [],
    }));

    expect(response.status).toBe(200);
    const data = await response.json() as { normalized: number; merged: number };
    expect(data.normalized).toBe(1);
    expect(data.merged).toBe(1);

    const rows = await testPool.query<{ id: number; status: string }>(
      `SELECT id, status FROM words WHERE user_id = 1 AND dictionary_form = '食べる' AND reading = 'たべる'`,
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].status).toBe('known');
    expect(rows.rows[0].id).toBe(idKnown);
  });

  it('merged entry with user_translation → user_translation preserved on survivor', async () => {
    const idSeen = await seedWord({ dictionary_form: '食べ', reading: 'たべる', status: 'seen', user_translation: 'my translation' });
    await seedWord({ dictionary_form: '食べる', reading: 'たべる', status: 'known' });

    const response = await POST(makePostRequest({
      normalizations: [{ id: idSeen, canonical_dictionary_form: '食べる' }],
      frequency_backfill_ids: [],
    }));

    expect(response.status).toBe(200);
    const data = await response.json() as { merged: number };
    expect(data.merged).toBe(1);

    const rows = await testPool.query<{ user_translation: string | null }>(
      `SELECT user_translation FROM words WHERE user_id = 1 AND dictionary_form = '食べる'`,
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].user_translation).toBe('my translation');
  });

  it('POST with no changes needed → returns { normalized: 0, merged: 0, frequencyBackfilled: 0 }', async () => {
    await seedWord({ dictionary_form: '食べる', reading: 'たべる' });

    const response = await POST(makePostRequest({
      normalizations: [],
      frequency_backfill_ids: [],
    }));

    expect(response.status).toBe(200);
    const data = await response.json() as { normalized: number; merged: number; frequencyBackfilled: number };
    expect(data).toEqual({ normalized: 0, merged: 0, frequencyBackfilled: 0 });
  });

  it('idempotent: second POST on same data returns all-zero summary', async () => {
    const id = await seedWord({ dictionary_form: '食べ', reading: 'たべる' });

    const payload = {
      normalizations: [{ id, canonical_dictionary_form: '食べる' }],
      frequency_backfill_ids: [],
    };

    await POST(makePostRequest(payload));
    const response2 = await POST(makePostRequest(payload));

    expect(response2.status).toBe(200);
    const data = await response2.json() as { normalized: number; merged: number; frequencyBackfilled: number };
    expect(data).toEqual({ normalized: 0, merged: 0, frequencyBackfilled: 0 });
  });
});
