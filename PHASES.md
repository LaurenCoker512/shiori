# 栞 (Shiori) — Implementation Phases

> Derived from SPEC.md. Each phase is independently shippable and verifiable.  
> Test stack: **Vitest** for unit/integration, **React Testing Library** for components, **Playwright** for E2E.

---

## Phase 1 — Project Scaffold ✅

**Deliverables:**
- `npx create-next-app@14` with App Router, TypeScript, Tailwind CSS
- `.env.local` template committed as `.env.local.example`
- Install all project dependencies up front: `pg`, `@anthropic-ai/sdk`, `remark`, `remark-stringify`, `strip-markdown`, `unist-util-visit`, `node-html-parser`, `recharts`, `lodash`, `@types/lodash`, `@types/pg`
- Vitest + React Testing Library + Playwright configured
- `vitest.config.ts`, `playwright.config.ts`
- `package.json` scripts: `test`, `test:e2e`, `dev`, `build`

**Tests:**
- Vitest smoke test: `expect(true).toBe(true)` — confirms test runner works
- Playwright smoke test: visit `http://localhost:3000`, assert page loads

**Acceptance:** `npm test` and `npm run test:e2e` both pass with green output.

---

## Phase 2 — Database Migration & Client ✅

**Deliverables:**
- `migrations/001_initial.sql` — full schema from §3.1
- `lib/db.ts` — `Pool` + `query<T>()` helper (§3.2)
- `npm run db:migrate` script (or manual instructions in README)

**Tests:**
- Unit: `lib/db.ts` exports a `query` function (shape test, no real connection needed)
- Integration (requires `TEST_DATABASE_URL`): run migration, assert all 5 tables exist, assert `UNIQUE` and `CHECK` constraints by inserting invalid rows
- Integration: verify `ON DELETE CASCADE` on `sentence_patterns` and `furigana_overrides`

**Acceptance:** Migration runs cleanly against a local or Railway test DB; constraint tests pass.

---

## Phase 3 — Shared Types & `parseTranslations` ✅

**Deliverables:**
- `lib/types.ts` — all types from §4: `WordStatus`, `JlptLevel`, `Token`, `Sentence`, `ParsedContent`, `Word`, `GrammarPattern`, `FuriganaOverride`, `parseTranslations()`

**Tests:**
- Unit `parseTranslations`:
  - Returns `[]` for `null`
  - Parses valid JSON array: `'["to read","to recite"]'` → `['to read', 'to recite']`
  - Falls back to semicolon split for non-JSON: `'to read; to recite'` → `['to read', 'to recite']`
  - Returns `[]` for empty string
  - Returns `[]` for malformed JSON that is also not semicolon-separated

**Acceptance:** All 5 `parseTranslations` cases pass.

---

## Phase 4 — Format Detection ✅

**Deliverables:**
- `lib/format-detection.ts` — `detectFormat()` from §5

**Tests:**
- Unit `detectFormat`:
  - `<p>text</p>` → `'html'`
  - `<br/>` → `'html'`
  - `<h1 class="title">` → `'html'`
  - Plain Japanese text → `'markdown'`
  - Markdown with `# Heading` → `'markdown'`
  - Markdown with `**bold**` → `'markdown'`
  - Mixed text with no recognized HTML tags → `'markdown'`

**Acceptance:** All 7 format detection cases pass.

---

## Phase 5 — Text Processing ✅

**Deliverables:**
- `lib/text-processing.ts`:
  - `processMarkdown(raw)` — remark pipeline with sentinel injection (§6.1)
  - `processHtml(raw)` — `node-html-parser` sanitizer (§6.2)
  - `parseHeadingSentinels(sentences)` — post-tokenization heading extractor (§6.1)

**Tests:**
- Unit `processMarkdown`:
  - Strips `**bold**` to plain text
  - Converts `# Heading` to `__HEADING_1__Heading`
  - Converts `## Sub` to `__HEADING_2__Sub`
  - Does not sentinel-ify non-heading lines
  - Preserves paragraph separation (`\n\n`)
- Unit `processHtml`:
  - Strips tags from `<p>text</p>` → `text`
  - Converts `<br>` to `\n`
  - Adds `\n\n` after block elements
  - Collapses 3+ newlines to `\n\n`
- Unit `parseHeadingSentinels`:
  - Sentence with `raw: '__HEADING_1__タイトル'` → `{ is_heading: true, heading_level: 1, raw: 'タイトル' }`
  - Non-heading sentence returned unchanged
  - Sentinel stripped from token `surface` and `dictionary_form`
  - `heading_level` matches depth (1–6)

