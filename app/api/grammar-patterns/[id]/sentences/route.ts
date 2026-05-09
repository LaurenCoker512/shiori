import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { jsonResponse } from '@/lib/api';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const result = await query<{
    text_id: number;
    title: string;
    sentence_index: number;
    sentence_raw: string;
  }>(
    `SELECT
       t.id AS text_id,
       t.title,
       sp.sentence_index,
       t.parsed_content -> sp.sentence_index ->> 'raw' AS sentence_raw
     FROM sentence_patterns sp
     JOIN texts t ON t.id = sp.text_id
     JOIN grammar_patterns gp ON gp.id = sp.grammar_pattern_id
     WHERE sp.grammar_pattern_id = $1
       AND gp.user_id = $2
     ORDER BY t.title ASC, sp.sentence_index ASC`,
    [id, user.id],
  );

  return jsonResponse({ sentences: result.rows });
}
