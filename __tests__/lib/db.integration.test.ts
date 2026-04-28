import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

let pool: Pool;

describeIfDb('database integration', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
    await pool.query('DROP TABLE IF EXISTS sentence_patterns, furigana_overrides, grammar_patterns, texts, words CASCADE');
    const migration = readFileSync(join(process.cwd(), 'migrations/001_initial.sql'), 'utf-8');
    await pool.query(migration);
  });

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS sentence_patterns, furigana_overrides, grammar_patterns, texts, words CASCADE');
    await pool.end();
  });

  it('migration creates all 5 tables', async () => {
    const result = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const tables = result.rows.map((r) => r.tablename);
    expect(tables).toContain('words');
    expect(tables).toContain('texts');
    expect(tables).toContain('furigana_overrides');
    expect(tables).toContain('grammar_patterns');
    expect(tables).toContain('sentence_patterns');
  });

  it('words CHECK constraint rejects invalid status', async () => {
    await expect(
      pool.query(`INSERT INTO words (dictionary_form, reading, status) VALUES ('食べる', 'たべる', 'invalid')`)
    ).rejects.toThrow();
  });

  it('words UNIQUE constraint rejects duplicate dictionary_form+reading', async () => {
    await pool.query(`INSERT INTO words (dictionary_form, reading) VALUES ('食べる', 'たべる')`);
    await expect(
      pool.query(`INSERT INTO words (dictionary_form, reading) VALUES ('食べる', 'たべる')`)
    ).rejects.toThrow();
  });

  it('words jlpt_level CHECK constraint rejects invalid value', async () => {
    await expect(
      pool.query(`INSERT INTO words (dictionary_form, reading, jlpt_level) VALUES ('飲む', 'のむ', 'N6')`)
    ).rejects.toThrow();
  });

  it('sentence_patterns ON DELETE CASCADE removes rows when text deleted', async () => {
    await pool.query(`INSERT INTO texts (id, title, raw_content) VALUES (999, 'Test', 'content')`);
    await pool.query(`INSERT INTO sentence_patterns (text_id, sentence_index) VALUES (999, 0)`);
    await pool.query(`DELETE FROM texts WHERE id = 999`);
    const result = await pool.query(`SELECT * FROM sentence_patterns WHERE text_id = 999`);
    expect(result.rows).toHaveLength(0);
  });

  it('furigana_overrides ON DELETE CASCADE removes rows when word deleted', async () => {
    const wordResult = await pool.query<{ id: number }>(
      `INSERT INTO words (dictionary_form, reading) VALUES ('走る', 'はしる') RETURNING id`
    );
    const wordId = wordResult.rows[0].id;
    await pool.query(
      `INSERT INTO furigana_overrides (word_id, surface_form, corrected_reading) VALUES ($1, '走', 'はし')`,
      [wordId]
    );
    await pool.query(`DELETE FROM words WHERE id = $1`, [wordId]);
    const result = await pool.query(`SELECT * FROM furigana_overrides WHERE word_id = $1`, [wordId]);
    expect(result.rows).toHaveLength(0);
  });
});
