import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import type { GrammarPattern } from '@/lib/types';
import { jsonResponse } from '@/lib/api';

export async function GET(): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const uid = user.id;

  const [seenResult, knownResult, comprehensionResult, grammarResult] = await Promise.all([
    query<{ date: string; count: string }>(
      `SELECT DATE(seen_at)::text AS date, COUNT(*) AS count
       FROM words
       WHERE user_id = $1 AND seen_at IS NOT NULL
       GROUP BY DATE(seen_at)
       ORDER BY date ASC`,
      [uid],
    ),
    query<{ date: string; count: string }>(
      `SELECT DATE(known_at)::text AS date, COUNT(*) AS count
       FROM words
       WHERE user_id = $1 AND known_at IS NOT NULL
       GROUP BY DATE(known_at)
       ORDER BY date ASC`,
      [uid],
    ),
    query<{ text_id: number; title: string; last_read_at: string; pct_known: string }>(
      `WITH token_stats AS (
        SELECT
          t.id AS text_id,
          t.title,
          t.last_read_at,
          COUNT(*) FILTER (WHERE w.status = 'known') AS known_count,
          COUNT(*) AS total_count
        FROM texts t
        CROSS JOIN LATERAL jsonb_array_elements(t.parsed_content) AS sentence
        CROSS JOIN LATERAL jsonb_array_elements(sentence->'tokens') AS token
        LEFT JOIN words w
          ON w.dictionary_form = token->>'dictionary_form'
          AND w.reading = token->>'reading'
          AND w.user_id = $1
        WHERE t.user_id = $1
          AND (token->>'is_content_word')::boolean = true
          AND token->>'dictionary_form' ~ '[ぁ-んァ-ン一-鿿㐀-䶿]'
        GROUP BY t.id, t.title, t.last_read_at
      )
      SELECT *, ROUND(known_count::numeric / NULLIF(total_count, 0) * 100, 1) AS pct_known
      FROM token_stats
      ORDER BY last_read_at DESC NULLS LAST`,
      [uid],
    ),
    query<GrammarPattern & { sentence_count: string }>(
      `SELECT gp.*, COUNT(sp.id) AS sentence_count
       FROM grammar_patterns gp
       LEFT JOIN sentence_patterns sp ON sp.grammar_pattern_id = gp.id
       WHERE gp.user_id = $1
       GROUP BY gp.id
       ORDER BY gp.first_encountered_at ASC`,
      [uid],
    ),
  ]);

  return jsonResponse({
    seenSeries: seenResult.rows.map(r => ({ date: r.date, count: Number(r.count) })),
    knownSeries: knownResult.rows.map(r => ({ date: r.date, count: Number(r.count) })),
    comprehension: comprehensionResult.rows.map(r => ({
      text_id: r.text_id,
      title: r.title,
      last_read_at: r.last_read_at,
      pct_known: Number(r.pct_known),
    })),
    grammarPatterns: grammarResult.rows.map(r => ({
      ...r,
      sentence_count: Number(r.sentence_count),
    })),
  });
}