**Acceptance:** All text processing tests pass; no JSDOM or browser APIs required.

---

## Phase 6 — Claude API Wrappers ✅

**Deliverables:**
- `lib/claude.ts` — all four wrappers from §7: `tokenizeText`, `analyzeGrammar`, `describeGrammarPattern`, `translateWord`

**Tests:**
- Unit (mock `@anthropic-ai/sdk`):
  - `tokenizeText`: mock returns valid JSON array → result typed as `ParsedContent`
  - `tokenizeText`: mock returns invalid JSON → throws `SyntaxError`
  - `analyzeGrammar`: mock returns `[]` → returns `[]`
  - `analyzeGrammar`: mock returns pattern array → returns typed array
  - `describeGrammarPattern`: mock returns text → returns trimmed string
  - `translateWord`: mock returns `{ translations, jlpt_level }` → returns `TranslationResult`

**Acceptance:** All 6 mock-based unit tests pass; no real API key needed.

---

## Phase 7 — Import API Route (`POST /api/texts`) ✅

**Deliverables:**
- `app/api/texts/route.ts` — POST handler from §8.1

**Tests:**
- Integration (real DB, mocked Claude):
  - Missing `title` → 400 `{ error }` response
  - Valid markdown body → text row inserted, words upserted, returns `{ id }`
  - Valid HTML body → processed via `processHtml`, same as above
  - `formatOverride: 'html'` on markdown input → uses HTML processor
  - Claude tokenizer throws → 500 `{ error: 'Tokenization failed' }`, nothing persisted
  - Duplicate word upsert (same `dictionary_form`+`reading`) → no duplicate, no error
- Unit: `detectFormat` is called when no `formatOverride` is provided

**Acceptance:** All 6 import route tests pass.

---

## Phase 8 — Text Reader & Management Routes ✅

**Deliverables:**
- `app/api/texts/[id]/route.ts` — GET, PATCH, DELETE handlers from §8.2 and §8.3

**Tests:**
- Integration:
  - GET existing text → returns `{ text, wordStatusMap, furiganaOverrides }`, updates `last_read_at`
  - GET non-existent text → 404
  - PATCH with new title → updates `texts.title`, returns `{ id, title }`
  - PATCH with empty title → 400
  - DELETE → removes text row, `sentence_patterns` cascade-deleted, `words` preserved
- Unit: `wordStatusMap` keyed by `dictionary_form+reading` for every returned word

**Acceptance:** All 6 reader route tests pass.

---

## Phase 9 — Re-parse Route ✅

**Deliverables:**
- `app/api/texts/[id]/reparse/route.ts` — POST handler from §8.4

**Tests:**
- Integration (mocked Claude):
  - Re-tokenizes raw content, updates `parsed_content`
  - Deletes all `sentence_patterns` for the text
  - Deletes `furigana_overrides` for surface forms no longer in new parsed content
  - Preserves `furigana_overrides` for surface forms still present
  - Upserts new content words into `words`
  - Returns `{ ok: true }`

**Acceptance:** All 5 re-parse tests pass.

---

## Phase 10 — Word Update & Browser Routes ✅

**Deliverables:**
- `app/api/words/[id]/route.ts` — PATCH handler from §8.7
- `app/api/words/route.ts` — GET handler from §8.9

**Tests:**
- Integration `PATCH /api/words/[id]`:
  - `unseen → seen`: sets `seen_at`, leaves `known_at` null
  - `seen → known`: sets `known_at`
  - `known → seen` (regression): clears `known_at`
  - `user_translation: null` clears the field
  - `user_translation: "custom"` sets the field
  - Returns updated `Word` row
- Integration `GET /api/words`:
  - No filters → returns first page of 50
  - `status=seen` filters correctly
  - `jlpt_level=N3` filters correctly
  - `search=食べ` matches `dictionary_form` and `reading` with ILIKE
  - Returns `{ words, total }` with correct `total`
  - `page=2&pageSize=10` returns correct offset

**Acceptance:** All 11 word route tests pass.

---

## Phase 11 — Translation Route ✅

**Deliverables:**
- `app/api/words/[id]/translation/route.ts` — GET handler from §8.6

**Tests:**
- Integration (mocked Claude):
  - Word with existing `translation` → returns immediately, no Claude call
  - Word with null `translation` → calls `translateWord`, persists result, returns `{ translations, jlpt_level }`
  - `contextSentence` query param passed to `translateWord`
  - Claude throws → returns `{ error: 'Translation unavailable' }`, nothing persisted

