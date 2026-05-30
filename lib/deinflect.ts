export interface DeinflectionResult {
  baseForm: string;
  derivationChain: string[];
}

interface Rule {
  suffix: string;
  base: string;
  name: string;
}

// Each rule maps an inflected suffix to its base form.
// The derivationChain returned by deinflect() lists transformations in base→surface order.
const RULES: Rule[] = [
  // Polite past / negative
  { suffix: 'ました', base: 'ます', name: 'past' },
  { suffix: 'ませんでした', base: 'ます', name: 'negative past' },
  { suffix: 'ません', base: 'ます', name: 'negative' },

  // Past tense (plain)
  { suffix: 'いた', base: 'く', name: 'past' },
  { suffix: 'いだ', base: 'ぐ', name: 'past' },
  { suffix: 'した', base: 'す', name: 'past' },
  { suffix: 'った', base: 'う', name: 'past' },
  { suffix: 'った', base: 'つ', name: 'past' },
  { suffix: 'んだ', base: 'ぬ', name: 'past' },
  { suffix: 'んだ', base: 'ぶ', name: 'past' },
  { suffix: 'んだ', base: 'む', name: 'past' },
  { suffix: 'た', base: 'る', name: 'past' },

  // Polite (masu form) — specific godan patterns before the ichidan catch-all
  { suffix: 'います', base: 'う', name: 'polite' },
  { suffix: 'きます', base: 'く', name: 'polite' },
  { suffix: 'ぎます', base: 'ぐ', name: 'polite' },
  { suffix: 'します', base: 'する', name: 'polite' },
  { suffix: 'ちます', base: 'つ', name: 'polite' },
  { suffix: 'にます', base: 'ぬ', name: 'polite' },
  { suffix: 'びます', base: 'ぶ', name: 'polite' },
  { suffix: 'みます', base: 'む', name: 'polite' },
  { suffix: 'ります', base: 'る', name: 'polite' },
  { suffix: 'ます', base: 'る', name: 'polite' },

  // Negative (plain)
  { suffix: 'わない', base: 'う', name: 'negative' },
  { suffix: 'かない', base: 'く', name: 'negative' },
  { suffix: 'がない', base: 'ぐ', name: 'negative' },
  { suffix: 'さない', base: 'す', name: 'negative' },
  { suffix: 'たない', base: 'つ', name: 'negative' },
  { suffix: 'なない', base: 'ぬ', name: 'negative' },
  { suffix: 'ばない', base: 'ぶ', name: 'negative' },
  { suffix: 'まない', base: 'む', name: 'negative' },
  { suffix: 'らない', base: 'る', name: 'negative' },
  { suffix: 'ない', base: 'る', name: 'negative' },

  // Te-form
  { suffix: 'いて', base: 'く', name: 'te-form' },
  { suffix: 'いで', base: 'ぐ', name: 'te-form' },
  { suffix: 'して', base: 'す', name: 'te-form' },
  { suffix: 'って', base: 'う', name: 'te-form' },
  { suffix: 'って', base: 'つ', name: 'te-form' },
  { suffix: 'んで', base: 'ぬ', name: 'te-form' },
  { suffix: 'んで', base: 'ぶ', name: 'te-form' },
  { suffix: 'んで', base: 'む', name: 'te-form' },
  { suffix: 'て', base: 'る', name: 'te-form' },

  // Passive
  { suffix: 'われる', base: 'う', name: 'passive' },
  { suffix: 'かれる', base: 'く', name: 'passive' },
  { suffix: 'がれる', base: 'ぐ', name: 'passive' },
  { suffix: 'される', base: 'する', name: 'passive' },
  { suffix: 'たれる', base: 'つ', name: 'passive' },
  { suffix: 'なれる', base: 'ぬ', name: 'passive' },
  { suffix: 'ばれる', base: 'ぶ', name: 'passive' },
  { suffix: 'まれる', base: 'む', name: 'passive' },
  { suffix: 'られる', base: 'る', name: 'passive' },

  // Potential (godan)
  { suffix: 'える', base: 'う', name: 'potential' },
  { suffix: 'ける', base: 'く', name: 'potential' },
  { suffix: 'げる', base: 'ぐ', name: 'potential' },
  { suffix: 'せる', base: 'す', name: 'potential' },
  { suffix: 'てる', base: 'つ', name: 'potential' },
  { suffix: 'ねる', base: 'ぬ', name: 'potential' },
  { suffix: 'べる', base: 'ぶ', name: 'potential' },
  { suffix: 'める', base: 'む', name: 'potential' },
  { suffix: 'れる', base: 'る', name: 'potential' },

  // Causative
  { suffix: 'わせる', base: 'う', name: 'causative' },
  { suffix: 'かせる', base: 'く', name: 'causative' },
  { suffix: 'がせる', base: 'ぐ', name: 'causative' },
  { suffix: 'たせる', base: 'つ', name: 'causative' },
  { suffix: 'なせる', base: 'ぬ', name: 'causative' },
  { suffix: 'ばせる', base: 'ぶ', name: 'causative' },
  { suffix: 'ませる', base: 'む', name: 'causative' },
  { suffix: 'らせる', base: 'る', name: 'causative' },
  { suffix: 'させる', base: 'する', name: 'causative' },
  { suffix: 'させる', base: 'る', name: 'causative' },

  // Volitional
  { suffix: 'おう', base: 'う', name: 'volitional' },
  { suffix: 'こう', base: 'く', name: 'volitional' },
  { suffix: 'ごう', base: 'ぐ', name: 'volitional' },
  { suffix: 'そう', base: 'す', name: 'volitional' },
  { suffix: 'とう', base: 'つ', name: 'volitional' },
  { suffix: 'のう', base: 'ぬ', name: 'volitional' },
  { suffix: 'ぼう', base: 'ぶ', name: 'volitional' },
  { suffix: 'もう', base: 'む', name: 'volitional' },
  { suffix: 'ろう', base: 'る', name: 'volitional' },
  { suffix: 'しよう', base: 'する', name: 'volitional' },
  { suffix: 'よう', base: 'る', name: 'volitional' },

  // Conditional
  { suffix: 'えば', base: 'う', name: 'conditional' },
  { suffix: 'けば', base: 'く', name: 'conditional' },
  { suffix: 'げば', base: 'ぐ', name: 'conditional' },
  { suffix: 'せば', base: 'す', name: 'conditional' },
  { suffix: 'てば', base: 'つ', name: 'conditional' },
  { suffix: 'ねば', base: 'ぬ', name: 'conditional' },
  { suffix: 'べば', base: 'ぶ', name: 'conditional' },
  { suffix: 'めば', base: 'む', name: 'conditional' },
  { suffix: 'れば', base: 'る', name: 'conditional' },
];

const MAX_DEPTH = 6;

function explore(
  form: string,
  chain: string[],
  results: DeinflectionResult[],
): void {
  if (chain.length >= MAX_DEPTH) return;

  for (const rule of RULES) {
    if (form.length > rule.suffix.length && form.endsWith(rule.suffix)) {
      const newForm = form.slice(0, form.length - rule.suffix.length) + rule.base;
      const newChain = [...chain, rule.name];
      results.push({ baseForm: newForm, derivationChain: [...newChain].reverse() });
      explore(newForm, newChain, results);
    }
  }
}

export function deinflect(surface: string): DeinflectionResult[] {
  const results: DeinflectionResult[] = [];
  explore(surface, [], results);
  return results;
}
