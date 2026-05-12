const GOOGLE_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

export const TTS_VOICES = [
  { id: 'ja-JP-Neural2-B', label: 'Sakura (female, Neural2)' },
  { id: 'ja-JP-Neural2-C', label: 'Kenji (male, Neural2)' },
  { id: 'ja-JP-Neural2-D', label: 'Hiroshi (male, Neural2)' },
] as const;

export type TTSVoiceId = typeof TTS_VOICES[number]['id'];

export const TTS_VOICE_IDS = TTS_VOICES.map(v => v.id) as [TTSVoiceId, ...TTSVoiceId[]];

export const TTS_SPEAKING_RATE_MIN = 0.5;
export const TTS_SPEAKING_RATE_MAX = 2.0;

export async function synthesizeSpeech(
  apiKey: string,
  text: string,
  voice: string,
  speakingRate: number,
): Promise<ArrayBuffer> {
  const res = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'ja-JP', name: voice },
      audioConfig: { audioEncoding: 'MP3', speakingRate },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google TTS error ${res.status}: ${body}`);
  }

  const data = await res.json() as { audioContent: string };
  const binary = atob(data.audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
