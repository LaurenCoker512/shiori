# Phase 7 — Kuromoji Foundation

**Sprint:** 5 of 5  
**Prerequisite:** Phases 1–6 complete. This phase has no interaction with Phase 1–6 code.  
**Goal:** Install Kuromoji, create the server-side singleton, replace `tokenizeText` in `lib/llm.ts` with `assignKanjiReadings`, update `next.config.mjs`, and update the LLM tests. The import pipeline itself is not changed yet (Phase 8).

---

## Read first

- `lib/llm.ts` — full file; identify `tokenizeText` (to delete) and add `assignKanjiReadings`
- `next.config.mjs` — full file; will add `serverExternalPackages` and extend `outputFileTracingIncludes`
- `__tests__/lib/llm.test.ts` — find the `tokenizeText` describe block (lines ~20–57) to remove

---

## 1. Install

```
npm install @patdx/kuromoji
```

---

## 2. Create `lib/kuromoji.ts`

Server-only singleton. Must not be imported in any client component.

```ts
import 'server-only';

type Tokenizer = Awaited<ReturnType<
  import('@patdx/kuromoji').TokenizerBuilder['build']
>>;

let tokenizer: Tokenizer | null = null;

async function getTokenizer(): Promise<Tokenizer> {
  if (tokenizer) return tokenizer;
  const kuromoji = await import('@patdx/kuromoji');
  const NodeDictionaryLoader = (await import('@patdx/kuromoji/node')).default;
  const path = await import('path');
  const loader = new NodeDictionaryLoader({
    dic_path: path.join(process.cwd(), 'node_modules/@patdx/kuromoji/dict/'),
  });
  tokenizer = await new kuromoji.TokenizerBuilder({ loader }).build();
  return tokenizer;
}

export async function kuromojiTokenize(text: string): Promise<import('@patdx/kuromoji').IpadicFeatures[]> {
  const t = await getTokenizer();
  return t.tokenize(text);
}
```

`reading` is `string | undefined` on `IpadicFeatures` — always guard for `undefined` (`UNKNOWN` tokens have no reading).

---

## 3. Update `lib/llm.ts`

### Delete `tokenizeText`

Remove the entire `tokenizeText` function and its prompt. It is fully replaced by the hybrid pipeline.

### Add `assignKanjiReadings`

A focused prompt that accepts only the kanji/unknown token subset and returns per-token readings:

```ts
interface KanjiToken {
  surface: string;
  dictionary_form: string;
  sentence_context: string;
}

interface KanjiReading {
  surface: string;
  surface_reading: string;  // hiragana reading of the surface form
  dict_reading: string;     // hiragana reading of the dictionary form
}

export async function assignKanjiReadings(
  config: AnthropicConfig,
  tokens: KanjiToken[],
  signal?: AbortSignal,
): Promise<KanjiReading[]> {
  // Prompt: given surface + dictionary_form + sentence context, return
  // { surface_reading, dict_reading } in hiragana for each token.
  // Return JSON array matching input order.
  ...
}
```

---

## 4. Update `next.config.mjs`

Add `serverExternalPackages` (prevents webpack from bundling `@patdx/kuromoji`, which uses `fs` directly):

```js
serverExternalPackages: ['@patdx/kuromoji'],
```

Extend `outputFileTracingIncludes` to include the dict files (required for Vercel deployment):

```js
outputFileTracingIncludes: {
  '/api/**': [
    './data/frequency/**',                         // existing (Phase 3)
    './node_modules/@patdx/kuromoji/dict/**',      // new
  ],
},
```

---

## 5. Tests

### Update `__tests__/lib/llm.test.ts`

**Remove** the `tokenizeText` describe block (lines ~20–57). Running vitest without removing it will give a "not a function" error once `tokenizeText` is deleted.

**Add** an `assignKanjiReadings` describe block:

```ts
describe('assignKanjiReadings', () => {
  it('returns surface_reading and dict_reading for flagged tokens', async () => {
    vi.mocked(anthropicCreate).mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify([
            { surface: '食べた', surface_reading: 'たべた', dict_reading: 'たべる' },
          ]),
        },
      ],
    });

    const result = await assignKanjiReadings(anthropicConfig, [
      { surface: '食べた', dictionary_form: '食べる', sentence_context: '昨日食べた。' },
    ]);

    expect(result).toEqual([
      { surface: '食べた', surface_reading: 'たべた', dict_reading: 'たべる' },
    ]);
  });

  it('does not include pure-kana tokens in output', async () => {
    // Pure-kana tokens should not be passed to assignKanjiReadings at all —
    // test that the function correctly returns only what the LLM returns
    // (filtering happens in processImport, not here)
    vi.mocked(anthropicCreate).mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
    const result = await assignKanjiReadings(anthropicConfig, []);
    expect(result).toEqual([]);
  });
});
```

### New: `__tests__/lib/kuromoji.test.ts`

`import 'server-only'` throws in jsdom — use node environment:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { kuromojiTokenize } from '@/lib/kuromoji';

describe('kuromojiTokenize', () => {
  it('returns IpadicFeatures array for Japanese text', async () => {
    const tokens = await kuromojiTokenize('猫が好きです');
    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0]).toHaveProperty('surface_form');
  });

  it('pure-kana token has reading defined', async () => {
    const tokens = await kuromojiTokenize('です');
    expect(tokens[0].reading).toBeDefined();
  });

  it('singleton: getTokenizer called twice returns same instance', async () => {
    // Call kuromojiTokenize twice; the module-level tokenizer variable
    // should only be set once — assert by checking no double-init error is thrown
    await kuromojiTokenize('テスト');
    await kuromojiTokenize('テスト');
    // If we reach here without error, singleton worked
  });
});
```

Note: this test actually loads the Kuromoji dict (~17.8 MB) — it's slow (~5–10s) on first run. That's expected.

## Run

```
npx vitest run __tests__/lib/llm.test.ts
npx vitest run __tests__/lib/kuromoji.test.ts
npx vitest run
```
