import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcryptjs';

const mockQuery = vi.hoisted(() => vi.fn());
const mockCreateSession = vi.hoisted(() => vi.fn());
const mockDeleteSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ query: mockQuery }));
vi.mock('@/lib/session', () => ({
  createSession: mockCreateSession,
  deleteSession: mockDeleteSession,
}));

import { POST as register } from '@/app/api/auth/register/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

function makeRequest(url: string, body: object): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describeIfDb('POST /api/auth/register — integration', () => {
  let testPool: Pool;

  beforeAll(async () => {
    testPool = new Pool({ connectionString: TEST_DATABASE_URL });
    await testPool.query('DROP TABLE IF EXISTS sessions, users CASCADE');
    const migration = readFileSync(join(process.cwd(), 'migrations/002_auth.sql'), 'utf-8');
    await testPool.query(migration);
    mockQuery.mockReset();
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => testPool.query(sql, params));
  });

  afterEach(async () => {
    await testPool.query('TRUNCATE TABLE sessions, users RESTART IDENTITY CASCADE');
    mockCreateSession.mockReset();
  });

  afterAll(async () => {
    await testPool.query('DROP TABLE IF EXISTS sessions, users CASCADE');
    await testPool.end();
  });

  it('valid registration → inserts user and calls createSession', async () => {
    const response = await register(
      makeRequest('http://localhost/api/auth/register', {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      }),
    );
    expect(response.status).toBe(200);
    const data = await response.json() as { ok: boolean };
    expect(data.ok).toBe(true);

    const users = await testPool.query<{ email: string }>('SELECT email FROM users');
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0].email).toBe('test@example.com');
    expect(mockCreateSession).toHaveBeenCalledOnce();
  });

  it('duplicate email → 409, no session created', async () => {
    await testPool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
      ['Existing', 'dup@example.com', 'hash'],
    );

    const response = await register(
      makeRequest('http://localhost/api/auth/register', {
        name: 'Another',
        email: 'dup@example.com',
        password: 'password123',
      }),
    );
    expect(response.status).toBe(409);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('short password → 400, no session created', async () => {
    const response = await register(
      makeRequest('http://localhost/api/auth/register', {
        name: 'Test User',
        email: 'test@example.com',
        password: 'short',
      }),
    );
    expect(response.status).toBe(400);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('invalid email → 400, no session created', async () => {
    const response = await register(
      makeRequest('http://localhost/api/auth/register', {
        name: 'Test User',
        email: 'notanemail',
        password: 'password123',
      }),
    );
    expect(response.status).toBe(400);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('missing name → 400, no session created', async () => {
    const response = await register(
      makeRequest('http://localhost/api/auth/register', {
        email: 'test@example.com',
        password: 'password123',
      }),
    );
    expect(response.status).toBe(400);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});

describeIfDb('POST /api/auth/login — integration', () => {
  let testPool: Pool;

  beforeAll(async () => {
    testPool = new Pool({ connectionString: TEST_DATABASE_URL });
    await testPool.query('DROP TABLE IF EXISTS sessions, users CASCADE');
    const migration = readFileSync(join(process.cwd(), 'migrations/002_auth.sql'), 'utf-8');
    await testPool.query(migration);
    mockQuery.mockReset();
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => testPool.query(sql, params));

    // cost 4 for speed; cost 12 is used in production
    const hash = await bcrypt.hash('correctpassword', 4);
    await testPool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
      ['Test User', 'test@example.com', hash],
    );
  });

  afterEach(() => {
    mockCreateSession.mockReset();
  });

  afterAll(async () => {
    await testPool.query('DROP TABLE IF EXISTS sessions, users CASCADE');
    await testPool.end();
  });

  it('valid credentials → calls createSession, returns { ok: true }', async () => {
    const response = await login(
      makeRequest('http://localhost/api/auth/login', {
        email: 'test@example.com',
        password: 'correctpassword',
      }),
    );
    expect(response.status).toBe(200);
    const data = await response.json() as { ok: boolean };
    expect(data.ok).toBe(true);
    expect(mockCreateSession).toHaveBeenCalledOnce();
  });

  it('wrong password → 401, no session created', async () => {
    const response = await login(
      makeRequest('http://localhost/api/auth/login', {
        email: 'test@example.com',
        password: 'wrongpassword',
      }),
    );
    expect(response.status).toBe(401);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('unknown email → 401, no session created', async () => {
    const response = await login(
      makeRequest('http://localhost/api/auth/login', {
        email: 'nobody@example.com',
        password: 'correctpassword',
      }),
    );
    expect(response.status).toBe(401);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/logout', () => {
  it('calls deleteSession and redirects to /login', async () => {
    mockDeleteSession.mockResolvedValue(undefined);
    const response = await logout();
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/login');
    expect(mockDeleteSession).toHaveBeenCalledOnce();
  });
});
