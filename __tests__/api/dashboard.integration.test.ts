import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ query: mockQuery }));

import { GET } from '@/app/api/dashboard/route';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

function makeGetRequest(): Request {
  return new Request('http://localhost/api/dashboard');
}

describeIfDb('GET /api/dashboard — integration', () => {
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

  async function seedWord(overrides: { seen_at?: string; known_at?: string; status?: string } = {}): Promise<number> {
    const status = overrides.status ?? (overrides.known_at ? 'known' : overrides.seen_at ? 'seen' : 'unseen');
    const result = await testPool.query<{ id: number }>(
      `INSERT INTO words (user_id, dictionary_form, reading, status, seen_at, known_at)
       VALUES (1, $1, $2, $3, $4, $5) RETURNING id`,
      [
        `word_${Math.random()}`,
        `reading_${Math.random()}`,
        status,
        overrides.seen_at ?? null,
        overrides.known_at ?? null,
      ],
    );
    return result.rows[0].id;
  }

  async function seedText(parsedContent: unknown[]): Promise<number> {
    const result = await testPool.query<{ id: number }>(
      `INSERT INTO texts (user_id, title, raw_content, parsed_content, last_read_at)
       VALUES (1, 'Test Text', 'raw', $1, NOW()) RETURNING id`,
      [JSON.stringify(parsedContent)],
    );
    return result.rows[0].id;
  }

  async function seedGrammarPattern(pattern: string): Promise<number> {
    const result = await testPool.query<{ id: number }>(
      `INSERT INTO grammar_patterns (user_id, pattern, description_en, jlpt_level)
       VALUES (1, $1, 'Description', 'N4') RETURNING id`,
      [pattern],
    );
    return result.rows[0].id;
  }

  it('returns seenSeries and knownSeries as separate arrays keyed by seen_at and known_at dates', async () => {
    await seedWord({ seen_at: '2024-01-01', status: 'seen' });
    await seedWord({ seen_at: '2024-01-01', known_at: '2024-01-02', status: 'known' });
    await seedWord({ known_at: '2024-01-02', seen_at: '2024-01-02', status: 'known' });

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json() as {
      seenSeries: { date: string; count: number }[];
      knownSeries: { date: string; count: number }[];
    };

    const seenCounts = data.seenSeries.reduce<Record<string, number>>((acc, r) => {
      acc[r.date] = r.count;
      return acc;
    }, {});
    expect(seenCounts['2024-01-01']).toBe(2);
    expect(seenCounts['2024-01-02']).toBe(1);

    const knownCounts = data.knownSeries.reduce<Record<string, number>>((acc, r) => {
      acc[r.date] = r.count;
      return acc;
    }, {});
    expect(knownCounts['2024-01-02']).toBe(2);
    expect(data.seenSeries.every(r => typeof r.count === 'number')).toBe(true);
    expect(data.knownSeries.every(r => typeof r.count === 'number')).toBe(true);
  });

  it('comprehension array includes pct_known computed from parsed_content tokens', async () => {
    const wordId = await testPool.query<{ id: number }>(
      `INSERT INTO words (user_id, dictionary_form, reading, status, seen_at, known_at)
       VALUES (1, '食べる', 'たべる', 'known', NOW(), NOW()) RETURNING id`,
    ).then(r => r.rows[0].id);
    void wordId;

    const parsedContent = [
      {
        sentence_index: 0,
        raw: '食べる',
        tokens: [
          { dictionary_form: '食べる', reading: 'たべる', is_content_word: true, surface: '食べる' },
          { dictionary_form: 'は', reading: 'は', is_content_word: false, surface: 'は' },
        ],
      },
    ];
    await seedText(parsedContent);

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json() as {
      comprehension: { text_id: number; title: string; pct_known: number }[];
    };

    expect(data.comprehension).toHaveLength(1);
    expect(data.comprehension[0].pct_known).toBe(100);
  });

  it('grammarPatterns includes sentence_count', async () => {
    const textId = await seedText([{ sentence_index: 0, raw: '猫が食べる。', tokens: [] }]);
    const patternId = await seedGrammarPattern('〜ていた');

    await testPool.query(
      'INSERT INTO sentence_patterns (text_id, sentence_index, grammar_pattern_id) VALUES ($1, 0, $2)',
      [textId, patternId],
    );
    await testPool.query(
      'INSERT INTO sentence_patterns (text_id, sentence_index, grammar_pattern_id) VALUES ($1, 1, $2)',
      [textId, patternId],
    );

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json() as {
      grammarPatterns: { pattern: string; sentence_count: number }[];
    };

    expect(data.grammarPatterns).toHaveLength(1);
    expect(data.grammarPatterns[0].pattern).toBe('〜ていた');
    expect(data.grammarPatterns[0].sentence_count).toBe(2);
    expect(typeof data.grammarPatterns[0].sentence_count).toBe('number');
  });

  it('empty DB returns empty arrays', async () => {
    const response = await GET(makeGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json() as {
      seenSeries: unknown[];
      knownSeries: unknown[];
      comprehension: unknown[];
      grammarPatterns: unknown[];
    };

    expect(data.seenSeries).toEqual([]);
    expect(data.knownSeries).toEqual([]);
    expect(data.comprehension).toEqual([]);
    expect(data.grammarPatterns).toEqual([]);
  });
});
