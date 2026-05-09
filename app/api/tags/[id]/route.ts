import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { jsonResponse } from '@/lib/api';
import { TAG_COLORS } from '@/lib/tags';
import type { Tag, TagColor } from '@/lib/types';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const tagId = parseInt(params.id, 10);
  if (isNaN(tagId)) return jsonResponse({ error: 'Invalid id' }, 400);

  const existing = await query<{ id: number }>(
    'SELECT id FROM tags WHERE id = $1 AND user_id = $2',
    [tagId, user.id],
  );
  if (existing.rows.length === 0) return jsonResponse({ error: 'Not found' }, 404);

  const body = await request.json() as { name?: unknown; color?: unknown };
  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name === '' || name.length > 32) {
      return jsonResponse({ error: 'Tag name must be 1–32 characters' }, 400);
    }
    values.push(name);
    updates.push(`name = $${values.length}`);
  }

  if (body.color !== undefined) {
    if (!TAG_COLORS.includes(body.color as TagColor)) {
      return jsonResponse({ error: 'Invalid color' }, 400);
    }
    values.push(body.color);
    updates.push(`color = $${values.length}`);
  }

  if (updates.length === 0) return jsonResponse({ error: 'No fields to update' }, 400);

  values.push(tagId);
  try {
    const result = await query<Tag>(
      `UPDATE tags SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING id, name, color`,
      values,
    );
    return jsonResponse({ tag: result.rows[0] });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('unique')) {
      return jsonResponse({ error: 'A tag with that name already exists' }, 409);
    }
    throw err;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const tagId = parseInt(params.id, 10);
  if (isNaN(tagId)) return jsonResponse({ error: 'Invalid id' }, 400);

  const result = await query(
    'DELETE FROM tags WHERE id = $1 AND user_id = $2',
    [tagId, user.id],
  );
  if ((result as unknown as { rowCount: number }).rowCount === 0) {
    return jsonResponse({ error: 'Not found' }, 404);
  }
  return jsonResponse({ ok: true });
}