**Acceptance:** All 4 translation route tests pass.

---

## Phase 12 — Grammar Analysis Route ✅

**Deliverables:**
- `app/api/sentences/[textId]/[sentenceIndex]/grammar/route.ts` — GET handler from §8.5

**Tests:**
- Integration (mocked Claude):
  - Existing `sentence_patterns` rows → returns cached patterns, no Claude call
  - NULL sentinel row exists → returns `[]`, no Claude call
  - No prior rows → calls `analyzeGrammar`, creates new `grammar_patterns` rows with descriptions, inserts `sentence_patterns`, returns patterns
  - Pattern already exists in `grammar_patterns` → skips `describeGrammarPattern`, reuses row
  - `analyzeGrammar` returns `[]` → inserts NULL sentinel row, returns `[]`
  - Claude throws → returns `{ patterns: [], error: 'Grammar analysis unavailable' }`, nothing persisted

**Acceptance:** All 6 grammar route tests pass.

---

## Phase 13 — Furigana & Dashboard Routes ✅

**Deliverables:**
- `app/api/furigana-overrides/route.ts` — POST handler from §8.8
- `app/api/dashboard/route.ts` — GET handler from §8.10
- `app/api/grammar-patterns/[id]/sentences/route.ts` — GET handler from §8.11

**Tests:**
- Integration `POST /api/furigana-overrides`:
  - Upserts correctly; duplicate upsert does not create second row
  - Returns `{ ok: true }`
- Integration `GET /api/dashboard`:
  - Returns `seenSeries` and `knownSeries` as separate arrays
  - `seenSeries` entries only use `seen_at` dates
  - `knownSeries` entries only use `known_at` dates
  - `comprehension` array includes `pct_known`
  - `grammarPatterns` includes `sentence_count`
- Integration `GET /api/grammar-patterns/[id]/sentences`:
  - Returns sentences for a known pattern, grouped-sortable by `title` and `sentence_index`
  - Excludes NULL sentinel rows (where `grammar_pattern_id IS NULL`)

**Acceptance:** All 8 route tests pass.

---

## Phase 14 — Import Page ✅

**Deliverables:**
- `components/import/ImportForm.tsx` — §9.1
- `components/ui/Spinner.tsx`
- `app/import/page.tsx`

**Tests:**
- Component `ImportForm` (RTL):
  - Submit button disabled when title is empty
  - Submit button enabled when title and content are filled
  - Format label updates as user types (auto-detect reflects input)
  - Long text warning appears when cleaned text > 30,000 characters
  - Long text warning does not block submission
  - Shows `<Spinner>` while request is in flight (mock `fetch`)
  - On success: calls `router.push('/texts/[id]')` (mock Next router)
  - On error: shows inline error message, form remains editable
- E2E:
  - Visit `/import`, fill form with short Japanese text, submit, assert redirect to `/texts/[id]`

**Acceptance:** All 8 component tests and 1 E2E test pass.

---

## Phase 15 — Reader Skeleton ✅

**Deliverables:**
- `app/texts/[id]/page.tsx` — fetches via `GET /api/texts/[id]`, passes to `ReaderContent`
- `components/reader/ReaderHeader.tsx` — title, back link, overflow menu stub
- `components/reader/ReaderContent.tsx` — §9.2 furigana toggle with localStorage
- `components/reader/SentenceBlock.tsx` — §9.3 heading vs. body rendering
- `components/reader/WordToken.tsx` — §9.4 ruby + furigana visibility logic
- `components/ui/OverflowMenu.tsx`

**Tests:**
- Component `ReaderContent` (RTL):
  - Reads `shiori-furigana` from `localStorage` on mount
  - Toggle button writes to `localStorage` on click
  - Defaults to `true` when no localStorage key set
- Component `SentenceBlock` (RTL):
  - `is_heading: true, heading_level: 2` → renders `<h2>`
  - Non-heading sentence → renders `<p>`
  - Heading sentence has no grammar trigger
- Component `WordToken` (RTL):
  - Non-content word → plain `<span>`, no `<ruby>`
  - Content word → `<ruby>` with `aria-label` on element
  - `<rt>` has `aria-hidden="true"`
  - `known` word + `showFurigana: false` → `<rt>` hidden (via CSS class)
  - `unseen` word + `showFurigana: false` → `<rt>` visible
  - `known` word + `showFurigana: true` → `<rt>` visible (toggle override)
  - Furigana override applied when provided
- E2E:
  - Visit `/texts/[id]`, assert ruby tokens render, assert heading sentence renders as `<h2>` (or correct level)

