# Phase 6 — Vocabulary Cleanup

**Sprint:** 4 of 5  
**Prerequisite:** Phases 1–4 complete (`lookupWord`, `lookupFrequencyTier`, migration 009, and `Word.frequency_tier` all exist)  
**Goal:** Add the "Clean up vocabulary" action — a client-side batch normalization flow backed by a new `/api/words/cleanup` POST route. Runs entirely via the already-initialized JMdict IndexedDB.

---

## Read first

- `app/api/words/route.ts` — understand the auth pattern used in this project's API routes
- `components/settings/` — list existing settings components to understand the conventions (`ApiKeyForm`, `ProfileForm`, `TagManager`, `TTSForm`)
- `__tests__/api/words.integration.test.ts` — understand the integration test pattern (pool setup, migration apply, auth session mock)

---

## 1. Create `app/api/words/cleanup/route.ts`

POST handler. Accepts:

```ts
interface CleanupPayload {
  normalizations: { id: number; canonical_dictionary_form: string }[];
  frequency_backfills: { id: number; frequency_tier: string }[];
}
```

Processing order:

1. Apply each normalization: `UPDATE words SET dictionary_form = $canonical WHERE id = $id AND user_id = $userId`
2. After all normalizations, find duplicates: words sharing `(user_id, dictionary_form, reading)` with more than one row
3. For each duplicate group: keep the highest-status entry (`known` > `seen` > `unseen`). If tied on status, keep the one with `user_translation` set. Delete the others. Preserve `user_translation` on the survivor.
4. Apply frequency backfills: `UPDATE words SET frequency_tier = $tier WHERE id = $id AND user_id = $userId AND frequency_tier IS NULL`
5. Return `{ normalized: number; merged: number; frequencyBackfilled: number }`

The operation is idempotent — running it twice on unchanged data returns all-zero counts.

---

## 2. Create `components/settings/VocabularyActions.tsx`

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
    const frequencyBackfills: { id: number; frequency_tier: string }[] = [];

    for (const word of words) {
      const entry = await lookupWord(word.dictionary_form, word.reading);
      if (entry) {
        const canonical = /* extract canonical headword from entry */;
        if (canonical && canonical !== word.dictionary_form) {
          normalizations.push({ id: word.id, canonical_dictionary_form: canonical });
        }
      }
      if (word.frequency_tier === null && entry) {
        // frequency backfill is handled server-side using the frequency data
        // include in backfill list; server calls lookupFrequencyTier
        frequencyBackfills.push({ id: word.id, frequency_tier: '' /* server fills */ });
      }
    }

    const cleanupRes = await fetch('/api/words/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ normalizations, frequency_backfills: frequencyBackfills }),
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

## 3. Integration tests — `__tests__/api/words-cleanup.integration.test.ts` (new file)

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
