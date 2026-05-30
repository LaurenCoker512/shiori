# Phase 4 — Frequency Wiring + UI

**Sprint:** 2 of 5  
**Prerequisite:** Phase 3 complete (`lib/frequency.ts`, migration 009, `Word.frequency_tier` type exist)  
**Goal:** Wire `frequency_tier` into the import pipeline, API routes, and UI. Update all related tests.

---

## Read first

- `lib/processImport.ts` — find the bulk word INSERT
- `app/api/words/route.ts` — find where query filters are applied
- `app/api/words/[id]/route.ts` — find the PATCH handler
- `components/reader/WordPopover.tsx` — find the JLPT badge to add frequency badge alongside
- `components/dashboard/WordBrowser.tsx` — find the JLPT filter `<select>` to mirror for frequency
- `__tests__/components/WordBrowser.test.tsx` — find the JLPT filter test (line ~90–104) to mirror
- `__tests__/api/words.integration.test.ts` — find `beforeAll` migration apply (line ~53)
- `__tests__/api/translation.integration.test.ts` — find `beforeAll` migration apply

---

## 1. `lib/processImport.ts`

Import and call `lookupFrequencyTier` during bulk word insert:

```ts
import { lookupFrequencyTier } from '@/lib/frequency';
```

In the word-building loop, add:

```ts
const frequencyTier = await lookupFrequencyTier(token.dictionary_form, token.reading);
```

Include `frequency_tier` in the INSERT statement. Keep `ON CONFLICT DO NOTHING` behavior unchanged.

---

## 2. `app/api/words/route.ts`

Add `frequency_tier` to the query filter params alongside `jlpt_level` and `status`. Accept it from the URL search params and apply as a `WHERE frequency_tier = $n` clause when present.

---

## 3. `app/api/words/[id]/route.ts` (PATCH handler)

Lazy backfill: when `frequency_tier` is `null` on the word being updated, call `lookupFrequencyTier` and include the result in the UPDATE. This covers pre-migration words.

---

## 4. `components/reader/WordPopover.tsx`

Add a frequency badge alongside the existing JLPT badge. Use the same badge component/pattern. Show nothing when `word.frequency_tier` is `null`.

```tsx
{word.frequency_tier && (
  <Badge variant="secondary">{word.frequency_tier}</Badge>
)}
```

---

## 5. `components/dashboard/WordBrowser.tsx`

Add a frequency tier `<select>` filter alongside the existing JLPT and status filters:

```tsx
<select
  value={filters.frequencyTier ?? ''}
  onChange={(e) =>
    setFilters((f) => ({ ...f, frequencyTier: e.target.value || null }))
  }
>
  <option value="">All frequencies</option>
  <option value="very-common">Very common</option>
  <option value="common">Common</option>
  <option value="uncommon">Uncommon</option>
  <option value="rare">Rare</option>
  <option value="very-rare">Very rare</option>
</select>
```

Pass `frequency_tier=` as a query param to the API fetch when the filter is set.

---

## 6. Update tests

### `__tests__/api/words.integration.test.ts`

In both `beforeAll` blocks (lines ~48 and ~157), apply migration 009 after 001:

```ts
const migration009 = readFileSync(join(process.cwd(), 'migrations/009_frequency.sql'), 'utf-8');
await testPool.query(migration009);
```

### `__tests__/api/translation.integration.test.ts`

Same fix: apply migration 009 in `beforeAll` after the initial migration.

### `__tests__/components/WordBrowser.test.tsx`

Add one test mirroring the existing JLPT filter test (line ~90–104):

```ts
it('frequency tier filter change triggers refetch with frequency_tier query param', async () => {
  const user = userEvent.setup();
  mockFetch([makeWord()], 1);
  render(<WordBrowser />);
  await waitFor(() => screen.getByRole('combobox', { name: /frequency/i }));

  mockFetch([makeWord()], 1);
  await user.selectOptions(
    screen.getByRole('combobox', { name: /frequency/i }),
    'common',
  );

  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('frequency_tier=common'),
      expect.anything(),
    ),
  );
});
```

## Run

```
npx vitest run __tests__/api/words.integration.test.ts
npx vitest run __tests__/api/translation.integration.test.ts
npx vitest run __tests__/components/WordBrowser.test.tsx
npx vitest run
```
