import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { jsonResponse as json } from '@/lib/api';

export async function PATCH(request: Request): Promise<Response> {
  const user = await getSession();
  if (user === null) return json({ error: 'Unauthorized' }, 401);

  const body = await request.json() as {
    name?: unknown;
    openrouter_api_key?: unknown;
    openrouter_model?: unknown;
  };

  const isAISettings = 'openrouter_api_key' in body || 'openrouter_model' in body;

  if (isAISettings) {
    const { openrouter_api_key, openrouter_model } = body;

    if (openrouter_api_key !== undefined) {
      if (typeof openrouter_api_key !== 'string' || (openrouter_api_key !== '' && !openrouter_api_key.startsWith('sk-or-'))) {
        return json({ error: 'OpenRouter key must start with sk-or-' }, 400);
      }
    }

    if (openrouter_model !== undefined) {
      if (typeof openrouter_model !== 'string' || openrouter_model.trim() === '') {
        return json({ error: 'OpenRouter model is required' }, 400);
      }
    }

    await query(
      `UPDATE users SET
        openrouter_api_key = CASE WHEN $1::text IS NOT NULL THEN NULLIF($1, '') ELSE openrouter_api_key END,
        openrouter_model   = COALESCE($2, openrouter_model)
       WHERE id = $3`,
      [
        openrouter_api_key !== undefined ? String(openrouter_api_key) : null,
        openrouter_model !== undefined ? String(openrouter_model).trim() : null,
        user.id,
      ],
    );

    return json({ ok: true });
  }

  if (typeof body.name !== 'string' || body.name.trim() === '') {
    return json({ error: 'Name is required' }, 400);
  }

  await query(
    'UPDATE users SET name = $1 WHERE id = $2',
    [body.name.trim(), user.id],
  );

  return json({ ok: true, name: body.name.trim() });
}
