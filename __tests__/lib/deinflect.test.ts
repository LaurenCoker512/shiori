import { describe, it, expect } from 'vitest';
import { deinflect } from '@/lib/deinflect';

describe('deinflect', () => {
  it('食べました → base 食べる with chain [polite, past]', () => {
    const results = deinflect('食べました');
    expect(results).toContainEqual({
      baseForm: '食べる',
      derivationChain: ['polite', 'past'],
    });
  });

  it('食べられました → base 食べる with chain [passive, polite, past]', () => {
    const results = deinflect('食べられました');
    expect(results).toContainEqual({
      baseForm: '食べる',
      derivationChain: ['passive', 'polite', 'past'],
    });
  });

  it('undeclined noun returns []', () => {
    expect(deinflect('猫')).toEqual([]);
  });
});
