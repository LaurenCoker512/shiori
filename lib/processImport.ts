import { tokenizeText } from '@/lib/claude';
import type { LLMConfig } from '@/lib/claude';
import { parseHeadingSentinels } from '@/lib/text-processing';
import { query } from '@/lib/db';
import { registerImportAbort, unregisterImportAbort } from '@/lib/importAbortControllers';

export async function processImport(
  textId: number,
  userId: number,
  rawContent: string,
  config: LLMConfig,
): Promise<void> {
  const abortController = new AbortController();
  registerImportAbort(textId, abortController);

  try {
    await query(
      'UPDATE texts SET import_status = $1 WHERE id = $2',
      ['processing', textId],
    );

    // Normalize literal escape sequences that some export tools write instead of
    // actual whitespace characters (e.g. \n as two chars: backslash + n).
    const normalizedContent = rawContent
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n');

    const tokenized = await tokenizeText(config, normalizedContent, abortController.signal);
    const parsedContent = parseHeadingSentinels(tokenized);

    await query(
      'UPDATE texts SET parsed_content = $1, import_status = $2 WHERE id = $3',
      [JSON.stringify(parsedContent), 'ready', textId],
    );

    const contentWords = parsedContent.flatMap(s => s.tokens).filter(t => t.is_content_word);
    if (contentWords.length > 0) {
      const forms = contentWords.map(t => t.dictionary_form);
      const readings = contentWords.map(t => t.dict_reading);
      await query(
        `INSERT INTO words (user_id, dictionary_form, reading)
         SELECT $1, unnest($2::text[]), unnest($3::text[])
         ON CONFLICT (user_id, dictionary_form, reading) DO NOTHING`,
        [userId, forms, readings],
      );
    }
  } catch (err) {
    unregisterImportAbort(textId);
    // Aborted cancellations are intentional — don't write an error to the (now-deleted) row
    if (err instanceof Error && err.name === 'AbortError') return;
    const message = err instanceof Error ? err.message : 'Unknown error';
    await query(
      'UPDATE texts SET import_status = $1, import_error = $2 WHERE id = $3',
      ['error', message, textId],
    ).catch(() => { /* best-effort — DB may be unavailable */ });
    return;
  }
  unregisterImportAbort(textId);
}
