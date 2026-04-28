# 栞 (Shiori) — Technical Specification

> **Status:** Ready for implementation  
> **Derived from:** REQUIREMENTS.md  
> **Stack:** Next.js 14 (App Router) · React · Tailwind CSS · PostgreSQL (Railway) · Claude API

---

## 1. Project Structure

```
shiori/
├── app/
│   ├── layout.tsx                  # Root layout (font, global CSS)
│   ├── page.tsx                    # Dashboard (/)
│   ├── import/
│   │   └── page.tsx                # Import form (/import)
│   └── texts/
│       └── [id]/
│           └── page.tsx            # Reader (/texts/[id])
├── components/
│   ├── dashboard/
│   │   ├── VocabularyChart.tsx
│   │   ├── ComprehensionList.tsx
│   │   ├── WordBrowser.tsx
│   │   └── GrammarPatternLog.tsx
│   ├── reader/
│   │   ├── ReaderHeader.tsx
│   │   ├── ReaderContent.tsx
│   │   ├── SentenceBlock.tsx
│   │   ├── WordToken.tsx
│   │   ├── WordPopover.tsx
│   │   ├── FuriganaEdit.tsx
│   │   └── GrammarTooltip.tsx
│   ├── import/
│   │   └── ImportForm.tsx
│   └── ui/
│       ├── Spinner.tsx
│       ├── ConfirmDialog.tsx
│       └── OverflowMenu.tsx
├── lib/
│   ├── db.ts                       # postgres connection (node-postgres)
│   ├── claude.ts                   # Claude API client + typed call wrappers
│   ├── format-detection.ts         # HTML vs markdown heuristic
│   ├── text-processing.ts          # remark pipeline + node-html-parser sanitizer
│   └── types.ts                    # Shared TypeScript types
├── app/api/
│   ├── texts/
│   │   ├── route.ts                # POST /api/texts (import)
│   │   └── [id]/
│   │       ├── route.ts            # GET, PATCH, DELETE /api/texts/[id]
│   │       └── reparse/
│   │           └── route.ts        # POST /api/texts/[id]/reparse
│   ├── words/
│   │   ├── route.ts                # GET /api/words (word browser)
│   │   └── [id]/
│   │       ├── route.ts            # PATCH /api/words/[id]
│   │       └── translation/
│   │           └── route.ts        # GET /api/words/[id]/translation
│   ├── sentences/
│   │   └── [textId]/
│   │       └── [sentenceIndex]/
│   │           └── grammar/
│   │               └── route.ts    # GET /api/sentences/[textId]/[sentenceIndex]/grammar
│   ├── grammar-patterns/
│   │   └── [id]/
│   │       └── sentences/
│   │           └── route.ts        # GET /api/grammar-patterns/[id]/sentences
│   ├── furigana-overrides/
│   │   └── route.ts                # POST /api/furigana-overrides
│   └── dashboard/
│       └── route.ts                # GET /api/dashboard (stats, comprehension)
├── migrations/
│   └── 001_initial.sql
└── .env.local                      # DATABASE_URL, ANTHROPIC_API_KEY
```

---

## 2. Environment Variables

```
DATABASE_URL=postgresql://...       # Railway PostgreSQL connection string
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 3. Database

### 3.1 Migration SQL (`migrations/001_initial.sql`)

```sql
CREATE TABLE words (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL DEFAULT 1,
  dictionary_form   TEXT NOT NULL,
  reading           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'unseen'
                    CHECK (status IN ('unseen', 'seen', 'known')),
  translation       TEXT,
  user_translation  TEXT,
  jlpt_level        TEXT CHECK (jlpt_level IN ('N5','N4','N3','N2','N1') OR jlpt_level IS NULL),
  seen_at           TIMESTAMPTZ,
  known_at          TIMESTAMPTZ,
  UNIQUE (user_id, dictionary_form, reading)
);

