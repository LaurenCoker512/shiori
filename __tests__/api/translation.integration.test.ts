import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const mockTranslateWord = vi.hoisted(() => vi.fn());
const mockQuery = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/claude', () => ({ translateWord: mockTranslateWord, buildLLMConfig: vi.fn(() => ({ apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6' })) }));
vi.mock('@/lib/db', () => ({ query: mockQuery }));
vi.mock('@/lib/session', () => ({ getSession: mockGetSession }));

import { GET } from '@/app/api/words/[id]/translation/route';
import type { SessionUser } from '@/lib/session';

const FAKE_USER: SessionUser = {
  id: 1, name: 'Test', email: 'test@example.com',
  anthropic_api_key: 'sk-ant-test', ai_provider: 'anthropic', anthropic_model: 'claude-sonnet-4-6',
  openrouter_api_key: null, openrouter_model: 'anthropic/claude-sonnet-4-6',
};

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/words/1/translation');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString());
}

function makeParams(id: string) {
  return { params: { id } };
}

describeIfDb('GET /api/words/[id]/translation — integration', () => {
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
    mockTranslateWord.mockReset();
  });

  afterAll(async () => {
    await testPool.query(
      'DROP TABLE IF EXISTS sentence_patterns, furigana_overrides, grammar_patterns, texts, words CASCADE',
    );
    await testPool.end();
  });

  async function seedWord(overrides: { translation?: string | null } = {}): Promise<number> {
    const result = await testPool.query<{ id: number }>(
      `INSERT INTO words (user_id, dictionary_form, reading, translation) VALUES (1, '食べる', 'たべる', $1) RETURNING id`,
      ['translation' in overrides ? overrides.translation : null],
    );
    return result.rows[0].id;
  }

  it('word with existing translation returns immediately, no Claude call', async () => {
    const wordId = await seedWord({ translation: '["to eat","to consume"]' });

    const response = await GET(makeGetRequest(), makeParams(String(wordId)));
    expect(response.status).toBe(200);
    const data = await response.json() as { translations: string[]; jlpt_level: string | null };

    expect(data.translations).toEqual(['to eat', 'to consume']);
    expect(mockTranslateWord).not.toHaveBeenCalled();
  });

  it('null translation calls translateWord, persists result, returns { translations, jlpt_level }', async () => {
    const wordId = await seedWord();
    mockTranslateWord.mockResolvedValue({ translations: ['to eat', 'to consume'], jlpt_level: 'N5' });

    const response = await GET(makeGetRequest(), makeParams(String(wordId)));
    expect(response.status).toBe(200);
    const data = await response.json() as { translations: string[]; jlpt_level: string | null };

    expect(data.translations).toEqual(['to eat', 'to consume']);
    expect(data.jlpt_level).toBe('N5');
    expect(mockTranslateWord).toHaveBeenCalledOnce();

    const row = await testPool.query<{ translation: string; jlpt_level: string }>(
      'SELECT translation, jlpt_level FROM words WHERE id = $1',
      [wordId],
    );
    expect(row.rows[0].translation).toBe('["to eat","to consume"]');
    expect(row.rows[0].jlpt_level).toBe('N5');
  });

  it('contextSentence query param is passed to translateWord', async () => {
    const wordId = await seedWord();
    mockTranslateWord.mockResolvedValue({ translations: ['to eat'], jlpt_level: 'N5' });

    await GET(makeGetRequest({ contextSentence: '猫が食べる。' }), makeParams(String(wordId)));

    expect(mockTranslateWord).toHaveBeenCalledWith(
      { apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6' },
      '食べる',
      '猫が食べる。',
    );
  });

  it('Claude throws → returns { error: "Translation unavailable" }, nothing persisted', async () => {
    const wordId = await seedWord();
    mockTranslateWord.mockRejectedValue(new Error('API error'));

    const response = await GET(makeGetRequest(), makeParams(String(wordId)));
    expect(response.status).toBe(500);
    const data = await response.json() as { error: string };
    expect(data.error).toBe('Translation unavailable');

    const row = await testPool.query<{ translation: string | null }>(
      'SELECT translation FROM words WHERE id = $1',
      [wordId],
    );
    expect(row.rows[0].translation).toBeNull();
  });
});
