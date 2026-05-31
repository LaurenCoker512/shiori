import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { jsonResponse } from '@/lib/api';

export async function POST(): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const result = await query<{ id: number }>(
    `UPDATE words SET translation = NULL, jlpt_level = NULL
     WHERE user_id = $1 AND translation IS NOT NULL
     RETURNING id`,
    [user.id],
  );

  return jsonResponse({ cleared: result.rows.length });
}
