import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool !== null) return pool;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  return pool;
}

export function query<T extends object>(text: string, params?: unknown[]): Promise<{ rows: T[] }> {
  return getPool().query(text, params);
}
