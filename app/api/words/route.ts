import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import type { Word, WordStatus, JlptLevel } from '@/lib/types';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(request: Request): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as WordStatus | null;
  const jlptLevel = searchParams.get('jlpt_level') as JlptLevel | null;
  const search = searchParams.get('search');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10));
  const offset = (page - 1) * pageSize;

  const wordsResult = await query<Word>(
    `SELECT * FROM words
     WHERE user_id = $1
       AND ($2::text IS NULL OR status = $2)
       AND ($3::text IS NULL OR jlpt_level = $3)
       AND ($4::text IS NULL OR dictionary_form ILIKE '%' || $4 || '%' OR reading ILIKE '%' || $4 || '%')
     ORDER BY reading ASC
     LIMIT $5 OFFSET $6`,
    [user.id, status, jlptLevel, search, pageSize, offset],
  );

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM words
     WHERE user_id = $1
       AND ($2::text IS NULL OR status = $2)
       AND ($3::text IS NULL OR jlpt_level = $3)
       AND ($4::text IS NULL OR dictionary_form ILIKE '%' || $4 || '%' OR reading ILIKE '%' || $4 || '%')`,
    [user.id, status, jlptLevel, search],
  );

  return jsonResponse({
    words: wordsResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  });
}
