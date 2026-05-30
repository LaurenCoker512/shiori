import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import type { Word, WordStatus, JlptLevel, FrequencyTier } from '@/lib/types';
import { jsonResponse } from '@/lib/api';

export async function GET(request: Request): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');
  const status: WordStatus | null = (statusParam === 'unseen' || statusParam === 'seen' || statusParam === 'known') ? statusParam : null;
  const jlptParam = searchParams.get('jlpt_level');
  const jlptLevel: JlptLevel | null = (jlptParam === 'N5' || jlptParam === 'N4' || jlptParam === 'N3' || jlptParam === 'N2' || jlptParam === 'N1') ? jlptParam : null;
  const frequencyParam = searchParams.get('frequency_tier');
  const frequencyTier: FrequencyTier | null = (frequencyParam === 'very-common' || frequencyParam === 'common' || frequencyParam === 'uncommon' || frequencyParam === 'rare' || frequencyParam === 'very-rare') ? frequencyParam : null;
  const search = searchParams.get('search');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(1000, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)));
  const offset = (page - 1) * pageSize;

  const [wordsResult, countResult, statusCountsResult] = await Promise.all([
    query<Word>(
      `SELECT * FROM words
       WHERE user_id = $1
         AND ($2::text IS NULL OR status = $2)
         AND ($3::text IS NULL OR jlpt_level = $3)
         AND ($4::text IS NULL OR dictionary_form ILIKE '%' || $4 || '%' OR reading ILIKE '%' || $4 || '%')
         AND ($5::text IS NULL OR frequency_tier = $5)
       ORDER BY CASE status WHEN 'known' THEN 0 WHEN 'seen' THEN 1 ELSE 2 END, reading ASC
       LIMIT $6 OFFSET $7`,
      [user.id, status, jlptLevel, search, frequencyTier, pageSize, offset],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM words
       WHERE user_id = $1
         AND ($2::text IS NULL OR status = $2)
         AND ($3::text IS NULL OR jlpt_level = $3)
         AND ($4::text IS NULL OR dictionary_form ILIKE '%' || $4 || '%' OR reading ILIKE '%' || $4 || '%')
         AND ($5::text IS NULL OR frequency_tier = $5)`,
      [user.id, status, jlptLevel, search, frequencyTier],
    ),
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) AS count FROM words
       WHERE user_id = $1
         AND ($2::text IS NULL OR jlpt_level = $2)
         AND ($3::text IS NULL OR dictionary_form ILIKE '%' || $3 || '%' OR reading ILIKE '%' || $3 || '%')
         AND ($4::text IS NULL OR frequency_tier = $4)
       GROUP BY status`,
      [user.id, jlptLevel, search, frequencyTier],
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
