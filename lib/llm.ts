import type { ParsedContent, JlptLevel } from './types';
import type { SessionUser } from './session';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export interface LLMConfig {
  apiKey: string;
  model: string;
}

export function buildLLMConfig(user: SessionUser): LLMConfig | null {
  if (user.openrouter_api_key === null) return null;
  return { apiKey: user.openrouter_api_key, model: user.openrouter_model };
}

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

async function callModel(config: LLMConfig, prompt: string, maxTokens: number, signal?: AbortSignal): Promise<string> {
  type OpenRouterResponse = {
    choices?: Array<{ message: { content: string | null; reasoning?: string | null } }>;
    error?: { message: string; code?: number | string };
  };

  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
      reasoning: { enabled: false },
    }),
  });

  const data = await res.json() as OpenRouterResponse;

  if (data.error !== undefined) {
    throw new Error(`OpenRouter error: ${data.error.message}`);
  }
  if (!res.ok) {
    throw new Error(`OpenRouter HTTP ${res.status}`);
  }
  if (!Array.isArray(data.choices) || data.choices.length === 0) {
    throw new Error('OpenRouter returned no choices');
  }

  const message = data.choices[0].message;
  const text = message.content ?? message.reasoning ?? null;
  if (text === null || text.trim() === '') {
    throw new Error('OpenRouter returned empty content');
  }
  return stripThinkTags(text);
}

// Valid first characters of a JSON value (after the opening bracket/brace)
const JSON_ARRAY_VALUE_STARTS = new Set(['"', '[', '{', ']', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 't', 'f', 'n']);
const JSON_OBJECT_VALUE_STARTS = new Set(['"', '}']);

// Scans raw for every candidate occurrence of `open` followed by a valid JSON value start,
// extracts the balanced bracket substring, and validates with JSON.parse. Returns the first
// candidate that parses cleanly, skipping false positives in reasoning/prose text.
function extractJson(raw: string, open: '{' | '['): string {
  const close = open === '[' ? ']' : '}';
  const validNext = open === '[' ? JSON_ARRAY_VALUE_STARTS : JSON_OBJECT_VALUE_STARTS;

  let pos = 0;
  while (pos < raw.length) {
    const idx = raw.indexOf(open, pos);
    if (idx === -1) break;

    // Skip if not followed by a valid JSON value start (after whitespace)
    let nextIdx = idx + 1;
    while (nextIdx < raw.length && '\t\n\r '.includes(raw[nextIdx])) nextIdx++;
    if (nextIdx >= raw.length || !validNext.has(raw[nextIdx])) { pos = idx + 1; continue; }

    // Extract balanced bracket substring
    let depth = 0;
    let inString = false;
    let escape = false;
    let end = -1;
    for (let i = idx; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === open) depth++;
      else if (ch === close && --depth === 0) { end = i; break; }
    }

    if (end === -1) { pos = idx + 1; continue; }

    const candidate = raw.slice(idx, end + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      pos = idx + 1;
    }
  }

  throw new Error(`No JSON ${open === '[' ? 'array' : 'object'} found in model response`);
}

const TOKENIZE_CHUNK_SIZE = 400;

function splitIntoChunks(text: string): string[] {
  if (text.length <= TOKENIZE_CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    if (start + TOKENIZE_CHUNK_SIZE >= text.length) {
      chunks.push(text.slice(start).trim());
      break;
    }

    const segment = text.slice(start, start + TOKENIZE_CHUNK_SIZE);

    // Prefer paragraph boundary in the second half of the segment
    let splitAt = segment.lastIndexOf('\n\n');
    if (splitAt < TOKENIZE_CHUNK_SIZE / 2) {
      const lastPunct = Math.max(
        segment.lastIndexOf('。'),
        segment.lastIndexOf('！'),
        segment.lastIndexOf('？'),
      );
      splitAt = lastPunct > TOKENIZE_CHUNK_SIZE / 2 ? lastPunct + 1 : TOKENIZE_CHUNK_SIZE;
    }

    chunks.push(text.slice(start, start + splitAt).trim());
    start += splitAt;
    while (start < text.length && text[start] === '\n') start++;
  }

  return chunks.filter(c => c.length > 0);
}

// Compact response: array of sentences, each sentence is an array of token tuples.
// Token tuple: [surface, dictionary_form, surface_reading, dict_reading, is_content_word (0|1)]
type CompactToken = [string, string, string, string, 0 | 1];

function flattenToTokens(arr: unknown[]): CompactToken[] {
  const result: CompactToken[] = [];
  for (const item of arr) {
    if (!Array.isArray(item)) continue;
    if (item.length === 5 && typeof item[0] === 'string' && typeof item[1] === 'string') {
      result.push(item as CompactToken);
    } else {
      result.push(...flattenToTokens(item as unknown[]));
    }
  }
  return result;
}

