import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ query: mockQuery }));

import { GET } from '@/app/api/grammar-patterns/[id]/sentences/route';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

function makeGetRequest(): Request {
  return new Request('http://localhost/api/grammar-patterns/1/sentences');
}

function makeParams(id: string) {
  return { params: { id } };
}

describeIfDb('GET /api/grammar-patterns/[id]/sentences — integration', () => {
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

  async function seedText(title: string, parsedContent: unknown[]): Promise<number> {
    const result = await testPool.query<{ id: number }>(
      `INSERT INTO texts (user_id, title, raw_content, parsed_content)
       VALUES (1, $1, 'raw', $2) RETURNING id`,
      [title, JSON.stringify(parsedContent)],
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

  it('returns sentences for a known grammar pattern ordered by title then sentence_index', async () => {
    const parsedContent = [
      { sentence_index: 0, raw: '猫が食べていた。', tokens: [] },
      { sentence_index: 1, raw: '犬が走っていた。', tokens: [] },
    ];
    const textId = await seedText('Test Title', parsedContent);
    const patternId = await seedGrammarPattern('〜ていた');

    await testPool.query(
      'INSERT INTO sentence_patterns (text_id, sentence_index, grammar_pattern_id) VALUES ($1, 1, $2)',
      [textId, patternId],
    );
    await testPool.query(
      'INSERT INTO sentence_patterns (text_id, sentence_index, grammar_pattern_id) VALUES ($1, 0, $2)',
      [textId, patternId],
    );

    const response = await GET(makeGetRequest(), makeParams(String(patternId)));
    expect(response.status).toBe(200);
    const data = await response.json() as {
      sentences: { text_id: number; title: string; sentence_index: number; sentence_raw: string }[];
    };

    expect(data.sentences).toHaveLength(2);
    expect(data.sentences[0].sentence_index).toBe(0);
    expect(data.sentences[0].sentence_raw).toBe('猫が食べていた。');
    expect(data.sentences[1].sentence_index).toBe(1);
    expect(data.sentences[1].sentence_raw).toBe('犬が走っていた。');
    expect(data.sentences[0].title).toBe('Test Title');
  });

  it('excludes NULL sentinel rows (grammar_pattern_id IS NULL)', async () => {
    const parsedContent = [{ sentence_index: 0, raw: '猫が食べる。', tokens: [] }];
    const textId = await seedText('Test', parsedContent);
    const patternId = await seedGrammarPattern('〜ていた');

    await testPool.query(
      'INSERT INTO sentence_patterns (text_id, sentence_index, grammar_pattern_id) VALUES ($1, 0, NULL)',
      [textId],
    );

    const response = await GET(makeGetRequest(), makeParams(String(patternId)));
    expect(response.status).toBe(200);
    const data = await response.json() as { sentences: unknown[] };
    expect(data.sentences).toEqual([]);
  });
});
