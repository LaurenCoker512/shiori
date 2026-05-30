# Phase 1 — JMdict Foundation

**Sprint:** 1 of 5  
**Prerequisite:** none  
**Goal:** Add the client-side dictionary layer — types, the `lib/jmdict.ts` singleton, the bundled JLPT data file, and unit tests. Nothing in the UI changes yet.

---

## Read first

- `lib/types.ts` — add new types here

---

## 1. Add types to `lib/types.ts`

```ts
export interface JMdictSense {
  pos: string[];      // e.g. ['n'], ['v5k'], ['adj-i']
  glosses: string[];  // up to 3 glosses per sense
  info?: string;      // e.g. "usually written using kana alone"
}

export interface JMdictEntry {
  id: number;
  senses: JMdictSense[];
  jlpt_level: JlptLevel | null;
}
```

`JlptLevel` is already defined in `lib/types.ts` — do not redefine it.

---

## 2. Create `data/jlpt.json`

Static JLPT vocabulary list keyed by `dictionary_form`. Each value is the level string.

```json
{
  "猫": "N5",
  "犬": "N5",
  "食べる": "N5"
}
```

Populate with the real ~8,700 word N5–N1 dataset (source: jlpt-vocab-list or similar public domain list). The file is imported as a JSON module — Next.js bundles it at build time. No `fs.readFile` needed.

---

## 3. Create `lib/jmdict.ts`

Browser-only singleton. Never import `@birchill/jpdict-idb` statically — only via dynamic import inside `getDb()` so the module cannot be bundled server-side.

```ts
import jlptData from '@/data/jlpt.json';
import type { JMdictEntry, JMdictSense, JlptLevel } from '@/lib/types';

let dbInstance: import('@birchill/jpdict-idb').JpdictIdb | null = null;

async function getDb() {
  if (typeof window === 'undefined') return null;
  if (dbInstance) return dbInstance;
  const { JpdictIdb } = await import('@birchill/jpdict-idb');
  dbInstance = new JpdictIdb();
  return dbInstance;
}

function jlptLevel(dictionaryForm: string): JlptLevel | null {
  const level = (jlptData as Record<string, string>)[dictionaryForm];
  return (level as JlptLevel) ?? null;
}

export async function lookupWord(
  dictionaryForm: string,
  reading: string,
): Promise<JMdictEntry | null> {
  const db = await getDb();
  if (!db) return null;

  // Stage 1: exact match on dictionary form
  const results = await db.getWords(dictionaryForm);
  const match = results.find(
    (r) =>
      r.k?.some((k) => k.ent === dictionaryForm) ||
      r.r?.some((rd) => rd.ent === reading),
  ) ?? results[0] ?? null;

  // Stage 2: single-character fallback when no match
  const entry = match ?? (dictionaryForm.length === 1
    ? (await db.getWords(dictionaryForm))[0] ?? null
    : null);

  if (!entry) return null;

  const senses: JMdictSense[] = entry.s.map((s) => ({
    pos: s.pos ?? [],
    glosses: (s.g ?? []).slice(0, 3).map((g) => g.str),
    info: s.inf ?? undefined,
  }));

  return { id: entry.id, senses, jlpt_level: jlptLevel(dictionaryForm) };
}
```

Install the library:
```
npm install @birchill/jpdict-idb
```

`@birchill/normal-jp` is a required peer dependency — it installs automatically. Do not install it separately.

---

## 4. Tests — `__tests__/lib/jmdict.test.ts` (new file)

Mock `@birchill/jpdict-idb` entirely with `vi.mock`. Do not hit real IndexedDB.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@birchill/jpdict-idb', () => ({
  JpdictIdb: vi.fn().mockImplementation(() => ({
    getWords: vi.fn(),
  })),
}));

vi.mock('@/data/jlpt.json', () => ({
  default: { '猫': 'N5', '食べる': 'N5' },
}));
```

Write tests for:

1. **Maps WordResult to JMdictEntry** — mock `getWords` to return a fixture with `s`, `k`, `r` fields; assert `lookupWord('猫', 'ねこ')` returns `{ id, senses: [{ pos, glosses }], jlpt_level: 'N5' }`.
2. **Glosses capped at 3** — fixture sense with 5 glosses; assert returned glosses length is 3.
3. **Server-side guard** — patch `typeof window` to `'undefined'` (or mock `getDb` to return `null`); assert `lookupWord` returns `null`.
4. **JMdict miss returns null** — mock `getWords` to return `[]`; assert `lookupWord` returns `null`.
5. **JLPT level populated for known word** — `jlpt_level` is `'N5'` for `'猫'`.
6. **JLPT level null for unknown word** — `jlpt_level` is `null` for `'謎語'` (not in fixture).

## Run

```
npx vitest run __tests__/lib/jmdict.test.ts
```

All 6 tests should pass. Run the full suite to confirm no regressions:

```
npx vitest run
```
