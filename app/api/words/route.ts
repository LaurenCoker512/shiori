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

  const [wordsResult, countResult, statusCountsResult] = await Promise.all([
    query<Word>(
      `SELECT * FROM words
       WHERE user_id = $1
         AND ($2::text IS NULL OR status = $2)
         AND ($3::text IS NULL OR jlpt_level = $3)
         AND ($4::text IS NULL OR dictionary_form ILIKE '%' || $4 || '%' OR reading ILIKE '%' || $4 || '%')
       ORDER BY CASE status WHEN 'known' THEN 0 WHEN 'seen' THEN 1 ELSE 2 END, reading ASC
       LIMIT $5 OFFSET $6`,
      [user.id, status, jlptLevel, search, pageSize, offset],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM words
       WHERE user_id = $1
         AND ($2::text IS NULL OR status = $2)
         AND ($3::text IS NULL OR jlpt_level = $3)
         AND ($4::text IS NULL OR dictionary_form ILIKE '%' || $4 || '%' OR reading ILIKE '%' || $4 || '%')`,
      [user.id, status, jlptLevel, search],
    ),
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) AS count FROM words
       WHERE user_id = $1
         AND ($2::text IS NULL OR jlpt_level = $2)
         AND ($3::text IS NULL OR dictionary_form ILIKE '%' || $3 || '%' OR reading ILIKE '%' || $3 || '%')
       GROUP BY status`,
      [user.id, jlptLevel, search],
    ),
  ]);

  const statusCounts = Object.fromEntries(
    statusCountsResult.rows.map(r => [r.status, Number(r.count)]),
  ) as Partial<Record<string, number>>;

  return jsonResponse({
    words: wordsResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
    knownCount: statusCounts['known'] ?? 0,
    seenCount: statusCounts['seen'] ?? 0,
    unseenCount: statusCounts['unseen'] ?? 0,
  });
}
