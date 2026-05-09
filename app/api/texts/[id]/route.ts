import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import type { Word, FuriganaOverride } from '@/lib/types';
import { jsonResponse } from '@/lib/api';
import { abortImport } from '@/lib/importAbortControllers';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const textResult = await query<{ id: number; title: string; raw_content: string; parsed_content: unknown; created_at: string; last_read_at: string | null }>(
    'SELECT * FROM texts WHERE id = $1 AND user_id = $2',
    [id, user.id],
  );

  if (textResult.rows.length === 0) {
    return jsonResponse({ error: 'Not found' }, 404);
  }

  await query('UPDATE texts SET last_read_at = NOW() WHERE id = $1', [id]);

  const wordsResult = await query<Word>(
    'SELECT * FROM words WHERE user_id = $1',
    [user.id],
  );

  const wordStatusMap: Record<string, Word> = {};
  for (const word of wordsResult.rows) {
    wordStatusMap[`${word.dictionary_form}|${word.reading}`] = word;
  }

  const furiganaResult = await query<FuriganaOverride>(
    'SELECT word_id, surface_form, corrected_reading FROM furigana_overrides WHERE user_id = $1',
    [user.id],
  );

  return jsonResponse({
    text: textResult.rows[0],
    wordStatusMap,
    furiganaOverrides: furiganaResult.rows,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const body = await request.json() as { title?: string };

  if (!body.title?.trim()) {
    return jsonResponse({ error: 'Title is required' }, 400);
  }

  const result = await query<{ id: number; title: string }>(
    'UPDATE texts SET title = $1 WHERE id = $2 AND user_id = $3 RETURNING id, title',
    [body.title.trim(), id, user.id],
  );

  if (result.rows.length === 0) {
    return jsonResponse({ error: 'Not found' }, 404);
  }

  return jsonResponse(result.rows[0]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  abortImport(id);
  await query('DELETE FROM texts WHERE id = $1 AND user_id = $2', [id, user.id]);

  return jsonResponse({ ok: true });
}