**Acceptance:** All 10 component tests and 1 E2E test pass.

---

## Phase 16 — Word Popover & Status Toggling ✅

**Deliverables:**
- `components/reader/WordPopover.tsx` — §9.5
- Status update wired into `WordToken` click handler
- Optimistic UI update in `ReaderContent` word state map

**Tests:**
- Component `WordPopover` (RTL):
  - `unseen` word: shows translation (or spinner), no "Mark as known" button
  - `seen` word: shows "Mark as known" button and "Close" button
  - `known` word: shows translation, no "Mark as known" button
  - `user_translation` set → shown primary with pencil icon (`aria-label="Custom translation"`)
  - No `user_translation` → shows `parseTranslations` output
  - `aria-live="polite"` region present while loading
  - "Mark as known" → calls `PATCH /api/words/[id]`, updates local state (mock fetch)
  - Escape key closes popover
  - Click outside closes popover
- Component `WordToken` + `WordPopover` integration (RTL):
  - Click on `unseen` word → triggers translation fetch and advances status to `seen`
  - On API error → reverts status optimistically
- E2E:
  - Click word in reader, assert popover appears with translation text

**Acceptance:** All 10 component tests and 1 E2E test pass.

---

## Phase 17 — Grammar Tooltip ✅

**Deliverables:**
- `components/reader/GrammarTooltip.tsx` — §9.7
- Hover/tap trigger logic in `SentenceBlock` (§9.3 pointer event logic)

**Tests:**
- Component `GrammarTooltip` (RTL):
  - Shows `<Spinner>` while in flight
  - On success: renders pattern name (bold), JLPT badge, `description_en`
  - On error: shows "Grammar analysis unavailable"
  - Empty result (`[]`) renders nothing / empty state
- Component `SentenceBlock` trigger (RTL):
  - Pointer on sentence container triggers grammar analysis
  - Pointer on a `[data-word]` child does NOT trigger grammar analysis
  - Heading sentences have no grammar trigger at all
- E2E:
  - Hover over a non-heading sentence, assert grammar tooltip appears with at least one pattern (or empty state message)

**Acceptance:** All 6 component tests and 1 E2E test pass.

---

## Phase 18 — Furigana Edit ✅

**Deliverables:**
- `components/reader/FuriganaEdit.tsx` — §9.6
- `components/ui/ConfirmDialog.tsx`

**Tests:**
- Component `FuriganaEdit` (RTL):
  - Pre-filled with current reading
  - On save: calls `POST /api/furigana-overrides` with correct payload (mock fetch)
  - On save: updates local override map in parent
  - On cancel: no API call made
  - Input accessible by `aria-label`
- E2E:
  - Click furigana edit trigger on a word, enter new reading, save, assert updated reading displayed

**Acceptance:** All 4 component tests and 1 E2E test pass.

---

## Phase 19 — Dashboard ✅

**Deliverables:**
- `app/page.tsx` — dashboard route
- `components/dashboard/VocabularyChart.tsx` — §9.8 (recharts two-series line chart)
- `components/dashboard/ComprehensionList.tsx`
- `components/dashboard/WordBrowser.tsx` — §9.9 (filter, search, paginate, inline edit)
- `components/dashboard/GrammarPatternLog.tsx` — §9.10 (expandable rows, drill-down)

**Tests:**
- Component `VocabularyChart` (RTL):
  - Renders both "seen" and "known" series
  - Cumulative sum computed correctly: `[{date:'2024-01-01', count:3}, {date:'2024-01-02', count:2}]` → cumulative `[3, 5]`
- Component `WordBrowser` (RTL):
  - Search input debounced 300ms before fetch (fake timers)
  - Status dropdown change triggers refetch with updated `status` param
  - JLPT dropdown change triggers refetch
  - Pagination buttons disabled at first/last page
  - Inline pencil click reveals `user_translation` input; blur saves via `PATCH`
  - `user_translation` shown primary when set; Claude gloss shown below in muted text
- Component `GrammarPatternLog` (RTL):
  - Clicking row expands and fetches `GET /api/grammar-patterns/[id]/sentences`
  - Expanded content renders sentences grouped by title
  - Second click collapses row
- E2E:
  - Visit `/`, assert chart renders, comprehension list shows at least one entry after importing text, word browser shows words with correct statuses

**Acceptance:** All 9 component tests and 1 E2E test pass.

---

## Phase 20 — Reader Header: Rename & Delete ✅

