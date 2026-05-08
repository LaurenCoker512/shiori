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

export async function POST(request: Request): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const body = await request.json() as {
    title?: string;
    content?: string;
  };

  if (!body.title?.trim()) {
    return jsonResponse({ error: 'Title is required' }, 400);
  }

  const cleanedText = body.content ?? '';

  let parsedContent;
  try {
    const tokenized = await tokenizeText(cleanedText);
    parsedContent = parseHeadingSentinels(tokenized);
  } catch (err) {
    console.error('Tokenization error:', err);
    return jsonResponse({ error: 'Tokenization failed' }, 500);
  }

  const textResult = await query<{ id: number }>(
    `INSERT INTO texts (user_id, title, raw_content, parsed_content) VALUES ($1, $2, $3, $4) RETURNING id`,
    [user.id, body.title.trim(), body.content ?? '', JSON.stringify(parsedContent)],
  );
  const textId = textResult.rows[0].id;

  const contentWords = parsedContent.flatMap(s => s.tokens).filter(t => t.is_content_word);

  for (const token of contentWords) {
    await query(
      `INSERT INTO words (user_id, dictionary_form, reading)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, dictionary_form, reading) DO NOTHING`,
      [user.id, token.dictionary_form, token.reading],
    );
  }

  return jsonResponse({ id: textId });
}
