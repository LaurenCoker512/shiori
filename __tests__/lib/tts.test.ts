import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { synthesizeSpeech } from '@/lib/tts';

beforeEach(() => {
  mockFetch.mockReset();
});

describe('synthesizeSpeech', () => {
  it('sends POST to the correct Google TTS endpoint with the API key', async () => {
    const audioContent = btoa('fake-mp3-bytes');
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ audioContent }) });

    await synthesizeSpeech('test-api-key', 'テスト', 'ja-JP-Neural2-B', 1.0);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://texttospeech.googleapis.com/v1/text:synthesize?key=test-api-key',
    );
  });

  it('sends correct request body — text, voice, language code, MP3 encoding, speaking rate', async () => {
    const audioContent = btoa('fake-mp3-bytes');
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ audioContent }) });

    await synthesizeSpeech('test-api-key', 'テスト', 'ja-JP-Neural2-C', 0.75);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body as string) as {
      input: { text: string };
      voice: { languageCode: string; name: string };
      audioConfig: { audioEncoding: string; speakingRate: number };
    };
    expect(body.input.text).toBe('テスト');
    expect(body.voice.languageCode).toBe('ja-JP');
    expect(body.voice.name).toBe('ja-JP-Neural2-C');
    expect(body.audioConfig.audioEncoding).toBe('MP3');
    expect(body.audioConfig.speakingRate).toBe(0.75);
  });

  it('decodes base64 audioContent into ArrayBuffer with correct bytes', async () => {
    const sourceBytes = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
    const audioContent = btoa(Array.from(sourceBytes).map(b => String.fromCharCode(b)).join(''));
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ audioContent }) });

    const result = await synthesizeSpeech('test-api-key', 'テスト', 'ja-JP-Neural2-B', 1.0);

    expect(new Uint8Array(result)).toEqual(sourceBytes);
  });

  it('throws with status code and body on a non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'API key not valid',
    });

    await expect(
      synthesizeSpeech('bad-key', 'テスト', 'ja-JP-Neural2-B', 1.0),
    ).rejects.toThrow('Google TTS error 403');
  });

  it('throws with body text included in the error message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Invalid request',
    });

    await expect(
      synthesizeSpeech('test-api-key', 'テスト', 'ja-JP-Neural2-B', 1.0),
    ).rejects.toThrow('Invalid request');
  });
});
