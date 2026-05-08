import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { translateWord, buildLLMConfig } from '@/lib/claude';
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
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);
  const llmConfig = buildLLMConfig(user);
  if (llmConfig === null) {
    return jsonResponse({ error: 'API key not configured. Add your key in Settings.' }, 403);
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const wordResult = await query<Word>(
    'SELECT * FROM words WHERE id = $1 AND user_id = $2',
    [id, user.id],
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
    const result = await translateWord(llmConfig, word.dictionary_form, contextSentence);
    const translationJson = JSON.stringify(result.translations);

    await query(
      'UPDATE words SET translation = $1, jlpt_level = $2 WHERE id = $3 AND user_id = $4',
      [translationJson, result.jlpt_level, id, user.id],
    );

    return jsonResponse({
      translations: result.translations,
      jlpt_level: result.jlpt_level,
    });
  } catch {
    return jsonResponse({ error: 'Translation unavailable' }, 500);
  }
}
