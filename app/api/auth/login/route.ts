import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { createSession } from '@/lib/session';
import { jsonResponse as json } from '@/lib/api';

// Prevents timing-based email enumeration: bcrypt.compare always runs regardless of whether the user exists
const DUMMY_HASH = '$2b$12$KIXlJmKdqCLkJnQGJqQ5.eM3BRXJ7g7UPB4IJZn5h.yCWeMkHfTe6';

export async function POST(request: Request): Promise<Response> {
  const body = await request.json() as { email?: unknown; password?: unknown };

  if (typeof body.email !== 'string' || typeof body.password !== 'string') {
    return json({ error: 'Email and password are required' }, 400);
  }

  const result = await query<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE email = $1',
    [body.email.toLowerCase()],
  );

  const user = result.rows[0];
  const hashToCompare = user?.password_hash ?? DUMMY_HASH;
  const passwordMatch = await bcrypt.compare(body.password, hashToCompare);

  if (user === undefined || !passwordMatch) {
    return json({ error: 'Invalid email or password' }, 401);
  }

  await createSession(user.id);

  return json({ ok: true });
}
