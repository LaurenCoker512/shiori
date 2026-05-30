# Phase 6 — Vocabulary Cleanup

**Sprint:** 4 of 5  
**Prerequisite:** Phases 1–4 complete (`lookupWord`, `lookupFrequencyTier`, migration 009, and `Word.frequency_tier` all exist)  
**Goal:** Add the "Clean up vocabulary" action — a client-side batch normalization flow backed by a new `/api/words/cleanup` POST route. Runs entirely via the already-initialized JMdict IndexedDB.

---

## Read first

- `lib/types.ts` — `JMdictEntry` interface (add `canonicalForm` here)
- `lib/jmdict.ts` — `buildEntry` (populate `canonicalForm` from `entry.k?.[0]?.ent ?? entry.r[0]?.ent`)
- `app/api/words/route.ts` — understand the auth pattern used in this project's API routes
- `components/settings/` — list existing settings components to understand the conventions (`ApiKeyForm`, `ProfileForm`, `TagManager`, `TTSForm`)
- `__tests__/api/words.integration.test.ts` — understand the integration test pattern (pool setup, migration apply, auth session mock)

---

## 1. Update `lib/types.ts` and `lib/jmdict.ts`

Add `canonicalForm` to `JMdictEntry` so `VocabularyActions` can use it without touching internal IDB types:

```ts
// lib/types.ts
export interface JMdictEntry {
  id: number;
  senses: JMdictSense[];
  jlpt_level: JlptLevel | null;
  canonicalForm: string;         // JMdict k[0] or r[0] — the normalized headword
  derivationChain?: string[];    // from Phase 5 (already present if Phase 5 ran first)
}
```

In `lib/jmdict.ts`, update `buildEntry`:

```ts
function buildEntry(
  entry: import('@birchill/jpdict-idb').WordResult,
  dictionaryForm: string,
): JMdictEntry {
  const senses: JMdictSense[] = entry.s.map((s) => ({
    pos: s.pos ?? [],
    glosses: s.g.slice(0, 3).map((g) => g.str),
    info: s.inf ?? undefined,
  }));
  const canonicalForm = entry.k?.[0]?.ent ?? entry.r[0]?.ent ?? dictionaryForm;
  return { id: entry.id, senses, jlpt_level: jlptLevel(dictionaryForm), canonicalForm };
}
```

After adding `canonicalForm` as a required field, fix any test `makeWord`-style helpers that construct `JMdictEntry` objects (check `__tests__/lib/jmdict.test.ts` and `__tests__/components/WordPopover.test.tsx` for inline entries — add `canonicalForm: '猫'` or similar to each).

---

## 2. Create `app/api/words/cleanup/route.ts`

POST handler. Accepts:

```ts
interface CleanupPayload {
  normalizations: { id: number; canonical_dictionary_form: string }[];
  frequency_backfill_ids: number[];  // IDs of words with null frequency_tier; server computes tiers
}
```

Processing order:

1. Apply each normalization: `UPDATE words SET dictionary_form = $canonical WHERE id = $id AND user_id = $userId`
2. After all normalizations, find duplicates: words sharing `(user_id, dictionary_form, reading)` with more than one row
3. For each duplicate group: keep the highest-status entry (`known` > `seen` > `unseen`). If tied on status, keep the one with `user_translation` set. Delete the others. Preserve `user_translation` on the survivor.
4. For each ID in `frequency_backfill_ids`: call `lookupFrequencyTier(word.dictionary_form, word.reading)` and apply `UPDATE words SET frequency_tier = $tier WHERE id = $id AND user_id = $userId AND frequency_tier IS NULL`
5. Return `{ normalized: number; merged: number; frequencyBackfilled: number }`

The operation is idempotent — running it twice on unchanged data returns all-zero counts.

---

## 3. Create `components/settings/VocabularyActions.tsx`

New settings component (alongside `ApiKeyForm.tsx` etc.):

```tsx
export function VocabularyActions() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [summary, setSummary] = useState<{
    normalized: number;
    merged: number;
    frequencyBackfilled: number;
  } | null>(null);

  async function handleCleanup() {
    setStatus('running');
    setSummary(null);

    // 1. Fetch all words from the API
    const res = await fetch('/api/words?limit=9999');
    const { words } = await res.json();

    // 2. For each word, run lookupWord against JMdict
    const normalizations: { id: number; canonical_dictionary_form: string }[] = [];
    const frequencyBackfillIds: number[] = [];

    for (const word of words) {
      const entry = await lookupWord(word.dictionary_form, word.reading);
      if (entry && entry.canonicalForm !== word.dictionary_form) {
        normalizations.push({ id: word.id, canonical_dictionary_form: entry.canonicalForm });
      }
      if (word.frequency_tier === null) {
        frequencyBackfillIds.push(word.id);
      }
    }

    const cleanupRes = await fetch('/api/words/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        normalizations,
        frequency_backfill_ids: frequencyBackfillIds,
      }),
    });

    if (!cleanupRes.ok) {
      setStatus('error');
      return;
    }
    setSummary(await cleanupRes.json());
    setStatus('done');
  }

  return (
    <section>
      <h2>Vocabulary</h2>
      <button onClick={handleCleanup} disabled={status === 'running'}>
        {status === 'running' ? 'Running…' : 'Clean up vocabulary'}
      </button>
      {summary && (
        <p>
          {summary.normalized} words normalized · {summary.merged} duplicates merged ·{' '}
          {summary.frequencyBackfilled} words updated with frequency data
        </p>
      )}
      {status === 'error' && <p>Cleanup failed. Please try again.</p>}
    </section>
  );
}
```

Wire `VocabularyActions` into the Settings page alongside the existing components.

---

## 4. Integration tests — `__tests__/api/words-cleanup.integration.test.ts` (new file)

Follow the pattern from `__tests__/api/words.integration.test.ts` (pool setup, mock auth session, apply migrations 001 + 009 in `beforeAll`).

Tests:

```ts
it('POST with normalization → dictionary_form updated in DB', async () => { ... });

it('POST: two words share canonical form after normalization → duplicate merged; higher-status survives', async () => {
  // Insert word A (seen) and word B (known) with different dictionary_forms
  // that both normalize to the same canonical
  // POST cleanup with both normalizations
  // Assert only one row remains, with status 'known'
});

it('merged entry with user_translation → user_translation preserved on survivor', async () => { ... });

it('POST with no changes needed → returns { normalized: 0, merged: 0, frequencyBackfilled: 0 }', async () => { ... });

it('idempotent: second POST on same data returns all-zero summary', async () => {
  // Run cleanup twice; second result should all be 0
});
```

## Run

```
npx vitest run __tests__/api/words-cleanup.integration.test.ts
npx vitest run
```
