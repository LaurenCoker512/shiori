import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const mockAnalyzeGrammar = vi.hoisted(() => vi.fn());
const mockDescribeGrammarPattern = vi.hoisted(() => vi.fn());
const mockQuery = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/claude', () => ({
  analyzeGrammar: mockAnalyzeGrammar,
  describeGrammarPattern: mockDescribeGrammarPattern,
  buildLLMConfig: vi.fn(() => ({ apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6' })),
}));
vi.mock('@/lib/db', () => ({ query: mockQuery }));
vi.mock('@/lib/session', () => ({ getSession: mockGetSession }));

import { GET } from '@/app/api/sentences/[textId]/[sentenceIndex]/grammar/route';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

function makeParams(textId: string, sentenceIndex: string) {
  return { params: { textId, sentenceIndex } };
}

function makeGetRequest(): Request {
  return new Request('http://localhost/api/sentences/1/0/grammar');
}

describeIfDb('GET /api/sentences/[textId]/[sentenceIndex]/grammar — integration', () => {
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
      
      openrouter_api_key: null, openrouter_model: 'anthropic/claude-sonnet-4-6',
    });
  });

  afterEach(async () => {
    await testPool.query(
      'TRUNCATE TABLE sentence_patterns, furigana_overrides, grammar_patterns, words, texts RESTART IDENTITY CASCADE',
    );
    mockAnalyzeGrammar.mockReset();
    mockDescribeGrammarPattern.mockReset();
  });

  afterAll(async () => {
    await testPool.query(
      'DROP TABLE IF EXISTS sentence_patterns, furigana_overrides, grammar_patterns, texts, words CASCADE',
    );
    await testPool.end();
  });

  const PARSED_CONTENT = JSON.stringify([
    { sentence_index: 0, raw: '猫が食べていた。', tokens: [] },
  ]);

  async function seedText(): Promise<number> {
    const result = await testPool.query<{ id: number }>(
      `INSERT INTO texts (user_id, title, raw_content, parsed_content)
       VALUES (1, 'Test', 'raw', $1) RETURNING id`,
      [PARSED_CONTENT],
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

  async function seedSentencePattern(textId: number, sentenceIndex: number, grammarPatternId: number | null): Promise<void> {
    await testPool.query(
      `INSERT INTO sentence_patterns (text_id, sentence_index, grammar_pattern_id) VALUES ($1, $2, $3)`,
      [textId, sentenceIndex, grammarPatternId],
    );
  }

  it('existing sentence_patterns rows → returns cached patterns, no Claude call', async () => {
    const textId = await seedText();
    const patternId = await seedGrammarPattern('〜ていた');
    await seedSentencePattern(textId, 0, patternId);

    const response = await GET(makeGetRequest(), makeParams(String(textId), '0'));
    expect(response.status).toBe(200);
    const data = await response.json() as { patterns: { pattern: string }[] };

    expect(data.patterns).toHaveLength(1);
    expect(data.patterns[0].pattern).toBe('〜ていた');
    expect(mockAnalyzeGrammar).not.toHaveBeenCalled();
  });

  it('NULL sentinel row exists → returns [], no Claude call', async () => {
    const textId = await seedText();
    await seedSentencePattern(textId, 0, null);

    const response = await GET(makeGetRequest(), makeParams(String(textId), '0'));
    expect(response.status).toBe(200);
    const data = await response.json() as { patterns: unknown[] };

    expect(data.patterns).toEqual([]);
    expect(mockAnalyzeGrammar).not.toHaveBeenCalled();
  });

  it('no prior rows → calls analyzeGrammar, creates grammar_patterns row, inserts sentence_patterns, returns patterns', async () => {
    const textId = await seedText();
    mockAnalyzeGrammar.mockResolvedValue([{ pattern: '〜ていた', jlpt_level: 'N4' }]);
    mockDescribeGrammarPattern.mockResolvedValue('Past progressive tense.');

    const response = await GET(makeGetRequest(), makeParams(String(textId), '0'));
    expect(response.status).toBe(200);
    const data = await response.json() as { patterns: { pattern: string; description_en: string; jlpt_level: string }[] };

    expect(data.patterns).toHaveLength(1);
    expect(data.patterns[0].pattern).toBe('〜ていた');
    expect(data.patterns[0].description_en).toBe('Past progressive tense.');
    expect(data.patterns[0].jlpt_level).toBe('N4');
    expect(mockAnalyzeGrammar).toHaveBeenCalledWith(
      { apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6' },
      '猫が食べていた。',
    );
    expect(mockDescribeGrammarPattern).toHaveBeenCalledWith(
      { apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6' },
      '〜ていた',
    );

    const gpRow = await testPool.query('SELECT * FROM grammar_patterns WHERE pattern = $1', ['〜ていた']);
    expect(gpRow.rows).toHaveLength(1);

    const spRow = await testPool.query(
      'SELECT * FROM sentence_patterns WHERE text_id = $1 AND sentence_index = 0',
      [textId],
    );
    expect(spRow.rows).toHaveLength(1);
    expect(spRow.rows[0].grammar_pattern_id).toBe(gpRow.rows[0].id);
  });

  it('pattern already exists in grammar_patterns → skips describeGrammarPattern, reuses row', async () => {
    const textId = await seedText();
    const existingPatternId = await seedGrammarPattern('〜ていた');
    mockAnalyzeGrammar.mockResolvedValue([{ pattern: '〜ていた', jlpt_level: 'N4' }]);

    const response = await GET(makeGetRequest(), makeParams(String(textId), '0'));
    expect(response.status).toBe(200);
    const data = await response.json() as { patterns: { id: number }[] };

    expect(data.patterns).toHaveLength(1);
    expect(data.patterns[0].id).toBe(existingPatternId);
    expect(mockDescribeGrammarPattern).not.toHaveBeenCalled();

    const gpRows = await testPool.query('SELECT * FROM grammar_patterns WHERE pattern = $1', ['〜ていた']);
    expect(gpRows.rows).toHaveLength(1);
  });

  it('analyzeGrammar returns [] → inserts NULL sentinel row, returns { patterns: [] }', async () => {
    const textId = await seedText();
    mockAnalyzeGrammar.mockResolvedValue([]);

    const response = await GET(makeGetRequest(), makeParams(String(textId), '0'));
    expect(response.status).toBe(200);
    const data = await response.json() as { patterns: unknown[] };

    expect(data.patterns).toEqual([]);

    const spRows = await testPool.query(
      'SELECT * FROM sentence_patterns WHERE text_id = $1 AND sentence_index = 0',
      [textId],
    );
    expect(spRows.rows).toHaveLength(1);
    expect(spRows.rows[0].grammar_pattern_id).toBeNull();
  });

  it('Claude throws → returns { patterns: [], error: "Grammar analysis unavailable" }, nothing persisted', async () => {
    const textId = await seedText();
    mockAnalyzeGrammar.mockRejectedValue(new Error('API error'));

    const response = await GET(makeGetRequest(), makeParams(String(textId), '0'));
    expect(response.status).toBe(500);
    const data = await response.json() as { patterns: unknown[]; error: string };

    expect(data.patterns).toEqual([]);
    expect(data.error).toBe('Grammar analysis unavailable');

    const spRows = await testPool.query(
      'SELECT * FROM sentence_patterns WHERE text_id = $1 AND sentence_index = 0',
      [textId],
    );
    expect(spRows.rows).toHaveLength(0);
  });
});
