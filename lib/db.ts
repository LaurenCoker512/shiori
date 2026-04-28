import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export function query<T extends object>(text: string, params?: unknown[]): Promise<{ rows: T[] }> {
  return pool.query(text, params);
}
