import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { jsonResponse } from '@/lib/api';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const textId = parseInt(params.id, 10);
  if (isNaN(textId)) return jsonResponse({ error: 'Invalid id' }, 400);

  const textResult = await query<{ id: number }>(
    'SELECT id FROM texts WHERE id = $1 AND user_id = $2',
    [textId, user.id],
  );
  if (textResult.rows.length === 0) return jsonResponse({ error: 'Not found' }, 404);

  const body = await request.json() as { tagIds?: unknown };
  if (!Array.isArray(body.tagIds) || !body.tagIds.every(id => typeof id === 'number')) {
    return jsonResponse({ error: 'tagIds must be an array of numbers' }, 400);
  }
  const tagIds = body.tagIds as number[];

  if (tagIds.length > 0) {
    const owned = await query<{ id: number }>(
      'SELECT id FROM tags WHERE id = ANY($1) AND user_id = $2',
      [tagIds, user.id],
    );
    if (owned.rows.length !== tagIds.length) {
      return jsonResponse({ error: 'One or more tags not found' }, 403);
    }
  }

  await query('DELETE FROM text_tags WHERE text_id = $1', [textId]);

  if (tagIds.length > 0) {
    const placeholders = tagIds.map((_, i) => `($1, $${i + 2})`).join(', ');
    await query(
      `INSERT INTO text_tags (text_id, tag_id) VALUES ${placeholders}`,
      [textId, ...tagIds],
    );
  }

  return jsonResponse({ tagIds });
}
