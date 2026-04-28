import { describe, it, expect } from 'vitest';
import { parseTranslations } from '@/lib/types';

describe('parseTranslations', () => {
  it('returns [] for null', () => {
    expect(parseTranslations(null)).toEqual([]);
  });

  it('parses a valid JSON array', () => {
    expect(parseTranslations('["to read","to recite"]')).toEqual(['to read', 'to recite']);
  });

  it('falls back to semicolon split for non-JSON', () => {
    expect(parseTranslations('to read; to recite')).toEqual(['to read', 'to recite']);
  });

  it('returns [] for empty string', () => {
    expect(parseTranslations('')).toEqual([]);
  });

  it('falls back to single-element array for malformed JSON with no semicolons', () => {
    expect(parseTranslations('{invalid}')).toEqual(['{invalid}']);
  });
});