CREATE TABLE texts (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL DEFAULT 1,
  title           TEXT NOT NULL,
  raw_content     TEXT NOT NULL,
  parsed_content  JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_read_at    TIMESTAMPTZ
);

CREATE TABLE furigana_overrides (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL DEFAULT 1,
  word_id           INTEGER REFERENCES words(id) ON DELETE CASCADE,
  surface_form      TEXT NOT NULL,
  corrected_reading TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, word_id, surface_form)
);

CREATE TABLE grammar_patterns (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL DEFAULT 1,
  pattern              TEXT NOT NULL,
  description_en       TEXT NOT NULL,
  jlpt_level           TEXT CHECK (jlpt_level IN ('N5','N4','N3','N2','N1') OR jlpt_level IS NULL),
  first_encountered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, pattern)
);

CREATE TABLE sentence_patterns (
  id                 SERIAL PRIMARY KEY,
  text_id            INTEGER REFERENCES texts(id) ON DELETE CASCADE,
  sentence_index     INTEGER NOT NULL,
  grammar_pattern_id INTEGER REFERENCES grammar_patterns(id),
  UNIQUE (text_id, sentence_index, grammar_pattern_id)
);
```

### 3.2 DB Client (`lib/db.ts`)

Use `pg` (node-postgres) with a connection pool. Export a single `query(text, params)` helper.

```ts
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export function query<T extends object>(text: string, params?: unknown[]): Promise<{ rows: T[] }> {
  return pool.query(text, params);
}
```

---

## 4. TypeScript Types (`lib/types.ts`)

```ts
export type WordStatus = 'unseen' | 'seen' | 'known';
export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface Token {
  surface: string;
  dictionary_form: string;
  reading: string;
  pos: string;
  is_content_word: boolean;
}

export interface Sentence {
  sentence_index: number;
  raw: string;
  tokens: Token[];
  is_heading?: boolean;
  heading_level?: 1 | 2 | 3 | 4 | 5 | 6;
}

// parsed_content shape stored in texts.parsed_content
export type ParsedContent = Sentence[];

export interface Word {
  id: number;
  user_id: number;
  dictionary_form: string;
  reading: string;
  status: WordStatus;
  translation: string | null;       // JSON array stored as text, e.g. '["to read","to recite"]'
  user_translation: string | null;
  jlpt_level: JlptLevel | null;
  seen_at: string | null;
  known_at: string | null;
}

export interface GrammarPattern {
  id: number;
  pattern: string;
  description_en: string;
  jlpt_level: JlptLevel | null;
  first_encountered_at: string;
  sentence_count?: number;          // computed in dashboard query
}

export interface FuriganaOverride {
  word_id: number;
  surface_form: string;
  corrected_reading: string;
}

// translation field is stored as JSON array string; parse on read
export function parseTranslations(translation: string | null): string[] {
  if (!translation) return [];
  try {
    return JSON.parse(translation) as string[];
  } catch {
    return translation.split(';').map(s => s.trim()).filter(Boolean);
  }
}
```

---

## 5. Format Detection (`lib/format-detection.ts`)

```ts
const HTML_TAG_PATTERN = /<(p|div|span|br|h[1-6]|ul|ol|li|a|strong|em)[\s/>]/i;

export function detectFormat(content: string): 'html' | 'markdown' {
  return HTML_TAG_PATTERN.test(content) ? 'html' : 'markdown';
}
```

---

## 6. Text Processing (`lib/text-processing.ts`)

Two functions that return cleaned plain text (with `\n\n` paragraph breaks preserved) from raw input. For markdown, heading structure is extracted first and injected as sentinel lines so the tokenizer can carry it through.

### 6.1 Markdown

Extracts heading levels before stripping, then reinserts sentinel lines in the form `__HEADING_N__<text>` so the Claude tokenizer can identify them. After tokenization, `parseHeadingSentinels` strips the sentinels and populates `is_heading`/`heading_level`.

```ts
import { remark } from 'remark';
import strip from 'strip-markdown';
import { visit } from 'unist-util-visit';
import type { Root, Heading } from 'mdast';

