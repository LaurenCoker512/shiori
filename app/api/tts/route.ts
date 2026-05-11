import { getSession } from '@/lib/session';
import { jsonResponse } from '@/lib/api';
import { synthesizeSpeech } from '@/lib/tts';

export async function POST(request: Request): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  if (user.google_tts_api_key === null) {
    return jsonResponse(
      { error: 'Google TTS API key not configured. Add your key in Settings.' },
      403,
    );
  }

  const body = await request.json() as { text?: unknown };

  if (typeof body.text !== 'string' || body.text.trim() === '') {
    return jsonResponse({ error: 'text is required' }, 400);
  }

  const audio = await synthesizeSpeech(
    user.google_tts_api_key,
    body.text.trim(),
    user.tts_voice,
    user.tts_speaking_rate,
  );

  return new Response(audio, {
    headers: { 'Content-Type': 'audio/mpeg' },
  });
}
