import { query } from '@/lib/db';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
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
     WHERE sp.grammar_pattern_id = $1
       AND sp.grammar_pattern_id IS NOT NULL
     ORDER BY t.title ASC, sp.sentence_index ASC`,
    [id],
  );

  return jsonResponse({ sentences: result.rows });
}
