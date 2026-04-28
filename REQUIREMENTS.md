# 栞 (Shiori) — Japanese Immersion Reader
## Requirements Document

> **Status:** Planning  
> **Stack:** Next.js (App Router) · React · Tailwind · PostgreSQL (Railway) · Claude API  
> **Scope:** Single-user, personal tool

---

## 1. Overview

Shiori is a personal Japanese reading and vocabulary tracking app designed for immersion-based learning. The user imports Japanese fanfiction and AI-generated essays, reads them with optional furigana and grammar guidance, and tracks vocabulary growth over time. Learning is positive and non-prescriptive — no streaks, no mandatory review, just visible progress.

---

## 2. Core Principles

- **Immersion-first:** All content is user-supplied (no generic practice texts).
- **Correct tokenization:** Japanese words are parsed properly so one word = one known word, not many.
- **Three-state vocabulary:** Words are `unseen`, `seen`, or `known`. Vocabulary state is global — marking a word in one text propagates to all texts.
- **Positive motivation:** Metrics show growth and accumulation, never failure or regression.
- **Lazy AI calls:** Claude API is only called when needed and all results are persisted to avoid redundant calls.
- **Single-user:** No auth required initially. A single hardcoded `user_id = 1` is acceptable to start; NextAuth can be added later.

---

## 3. Routes

| Route | Purpose |
|---|---|
| `/` | Dashboard — stats, per-text comprehension list, navigation to reader |
| `/import` | Import form — paste content, provide title, submit for processing |
| `/texts/[id]` | Reader — renders a single text with furigana, word interaction, grammar hover |

---

## 4. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Frontend | React, Tailwind CSS |
| Backend | Next.js API routes |
| Database | PostgreSQL on Railway |
| AI | Claude API (sonnet-class model) |
| Japanese NLP | Claude (no Kuromoji or separate NLP library needed) |
| Markdown parsing | `remark` |
| Rich text / HTML paste | `DOMParser` + sanitization |

---

## 5. Database Schema

```sql
-- Words: every unique dictionary-form word the user has ever encountered
words (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL DEFAULT 1,
  dictionary_form     TEXT NOT NULL,        -- e.g. 食べる
  reading             TEXT NOT NULL,        -- e.g. たべる (default furigana)
  status              TEXT NOT NULL         -- 'unseen' | 'seen' | 'known'
                      DEFAULT 'unseen',
  translation         TEXT,                 -- cached English gloss (from Claude)
  user_translation    TEXT,                 -- user-provided override (shown in place of translation when set)
  jlpt_level          TEXT,                 -- 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | NULL (populated alongside translation)
  seen_at             TIMESTAMPTZ,          -- set once on first click; never overwritten
  known_at            TIMESTAMPTZ,          -- set when status reaches 'known'; cleared on manual regression
  UNIQUE (user_id, dictionary_form, reading) -- reading included to distinguish homographs (e.g. 上(うえ) vs 上(かみ))
)

-- Texts: imported documents
texts (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL DEFAULT 1,
  title               TEXT NOT NULL,
  raw_content         TEXT NOT NULL,        -- original paste (markdown or rich text)
  parsed_content      JSONB,               -- Claude's tokenized JSON (see §6.1)
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  last_read_at        TIMESTAMPTZ           -- updated when the reader is opened (/texts/[id] is loaded)
)

-- Furigana overrides: user corrections to Claude's readings
furigana_overrides (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL DEFAULT 1,
  word_id             INTEGER REFERENCES words(id) ON DELETE CASCADE,
  surface_form        TEXT NOT NULL,        -- exact surface form in text, e.g. 食べて
  corrected_reading   TEXT NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, word_id, surface_form)
)

-- Grammar patterns: unique patterns encountered across all texts
grammar_patterns (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL DEFAULT 1,
  pattern             TEXT NOT NULL,        -- e.g. 〜ている
  description_en      TEXT NOT NULL,
  jlpt_level          TEXT,                 -- 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | NULL
  first_encountered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, pattern)
)

-- Sentence patterns: join between sentences and grammar patterns
sentence_patterns (
  id                  SERIAL PRIMARY KEY,
  text_id             INTEGER REFERENCES texts(id) ON DELETE CASCADE,
  sentence_index      INTEGER NOT NULL,
  grammar_pattern_id  INTEGER REFERENCES grammar_patterns(id),
  UNIQUE (text_id, sentence_index, grammar_pattern_id)
)
```

