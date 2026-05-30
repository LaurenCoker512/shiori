# Phase 8 — Hybrid Import Pipeline + Re-parse UI

**Sprint:** 5 of 5  
**Prerequisite:** Phase 7 complete (`lib/kuromoji.ts` exists, `assignKanjiReadings` exists in `lib/llm.ts`)  
**Goal:** Replace the full-LLM tokenization path in `processImport.ts` with the hybrid Kuromoji + LLM pipeline. Add the "Re-parse texts" button in Settings. Add processImport tests.

---

## Read first

- `lib/processImport.ts` — full file; identify the `tokenizeText` call site
- `lib/types.ts` — `Token` interface field names
- `components/settings/VocabularyActions.tsx` — add "Re-parse texts" here (created in Phase 6)
- `app/api/texts/[id]/` — find the reparse route to understand how re-import is triggered

---

## 1. Update `lib/processImport.ts`

Replace the `tokenizeText(config, text)` call with the hybrid pipeline:

```
1. const kuroTokens = await kuromojiTokenize(text)
2. Convert IpadicFeatures[] → preliminary Token[] (see field mapping below)
3. Filter: needsLlm = kuroTokens where surface_form contains kanji OR word_type === 'UNKNOWN'
   Kanji regex: /[一-鿿㐀-䶿]/
4. const llmReadings = needsLlm.length > 0
     ? await assignKanjiReadings(config, needsLlm.map(t => ({
         surface: t.surface_form,
         dictionary_form: t.basic_form,
         sentence_context: getSentenceContext(t, kuroTokens),
       })), signal)
     : []
5. Merge llmReadings back into the preliminary Token[]
6. Continue with existing parseHeadingSentinels() + DB insert (unchanged)
```

### Field mapping: `IpadicFeatures` → `Token`

| `Token` field | Source |
|---|---|
| `surface` | `surface_form` |
| `dictionary_form` | `basic_form` (use `surface_form` if `basic_form` is `'*'`) |
| `reading` | For pure-kana: `toHiragana(reading)`. For kanji/unknown: LLM `surface_reading` |
| `dict_reading` | For pure-kana: `toHiragana(reading)` if `basic_form` is pure kana. For kanji/unknown: LLM `dict_reading` |
| `is_content_word` | `true` if `pos` ∈ `['名詞', '動詞', '形容詞', '形容動詞', '副詞', '感動詞']`; `false` otherwise |

`toHiragana`: convert katakana reading to hiragana. Kuromoji always returns readings in katakana.

### Graceful degradation (no API key)

When `config` is `null` or `assignKanjiReadings` throws due to no API key, use Kuromoji's own reading as fallback for kanji tokens rather than failing the import:

```ts
const llmReadings = config
  ? await assignKanjiReadings(config, needsLlm, signal).catch(() => null)
  : null;

// If llmReadings is null, use Kuromoji's katakana reading converted to hiragana for all tokens
```

---

## 2. Add `getSentenceContext` helper (in `processImport.ts`)

Returns the surrounding sentence text for a given token — pass as context to the LLM prompt:

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

Mock both `lib/kuromoji` and `lib/llm` entirely. Do not hit the real tokenizer or LLM.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/kuromoji', () => ({
  kuromojiTokenize: vi.fn(),
}));

vi.mock('@/lib/llm', () => ({
  assignKanjiReadings: vi.fn(),
  // keep other exports if imported by processImport
}));

vi.mock('@/lib/frequency', () => ({
  lookupFrequencyTier: vi.fn().mockResolvedValue(null),
}));
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

Tests:

```ts
it('kanji tokens are sent to assignKanjiReadings; pure-kana tokens are not', async () => {
  vi.mocked(kuromojiTokenize).mockResolvedValue([pureKanaToken, kanjiToken]);
  vi.mocked(assignKanjiReadings).mockResolvedValue([
    { surface: '食べた', surface_reading: 'たべた', dict_reading: 'たべる' },
  ]);

  await processImport(/* config, text, ... */);

  expect(assignKanjiReadings).toHaveBeenCalledWith(
    expect.anything(),
    expect.arrayContaining([expect.objectContaining({ surface: '食べた' })]),
    expect.anything(),
  );
  // pure-kana should NOT be in the call
  expect(assignKanjiReadings).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.arrayContaining([expect.objectContaining({ surface: 'です' })]),
    expect.anything(),
  );
});

it('LLM readings merged into final Token[]', async () => {
  vi.mocked(kuromojiTokenize).mockResolvedValue([kanjiToken]);
  vi.mocked(assignKanjiReadings).mockResolvedValue([
    { surface: '食べた', surface_reading: 'たべた', dict_reading: 'たべる' },
  ]);

  const tokens = await processImport(/* ... */);

  const tok = tokens.find((t) => t.surface === '食べた');
  expect(tok?.reading).toBe('たべた');
  expect(tok?.dict_reading).toBe('たべる');
});

it('frequency_tier populated on inserted words', async () => {
  vi.mocked(lookupFrequencyTier).mockResolvedValue('common');
  vi.mocked(kuromojiTokenize).mockResolvedValue([kanjiToken]);
  vi.mocked(assignKanjiReadings).mockResolvedValue([
    { surface: '食べた', surface_reading: 'たべた', dict_reading: 'たべる' },
  ]);

  const tokens = await processImport(/* ... */);

  const tok = tokens.find((t) => t.surface === '食べた');
  expect(tok?.frequency_tier).toBe('common');
});

it('graceful degradation: assignKanjiReadings throws → Kuromoji reading used', async () => {
  vi.mocked(kuromojiTokenize).mockResolvedValue([kanjiToken]);
  vi.mocked(assignKanjiReadings).mockRejectedValue(new Error('no api key'));

  const tokens = await processImport(/* config: null, ... */);

  // Should not throw; kanji token gets katakana→hiragana fallback reading
  const tok = tokens.find((t) => t.surface === '食べた');
  expect(tok?.reading).toBe('たべた'); // toHiragana('タベタ')
});
```

## Run

```
npx vitest run __tests__/lib/processImport.test.ts
npx vitest run
```

Full suite passes → all 5 sprints are complete.
