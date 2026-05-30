# Phase 3 — Frequency Data Layer

**Sprint:** 2 of 5  
**Prerequisite:** Phases 1–2 complete (or can be done in parallel — no overlap with Phase 1/2 code)  
**Goal:** Add the JPDB frequency tier infrastructure: DB migration, `lib/frequency.ts`, `next.config.mjs` update, and unit tests. Nothing in the UI or import pipeline changes yet.

---

## Read first

- `lib/types.ts` — add `frequency_tier` to `Word`
- `next.config.mjs` — add `outputFileTracingIncludes`
- `migrations/` — check the highest-numbered migration to confirm `009` is next

---

## 1. Copy frequency data files

From `rcoker37/Comprehensible-Input-Generator`:

```
client/public/frequency/jpdb.json          → data/frequency/jpdb.json         (~3.4 MB)
client/public/frequency/jpdb-by-entry.json → data/frequency/jpdb-by-entry.json (~6.9 MB)
client/src/lib/frequency.ts                → lib/frequency.ts  (then adapt — see below)
```

Files go in `data/frequency/` (not `public/`). They are never served publicly.

---

## 2. Create `migrations/009_frequency.sql`

```sql
ALTER TABLE words
  ADD COLUMN frequency_tier TEXT
    CHECK (
      frequency_tier IN ('very-common', 'common', 'uncommon', 'rare', 'very-rare')
      OR frequency_tier IS NULL
    );
```

Update `package.json` `db:migrate` script to include `009_frequency.sql`.  
Update `DEPLOYMENT.md` migration list in step 1.3 to include 009.

---

## 3. Update `lib/types.ts`

Add `frequency_tier` to the `Word` interface:

```ts
frequency_tier: 'very-common' | 'common' | 'uncommon' | 'rare' | 'very-rare' | null;
```

### Breaking changes to fix immediately (same PR)

The `Word` interface change breaks `makeWord()` factories in two test files. Add `frequency_tier: null` to the default object:

- `__tests__/components/WordPopover.test.tsx` line ~16
- `__tests__/components/WordBrowser.test.tsx` line ~16

---

## 4. Create `lib/frequency.ts`

Server-only. Loads both JSON files lazily with a module-level singleton so they are parsed at most once per warm function instance.

Tier thresholds:

| Tier | JPDB rank |
|------|-----------|
| `very-common` | ≤ 1,500 |
| `common` | ≤ 5,000 |
| `uncommon` | ≤ 15,000 |
| `rare` | ≤ 30,000 |
| `very-rare` | > 30,000 |

```ts
import { promises as fs } from 'fs';
import path from 'path';
import type { Word } from '@/lib/types';

type FrequencyTier = NonNullable<Word['frequency_tier']>;

interface FrequencyData {
  jpdb: Record<string, number>;         // surface → rank
  jpdbByEntry: Record<string, number>;  // "dict_form|reading" → rank
}

let cache: FrequencyData | null = null;

async function getFrequencyData(): Promise<FrequencyData> {
  if (cache !== null) return cache;
  const base = path.join(process.cwd(), 'data/frequency');
  const [raw1, raw2] = await Promise.all([
    fs.readFile(path.join(base, 'jpdb.json'), 'utf8'),
    fs.readFile(path.join(base, 'jpdb-by-entry.json'), 'utf8'),
  ]);
  cache = { jpdb: JSON.parse(raw1), jpdbByEntry: JSON.parse(raw2) };
  return cache;
}

function rankToTier(rank: number): FrequencyTier {
  if (rank <= 1500) return 'very-common';
  if (rank <= 5000) return 'common';
  if (rank <= 15000) return 'uncommon';
  if (rank <= 30000) return 'rare';
  return 'very-rare';
}

export async function lookupFrequencyTier(
  dictionaryForm: string,
  reading: string,
): Promise<FrequencyTier | null> {
  const data = await getFrequencyData();
  const entryKey = `${dictionaryForm}|${reading}`;
  const rank = data.jpdbByEntry[entryKey] ?? data.jpdb[dictionaryForm] ?? null;
  return rank !== null ? rankToTier(rank) : null;
}
```

---

## 5. Update `next.config.mjs`

Inside `experimental`:

```js
outputFileTracingIncludes: {
  '/api/**': [
    './data/frequency/**',
  ],
},
```

(`data/jlpt.json` is a JSON module import — no tracing entry needed for it.)

---

## 6. Tests — `__tests__/lib/frequency.test.ts` (new file)

Use a small inline fixture instead of the real data files. Mock `fs.readFile` via `vi.mock('fs', ...)` or by mocking the internal `getFrequencyData` function.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

import { promises as fs } from 'fs';
import { lookupFrequencyTier } from '@/lib/frequency';

const fixture = {
  jpdb: { '猫': 800, '犬': 1600 },
  jpdbByEntry: { '食べる|たべる': 400 },
};

beforeEach(() => {
  // Reset singleton cache between tests by re-importing or resetting module state
  vi.mocked(fs.readFile)
    .mockResolvedValueOnce(JSON.stringify(fixture.jpdb))
    .mockResolvedValueOnce(JSON.stringify(fixture.jpdbByEntry));
});
```

Tests:

1. **Entry-keyed hit** — `lookupFrequencyTier('食べる', 'たべる')` → `'very-common'` (rank 400)
2. **Entry miss, surface hit** — `lookupFrequencyTier('犬', 'いぬ')` → `'common'` (rank 1600, surface key)
3. **Both miss** — `lookupFrequencyTier('謎語', 'なぞご')` → `null`
4. **Tier boundaries** — test rank values at each threshold:
   - 1500 → `'very-common'`
   - 1501 → `'common'`
   - 5000 → `'common'`
   - 5001 → `'uncommon'`
   - 15000 → `'uncommon'`
   - 15001 → `'rare'`
   - 30000 → `'rare'`
   - 30001 → `'very-rare'`

## Run

```
npx vitest run __tests__/lib/frequency.test.ts
npx vitest run
```

The `makeWord()` type fixes should clear any TypeScript compile errors in `WordPopover.test.tsx` and `WordBrowser.test.tsx`.
