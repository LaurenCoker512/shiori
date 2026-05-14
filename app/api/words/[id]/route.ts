import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import type { Word, WordStatus } from '@/lib/types';
import { jsonResponse } from '@/lib/api';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const body = await request.json() as { status?: WordStatus; user_translation?: string | null };

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.status !== undefined) {
    updates.push(`status = $${values.length + 1}`);
    values.push(body.status);

    if (body.status === 'unseen') {
      updates.push(`seen_at = NULL`);
      updates.push(`known_at = NULL`);
    } else if (body.status === 'seen') {
      updates.push(`seen_at = COALESCE(seen_at, NOW())`);
      updates.push(`known_at = NULL`);
    } else if (body.status === 'known') {
      updates.push(`seen_at = COALESCE(seen_at, NOW())`);
      updates.push(`known_at = NOW()`);
    }
  }

  if ('user_translation' in body) {
    updates.push(`user_translation = $${values.length + 1}`);
    values.push(body.user_translation ?? null);
  }

  if (updates.length === 0) {
    return jsonResponse({ error: 'No fields to update' }, 400);
  }

  values.push(id, user.id);
  const result = await query<Word>(
    `UPDATE words SET ${updates.join(', ')} WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`,
    values,
  );

  if (result.rows.length === 0) {
    return jsonResponse({ error: 'Not found' }, 404);
  }

  return jsonResponse(result.rows[0]);
}
