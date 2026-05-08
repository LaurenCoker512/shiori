import { parseHeadingSentinels } from '@/lib/text-processing';
import { tokenizeText } from '@/lib/claude';
import { query } from '@/lib/db';
import { getSession } from '@/lib/session';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const textResult = await query<{ raw_content: string }>(
    'SELECT raw_content FROM texts WHERE id = $1 AND user_id = $2',
    [id, user.id],
  );

  if (textResult.rows.length === 0) {
    return jsonResponse({ error: 'Not found' }, 404);
  }

  const cleanedText = textResult.rows[0].raw_content;

  const tokenized = await tokenizeText(cleanedText);
  const parsedContent = parseHeadingSentinels(tokenized);

  await query(
    'UPDATE texts SET parsed_content = $1 WHERE id = $2',
    [JSON.stringify(parsedContent), id],
  );

  await query(
    'DELETE FROM sentence_patterns WHERE text_id = $1',
    [id],
  );

  const newSurfaces = parsedContent
    .flatMap(s => s.tokens.filter(t => t.is_content_word).map(t => t.surface));

  await query(
    `DELETE FROM furigana_overrides WHERE user_id = $1 AND surface_form <> ALL($2::text[])`,
    [user.id, newSurfaces],
  );

  const contentWords = parsedContent.flatMap(s => s.tokens).filter(t => t.is_content_word);

  for (const token of contentWords) {
    await query(
      `INSERT INTO words (user_id, dictionary_form, reading)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, dictionary_form, reading) DO NOTHING`,
      [user.id, token.dictionary_form, token.reading],
    );
  }

  return jsonResponse({ ok: true });
}
