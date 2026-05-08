import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { createSession } from '@/lib/session';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json() as { email?: unknown; password?: unknown };

  if (typeof body.email !== 'string' || typeof body.password !== 'string') {
    return json({ error: 'Email and password are required' }, 400);
  }

  const result = await query<{ id: number; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE email = $1',
    [body.email.toLowerCase()],
  );

  const user = result.rows[0];
  const validPassword = user !== undefined && await bcrypt.compare(body.password, user.password_hash);

  if (!validPassword) {
    return json({ error: 'Invalid email or password' }, 401);
  }

  await createSession(user.id);

  return json({ ok: true });
}
