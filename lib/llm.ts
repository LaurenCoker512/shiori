import type { JlptLevel } from './types';
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