---

## 6. Text Import

### 6.1 Accepted Input Formats

- **Markdown** (e.g. AI-generated essays exported as `.md` or pasted directly)
- **Rich text / HTML** (e.g. copy-pasted from a browser or document)

Both are accepted in the same paste/import textarea. The app auto-detects the format: content is treated as HTML if it contains a `<` followed by a known block or inline tag name (`p`, `div`, `span`, `br`, `h1`–`h6`, `ul`, `ol`, `li`, `a`, `strong`, `em`); otherwise it is treated as markdown/plain text. A **format override toggle** on the import form allows the user to override the detected format if auto-detection is wrong.

### 6.2 Import Processing

1. User pastes content and provides a title. The title field is required — the submit button is disabled until it is non-empty. Duplicate titles are allowed; each text has its own `id`.
2. App detects format:
   - Markdown → parse with `remark`, preserve paragraph and heading structure, strip to plain text.
   - Rich text / HTML → sanitize with `DOMParser`, extract text nodes, preserve paragraph breaks.
3. If the cleaned text exceeds ~30,000 characters, a soft warning is shown ("This text is long and may take a moment to process") but import is not blocked.
4. The import page shows a blocking spinner while Claude tokenizes. On completion, the user is redirected to `/texts/[id]`.
5. Cleaned plain text (with paragraph breaks intact) is sent to Claude for tokenization (see §7.1).
6. Both `raw_content` (original paste) and `parsed_content` (Claude's JSON) are persisted to the `texts` table.
7. Parsed content is never re-generated unless the user explicitly requests a re-parse via the reader "..." menu.

---

## 7. Claude API Usage

All Claude calls are lazy (on-demand) and their results are persisted. No call is ever made twice for the same input.

### 7.1 Parse & Tokenize (on import, once per text)

**When:** Triggered on text import.  
**Persisted to:** `texts.parsed_content` (JSONB).

**Prompt goal:** Return a structured JSON array of sentences, each containing an array of tokens.

**Expected output shape:**

```json
[
  {
    "sentence_index": 0,
    "raw": "彼女は静かに本を読んでいた。",
    "tokens": [
      {
        "surface": "彼女",
        "dictionary_form": "彼女",
        "reading": "かのじょ",
        "pos": "noun",
        "is_content_word": true
      },
      {
        "surface": "は",
        "dictionary_form": "は",
        "reading": "は",
        "pos": "particle",
        "is_content_word": false
      },
      {
        "surface": "読んでいた",
        "dictionary_form": "読む",
        "reading": "よんでいた",
        "pos": "verb",
        "is_content_word": true
      }
    ]
  }
]
```

**Notes:**
- `is_content_word: false` for particles, punctuation, and grammatical function words — these are not tracked in the `words` table and have no click behavior.
- Each unique `dictionary_form` that is a content word is upserted into the `words` table on import (status defaults to `unseen` if new).

### 7.2 Grammar Analysis (per sentence, on first hover)

**When:** Triggered when the user first hovers or taps a sentence.  
**Persisted to:** `grammar_patterns` + `sentence_patterns` tables.

**Prompt goal:** Given the raw sentence text, identify grammar patterns worth explaining to a Japanese learner — conjugations, grammatical constructions, and set phrases. Skip trivially common structures (e.g. plain present-tense verb stems). Return only the pattern name and JLPT level from Claude; the explanation is either generated in a separate lazy call per pattern or sourced externally (see token optimization note below). Return an empty array if no notable patterns are found.

**Expected output shape (from Claude):**

```json
[
  {
    "pattern": "〜ていた",
    "jlpt_level": "N4"
  }
]
```

**`grammar_patterns` row shape (persisted):**

```json
{
  "pattern": "〜ていた",
  "description_en": "Past progressive — describes an action that was ongoing in the past.",
  "jlpt_level": "N4"
}
```

**Notes:**
- Results are cached per sentence. Subsequent hovers on the same sentence read from the DB.
- If no notable grammar patterns are found, an empty array is returned (and cached so no future call is made).
- **Token optimization:** Claude returns only the pattern name and JLPT level — the minimal data needed to identify the pattern. `description_en` is populated lazily: either via a dedicated follow-up Claude call the first time the pattern is encountered (fetched once, cached permanently to `grammar_patterns.description_en`), or by linking to an external grammar reference (e.g. Bunpro, jlpt.ninja). Implementation strategy is TBD, but the Claude per-sentence call should remain lightweight.

### 7.3 Word Translation (per word, on first click)

**When:** Triggered on the first click of any content word.  
**Persisted to:** `words.translation`.

**Prompt goal:** Given the `dictionary_form` and the surrounding sentence for context, return all common English glosses for the word (short, 1–5 words each) and a JLPT level estimate. Include multiple meanings if the word is genuinely polysemous — prefer over-inclusion to a single potentially wrong gloss. The surrounding sentence should guide ordering (most contextually relevant meaning first) but should not suppress other common meanings.

**Expected output shape:**

```json
{
  "translations": ["to read", "to recite", "to predict"],
  "jlpt_level": "N5"
}
```

**Notes:**
- Once `words.translation` is populated, no further Claude call is made for that word.
- The surrounding sentence is included in the prompt for context (e.g. 上 meaning "above" vs "elder"), but all common meanings are returned regardless.
- `words.translation` stores the full translations array (as a JSON array or semicolon-delimited string — TBD at implementation).
- `jlpt_level` is persisted to `words.jlpt_level` alongside `translation`. May be `null` if the word has no standard JLPT classification.

---

## 8. Error Handling

### 8.1 Import failure (Claude tokenization)
If the Claude call fails during import, show an error message on the import page. The text is not saved. The user may correct and resubmit.

### 8.2 Grammar hover failure
Show a small "Grammar analysis unavailable" message in the tooltip. Nothing is cached, so the next hover automatically retries.

### 8.3 Word translation failure
Show "Translation unavailable" in the word popover. Nothing is cached, so the next click automatically retries.

---

## 9. Reader UX

### 9.1 Reader Header

The reader has a persistent header containing:
- Text title
- A global **furigana toggle** (show/hide all furigana, overriding per-word status rules; persisted to `localStorage`, restored on page load)
- A **"..." overflow menu** containing: Rename, Re-parse, Delete (with confirmation dialog)

**Re-parse behavior:** Triggers a new Claude tokenization call. On completion, replaces `parsed_content`, purges all `sentence_patterns` rows for this text (grammar caches are stale after re-parse), and purges orphaned `furigana_overrides` (surface forms that no longer exist in the new parse).

**Delete behavior:** Removes the `texts` row and all associated `parsed_content`, `sentence_patterns`, and `furigana_overrides` for that text. Words in the `words` table and rows in `grammar_patterns` are never deleted — they represent global immersion history independent of any single text.

### 9.2 Word Rendering

Words are rendered using HTML `<ruby>` tags for furigana:

```html
<ruby>彼女<rt>かのじょ</rt></ruby>
```

Furigana display and click behavior depends on word status:

| Status | Furigana | Underline color | Click behavior |
|---|---|---|---|
| `unseen` | Always shown | Soft blue | Show translation popover; mark as `seen` |
| `seen` | Always shown | Soft amber | Show translation popover with **"Mark as known"** and **"Close"** buttons |
| `known` | Hidden by default | None | Show translation popover (no status change) |

- Function words (particles, punctuation) are rendered as plain text with no interactivity.
- Clicking a word triggers a translation fetch if `words.translation` is null, then displays it in a popover.
- For `seen` words, the popover contains the translation plus two explicit actions: **"Mark as known"** (promotes to `known`, closes popover) and **"Close"** (dismisses without changing status). Status is never changed automatically on click for `seen` words.
- For `unseen` and `known` words, the popover is dismissed by clicking outside it or pressing Escape.
- **Translation display priority:** Show `user_translation` if set; fall back to `translation`. A small pencil icon in the popover indicates a user-edited translation is active.

### 9.3 Furigana Corrections

- On hover of any furigana (`<rt>` element), a small edit icon appears. On touch devices, the edit icon is always visible on furigana.
- Clicking or tapping it opens an inline input pre-filled with the current reading.
- On save, the correction is written to `furigana_overrides` and immediately reflected in the UI.
- Overrides apply per `(word_id, surface_form)` pair — a correction for 読んでいた does not affect 読む in isolation.

### 9.4 Grammar Hover

- Hovering or tapping anywhere on a sentence triggers the grammar analysis call (if not yet cached).
- Results appear in a tooltip or slide-up panel listing each detected pattern with its explanation and JLPT level.
- A loading indicator is shown while the Claude call is in flight.
- **Touch equivalent (tablet):** On touch devices, a tap on sentence whitespace or punctuation (outside a word element) triggers grammar analysis. Tap elsewhere or tap a word to dismiss.

### 9.5 Accessibility & Touch

- Use semantic HTML throughout: `<button>` for interactive elements, `<nav>`, `<main>`, `<ruby>` for furigana.
- All icon-only buttons (furigana edit, overflow menu) must have an `aria-label`.
- Popovers and tooltips must be keyboard-accessible (openable and dismissible via keyboard).
- Focus order must follow reading order; no focus traps outside of modals/dialogs.
- Color contrast must meet WCAG 2.1 AA ratios for all text and interactive elements.
- `<ruby>` / `<rt>` furigana: include `aria-label` on the parent element with the full reading to avoid screen readers double-announcing kanji + furigana separately.
- Status changes (word promoted, translation loaded) should be announced via `aria-live` regions where appropriate.
- **Tablet layout (≥768px):** The reader and dashboard are responsive and usable on tablet browsers. Hover-only interactions have touch equivalents (see §9.3 for furigana edit, §9.4 for grammar trigger).

### 9.6 Text Rendering & Formatting

- Paragraph breaks from the original content are preserved.
- Markdown headings are rendered as visual separators or styled headings (not stripped).
- No other rich formatting is required in the reader view.

---

## 10. Vocabulary State Management

- Word status (`unseen` → `seen` → `known`) is **global** — set once, applies everywhere.
- Status changes are written to the `words` table immediately on click.
- All rendered texts reflect the current global status on load (no stale state).
- Transition rules:
  - `unseen` → `seen`: first click on an unseen word. Sets `seen_at`. Automatic — no confirmation.
  - `seen` → `known`: user clicks "Mark as known" in the translation popover. Sets `known_at`. Never automatic.
  - `known` → (no automatic change): clicking a known word only reveals furigana/translation without changing status. Status changes for known words are handled via the Word Browser (see §11.3).
- Manual regression (e.g. `known` → `seen` via the Word Browser) clears `known_at`.

---

## 11. Dashboard

The dashboard is the home page (`/`). It contains an "Import new text" button and four sections:

### 11.1 Vocabulary Growth Chart

- Line chart with two series: **Known words** and **Seen words**, both cumulative over time.
- X-axis: date. Y-axis: word count.
- Powered by `seen_at` and `known_at` columns on the `words` table.
- Emphasis is on the upward trend — no targets, no goal lines, just visible growth.

### 11.2 Per-Text Comprehension

- For each imported text, show the percentage of content-word tokens that are `known`.
- Displayed as a list or bar chart, sorted by most recently read.
- Each row is a clickable link to `/texts/[id]`.
- This gives a satisfying view of texts becoming more comprehensible over time.

### 11.3 Word Browser

- Paginated, searchable, filterable table of all words in the `words` table.
- Columns: kanji form, reading, status, translation, first seen date.
- Filters: status (`unseen` / `seen` / `known`), JLPT level (`N5` / `N4` / `N3` / `N2` / `N1`).
- Search: by kanji or kana.
- Inline status editing: user can manually change a word's status from the browser.
- **Translation display:** If `user_translation` is set, show it as the primary translation with the Claude-generated `translation` greyed out below it for reference. If only `translation` is set, show it alone. The `user_translation` field is always editable inline — users can set, update, or clear it at any time.

### 11.4 Grammar Pattern Log

- List of all unique grammar patterns encountered across all texts.
- Columns: pattern, explanation, JLPT level, first encountered date, count of sentences it appears in.
- Sorted by first encountered (chronological immersion order, not JLPT order).
- Clicking a pattern shows all sentences across all texts where it was detected.

---

## 12. Build Order (Suggested)

1. **DB setup** — Railway PostgreSQL, schema migration SQL, connection via environment variable.
2. **Import flow** — paste UI → format detection → Claude tokenization → persist to DB.
3. **Reader view** — render `parsed_content` as ruby-annotated tokens, color by word status.
4. **Word state toggling** — click to advance status, sync to DB, reflect globally.
5. **Word translation** — lazy Claude call on first click, cached to `words.translation`.
6. **Grammar hover** — lazy Claude call per sentence on first hover, cached to `sentence_patterns`.
7. **Furigana correction** — inline edit UI, persist to `furigana_overrides`, apply on render.
8. **Dashboard** — vocabulary growth chart, per-text comprehension, word browser, grammar log.

---

## 13. Out of Scope (for now)

- Spaced repetition / flashcard review
- Multi-user support / authentication
- Mobile app (phone-sized screens; tablet browser is in scope)
- Audio / pronunciation playback
- Automatic content fetching (e.g. AO3 scraping)
- Offline support

---

## 14. Open Questions

- [x] Should `unseen` words (never clicked) be included in the word browser, or only `seen` and `known`?  
  **Decision:** Include all three statuses. The word browser serves as a preview of vocabulary across all imported texts, and filtering by `unseen` is useful for seeing what's ahead. The status filter handles hiding them when not wanted.

- [x] Should re-parsing a text (e.g. after a Claude API improvement) reset furigana overrides, or preserve them?  
  **Decision:** Preserve overrides whose `(word_id, surface_form)` pairs still exist in the new parse; silently purge orphaned overrides (surface forms that no longer appear). User corrections are not invalidated by re-parsing.

- [x] Should the user be able to add a manual translation for a word (overriding Claude's cached gloss)?  
  **Decision:** Yes — add a `user_translation TEXT` column to the `words` table from the start, displayed in place of `translation` when set. The full UI for editing user translations (inline in the word browser and/or reader) is deferred to a future iteration, but the schema should support it immediately.

- [x] What should happen when the same surface form maps to different dictionary forms in different texts (e.g. context-dependent parsing differences)?  
  **Decision:** Treat each unique `(dictionary_form, reading)` pair as a distinct word. Change the `words` unique constraint to `UNIQUE (user_id, dictionary_form, reading)` so that e.g. 上(うえ) and 上(かみ) are tracked as separate entries. Furigana overrides then only correct genuinely wrong readings, not disambiguate homographs.

---

## 15. Gaps to Resolve

### Data Model

- [x] **Re-parse invalidates `sentence_patterns`** — `sentence_patterns` joins on `sentence_index` (an integer), not a stable sentence ID. If a re-parse shifts sentence ordering, existing grammar caches silently point to wrong sentences. Should re-parse purge all `sentence_patterns` for that text?  
  **Decision:** Yes — re-parse purges all `sentence_patterns` rows for that text. Grammar tooltips will be lazily re-fetched on next hover. Consistent with the existing furigana override behavior (orphaned overrides are purged on re-parse).

- [x] **Text deletion and orphaned grammar patterns** — §9.1 mentions Delete but doesn't specify behavior for orphaned data. Words are global and should persist (probably intentional), but `grammar_patterns` rows have no cascade — they'll linger after the only text referencing them is deleted. Is that acceptable?  
  **Decision:** Yes — `grammar_patterns` rows are never deleted. They represent cumulative immersion history; a pattern encountered in a deleted text is still a pattern you've seen. The Grammar Pattern Log intentionally persists across text deletions.

### UX / Behavior

- [x] **`seen` vs `known` in comprehension (§11.2)** — Comprehension is defined as "% of content-word tokens that are `known`." A word clicked many times but not yet `known` contributes 0%. Should `seen` words contribute a partial score, or is the strict `known`-only definition intentional?  
  **Decision:** Intentional — comprehension is strictly `known`-only. `seen` words are already tracked separately in the vocabulary growth chart (§11.1). The strict definition keeps the comprehension metric honest and meaningful.

- [x] **Translation context-sensitivity vs. caching (§7.3)** — The first-click prompt uses the surrounding sentence for context, but once cached, that gloss shows everywhere. Is this an accepted limitation, or should the translation be re-fetchable per-context?  
  **Decision:** Accepted limitation — the cached gloss is shown everywhere. Mitigated by prompting Claude to return all common meanings for polysemous words (most contextually relevant first), so a single wrong gloss is less likely. `user_translation` remains the escape hatch for incorrect entries. §7.3 updated to reflect the multi-translation output shape.

- [x] **Grammar hover vs. word click UX overlap** — §9.4 says hovering "anywhere on a sentence" triggers grammar analysis. Does hovering over a word also trigger the sentence grammar tooltip? Or does word hover suppress it? The interaction model between these two triggers isn't specified.  
  **Decision:** Word hover suppresses the sentence grammar tooltip. The grammar tooltip only fires when hovering sentence-level whitespace or punctuation — not when the event target is a word element. Each hover target is responsible for exactly one piece of UI.

- [x] **`seen` → `known` transition UX** — §9.2 says clicking a `seen` word shows translation and marks it `known` simultaneously. Is this promotion automatic, or does the user confirm? An accidental click permanently advances status; regression requires the Word Browser.  
  **Decision:** The popover for `seen` words shows the translation plus explicit **"Mark as known"** and **"Close"** buttons. Promotion is always deliberate — status never changes automatically on click. `unseen` → `seen` remains automatic (first click, no confirmation needed, lower stakes). §9.2 updated.

### Implementation

- [x] **Format auto-detection logic (§6.1)** — "The app auto-detects the format" but no detection heuristic is given. What signals determine markdown vs. rich text/HTML? (e.g. presence of `<` tags, `#` headings, `**bold**`?)  
  **Decision:** Detect HTML by checking whether the content contains a `<` followed by a known HTML tag name (e.g. `<p`, `<div`, `<span`, `<br`). Treat everything else as markdown/plain text. A manual format override toggle is shown on the import form to handle edge cases. §6.1 should be updated to document the heuristic and the override.

- [x] **Furigana toggle persistence (§9.1)** — The toggle is stateless and resets on page load. Is that the intended behavior, even across long reading sessions or return visits?  
  **Decision:** Persist to `localStorage`. The toggle state survives page reloads and return visits. Read on mount, write on toggle. No server involvement. §9.1 updated.

### Minor

- [x] **`user_translation` display logic** — The §14 decision notes `user_translation` is shown "in place of `translation` when set," but this isn't written into §9 (reader) or §11.3 (word browser). Both sections should specify which field to prefer.  
  **Decision:** Reader popover shows `user_translation` if set, falls back to `translation`; a pencil icon indicates a user-edited translation is active. Word browser shows `user_translation` as the primary value with the Claude gloss greyed out beneath it for reference. `user_translation` is always editable inline in the word browser — users can set, update, or clear it at any time. §9.2 and §11.3 updated.

- [x] **Grammar pattern count scope (§11.4)** — "Count of sentences it appears in" — is this across all texts, or per text?  
  **Decision:** Global count across all texts. The drill-down view (clicking a pattern) already shows all sentences grouped by text, so per-text breakdown is available without a dedicated column.

- [x] **Accessibility and tablet support** — The app currently has no explicit accessibility requirements, and §13 defers mobile but doesn't address tablets. Two questions: (1) What level of accessibility is expected — semantic HTML only, full WCAG 2.1 AA compliance, or something in between? (2) Should the reader and dashboard be usable on a tablet in a browser now, or is that a future concern? The grammar hover interaction (Gap 5) in particular needs a touch-equivalent since tablets have no hover state.  
  **Decision:** (1) Target WCAG 2.1 AA as a practical checklist — semantic HTML, ARIA labels on icon buttons, keyboard accessibility, sufficient contrast, and careful `<ruby>` screen reader handling — without a formal audit. (2) Tablet browser (≥768px) is a first-class target: hover interactions have touch equivalents, layout is responsive. Phone-sized screens remain out of scope. §9.3, §9.4, and new §9.5 updated; §13 updated.
