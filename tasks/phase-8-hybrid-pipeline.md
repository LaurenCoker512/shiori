# Phase 8 — Hybrid Import Pipeline + Re-parse UI

**Sprint:** 5 of 5  
**Prerequisite:** Phase 7 complete (`lib/kuromoji.ts` exists, `assignKanjiReadings` exists in `lib/llm.ts`)  
**Goal:** Replace the full-LLM tokenization path in `processImport.ts` with the hybrid Kuromoji + LLM pipeline. Add the "Re-parse texts" button in Settings. Add processImport tests.

---

## Read first

- `lib/processImport.ts` — full file; identify the `tokenizeText` call site (returns `void`, not tokens — tests must assert on DB calls, not return values)
- `lib/types.ts` — `Token` interface field names
- `components/settings/VocabularyActions.tsx` — add "Re-parse texts" here (created in Phase 6)
- `app/api/texts/[id]/` — find the reparse route to understand how re-import is triggered

---

## 1. Update `lib/processImport.ts`

Replace the `tokenizeText(config, text)` call with the hybrid pipeline:

```
1. const kuroTokens = await kuromojiTokenize(normalizedContent, abortController.signal)
2. Convert IpadicFeatures[] → preliminary Token[] (see field mapping below)
3. Filter: needsLlm = kuroTokens where surface_form contains kanji OR word_type === 'UNKNOWN'
   Kanji regex: /[一-鿿㐀-䶿]/
4. const llmReadings = config && needsLlm.length > 0
     ? await assignKanjiReadings(config, needsLlm.map(t => ({
         surface: t.surface_form,
         dictionary_form: t.basic_form,
         sentence_context: getSentenceContext(t, kuroTokens),
       })), abortController.signal).catch(() => null)
     : null
5. Merge llmReadings back into the preliminary Token[] (fall back to toHiragana(kuromoji reading) when null)
6. Continue with existing parseHeadingSentinels() + DB insert (unchanged)
```

### Field mapping: `IpadicFeatures` → `Token`

| `Token` field | Source |
|---|---|
| `surface` | `surface_form` |
| `dictionary_form` | `basic_form` (use `surface_form` if `basic_form` is `'*'`) |
| `reading` | For pure-kana: `toHiragana(reading ?? surface_form)`. For kanji/unknown: LLM `surface_reading` (fallback: `toHiragana(reading ?? surface_form)`) |
| `dict_reading` | For pure-kana: `toHiragana(basic_form)` if pure kana, else `toHiragana(reading ?? surface_form)`. For kanji/unknown: LLM `dict_reading` (fallback: `toHiragana(reading ?? surface_form)`) |
| `is_content_word` | `true` if `pos` ∈ `['名詞', '動詞', '形容詞', '形容動詞', '副詞', '感動詞']`; `false` otherwise |

`toHiragana`: convert katakana reading to hiragana. Kuromoji always returns readings in katakana. This utility already exists in `lib/text-processing.ts`.

### Graceful degradation (no API key / config null)

When `config` is `null` or `assignKanjiReadings` throws, use Kuromoji's own reading converted to hiragana as fallback for kanji tokens rather than failing the import.

---

## 2. Add `getSentenceContext` helper (in `processImport.ts`)

Returns the surrounding sentence text for a given token — passed as context to the LLM prompt:

```ts
function getSentenceContext(
  token: IpadicFeatures,
  allTokens: IpadicFeatures[],
): string {
  // Find the sentence boundary (。！？\n) around this token
  // Return the joined surface forms of the containing sentence
  // Cap at 50 characters to keep the LLM prompt small
}
```

---

## 3. Update `components/settings/VocabularyActions.tsx` (from Phase 6)

Add the "Re-parse texts" button:

```tsx
async function handleReparse() {
  setReparseStatus('running');
  setReparseProgress({ current: 0, total: 0 });

  const textsRes = await fetch('/api/texts');
  const { texts } = await textsRes.json();
  setReparseProgress({ current: 0, total: texts.length });

  for (let i = 0; i < texts.length; i++) {
    await fetch(`/api/texts/${texts[i].id}/reparse`, { method: 'POST' });
    setReparseProgress({ current: i + 1, total: texts.length });
  }

  setReparseStatus('done');
}
```

Show progress counter: "Re-parsing text 3 of 12…"

After re-parsing, prompt: "Run vocabulary cleanup to normalize any newly inserted words."

---

## 4. Tests — `__tests__/lib/processImport.test.ts` (new file)

