import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { jsonResponse } from '@/lib/api';
import { TAG_COLORS } from '@/lib/tags';
import type { Tag, TagColor } from '@/lib/types';

export async function GET(): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const result = await query<Tag>(
    'SELECT id, name, color FROM tags WHERE user_id = $1 ORDER BY name',
    [user.id],
  );
  return jsonResponse({ tags: result.rows });
}

export async function POST(request: Request): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const body = await request.json() as { name?: unknown; color?: unknown };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const color = body.color as string;

  if (name === '' || name.length > 32) {
    return jsonResponse({ error: 'Tag name must be 1–32 characters' }, 400);
  }
  if (!TAG_COLORS.includes(color as TagColor)) {
    return jsonResponse({ error: 'Invalid color' }, 400);
  }

  try {
    const result = await query<Tag>(
      'INSERT INTO tags (user_id, name, color) VALUES ($1, $2, $3) RETURNING id, name, color',
      [user.id, name, color],
    );
    return jsonResponse({ tag: result.rows[0] }, 201);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('unique')) {
      return jsonResponse({ error: 'A tag with that name already exists' }, 409);
    }
    throw err;
  }
}