export async function processMarkdown(raw: string): Promise<string> {
  // Inject sentinel lines before stripping so headings survive as plain text
  const withSentinels = await remark()
    .use(() => (tree: Root) => {
      visit(tree, 'heading', (node: Heading) => {
        // Prefix the heading text with a sentinel marker
        const textNode = node.children[0];
        if (textNode?.type === 'text') {
          textNode.value = `__HEADING_${node.depth}__${textNode.value}`;
        }
        node.type = 'paragraph' as 'heading'; // demote to paragraph so strip-markdown keeps it
      });
    })
    .use(strip)
    .process(raw);
  return String(withSentinels).trim();
}

const HEADING_SENTINEL = /^__HEADING_([1-6])__(.*)$/;

export function parseHeadingSentinels(sentences: import('./types').Sentence[]): import('./types').Sentence[] {
  return sentences.map(s => {
    const match = HEADING_SENTINEL.exec(s.raw);
    if (!match) return s;
    const level = parseInt(match[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
    const cleanRaw = match[2].trim();
    return {
      ...s,
      raw: cleanRaw,
      is_heading: true,
      heading_level: level,
      // Strip sentinel from any token surfaces too
      tokens: s.tokens.map(t => ({
        ...t,
        surface: t.surface.replace(HEADING_SENTINEL, '$2'),
        dictionary_form: t.dictionary_form.replace(HEADING_SENTINEL, '$2'),
      })),
    };
  });
}
```

`POST /api/texts` calls `parseHeadingSentinels` on the result of `tokenizeText` before persisting `parsed_content`.

### 6.2 HTML

Uses `node-html-parser` (server-safe; install with `npm i node-html-parser`):

```ts
import { parse } from 'node-html-parser';

export function processHtml(raw: string): string {
  const root = parse(raw);
  root.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li').forEach(el => {
    el.insertAdjacentHTML('afterend', '\n\n');
  });
  root.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
  return (root.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}
```

---

## 7. Claude API (`lib/claude.ts`)

```ts
import Anthropic from '@anthropic-ai/sdk';
import type { ParsedContent, JlptLevel } from './types';

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-5';

// ── 7.1 Tokenize ──────────────────────────────────────────────────────────────

export async function tokenizeText(cleanedText: string): Promise<ParsedContent> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: `You are a Japanese NLP tokenizer. Tokenize the following Japanese text into sentences and tokens.

Return ONLY a valid JSON array with no prose, markdown, or code fences. Each element represents one sentence:

[
  {
    "sentence_index": <integer, 0-based>,
    "raw": "<full sentence string, including any __HEADING_N__ prefix>",
    "tokens": [
      {
        "surface": "<surface form as it appears in text>",
        "dictionary_form": "<dictionary/lemma form>",
        "reading": "<hiragana reading of surface form>",
        "pos": "<noun|verb|adjective|adverb|particle|conjunction|interjection|punctuation|other>",
        "is_content_word": <true if this token should be tracked as vocabulary, false for particles/punctuation/conjunctions>
      }
    ]
  }
]

Rules:
- Split on sentence-ending punctuation (。！？) and newlines between paragraphs.
- Every character in the input must appear in exactly one token's surface field.
- is_content_word: true for nouns, verbs, adjectives, adverbs, and fixed expressions. false for particles, conjunctions, auxiliary verbs, punctuation, whitespace.
- dictionary_form for inflected words should be the plain dictionary form (e.g. 食べていた → 食べる).
- Lines beginning with __HEADING_N__ (where N is 1–6) are section headings. Treat them as a single sentence; do not split on internal punctuation. Preserve the __HEADING_N__ prefix in the raw field verbatim.

Text to tokenize:
${cleanedText}`
    }]
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  return JSON.parse(raw) as ParsedContent;
}

// ── 7.2 Grammar Analysis ──────────────────────────────────────────────────────

