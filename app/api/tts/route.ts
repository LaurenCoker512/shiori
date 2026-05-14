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

  const body = await request.json() as { text?: unknown; ssml?: unknown };

  const isSSML = typeof body.ssml === 'string' && body.ssml.trim() !== '';
  const isText = typeof body.text === 'string' && body.text.trim() !== '';

  if (!isSSML && !isText) {
    return jsonResponse({ error: 'text or ssml is required' }, 400);
  }

  const inputValue = isSSML ? (body.ssml as string).trim() : (body.text as string).trim();
  const inputType = isSSML ? 'ssml' : 'text';

  const audio = await synthesizeSpeech(
    user.google_tts_api_key,
    inputValue,
    user.tts_voice,
    user.tts_speaking_rate,
    inputType,
  );

  return new Response(audio, {
    headers: { 'Content-Type': 'audio/mpeg' },
  });
}
