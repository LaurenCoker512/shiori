import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { createSession } from '@/lib/session';
import { jsonResponse as json } from '@/lib/api';

export async function POST(request: Request): Promise<Response> {
  let body: { name?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (typeof body.name !== 'string' || body.name.trim() === '') {
    return json({ error: 'Name is required' }, 400);
  }
  if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) {
    return json({ error: 'Valid email is required' }, 400);
  }
  if (typeof body.password !== 'string' || body.password.length < 8) {
    return json({ error: 'Password must be at least 8 characters' }, 400);
  }

  try {
    const existing = await query<{ id: number }>(
      'SELECT id FROM users WHERE email = $1',
      [body.email.toLowerCase()],
    );
    if (existing.rows.length > 0) {
      return json({ error: 'An account with that email already exists' }, 409);
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const result = await query<{ id: number }>(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [body.name.trim(), body.email.toLowerCase(), passwordHash],
    );

    await createSession(result.rows[0].id);

    return json({ ok: true });
  } catch (err) {
    console.error('Registration error:', err);
    return json({ error: 'An unexpected error occurred. Please try again.' }, 500);
  }
}
