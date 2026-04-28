import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pg', () => {
  const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
  function Pool() {
    return { query: mockQuery };
  }
  return { Pool };
});

describe('lib/db', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports a query function', async () => {
    const db = await import('@/lib/db');
    expect(typeof db.query).toBe('function');
  });

  it('query returns an object with a rows array', async () => {
    const db = await import('@/lib/db');
    const result = await db.query('SELECT 1');
    expect(result).toHaveProperty('rows');
    expect(Array.isArray(result.rows)).toBe(true);
  });
});