interface GrammarHint {
  pattern: string;
  jlpt_level: JlptLevel | null;
}

export async function analyzeGrammar(sentence: string): Promise<GrammarHint[]> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `You are a Japanese grammar analyzer for immersion learners.

Analyze the following sentence and identify grammar patterns worth explaining — conjugations, grammatical constructions, and set phrases. Skip trivially common structures (e.g. plain dictionary-form verbs, basic copula です/だ).

Return ONLY a valid JSON array with no prose, markdown, or code fences. Return an empty array [] if no notable patterns are found.

[
  {
    "pattern": "<pattern name, e.g. 〜ていた>",
    "jlpt_level": "<N5|N4|N3|N2|N1 or null>"
  }
]

Sentence: ${sentence}`
    }]
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '[]';
  return JSON.parse(raw) as GrammarHint[];
}

// ── 7.3 Grammar Description (lazy, per pattern) ───────────────────────────────

export async function describeGrammarPattern(pattern: string): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Provide a concise English explanation (1–2 sentences) of the Japanese grammar pattern "${pattern}" for an intermediate learner. Return only the explanation text, no JSON, no formatting.`
    }]
  });

  return message.content[0].type === 'text' ? message.content[0].text.trim() : '';
}

// ── 7.4 Word Translation ──────────────────────────────────────────────────────

interface TranslationResult {
  translations: string[];
  jlpt_level: JlptLevel | null;
}

export async function translateWord(
  dictionaryForm: string,
  contextSentence: string
): Promise<TranslationResult> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `You are a Japanese–English dictionary. Given a Japanese word and a sentence it appears in, return all common English glosses for the word and a JLPT level estimate.

Rules:
- Return all common meanings (1–5 words each). For polysemous words, include all common senses — prefer over-inclusion to omission.
- Order meanings by contextual relevance to the sentence, but do not suppress common meanings.
- jlpt_level: the standard JLPT classification, or null if none.

Return ONLY valid JSON with no prose, markdown, or code fences:

{
  "translations": ["gloss 1", "gloss 2"],
  "jlpt_level": "N5"
}

Word: ${dictionaryForm}
Sentence: ${contextSentence}`
    }]
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}';
  return JSON.parse(raw) as TranslationResult;
}
```

---

## 8. API Routes

### 8.1 `POST /api/texts` — Import

**Request body:**
```ts
{ title: string; content: string; formatOverride?: 'html' | 'markdown' }
```

**Logic:**
1. Validate `title` non-empty; return 400 if missing.
2. Detect format with `detectFormat` (or use `formatOverride`).
3. Process to plain text via `processMarkdown` or `processHtml`.
4. Call `tokenizeText(cleanedText)`.
5. Insert into `texts` (`raw_content`, `parsed_content`, `title`).
6. For each token where `is_content_word === true`, upsert into `words`:
   ```sql
   INSERT INTO words (user_id, dictionary_form, reading)
   VALUES (1, $1, $2)
   ON CONFLICT (user_id, dictionary_form, reading) DO NOTHING
   ```
7. Return `{ id: number }`.

**Error:** If Claude call throws, return 500 with `{ error: 'Tokenization failed' }`. Do not persist.

---

### 8.2 `GET /api/texts/[id]` — Load Reader

**Logic:**
1. Fetch `texts` row.
2. Update `last_read_at = NOW()`.
3. Fetch all `words` for user (status map: `dictionary_form+reading → Word`).
4. Fetch all `furigana_overrides` for user.
5. Return `{ text, wordStatusMap, furiganaOverrides }`.

---

### 8.3 `GET /api/texts/[id]` handles GET, PATCH, DELETE

**`PATCH /api/texts/[id]` — Rename Text**

Request body: `{ title: string }`

Validate `title` non-empty; return 400 if missing. Update `texts.title`. Return `{ id: number; title: string }`.

**`DELETE /api/texts/[id]` — Delete Text**

