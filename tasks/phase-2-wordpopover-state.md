# Phase 2 — WordPopover State Redesign

**Sprint:** 1 of 5  
**Prerequisite:** Phase 1 complete (`lib/jmdict.ts` and types exist)  
**Goal:** Replace the current `translationLoading` / `loadedTranslations` state pair in `WordPopover.tsx` with a discriminated union. Wire in `lookupWord()` as the primary lookup and retain the LLM API route as fallback. Update all related tests.

---

## Read first

- `components/reader/WordPopover.tsx` — full file
- `__tests__/components/WordPopover.test.tsx` — full file (note line 98: the loading test to update)
- `__tests__/components/WordPopoverIntegration.test.tsx` — skim for anything that mocks `fetch` for translation

---

## 1. Modify `components/reader/WordPopover.tsx`

### Replace state

Remove `translationLoading` and `loadedTranslations`. Add:

```ts
type TranslationState =
  | { kind: 'loading' }
  | { kind: 'jmdict'; entry: JMdictEntry }
  | { kind: 'llm'; translations: string[] }
  | { kind: 'no-api-key' }
  | { kind: 'error' };

const [translationState, setTranslationState] = useState<TranslationState | null>(null);
```

`null` = no lookup needed (cached `word.translation` or `word.user_translation` already present).

### Replace the translation `useEffect`

```ts
useEffect(() => {
  if (word.translation !== null || word.user_translation !== null) return;

  setTranslationState({ kind: 'loading' });

  let cancelled = false;
  (async () => {
    const entry = await lookupWord(word.dictionary_form, word.reading);
    if (cancelled) return;

    if (entry) {
      setTranslationState({ kind: 'jmdict', entry });
      return;
    }

    // LLM fallback
    const res = await fetch(`/api/words/${word.id}/translation`);
    if (cancelled) return;

    if (res.status === 403) {
      setTranslationState({ kind: 'no-api-key' });
      return;
    }
    if (!res.ok) {
      setTranslationState({ kind: 'error' });
      return;
    }
    const data = await res.json();
    setTranslationState({ kind: 'llm', translations: data.translations });
  })();

  return () => { cancelled = true; };
}, [word.id, word.dictionary_form, word.reading, word.translation, word.user_translation]);
```

### Update render logic

Replace the existing translation display section with a switch on `translationState`:

```tsx
{translationState?.kind === 'loading' && (
  <div aria-live="polite"><Spinner /></div>
)}

{translationState?.kind === 'jmdict' && (
  <JMdictDisplay entry={translationState.entry} />
)}

{translationState?.kind === 'llm' && (
  <p>{translationState.translations.join(' / ')}</p>
)}

{translationState?.kind === 'no-api-key' && (
  <p>Add an OpenRouter key in Settings to look up proper nouns and rare words.</p>
)}

{translationState?.kind === 'error' && (
  <p>No translation available.</p>
)}
```

### Add `JMdictDisplay` component (same file or extract)

```tsx
function JMdictDisplay({ entry }: { entry: JMdictEntry }) {
  const hasMultiplePos = new Set(entry.senses.flatMap((s) => s.pos)).size > 1;

  return (
    <div>
      {entry.senses.map((sense, i) => (
        <div key={i}>
          {hasMultiplePos && sense.pos.length > 0 && (
            <span className="text-xs text-muted-foreground">{sense.pos.join(', ')}</span>
          )}
          <p>{sense.glosses.join('; ')}</p>
          {sense.info && <span className="text-xs text-muted-foreground">{sense.info}</span>}
        </div>
      ))}
    </div>
  );
}
```

---

## 2. Update `__tests__/components/WordPopover.test.tsx`

### Fix the loading test (line ~98)

Current test mocks `fetch` to hang. After this change, loading is triggered by `lookupWord`. Replace:

```ts
// OLD
it('aria-live="polite" region present while loading', () => {
  vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
  ...
});
```

With:

```ts
// NEW
vi.mock('@/lib/jmdict', () => ({
  lookupWord: vi.fn(),
}));

import { lookupWord } from '@/lib/jmdict';

it('aria-live="polite" region present while loading', () => {
  vi.mocked(lookupWord).mockReturnValue(new Promise(() => {}));
  const { container } = render(
    <WordPopover
      word={makeWord({ translation: null, user_translation: null })}
      anchorRect={mockAnchorRect}
      onClose={vi.fn()}
      onStatusUpdate={vi.fn()}
    />,
  );
  expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
});
```

### Add new tests (append to the describe block)

```ts
it('JMdict hit with single POS → flat gloss list', async () => {
  vi.mocked(lookupWord).mockResolvedValue({
    id: 1,
    jlpt_level: 'N5',
    senses: [{ pos: ['n'], glosses: ['cat', 'feline'], info: undefined }],
  });
  render(
    <WordPopover
      word={makeWord({ translation: null, user_translation: null })}
      anchorRect={mockAnchorRect}
      onClose={vi.fn()}
      onStatusUpdate={vi.fn()}
    />,
  );
  await waitFor(() => expect(screen.getByText('cat; feline')).toBeInTheDocument());
  expect(screen.queryByText('n')).not.toBeInTheDocument(); // no POS label for single POS
});

it('JMdict hit with multiple POS → labeled sections', async () => {
  vi.mocked(lookupWord).mockResolvedValue({
    id: 2,
    jlpt_level: null,
    senses: [
      { pos: ['n'], glosses: ['upper', 'top'] },
      { pos: ['v1'], glosses: ['to go up'] },
    ],
  });
  render(
    <WordPopover
      word={makeWord({ translation: null, user_translation: null })}
      anchorRect={mockAnchorRect}
      onClose={vi.fn()}
      onStatusUpdate={vi.fn()}
    />,
  );
  await waitFor(() => expect(screen.getByText('n')).toBeInTheDocument());
  expect(screen.getByText('v1')).toBeInTheDocument();
});

it('JMdict miss → fetch called on LLM route; translations rendered', async () => {
  vi.mocked(lookupWord).mockResolvedValue(null);
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ translations: ['cat'] }), { status: 200 }),
  );
  render(
    <WordPopover
      word={makeWord({ translation: null, user_translation: null })}
      anchorRect={mockAnchorRect}
      onClose={vi.fn()}
      onStatusUpdate={vi.fn()}
    />,
  );
  await waitFor(() => expect(screen.getByText('cat')).toBeInTheDocument());
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/words/'));
});

it('LLM route returns 403 → no-api-key message shown', async () => {
  vi.mocked(lookupWord).mockResolvedValue(null);
  vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 403 }));
  render(
    <WordPopover
      word={makeWord({ translation: null, user_translation: null })}
      anchorRect={mockAnchorRect}
      onClose={vi.fn()}
      onStatusUpdate={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(screen.getByText(/Add an OpenRouter key/)).toBeInTheDocument(),
  );
});
```

## Run

```
npx vitest run __tests__/components/WordPopover.test.tsx
npx vitest run __tests__/components/WordPopoverIntegration.test.tsx
```

Then the full suite:

```
npx vitest run
```
