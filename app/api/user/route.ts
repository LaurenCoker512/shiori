import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { jsonResponse as json } from '@/lib/api';

const ANTHROPIC_MODELS = ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] as const;

export async function PATCH(request: Request): Promise<Response> {
  const user = await getSession();
  if (user === null) return json({ error: 'Unauthorized' }, 401);

  const body = await request.json() as {
    name?: unknown;
    ai_provider?: unknown;
    anthropic_api_key?: unknown;
    anthropic_model?: unknown;
    openrouter_api_key?: unknown;
    openrouter_model?: unknown;
  };

  const isAISettings = 'ai_provider' in body || 'anthropic_api_key' in body ||
    'anthropic_model' in body || 'openrouter_api_key' in body || 'openrouter_model' in body;

  if (isAISettings) {
    const { ai_provider, anthropic_api_key, anthropic_model, openrouter_api_key, openrouter_model } = body;

    if (ai_provider !== undefined && ai_provider !== 'anthropic' && ai_provider !== 'openrouter') {
      return json({ error: 'Invalid provider' }, 400);
    }

    if (anthropic_api_key !== undefined) {
      if (typeof anthropic_api_key !== 'string' || (anthropic_api_key !== '' && !anthropic_api_key.startsWith('sk-ant-'))) {
        return json({ error: 'Anthropic key must start with sk-ant-' }, 400);
      }
    }

    if (anthropic_model !== undefined) {
      if (!(ANTHROPIC_MODELS as readonly unknown[]).includes(anthropic_model)) {
        return json({ error: 'Invalid Anthropic model' }, 400);
      }
    }

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
        ai_provider          = COALESCE($1, ai_provider),
        anthropic_api_key    = CASE WHEN $2::text IS NOT NULL THEN NULLIF($2, '') ELSE anthropic_api_key END,
        anthropic_model      = COALESCE($3, anthropic_model),
        openrouter_api_key   = CASE WHEN $4::text IS NOT NULL THEN NULLIF($4, '') ELSE openrouter_api_key END,
        openrouter_model     = COALESCE($5, openrouter_model)
       WHERE id = $6`,
      [
        ai_provider ?? null,
        anthropic_api_key !== undefined ? String(anthropic_api_key) : null,
        anthropic_model ?? null,
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
