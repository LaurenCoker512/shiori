// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { kuromojiTokenize } from '@/lib/kuromoji';

describe('kuromojiTokenize', () => {
  it('returns IpadicFeatures array for Japanese text', async () => {
    const tokens = await kuromojiTokenize('猫が好きです');
    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0]).toHaveProperty('surface_form');
  });

  it('pure-kana token has reading defined', async () => {
    const tokens = await kuromojiTokenize('です');
    expect(tokens[0].reading).toBeDefined();
  });

  it('singleton: second call returns without error', async () => {
    await kuromojiTokenize('テスト');
    await kuromojiTokenize('テスト');
  });
});
