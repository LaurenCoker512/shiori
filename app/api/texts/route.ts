import { parseHeadingSentinels } from '@/lib/text-processing';
import { tokenizeText } from '@/lib/claude';
import { query } from '@/lib/db';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request): Promise<Response> {
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
    `INSERT INTO texts (title, raw_content, parsed_content) VALUES ($1, $2, $3) RETURNING id`,
    [body.title.trim(), body.content ?? '', JSON.stringify(parsedContent)],
  );
  const textId = textResult.rows[0].id;

  const contentWords = parsedContent.flatMap(s => s.tokens).filter(t => t.is_content_word);

  for (const token of contentWords) {
    await query(
      `INSERT INTO words (user_id, dictionary_form, reading)
       VALUES (1, $1, $2)
       ON CONFLICT (user_id, dictionary_form, reading) DO NOTHING`,
      [token.dictionary_form, token.reading],
    );
  }

  return jsonResponse({ id: textId });
}
