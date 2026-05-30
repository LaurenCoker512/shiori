import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetWords = vi.fn();

vi.mock('@birchill/jpdict-idb', () => ({
  getWords: mockGetWords,
}));

vi.mock('@/data/jlpt.json', () => ({
  default: { 猫: 'N5', '食べる': 'N5' },
}));

import { lookupWord } from '@/lib/jmdict';

const fixtureEntry = {
  id: 1,
  k: [{ ent: '猫', match: true }],
  r: [{ ent: 'ねこ', match: true }],
  s: [
    {
      match: true,
      pos: ['n'],
      g: [{ str: 'cat' }, { str: 'kitty' }, { str: 'feline' }, { str: 'moggy' }],
      inf: undefined,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  global.window = global.window ?? ({} as Window & typeof globalThis);
});

describe('lookupWord', () => {
  it('maps WordResult to JMdictEntry', async () => {
    mockGetWords.mockResolvedValue([fixtureEntry]);

    const result = await lookupWord('猫', 'ねこ');

    expect(result).toEqual({
      id: 1,
      senses: [{ pos: ['n'], glosses: ['cat', 'kitty', 'feline'], info: undefined }],
      jlpt_level: 'N5',
    });
  });

  it('caps glosses at 3', async () => {
    mockGetWords.mockResolvedValue([fixtureEntry]);

    const result = await lookupWord('猫', 'ねこ');

    expect(result?.senses[0].glosses).toHaveLength(3);
  });

  it('returns null server-side when window is undefined', async () => {
    const originalWindow = global.window;
    // @ts-expect-error — deliberately removing window to simulate SSR
    global.window = undefined;

    const result = await lookupWord('猫', 'ねこ');

    global.window = originalWindow;
    expect(result).toBeNull();
    expect(mockGetWords).not.toHaveBeenCalled();
  });

  it('returns null when JMdict has no entry', async () => {
    mockGetWords.mockResolvedValue([]);

    const result = await lookupWord('謎語', 'なぞご');

    expect(result).toBeNull();
  });

  it('populates jlpt_level for a known word', async () => {
    mockGetWords.mockResolvedValue([fixtureEntry]);

    const result = await lookupWord('猫', 'ねこ');

    expect(result?.jlpt_level).toBe('N5');
  });

  it('sets jlpt_level to null for a word not in the JLPT list', async () => {
    const unknownEntry = { ...fixtureEntry, k: [{ ent: '謎語', match: true }] };
    mockGetWords.mockResolvedValue([unknownEntry]);

    const result = await lookupWord('謎語', 'なぞご');

    expect(result?.jlpt_level).toBeNull();
  });
});