`processImport` returns `void` and writes to the DB — tests must mock `@/lib/db` and assert on `query()` call arguments rather than on a return value.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/kuromoji', () => ({
  kuromojiTokenize: vi.fn(),
}));

vi.mock('@/lib/llm', () => ({
  assignKanjiReadings: vi.fn(),
}));

vi.mock('@/lib/frequency', () => ({
  lookupFrequencyTier: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('@/lib/importAbortControllers', () => ({
  registerImportAbort: vi.fn(),
  unregisterImportAbort: vi.fn(),
}));

import { kuromojiTokenize } from '@/lib/kuromoji';
import { assignKanjiReadings } from '@/lib/llm';
import { lookupFrequencyTier } from '@/lib/frequency';
import { query } from '@/lib/db';
import { processImport } from '@/lib/processImport';
```

Fixture token arrays — one pure-kana token and one kanji token:

```ts
const pureKanaToken = {
  surface_form: 'です',
  basic_form: 'です',
  reading: 'デス',
  word_type: 'KNOWN',
  pos: '助動詞',
};

const kanjiToken = {
  surface_form: '食べた',
  basic_form: '食べる',
  reading: 'タベタ',
  word_type: 'KNOWN',
  pos: '動詞',
};
```

Tests assert on the `query` mock to verify what surfaces, readings, and frequency tiers were written to the DB:

```ts
function getInsertCall() {
  // Find the query() call that does the words INSERT (contains 'INSERT INTO words')
  return vi.mocked(query).mock.calls.find(([sql]) =>
    typeof sql === 'string' && sql.includes('INSERT INTO words'),
  );
}

it('kanji tokens are sent to assignKanjiReadings; pure-kana tokens are not', async () => {
  vi.mocked(kuromojiTokenize).mockResolvedValue([pureKanaToken, kanjiToken]);
  vi.mocked(assignKanjiReadings).mockResolvedValue([
    { surface: '食べた', surface_reading: 'たべた', dict_reading: 'たべる' },
  ]);

  await processImport(1, 1, 'テスト', mockConfig);

  expect(assignKanjiReadings).toHaveBeenCalledWith(
    expect.anything(),
    expect.arrayContaining([expect.objectContaining({ surface: '食べた' })]),
    expect.anything(),
  );
  expect(assignKanjiReadings).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.arrayContaining([expect.objectContaining({ surface: 'です' })]),
    expect.anything(),
  );
});

it('LLM readings written to DB', async () => {
  vi.mocked(kuromojiTokenize).mockResolvedValue([kanjiToken]);
  vi.mocked(assignKanjiReadings).mockResolvedValue([
    { surface: '食べた', surface_reading: 'たべた', dict_reading: 'たべる' },
  ]);

  await processImport(1, 1, 'テスト', mockConfig);

  const insertCall = getInsertCall();
  expect(insertCall).toBeDefined();
  const [, [, forms, readings]] = insertCall!;
  expect(forms).toContain('食べる');
  expect(readings).toContain('たべる');
});

it('frequency_tier populated on inserted words', async () => {
  vi.mocked(kuromojiTokenize).mockResolvedValue([kanjiToken]);
  vi.mocked(assignKanjiReadings).mockResolvedValue([
    { surface: '食べた', surface_reading: 'たべた', dict_reading: 'たべる' },
  ]);
  vi.mocked(lookupFrequencyTier).mockResolvedValue('common');

  await processImport(1, 1, 'テスト', mockConfig);

  expect(lookupFrequencyTier).toHaveBeenCalledWith('食べる', 'たべる');
  // verify frequency_tier column included in INSERT args
  const insertCall = getInsertCall();
  const [sql] = insertCall!;
  expect(sql).toContain('frequency_tier');
});

it('graceful degradation: assignKanjiReadings throws → Kuromoji reading used, import succeeds', async () => {
  vi.mocked(kuromojiTokenize).mockResolvedValue([kanjiToken]);
  vi.mocked(assignKanjiReadings).mockRejectedValue(new Error('no api key'));

  await expect(processImport(1, 1, 'テスト', mockConfig)).resolves.not.toThrow();

  const insertCall = getInsertCall();
  expect(insertCall).toBeDefined();
  // Fallback: toHiragana('タベタ') = 'たべた'
  const [, [, , readings]] = insertCall!;
  expect(readings).toContain('たべた');
});
```

## Run

```
npx vitest run __tests__/lib/processImport.test.ts
npx vitest run
```

Full suite passes → all 5 sprints are complete.
