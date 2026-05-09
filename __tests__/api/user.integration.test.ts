import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const mockQuery = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ query: mockQuery }));
vi.mock('@/lib/session', () => ({ getSession: mockGetSession }));

import { PATCH } from '@/app/api/user/route';
import type { SessionUser } from '@/lib/session';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

const FAKE_USER: SessionUser = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  openrouter_api_key: null,
  openrouter_model: 'anthropic/claude-sonnet-4-6',
};

function makeRequest(body: object): Request {
  return new Request('http://localhost/api/user', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describeIfDb('PATCH /api/user — integration', () => {
  let testPool: Pool;

  beforeAll(async () => {
    testPool = new Pool({ connectionString: TEST_DATABASE_URL });
    await testPool.query('DROP TABLE IF EXISTS sessions, users CASCADE');

    for (const file of ['002_auth.sql', '004_user_api_key.sql', '005_ai_provider.sql']) {
      const sql = readFileSync(join(process.cwd(), 'migrations', file), 'utf-8');
      await testPool.query(sql);
    }

    await testPool.query(
      `INSERT INTO users (id, name, email, password_hash)
       VALUES (1, 'Test User', 'test@example.com', 'hash')`,
    );

    mockQuery.mockReset();
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => testPool.query(sql, params));
  });

  afterEach(() => {
    mockGetSession.mockReset();
  });

  afterAll(async () => {
    await testPool.query('DROP TABLE IF EXISTS sessions, users CASCADE');
    await testPool.end();
  });

  async function getUser() {
    const result = await testPool.query<{
      name: string;
      openrouter_api_key: string | null;
      openrouter_model: string;
    }>('SELECT name, openrouter_api_key, openrouter_model FROM users WHERE id = 1');
    return result.rows[0];
  }

  it('unauthenticated → 401', async () => {
    mockGetSession.mockResolvedValue(null);
    const response = await PATCH(makeRequest({ name: 'New Name' }));
    expect(response.status).toBe(401);
  });

  it('name change → updates name, returns { ok: true, name }', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER);
    const response = await PATCH(makeRequest({ name: 'Updated Name' }));
    expect(response.status).toBe(200);
    const data = await response.json() as { ok: boolean; name: string };
    expect(data.ok).toBe(true);
    expect(data.name).toBe('Updated Name');

    const row = await getUser();
    expect(row.name).toBe('Updated Name');
  });

  it('name change with surrounding whitespace → trims before saving', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER);
    const response = await PATCH(makeRequest({ name: '  Trimmed  ' }));
    expect(response.status).toBe(200);
    const data = await response.json() as { ok: boolean; name: string };
    expect(data.name).toBe('Trimmed');

    const row = await getUser();
    expect(row.name).toBe('Trimmed');
  });

  it('empty name → 400', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER);
    const response = await PATCH(makeRequest({ name: '' }));
    expect(response.status).toBe(400);
  });

  it('whitespace-only name → 400', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER);
    const response = await PATCH(makeRequest({ name: '   ' }));
    expect(response.status).toBe(400);
  });

  it('valid openrouter_api_key → stored in DB', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER);
    const response = await PATCH(makeRequest({ openrouter_api_key: 'sk-or-xyz789' }));
    expect(response.status).toBe(200);

    const row = await getUser();
    expect(row.openrouter_api_key).toBe('sk-or-xyz789');
  });

  it('empty openrouter_api_key string → clears key in DB', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER);
    await PATCH(makeRequest({ openrouter_api_key: 'sk-or-xyz789' }));
    const response = await PATCH(makeRequest({ openrouter_api_key: '' }));
    expect(response.status).toBe(200);

    const row = await getUser();
    expect(row.openrouter_api_key).toBeNull();
  });

  it('openrouter_api_key without sk-or- prefix → 400', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER);
    const response = await PATCH(makeRequest({ openrouter_api_key: 'bad-key' }));
    expect(response.status).toBe(400);
  });

  it('valid openrouter_model → updates DB', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER);
    const response = await PATCH(makeRequest({ openrouter_model: 'meta-llama/llama-3.1-8b-instruct' }));
    expect(response.status).toBe(200);

    const row = await getUser();
    expect(row.openrouter_model).toBe('meta-llama/llama-3.1-8b-instruct');
  });

  it('empty openrouter_model string → 400', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER);
    const response = await PATCH(makeRequest({ openrouter_model: '   ' }));
    expect(response.status).toBe(400);
  });
});