Deletes the `texts` row. `sentence_patterns` and `furigana_overrides` cascade. `words` and `grammar_patterns` are never deleted.

---

### 8.4 `POST /api/texts/[id]/reparse` — Re-parse

**Logic:**
1. Fetch `texts.raw_content`.
2. Re-detect format (or accept `formatOverride` in body).
3. Re-process and call `tokenizeText`.
4. Update `texts.parsed_content`.
5. Delete all `sentence_patterns` where `text_id = id`.
6. Collect all content-word surface forms from the new `parsed_content`:
   ```ts
   const newSurfaces = parsedContent
     .flatMap(s => s.tokens.filter(t => t.is_content_word).map(t => t.surface));
   ```
   Then delete orphaned overrides:
   ```sql
   DELETE FROM furigana_overrides
   WHERE user_id = 1
     AND surface_form <> ALL($1::text[])
   ```
   (Pass `newSurfaces` as `$1`.)
7. Upsert any new content words into `words`.
8. Return `{ ok: true }`.

---

### 8.5 `GET /api/sentences/[textId]/[sentenceIndex]/grammar` — Grammar Analysis

**Logic:**
1. Check `sentence_patterns` for existing rows with `text_id` + `sentence_index`. If found, join to `grammar_patterns` and return.
2. If not found (and no prior empty result marker — see note), fetch the sentence `raw` from `texts.parsed_content->[sentence_index].raw`.
3. Call `analyzeGrammar(raw)`.
4. For each returned pattern:
   a. Check whether a `grammar_patterns` row already exists for `(user_id=1, pattern)`.
   b. If **no row exists**: call `describeGrammarPattern(pattern)` to get `description_en`, then INSERT the new row.
   c. If a row already exists: use its `id` directly — skip the description call.
   d. Insert a `sentence_patterns` row linking `(text_id, sentence_index, grammar_pattern_id)`.
5. Return `{ patterns: GrammarPattern[] }`.

> **Empty result caching:** Insert a sentinel `sentence_patterns` row with `grammar_pattern_id = NULL` to mark "analyzed, no patterns found." On read, if a NULL row exists, return `[]` without calling Claude.

**Error:** Return `{ patterns: [], error: 'Grammar analysis unavailable' }`. Nothing cached.

---

### 8.6 `GET /api/words/[id]/translation` — Word Translation

**Logic:**
1. Fetch `words` row. If `translation` is already set, return it immediately.
2. Accept `contextSentence` as query param.
3. Call `translateWord(dictionary_form, contextSentence)`.
4. Serialize `translations` array as JSON string.
5. Update `words` row: `translation = $1, jlpt_level = $2`.
6. Return `{ translations: string[], jlpt_level: string | null }`.

**Error:** Return `{ error: 'Translation unavailable' }`. Nothing cached.

---

### 8.7 `PATCH /api/words/[id]` — Update Word

**Request body (all fields optional):**
```ts
{
  status?: WordStatus;
  user_translation?: string | null;
}
```

**Logic:**
- If `status` is provided:
  - `unseen → seen`: set `seen_at = NOW()` if null.
  - `seen → known`: set `known_at = NOW()`.
  - `known → seen` (manual regression): clear `known_at`.
- If `user_translation` is provided (including `null` to clear): update that field.
- Return updated `Word` row.

---

### 8.8 `POST /api/furigana-overrides` — Save Override

**Request body:** `{ word_id: number; surface_form: string; corrected_reading: string }`

Upsert into `furigana_overrides`. Return `{ ok: true }`.

---

### 8.9 `GET /api/words` — Word Browser

**Query params:** `status?: WordStatus`, `jlpt_level?: JlptLevel`, `search?: string`, `page?: number` (default 1), `pageSize?: number` (default 50)