function normalizeSentences(parsed: unknown): CompactToken[][] {
  if (!Array.isArray(parsed) || parsed.length === 0) return [];
  const first = parsed[0];

  if (first !== null && typeof first === 'object' && !Array.isArray(first)) {
    return (parsed as Array<Record<string, unknown>>).map(obj => {
      const tokensKey = Object.keys(obj).find(k => Array.isArray(obj[k]));
      return tokensKey !== undefined ? flattenToTokens(obj[tokensKey] as unknown[]) : [];
    });
  }

  if (!Array.isArray(first)) {
    throw new Error('Model returned unexpected sentence structure');
  }

  if (Array.isArray(first[0])) return (parsed as unknown[][]).map(s => flattenToTokens(s));
  return [flattenToTokens(parsed as unknown[])];
}

async function tokenizeChunk(config: LLMConfig, chunk: string, chunkLabel: string, signal?: AbortSignal): Promise<ParsedContent> {
  const raw = await callModel(config, `You are a Japanese NLP tokenizer. Tokenize the following Japanese text into sentences and tokens.

Return ONLY a valid JSON array of sentences — no prose, no markdown, no code fences, no wrapper object.
Each sentence is itself an array of token tuples: [surface, dictionary_form, surface_reading, dict_reading, is_content_word]
- surface_reading: exact hiragana reading of the surface form. Any kana already present in the surface (okurigana) MUST appear verbatim and in the same relative position within the reading — never alter or drop them. Examples: 思った→おもった (not おまった), 向いた→むいた (not むかいた), 温まった→あたたまった (not ぬくまった), 書かれた→かかれた. When a kanji has multiple possible readings, choose the one that fits the grammatical form and context.
- dict_reading: hiragana reading of the dictionary_form (the base/plain form)
- is_content_word: MUST be exactly the integer 1 or 0 — no other value, no text, no comments. Use 1 for nouns/verbs/adjectives/adverbs/fixed expressions/proper nouns — including Latin-script proper nouns (person names, place names) that function as Japanese words; 0 for particles/conjunctions/auxiliary verbs/punctuation/whitespace/numerals/symbols/Latin-script abbreviations or foreign words not used as Japanese proper nouns (e.g. DNA, OK, 8, ***, 1960).
- For Latin-script proper nouns marked is_content_word=1, surface_reading and dict_reading MUST be hiragana (e.g. "Ai" → "あい", "Tokyo" → "とうきょう"). Never use romaji or katakana as a reading.

Output shape (array of sentences, each sentence is an array of token tuples):
[
  [["surface1","dict1","reading1","dictreading1",1], ["surface2","dict2","reading2","dictreading2",0]],
  [["Ai","Ai","あい","あい",1], ["は","は","は","は",0], ["Tokyo","Tokyo","とうきょう","とうきょう",1]]
]
The fifth element is always 1 or 0. Never write anything else there — no floats, no negative numbers, no words.

Rules:
- Split on sentence-ending punctuation (。！？) and newlines between paragraphs.
- Every character in the input must appear in exactly one token's surface (first element).
- dictionary_form for inflected words should be the plain form (e.g. 食べていた → 食べる).
- CRITICAL: Each sentence array must be FLAT — every element must be a token tuple. Never nest token arrays inside other arrays within a sentence. Never group tokens into sub-arrays.

Text to tokenize:
${chunk}`, 8192, signal);

  let sentences: CompactToken[][];
  try {
    const sanitized = raw.replace(/,-?[A-Za-z_][^,\]]*([\],])/g, (_m, delim) => `,1${delim}`);
    const parsed: unknown = JSON.parse(extractJson(sanitized, '['));
    sentences = normalizeSentences(parsed);
  } catch (err) {
    console.error(`[tokenize] ${chunkLabel} parse error. raw (first 500 chars): ${raw.slice(0, 500)}`);
    throw err;
  }

  const allTokens = sentences.flat();
  const coveredNonWhitespace = allTokens.reduce((sum, t) => sum + t[0].replace(/\s/g, '').length, 0);
  const chunkNonWhitespace = chunk.replace(/\s/g, '').length;
  if (coveredNonWhitespace < chunkNonWhitespace * 0.9) {
    throw new Error(
      `[${chunkLabel}] Tokenizer only covered ${coveredNonWhitespace} of ${chunkNonWhitespace} non-whitespace input characters — model likely self-truncated`,
    );
  }

  const contentWordCount = allTokens.filter(t => t[4] === 1).length;
  if (chunkNonWhitespace > 20 && contentWordCount === 0) {
    throw new Error(
      `[${chunkLabel}] Tokenizer returned 0 content words for ${chunkNonWhitespace} non-whitespace input chars — model likely set all is_content_word to 0`,
    );
  }

  console.log(`[tokenize] ${chunkLabel} ok: ${chunk.length} chars in, ${raw.length} chars response, ${coveredNonWhitespace}/${chunkNonWhitespace} non-ws covered`);

  return sentences.map((tokens, index) => ({
    sentence_index: index,
    raw: tokens.map(t => t[0]).join(''),
    tokens: tokens.map(t => ({
      surface: t[0],
      dictionary_form: t[1],
      reading: t[2],
      dict_reading: t[3],
      is_content_word: t[4] === 1,
    })),
  }));
}

