import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { jsonResponse as json } from '@/lib/api';
import { TTS_VOICE_IDS, TTS_SPEAKING_RATE_MIN, TTS_SPEAKING_RATE_MAX } from '@/lib/tts';

export async function PATCH(request: Request): Promise<Response> {
  const user = await getSession();
  if (user === null) return json({ error: 'Unauthorized' }, 401);

  const body = await request.json() as {
    name?: unknown;
    openrouter_api_key?: unknown;
    openrouter_model?: unknown;
    use_llm_parsing?: unknown;
    google_tts_api_key?: unknown;
    tts_voice?: unknown;
    tts_speaking_rate?: unknown;
  };

  const isAISettings = 'openrouter_api_key' in body || 'openrouter_model' in body || 'use_llm_parsing' in body;
  const isTTSSettings = 'google_tts_api_key' in body || 'tts_voice' in body || 'tts_speaking_rate' in body;

  if (isAISettings) {
    const { openrouter_api_key, openrouter_model, use_llm_parsing } = body;

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

    if (use_llm_parsing !== undefined && typeof use_llm_parsing !== 'boolean') {
      return json({ error: 'use_llm_parsing must be a boolean' }, 400);
    }

    await query(
      `UPDATE users SET
        openrouter_api_key = CASE WHEN $1::text IS NOT NULL THEN NULLIF($1, '') ELSE openrouter_api_key END,
        openrouter_model   = COALESCE($2, openrouter_model),
        use_llm_parsing    = COALESCE($3, use_llm_parsing)
       WHERE id = $4`,
      [
        openrouter_api_key !== undefined ? String(openrouter_api_key) : null,
        openrouter_model !== undefined ? String(openrouter_model).trim() : null,
        use_llm_parsing !== undefined ? use_llm_parsing : null,
        user.id,
      ],
    );

    return json({ ok: true });
  }

  if (isTTSSettings) {
    const { google_tts_api_key, tts_voice, tts_speaking_rate } = body;

    if (google_tts_api_key !== undefined && typeof google_tts_api_key !== 'string') {
      return json({ error: 'google_tts_api_key must be a string' }, 400);
    }

    if (tts_voice !== undefined) {
      if (!(TTS_VOICE_IDS as readonly unknown[]).includes(tts_voice)) {
        return json({ error: `tts_voice must be one of: ${TTS_VOICE_IDS.join(', ')}` }, 400);
      }
    }

    if (tts_speaking_rate !== undefined) {
      if (
        typeof tts_speaking_rate !== 'number' ||
        tts_speaking_rate < TTS_SPEAKING_RATE_MIN ||
        tts_speaking_rate > TTS_SPEAKING_RATE_MAX
      ) {
        return json({ error: `tts_speaking_rate must be between ${TTS_SPEAKING_RATE_MIN} and ${TTS_SPEAKING_RATE_MAX}` }, 400);
      }
    }

    await query(
      `UPDATE users SET
        google_tts_api_key = CASE WHEN $1::text IS NOT NULL THEN NULLIF($1, '') ELSE google_tts_api_key END,
        tts_voice          = COALESCE($2, tts_voice),
        tts_speaking_rate  = COALESCE($3, tts_speaking_rate)
       WHERE id = $4`,
      [
        google_tts_api_key !== undefined ? String(google_tts_api_key) : null,
        tts_voice !== undefined ? String(tts_voice) : null,
        tts_speaking_rate !== undefined ? Number(tts_speaking_rate) : null,
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