```sql
SELECT * FROM words
WHERE user_id = 1
  AND ($1::text IS NULL OR status = $1)
  AND ($2::text IS NULL OR jlpt_level = $2)
  AND ($3::text IS NULL OR dictionary_form ILIKE '%' || $3 || '%' OR reading ILIKE '%' || $3 || '%')
ORDER BY seen_at DESC NULLS LAST
LIMIT $4 OFFSET $5
```

Return `{ words: Word[], total: number }`.

---

### 8.10 `GET /api/dashboard` — Dashboard Stats

Returns:
```ts
{
  seenSeries: { date: string; count: number }[];
  knownSeries: { date: string; count: number }[];
  comprehension: { text_id: number; title: string; last_read_at: string; pct_known: number }[];
  grammarPatterns: (GrammarPattern & { sentence_count: number })[];
}
```

**Vocabulary time series queries (two separate series):**

```sql
-- Seen series: each date a word was first seen
SELECT DATE(seen_at) AS date, COUNT(*) AS count
FROM words
WHERE user_id = 1 AND seen_at IS NOT NULL
GROUP BY DATE(seen_at)
ORDER BY date ASC;

-- Known series: each date a word was marked known
SELECT DATE(known_at) AS date, COUNT(*) AS count
FROM words
WHERE user_id = 1 AND known_at IS NOT NULL
GROUP BY DATE(known_at)
ORDER BY date ASC;
```

Return both as `seenSeries` and `knownSeries` arrays in the response. Compute cumulative sums client-side before charting.

**Comprehension query:**
```sql
-- pct_known = (known content-word tokens) / (total content-word tokens)
-- parsed_content tokens are in JSONB; compute via unnesting
WITH token_stats AS (
  SELECT
    t.id AS text_id,
    t.title,
    t.last_read_at,
    COUNT(*) FILTER (WHERE w.status = 'known') AS known_count,
    COUNT(*) AS total_count
  FROM texts t
  CROSS JOIN LATERAL jsonb_array_elements(t.parsed_content) AS sentence
  CROSS JOIN LATERAL jsonb_array_elements(sentence->'tokens') AS token
  LEFT JOIN words w
    ON w.dictionary_form = token->>'dictionary_form'
    AND w.reading = token->>'reading'
    AND w.user_id = 1
  WHERE t.user_id = 1
    AND (token->>'is_content_word')::boolean = true
  GROUP BY t.id, t.title, t.last_read_at
)
SELECT *, ROUND(known_count::numeric / NULLIF(total_count, 0) * 100, 1) AS pct_known
FROM token_stats
ORDER BY last_read_at DESC NULLS LAST
```

**Grammar pattern log query:**
```sql
SELECT gp.*, COUNT(sp.id) AS sentence_count
FROM grammar_patterns gp
LEFT JOIN sentence_patterns sp ON sp.grammar_pattern_id = gp.id
WHERE gp.user_id = 1
GROUP BY gp.id
ORDER BY gp.first_encountered_at ASC
```

---

### 8.11 `GET /api/grammar-patterns/[id]/sentences` — Pattern Drill-down

Used by `GrammarPatternLog` when expanding a row to show all sentences where the pattern appears.

```sql
SELECT
  t.id AS text_id,
  t.title,
  sp.sentence_index,
  t.parsed_content -> sp.sentence_index ->> 'raw' AS sentence_raw
FROM sentence_patterns sp
JOIN texts t ON t.id = sp.text_id
WHERE sp.grammar_pattern_id = $1
  AND sp.grammar_pattern_id IS NOT NULL
ORDER BY t.title ASC, sp.sentence_index ASC
```

Returns `{ sentences: { text_id: number; title: string; sentence_index: number; sentence_raw: string }[] }`.

---

## 9. Component Specifications

### 9.1 `ImportForm`

- Controlled textarea for raw content paste.
- Controlled input for title (required; submit disabled when empty).
- Format override toggle: auto-detected label updates as user types; toggle switches between `'html'` and `'markdown'`.
- Long text warning: after content is entered, if `detectFormat` + `processMarkdown`/`processHtml` produces cleaned text longer than 30,000 characters, show an inline notice: _"This text is long and may take a moment to process."_ Do not block submission.
- On submit: `POST /api/texts`, show blocking `<Spinner>`, redirect to `/texts/[id]` on success.
- On error: show inline error message; form remains editable.