**Deliverables:**
- Rename flow in `ReaderHeader.tsx`: inline edit → `PATCH /api/texts/[id]` → update title in UI
- Delete flow: `ConfirmDialog` → `DELETE /api/texts/[id]` → redirect to `/`
- `OverflowMenu.tsx` wired with Rename and Delete actions

**Tests:**
- Component `ReaderHeader` (RTL):
  - Clicking rename opens inline input pre-filled with current title
  - Submit with new title calls `PATCH /api/texts/[id]`
  - Submit with empty title shows validation error, no API call
  - Clicking delete opens `ConfirmDialog`
  - Confirming delete calls `DELETE /api/texts/[id]` and redirects to `/`
  - Cancelling delete makes no API call
- E2E:
  - Rename a text in the reader, assert updated title persists after page reload
  - Delete a text, assert redirect to `/` and text no longer appears in comprehension list

**Acceptance:** All 6 component tests and 2 E2E tests pass.

---

## Phase 21 — Accessibility Audit ✅

**Deliverables:**
- Axe accessibility scans on all pages
- Fix any violations found during scan

**Tests:**
- Playwright + `@axe-core/playwright` automated scan:
  - `/` (dashboard) — zero critical/serious violations
  - `/import` — zero critical/serious violations
  - `/texts/[id]` (reader) — zero critical/serious violations
- Manual checklist verification (documented in PR description):
  - All icon-only buttons have `aria-label`
  - All `<ruby>` elements have `aria-label` on the element and `aria-hidden="true"` on `<rt>`
  - Popover/dialog keyboard navigation (Enter, Space, Escape) works
  - `aria-live="polite"` region announces translation and status changes
  - No positive `tabindex` values
  - Touch targets ≥ 44×44px on reader tokens and dashboard controls

**Acceptance:** Zero axe critical/serious violations on all 3 pages.

---

## Phase 22 — Responsive Layout Polish

**Deliverables:**
- Final responsive pass: dashboard two-column grid on `md+`, reader `max-w-3xl mx-auto`
- Minimum touch target enforcement (`min-h-11 min-w-11`) on all interactive elements
- Cross-breakpoint visual review

**Tests:**
- Playwright viewport tests:
  - Dashboard at `375×812` (mobile) → single column
  - Dashboard at `1024×768` (desktop) → two-column grid
  - Reader at `375×812` → `max-w-3xl` class present on content wrapper
  - Touch targets: all `button` and `[role="button"]` elements on reader page have `offsetWidth >= 44` and `offsetHeight >= 44`

**Acceptance:** All 4 responsive tests pass; no layout regressions on existing tests.

---

## Summary Table

| Phase | Area | Key Deliverable | Test Types |
|---|---|---|---|
| 1 | Scaffold | Next.js + Vitest + Playwright setup | Smoke |
| 2 | Database | Migration + `lib/db.ts` | Integration |
| 3 | Types | `lib/types.ts` + `parseTranslations` | Unit |
| 4 | Format Detection | `detectFormat` | Unit |
| 5 | Text Processing | `processMarkdown`, `processHtml`, `parseHeadingSentinels` | Unit |
| 6 | Claude Wrappers | `tokenizeText`, `analyzeGrammar`, `describeGrammarPattern`, `translateWord` | Unit (mocked) |
| 7 | Import Route | `POST /api/texts` | Integration |
| 8 | Text Routes | GET, PATCH, DELETE `/api/texts/[id]` | Integration |
| 9 | Re-parse Route | `POST /api/texts/[id]/reparse` | Integration |
| 10 | Word Routes | PATCH + GET `/api/words` | Integration |
| 11 | Translation Route | `GET /api/words/[id]/translation` | Integration |
| 12 | Grammar Route | `GET /api/sentences/.../grammar` | Integration |
| 13 | Furigana + Dashboard Routes | 3 remaining routes | Integration |
| 14 | Import Page | `ImportForm` + `/import` | Component + E2E |
| 15 | Reader Skeleton | `ReaderContent`, `SentenceBlock`, `WordToken` | Component + E2E |
| 16 | Word Popover | `WordPopover` + status toggling | Component + E2E |
| 17 | Grammar Tooltip | `GrammarTooltip` + trigger | Component + E2E |
| 18 | Furigana Edit | `FuriganaEdit` + `ConfirmDialog` | Component + E2E |
| 19 | Dashboard | Chart, WordBrowser, GrammarLog | Component + E2E |
| 20 | Rename & Delete | `ReaderHeader` flows | Component + E2E |
| 21 | Accessibility | Axe scans + checklist | Automated + Manual |
| 22 | Responsive | Viewport + touch target tests | Playwright |
