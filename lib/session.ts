import { cookies } from 'next/headers';
import { query } from './db';

const COOKIE_NAME = 'shiori_session';
const SESSION_DAYS = 30;

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  anthropic_api_key: string | null;
  ai_provider: 'anthropic' | 'openrouter';
  anthropic_model: string;
  openrouter_api_key: string | null;
  openrouter_model: string;
}

export async function getSession(): Promise<SessionUser | null> {
  const sessionId = cookies().get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const result = await query<SessionUser>(
    `SELECT u.id, u.name, u.email, u.anthropic_api_key,
            u.ai_provider, u.anthropic_model, u.openrouter_api_key, u.openrouter_model
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [sessionId],
  );

  return result.rows[0] ?? null;
}

export async function createSession(userId: number): Promise<void> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await query(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [sessionId, userId, expiresAt.toISOString()],
  );

  cookies().set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function deleteSession(): Promise<void> {
  const sessionId = cookies().get(COOKIE_NAME)?.value;
  if (sessionId) {
    await query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  }
  cookies().delete(COOKIE_NAME);
}
