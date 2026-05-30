import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { lookupFrequencyTier, rankToTier, _resetCacheForTesting } from '@/lib/frequency';

// jpdb.json format: { headword: [[reading | null, rank], ...] }
// jpdb-by-entry.json format: { id: { rank, headword, reading, canonical } }
const fixtureSurface = {
  '猫': [['ねこ', 800]],
  '犬': [['いぬ', 1600]],
};
const fixtureByEntry = {
  '12345': { rank: 400, headword: '食べる', reading: 'たべる', canonical: '食べる' },
};

function setupFixture(
  surface: Record<string, Array<[string | null, number]>> = fixtureSurface,
  byEntry: Record<string, { rank: number; headword: string; reading: string | null; canonical: string }> = fixtureByEntry,
) {
  vi.spyOn(fs, 'readFile')
    .mockResolvedValueOnce(JSON.stringify(surface) as unknown as Buffer)
    .mockResolvedValueOnce(JSON.stringify(byEntry) as unknown as Buffer);
}

beforeEach(() => {
  vi.restoreAllMocks();
  _resetCacheForTesting();
});

describe('rankToTier', () => {
  it('tier boundaries', () => {
    const cases: [number, string][] = [
      [1500, 'very-common'],
      [1501, 'common'],
      [5000, 'common'],
      [5001, 'uncommon'],
      [15000, 'uncommon'],
      [15001, 'rare'],
      [30000, 'rare'],
      [30001, 'very-rare'],
    ];
    for (const [rank, expected] of cases) {
      expect(rankToTier(rank), `rank ${rank}`).toBe(expected);
    }
  });
});

describe('lookupFrequencyTier', () => {
  it('entry-keyed hit → very-common (rank 400)', async () => {
    setupFixture();
    expect(await lookupFrequencyTier('食べる', 'たべる')).toBe('very-common');
  });

  it('entry miss, surface hit with reading match → very-common (rank 800)', async () => {
    setupFixture();
    expect(await lookupFrequencyTier('猫', 'ねこ')).toBe('very-common');
  });

  it('entry miss, surface hit no reading match → uses first entry rank', async () => {
    setupFixture();
    // 犬 rank 1600 → common; reading 'inu' doesn't match 'いぬ' so falls to entries[0]
    expect(await lookupFrequencyTier('犬', 'inu')).toBe('common');
  });

  it('both miss → null', async () => {
    setupFixture();
    expect(await lookupFrequencyTier('謎語', 'なぞご')).toBeNull();
  });
});
