import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const mockTokenizeText = vi.hoisted(() => vi.fn());
const mockQuery = vi.hoisted(() => vi.fn());

vi.mock('@/lib/claude', () => ({ tokenizeText: mockTokenizeText }));
vi.mock('@/lib/db', () => ({ query: mockQuery }));

import * as formatDetection from '@/lib/format-detection';
import { POST } from '@/app/api/texts/route';
import type { ParsedContent } from '@/lib/types';

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
      { surface: '猫', dictionary_form: '猫', reading: 'ねこ', pos: 'noun', is_content_word: true },
      { surface: 'が', dictionary_form: 'が', reading: 'が', pos: 'particle', is_content_word: false },
      { surface: '好き', dictionary_form: '好き', reading: 'すき', pos: 'adjective', is_content_word: true },
      { surface: 'です', dictionary_form: 'です', reading: 'です', pos: 'other', is_content_word: false },
      { surface: '。', dictionary_form: '。', reading: '。', pos: 'punctuation', is_content_word: false },
    ],
  },
];

describe('POST /api/texts — unit', () => {
  it('calls detectFormat when no formatOverride is provided', async () => {
    mockTokenizeText.mockResolvedValue(sampleParsedContent);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValue({ rows: [] });

    const spy = vi.spyOn(formatDetection, 'detectFormat');
    await POST(makeRequest({ title: 'Test', content: '猫が好きです。' }));
    expect(spy).toHaveBeenCalledWith('猫が好きです。');
    spy.mockRestore();
  });
});

describeIfDb('POST /api/texts — integration', () => {
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

  it('inserts text and words for valid markdown body, returns { id }', async () => {
    mockTokenizeText.mockResolvedValue(sampleParsedContent);

    const response = await POST(makeRequest({ title: '猫の話', content: '猫が好きです。' }));
    expect(response.status).toBe(200);
    const data = await response.json() as { id: number };
    expect(typeof data.id).toBe('number');

    const texts = await testPool.query<{ title: string }>('SELECT title FROM texts');
    expect(texts.rows).toHaveLength(1);
    expect(texts.rows[0].title).toBe('猫の話');

    const words = await testPool.query<{ dictionary_form: string }>('SELECT dictionary_form FROM words');
    const forms = words.rows.map(r => r.dictionary_form);
    expect(forms).toContain('猫');
    expect(forms).toContain('好き');
    expect(forms).not.toContain('が');
  });

  it('processes HTML body via processHtml and inserts correctly', async () => {
    mockTokenizeText.mockResolvedValue(sampleParsedContent);

    const response = await POST(makeRequest({ title: 'HTML Test', content: '<p>猫が好きです。</p>' }));
    expect(response.status).toBe(200);

    // tokenizeText should receive stripped plain text, not HTML
    const calledWith = mockTokenizeText.mock.calls[0][0] as string;
    expect(calledWith).toBe('猫が好きです。');

    const texts = await testPool.query<{ raw_content: string }>('SELECT raw_content FROM texts');
    expect(texts.rows[0].raw_content).toBe('<p>猫が好きです。</p>');
  });

  it('uses processHtml when formatOverride is html on markdown input', async () => {
    mockTokenizeText.mockResolvedValue(sampleParsedContent);

    await POST(makeRequest({
      title: 'Override Test',
      content: '# 猫が好きです',
      formatOverride: 'html',
    }));

    // processHtml on plain text produces no sentinel; processMarkdown would produce __HEADING_1__
    const calledWith = mockTokenizeText.mock.calls[0][0] as string;
    expect(calledWith).not.toContain('__HEADING_');
  });

  it('returns 500 and persists nothing when tokenizer throws', async () => {
    mockTokenizeText.mockRejectedValue(new Error('API error'));

    const response = await POST(makeRequest({ title: 'Error Test', content: '猫が好きです。' }));
    expect(response.status).toBe(500);
    const data = await response.json() as { error: string };
    expect(data.error).toBe('Tokenization failed');

    const texts = await testPool.query('SELECT id FROM texts');
    expect(texts.rows).toHaveLength(0);
  });

  it('upserts duplicate words without error or duplication', async () => {
    const contentWithDupe: ParsedContent = [
      {
        sentence_index: 0,
        raw: '猫が猫です。',
        tokens: [
          { surface: '猫', dictionary_form: '猫', reading: 'ねこ', pos: 'noun', is_content_word: true },
          { surface: 'が', dictionary_form: 'が', reading: 'が', pos: 'particle', is_content_word: false },
          { surface: '猫', dictionary_form: '猫', reading: 'ねこ', pos: 'noun', is_content_word: true },
          { surface: 'です', dictionary_form: 'です', reading: 'です', pos: 'other', is_content_word: false },
          { surface: '。', dictionary_form: '。', reading: '。', pos: 'punctuation', is_content_word: false },
        ],
      },
    ];
    mockTokenizeText.mockResolvedValue(contentWithDupe);

    const response = await POST(makeRequest({ title: '猫テスト', content: '猫が猫です。' }));
    expect(response.status).toBe(200);

    const words = await testPool.query<{ dictionary_form: string }>('SELECT dictionary_form FROM words');
    expect(words.rows.filter(r => r.dictionary_form === '猫')).toHaveLength(1);
  });
});
