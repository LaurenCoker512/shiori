import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { lookupFrequencyTier, _resetCacheForTesting } from '@/lib/frequency';

function setupFixture(jpdb: Record<string, number>, jpdbByEntry: Record<string, number> = {}) {
  vi.spyOn(fs, 'readFile')
    .mockResolvedValueOnce(JSON.stringify(jpdb) as unknown as Buffer)
    .mockResolvedValueOnce(JSON.stringify(jpdbByEntry) as unknown as Buffer);
}

beforeEach(() => {
  vi.restoreAllMocks();
  _resetCacheForTesting();
});

describe('lookupFrequencyTier', () => {
  it('entry-keyed hit → very-common (rank 400)', async () => {
    setupFixture({ '猫': 800 }, { '食べる|たべる': 400 });
    expect(await lookupFrequencyTier('食べる', 'たべる')).toBe('very-common');
  });

  it('entry miss, surface hit → common (rank 1600)', async () => {
    setupFixture({ '犬': 1600 });
    expect(await lookupFrequencyTier('犬', 'いぬ')).toBe('common');
  });

  it('both miss → null', async () => {
    setupFixture({ '猫': 800 });
    expect(await lookupFrequencyTier('謎語', 'なぞご')).toBeNull();
  });

  it('tier boundaries', async () => {
    const boundaries: [number, string][] = [
      [1500, 'very-common'],
      [1501, 'common'],
      [5000, 'common'],
      [5001, 'uncommon'],
      [15000, 'uncommon'],
      [15001, 'rare'],
      [30000, 'rare'],
      [30001, 'very-rare'],
    ];

    for (const [rank, expected] of boundaries) {
      vi.restoreAllMocks();
      _resetCacheForTesting();
      setupFixture({ 'テスト': rank });
      expect(await lookupFrequencyTier('テスト', 'てすと'), `rank ${rank}`).toBe(expected);
    }
  });
});