export async function tokenizeText(config: LLMConfig, cleanedText: string, signal?: AbortSignal): Promise<ParsedContent> {
  const chunks = splitIntoChunks(cleanedText);

  const chunkResults = await Promise.all(
    chunks.map(async (chunk, i) => {
      const chunkLabel = `chunk ${i + 1}/${chunks.length}`;
      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await tokenizeChunk(config, chunk, chunkLabel, signal);
          if (result.length === 0) {
            throw new Error(`[${chunkLabel}] Tokenizer returned no sentences (${chunk.length} chars). The model may have failed to parse this section.`);
          }
          return result;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') throw err;
          lastError = err;
          if (attempt < 2) console.warn(`[tokenize] ${chunkLabel} attempt ${attempt} failed, retrying: ${err instanceof Error ? err.message : err}`);
        }
      }
      throw lastError;
    })
  );

  let sentenceOffset = 0;
  const results: ParsedContent = [];
  for (const chunkResult of chunkResults) {
    results.push(...chunkResult.map(s => ({ ...s, sentence_index: s.sentence_index + sentenceOffset })));
    sentenceOffset += chunkResult.length;
  }
  return results;
}

interface KanjiToken {
  surface: string;
  dictionary_form: string;
  sentence_context: string;
}

interface KanjiReading {
  surface: string;
  surface_reading: string;
  dict_reading: string;
}

export async function assignKanjiReadings(
  config: LLMConfig,
  tokens: KanjiToken[],
  signal?: AbortSignal,
): Promise<KanjiReading[]> {
  if (tokens.length === 0) return [];

  const raw = await callModel(config, `You are a Japanese reading assistant. For each token below, return the hiragana reading of the surface form (surface_reading) and the hiragana reading of the dictionary form (dict_reading), using sentence context to resolve ambiguous kanji.

Return ONLY a valid JSON array matching the input order — no prose, no markdown, no code fences.

[
  { "surface": "食べた", "surface_reading": "たべた", "dict_reading": "たべる" }
]

Tokens:
${JSON.stringify(tokens, null, 2)}`, 2048, signal);

  return JSON.parse(extractJson(raw, '[')) as KanjiReading[];
}

interface GrammarHint {
  pattern: string;
  jlpt_level: JlptLevel | null;
}

export async function analyzeGrammar(config: LLMConfig, sentence: string): Promise<GrammarHint[]> {
  const raw = await callModel(config, `You are a Japanese grammar analyzer for immersion learners.

Analyze the following sentence and identify grammar patterns worth explaining — conjugations, grammatical constructions, and set phrases. Skip trivially common structures (e.g. plain dictionary-form verbs, basic copula です/だ).

Return ONLY a valid JSON array with no prose, markdown, or code fences. Return an empty array [] if no notable patterns are found.

[
  {
    "pattern": "<pattern name, e.g. 〜ていた>",
    "jlpt_level": "<N5|N4|N3|N2|N1 or null>"
  }
]

Sentence: ${sentence}`, 512);

  return JSON.parse(extractJson(raw, '[')) as GrammarHint[];
}

export async function describeGrammarPattern(config: LLMConfig, pattern: string): Promise<string> {
  const raw = await callModel(config, `Provide a concise English explanation (1–2 sentences) of the Japanese grammar pattern "${pattern}" for an intermediate learner. Return only the explanation text, no JSON, no formatting.`, 256);
  return raw.trim();
}

interface TranslationResult {
  translations: string[];
  jlpt_level: JlptLevel | null;
}

export async function translateWord(
  config: LLMConfig,
  dictionaryForm: string,
  contextSentence: string,
): Promise<TranslationResult> {
  const raw = await callModel(config, `You are a Japanese–English dictionary. Given a Japanese word and a sentence it appears in, return all common English glosses for the word and a JLPT level estimate.

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
Sentence: ${contextSentence}`, 256);

  return JSON.parse(extractJson(raw, '{')) as TranslationResult;
}
