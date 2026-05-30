import { parseHeadingSentinels, toHiragana } from '@/lib/text-processing';
import { buildLLMConfig } from '@/lib/llm';
import { buildParsedContent } from '@/lib/processImport';
import { kuromojiTokenize } from '@/lib/kuromoji';
import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { jsonResponse } from '@/lib/api';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const llmConfig = buildLLMConfig(user);

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const textResult = await query<{ raw_content: string }>(
    'SELECT raw_content FROM texts WHERE id = $1 AND user_id = $2',
    [id, user.id],
  );

  if (textResult.rows.length === 0) {
    return jsonResponse({ error: 'Not found' }, 404);
  }

  const cleanedText = textResult.rows[0].raw_content
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n');

  const kuroTokens = await kuromojiTokenize(cleanedText);
  const sentences = await buildParsedContent(kuroTokens, llmConfig);
  const parsedContent = parseHeadingSentinels(sentences);

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

  if (contentWords.length > 0) {
    const forms = contentWords.map(t => t.dictionary_form);
    const readings = contentWords.map(t => toHiragana(t.dict_reading));
    await query(
      `INSERT INTO words (user_id, dictionary_form, reading)
       SELECT $1, unnest($2::text[]), unnest($3::text[])
       ON CONFLICT (user_id, dictionary_form, reading) DO NOTHING`,
      [user.id, forms, readings],
    );
  }

  return jsonResponse({ ok: true });
}