---

### 9.2 `ReaderContent`

Receives `ParsedContent`, word status map, and furigana overrides as props. Renders sentences via `SentenceBlock`.

**Furigana toggle:** Read from `localStorage` on mount (`useEffect`). Store in component state; write to `localStorage` on change.

```ts
const [showFurigana, setShowFurigana] = useState(true);
useEffect(() => {
  const stored = localStorage.getItem('shiori-furigana');
  if (stored !== null) setShowFurigana(stored === 'true');
}, []);
```

---

### 9.3 `SentenceBlock`

- If `sentence.is_heading` is `true`, renders tokens inside a semantic heading element (`<h1>`–`<h6>` based on `heading_level`) with Tailwind heading classes. Heading sentences are not grammar-hoverable (no grammar trigger, no tooltip).
- Otherwise renders a `<p>` wrapping all tokens.
- Non-heading sentences have `onMouseEnter` (desktop) and touch handling for grammar trigger (see §9.4).
- Passes `isGrammarActive` state down to control tooltip visibility.

**Grammar trigger logic:**
```ts
function handlePointerEvent(e: React.PointerEvent) {
  // Only trigger if the direct target is the sentence container, not a word element
  if ((e.target as HTMLElement).closest('[data-word]')) return;
  triggerGrammarAnalysis();
}
```

---

### 9.4 `WordToken`

Props: `token: Token`, `word: Word | null`, `furiganaOverride: string | null`, `showFurigana: boolean`

- Non-content words: render as plain `<span>`.
- Content words: render as `<ruby>` with `aria-label={token.reading}`.
  - Underline color class based on `word.status`.
  - `onClick`: open `WordPopover`, trigger translation fetch if needed, advance `unseen → seen`.
  - Furigana visibility: shown when `showFurigana` is `true` (global toggle ON overrides all per-status rules), OR when `showFurigana` is `false` but status is `unseen` or `seen` (per-status default). A `known` word only shows furigana when the global toggle is explicitly ON.

```html
<ruby aria-label={reading}>
  {surface}
  <rt aria-hidden="true">{reading}</rt>
</ruby>
```

---

### 9.5 `WordPopover`

Positioned popover anchored to the clicked word element.

**Content by status:**

| Status | Content |
|---|---|
| `unseen` | Translation (loading or loaded). Dismiss: click outside or Escape. |
| `seen` | Translation + **"Mark as known"** button + **"Close"** button. |
| `known` | Translation. Dismiss: click outside or Escape. |

- Translation: show `user_translation` if set (with pencil icon `aria-label="Custom translation"`); fallback to `parseTranslations(word.translation).join(' / ')`.
- Loading state: show spinner with `aria-live="polite"` announcement.
- Status update on "Mark as known": `PATCH /api/words/[id]` then update local word state map.

---

### 9.6 `FuriganaEdit`

- Inline popover or tooltip triggered by hover (desktop) or always-visible edit icon (touch).
- Pre-fills with current reading.
- On save: `POST /api/furigana-overrides`, update local override map.

---

### 9.7 `GrammarTooltip`

- Slide-up panel or tooltip showing grammar patterns for the hovered/tapped sentence.
- Shows spinner while `GET /api/sentences/[textId]/[sentenceIndex]/grammar` is in flight.
- On error: shows "Grammar analysis unavailable" inline.
- Each pattern: pattern name (bold), JLPT badge, `description_en`.

---

### 9.8 `VocabularyChart`

Use `recharts` (or `chart.js` via `react-chartjs-2`). Two `<Line>` series on one chart: known (solid) and seen (dashed). X-axis: date, Y-axis: cumulative count. No goal line, no targets.

---

### 9.9 `WordBrowser`

