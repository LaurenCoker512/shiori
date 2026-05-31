import { describe, it, expect, vi, afterEach } from 'vitest';

const mockGetSession = vi.hoisted(() => vi.fn());
const mockSynthesizeSpeech = vi.hoisted(() => vi.fn());

vi.mock('@/lib/session', () => ({ getSession: mockGetSession }));
vi.mock('@/lib/tts', () => ({ synthesizeSpeech: mockSynthesizeSpeech }));

import { POST } from '@/app/api/tts/route';
import type { SessionUser } from '@/lib/session';

const FAKE_USER: SessionUser = {
  id: 1,
  name: 'Test',
  email: 'test@example.com',
  openrouter_api_key: null,
  use_llm_parsing: false,
  openrouter_model: 'anthropic/claude-sonnet-4-6',
  google_tts_api_key: 'AIza-test-key',
  tts_voice: 'ja-JP-Neural2-B',
  tts_speaking_rate: 1.0,
};

const FAKE_USER_NO_KEY: SessionUser = { ...FAKE_USER, google_tts_api_key: null };

function makeRequest(body: object): Request {
  return new Request('http://localhost/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  mockGetSession.mockReset();
  mockSynthesizeSpeech.mockReset();
});

describe('POST /api/tts', () => {
  it('unauthenticated → 401', async () => {
    mockGetSession.mockResolvedValue(null);
    const response = await POST(makeRequest({ text: 'テスト' }));
    expect(response.status).toBe(401);
  });

  it('no API key configured → 403 with descriptive message', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER_NO_KEY);
    const response = await POST(makeRequest({ text: 'テスト' }));
    expect(response.status).toBe(403);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('Google TTS API key not configured');
  });

  it('missing text field → 400', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER);
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });

  it('whitespace-only text → 400', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER);
    const response = await POST(makeRequest({ text: '   ' }));
    expect(response.status).toBe(400);
  });

  it('valid request → calls synthesizeSpeech with session settings and returns audio/mpeg', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER);
    const fakeAudio = new ArrayBuffer(8);
    mockSynthesizeSpeech.mockResolvedValue(fakeAudio);

    const response = await POST(makeRequest({ text: 'こんにちは' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
      'AIza-test-key',
      'こんにちは',
      'ja-JP-Neural2-B',
      1.0,
      'text',
    );

    const buf = await response.arrayBuffer();
    expect(buf.byteLength).toBe(8);
  });

  it('text with surrounding whitespace → trims before passing to synthesizeSpeech', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER);
    mockSynthesizeSpeech.mockResolvedValue(new ArrayBuffer(4));

    await POST(makeRequest({ text: '  テスト  ' }));

    expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
      expect.anything(),
      'テスト',
      expect.anything(),
      expect.anything(),
      'text',
    );
  });

  it('synthesizeSpeech throws → propagates error', async () => {
    mockGetSession.mockResolvedValue(FAKE_USER);
    mockSynthesizeSpeech.mockRejectedValue(new Error('Google TTS error 403: API key invalid'));

    await expect(POST(makeRequest({ text: 'テスト' }))).rejects.toThrow('Google TTS error 403');
  });
});
