# Phase 5 — Deinflection + Derivation Chain

**Sprint:** 3 of 5  
**Prerequisite:** Phases 1–2 complete (`lib/jmdict.ts` exists and `lookupWord` is in use)  
**Goal:** Port the Yomitan deinflection engine; add it as Stage 2 of the JMdict lookup chain; show the derivation chain note in `WordPopover`.

---

## Read first

- `lib/jmdict.ts` — to add Stage 2 lookup
- `components/reader/WordPopover.tsx` — to add derivation note display
- `__tests__/components/WordPopover.test.tsx` — to add derivation test
- Friend's repo: `client/src/lib/japaneseTransforms.ts` and `client/src/lib/japaneseDeinflect.ts`

---

## 1. Create `lib/deinflect.ts`

Port **only**:
- The transform rule table from `japaneseTransforms.ts`
- The per-token candidate generation loop from `japaneseDeinflect.ts`

**Do not port** the sliding-window cursor scanning — it is designed for raw text and has no application to Shiori's pre-segmented tokens.

```ts
export interface DeinflectionResult {
  baseForm: string;
  derivationChain: string[];  // e.g. ['passive', 'polite', 'past']
}

export function deinflect(surface: string): DeinflectionResult[] {
  // apply transform rules iteratively
  // return all candidate base forms with their derivation chains
  // return [] for undeclined words (no rules match)
}
```

Return type is a pure array — no async, no dependencies. Ideal for unit testing.

---

## 2. Update `lib/jmdict.ts`

Add Stage 2 to `lookupWord`: when the direct lookup returns `null`, deinflect `dictionaryForm` and try each candidate `baseForm` against JMdict. Return the first hit (if any), flagged so `WordPopover` can show the derivation chain.

Update the return type to carry optional deinflection metadata:

```ts
export interface JMdictEntry {
  id: number;
  senses: JMdictSense[];
  jlpt_level: JlptLevel | null;
  derivationChain?: string[];  // present only when resolved via deinflection
}
```

In `lookupWord`:

```ts
// Stage 2: deinflection fallback
import { deinflect } from '@/lib/deinflect';

const candidates = deinflect(dictionaryForm);
for (const { baseForm, derivationChain } of candidates) {
  const results = await db.getWords(baseForm);
  if (results.length > 0) {
    const r = results[0];
    const senses = r.s.map(/* same mapping as Stage 1 */);
    return {
      id: r.id,
      senses,
      jlpt_level: jlptLevel(baseForm),
      derivationChain,
    };
  }
}
return null;
```

---

## 3. Update `components/reader/WordPopover.tsx`

In the `JMdictDisplay` component, show the derivation chain when present:

```tsx
{entry.derivationChain && entry.derivationChain.length > 0 && (
  <p className="text-xs text-muted-foreground">
    ← {entry.derivationChain.join(' ← ')}
  </p>
)}
```

---

## 4. Tests

### New: `__tests__/lib/deinflect.test.ts`

No mocks needed — `lib/deinflect.ts` is pure TypeScript.

```ts
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
```

### Update: `__tests__/components/WordPopover.test.tsx`

Add one test (with `lookupWord` already mocked from Phase 2):

```ts
it('deinflected result → derivation chain note rendered', async () => {
  vi.mocked(lookupWord).mockResolvedValue({
    id: 3,
    jlpt_level: null,
    senses: [{ pos: ['v1'], glosses: ['to eat'] }],
    derivationChain: ['passive', 'polite', 'past'],
  });
  render(
    <WordPopover
      word={makeWord({ translation: null, user_translation: null })}
      anchorRect={mockAnchorRect}
      onClose={vi.fn()}
      onStatusUpdate={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(screen.getByText('← passive ← polite ← past')).toBeInTheDocument(),
  );
});
```

### Update: `__tests__/lib/jmdict.test.ts`

Add one test for the deinflection Stage 2 path:

```ts
it('Stage 2: deinflection hit → returns entry with derivationChain', async () => {
  // First getWords call (direct) returns []; second (deinflected base) returns fixture
  vi.mocked(mockGetWords)
    .mockResolvedValueOnce([])   // Stage 1 miss
    .mockResolvedValueOnce([fixtureEntry]); // Stage 2 hit
  
  // mock deinflect to return a known candidate
  vi.mock('@/lib/deinflect', () => ({
    deinflect: () => [{ baseForm: '食べる', derivationChain: ['past'] }],
  }));

  const result = await lookupWord('食べた', 'たべた');
  expect(result?.derivationChain).toEqual(['past']);
});
```

## Run

```
npx vitest run __tests__/lib/deinflect.test.ts
npx vitest run __tests__/lib/jmdict.test.ts
npx vitest run __tests__/components/WordPopover.test.tsx
npx vitest run
```