- Fetches from `GET /api/words` with current filter/search/page state.
- Debounce search input (300ms).
- Inline status dropdown per row: `PATCH /api/words/[id]`.
- Inline `user_translation` edit: click pencil → text input → save on blur/enter → `PATCH /api/words/[id]`.
- Translation display: if `user_translation` set, show it primary + Claude gloss in `text-muted` below. Else show `translation`.

---

### 9.10 `GrammarPatternLog`

- Renders rows from `grammar_patterns` sorted by `first_encountered_at`.
- Clicking a row expands and fetches `GET /api/grammar-patterns/[id]/sentences`, then renders results grouped by `title`.

---

## 10. Accessibility Checklist

| Requirement | Implementation |
|---|---|
| Semantic HTML | `<button>`, `<nav>`, `<main>`, `<dialog>`, `<ruby>` |
| Icon-only buttons | `aria-label` on furigana edit icon, overflow menu, close buttons |
| `<ruby>` screen reader | `aria-label` on `<ruby>` element with full reading; `aria-hidden="true"` on `<rt>` |
| Keyboard popover | Popovers open/close with Enter/Space/Escape; focus trapped within modal dialogs |
| Focus order | DOM order matches visual reading order; no positive `tabindex` |
| Color contrast | WCAG 2.1 AA — 4.5:1 for normal text, 3:1 for large/UI elements |
| Status announcements | `aria-live="polite"` region for word status changes and translation loads |
| Tablet touch | Hover → tap equivalents for grammar trigger and furigana edit (§9.3, §9.4) |

---

## 11. Responsive Layout

- **Base breakpoint for tablet:** `md` (768px) in Tailwind.
- Reader: single column on all sizes; `max-w-3xl mx-auto` with comfortable reading padding.
- Dashboard: single column on small, two-column grid on `md+` for chart + comprehension list.
- Touch targets: minimum 44×44px for all interactive elements (Tailwind `min-h-11 min-w-11`).

---

## 12. Build Order

Follow §12 from REQUIREMENTS.md:

1. **DB + env setup** — Run `001_initial.sql` on Railway; wire `DATABASE_URL` in `.env.local`.
2. **Import flow** — `ImportForm` → `POST /api/texts` → tokenize → persist → redirect.
3. **Reader skeleton** — `GET /api/texts/[id]`, render `ParsedContent` as ruby tokens, color by status.
4. **Word state toggling** — click handlers, `PATCH /api/words/[id]`, optimistic UI update.
5. **Word translation** — `GET /api/words/[id]/translation`, popover with loading state.
6. **Grammar hover** — `GET /api/sentences/…/grammar`, tooltip with loading + error states.
7. **Furigana correction** — `FuriganaEdit`, `POST /api/furigana-overrides`, apply on render.
8. **Dashboard** — `GET /api/dashboard`, chart, comprehension list, word browser, grammar log.

---

## 13. Key Implementation Notes

- **`translation` storage format:** Store as JSON array string (`'["to read","to recite"]'`). Use `parseTranslations()` from `lib/types.ts` everywhere it is read.
- **Grammar description laziness:** `description_en` is populated in the same request that first inserts a `grammar_patterns` row (call `describeGrammarPattern` before inserting). Subsequent sentences that match the same pattern skip the description call entirely.
- **Optimistic status updates:** Update the local word status map immediately on click; revert on API error.
- **`last_read_at` write:** Update in `GET /api/texts/[id]` handler unconditionally on every load.
- **`sentence_patterns` NULL sentinel:** A row with `grammar_pattern_id = NULL` marks a sentence as "analyzed with no results." Check for this before firing a Claude call.
- **Server-side HTML processing:** `DOMParser` is browser-only. Use `node-html-parser` in API routes.
- **No auth:** All queries use `user_id = 1` hardcoded. No session middleware needed.

---

## 14. Resolved

All issues identified in review have been addressed inline in §§1–13. No open questions remain.
