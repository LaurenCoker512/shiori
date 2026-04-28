import { query } from '@/lib/db';
import { translateWord } from '@/lib/claude';
import { parseTranslations } from '@/lib/types';
import type { Word } from '@/lib/types';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const wordResult = await query<Word>(
    'SELECT * FROM words WHERE id = $1 AND user_id = 1',
    [id],
  );

  if (wordResult.rows.length === 0) {
    return jsonResponse({ error: 'Not found' }, 404);
  }

  const word = wordResult.rows[0];

  if (word.translation !== null) {
    return jsonResponse({
      translations: parseTranslations(word.translation),
      jlpt_level: word.jlpt_level ?? null,
    });
  }

  const { searchParams } = new URL(request.url);
  const contextSentence = searchParams.get('contextSentence') ?? '';

  try {
    const result = await translateWord(word.dictionary_form, contextSentence);
    const translationJson = JSON.stringify(result.translations);

    await query(
      'UPDATE words SET translation = $1, jlpt_level = $2 WHERE id = $3 AND user_id = 1',
      [translationJson, result.jlpt_level, id],
    );

    return jsonResponse({
      translations: result.translations,
      jlpt_level: result.jlpt_level,
    });
  } catch {
    return jsonResponse({ error: 'Translation unavailable' }, 500);
  }
}
