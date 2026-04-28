import Anthropic from '@anthropic-ai/sdk';
import type { ParsedContent, JlptLevel } from './types';

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-5';

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
${cleanedText}`,
    }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  return JSON.parse(raw) as ParsedContent;
}

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

Sentence: ${sentence}`,
    }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '[]';
  return JSON.parse(raw) as GrammarHint[];
}

export async function describeGrammarPattern(pattern: string): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Provide a concise English explanation (1–2 sentences) of the Japanese grammar pattern "${pattern}" for an intermediate learner. Return only the explanation text, no JSON, no formatting.`,
    }],
  });

  return message.content[0].type === 'text' ? message.content[0].text.trim() : '';
}

interface TranslationResult {
  translations: string[];
  jlpt_level: JlptLevel | null;
}

export async function translateWord(
  dictionaryForm: string,
  contextSentence: string,
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
Sentence: ${contextSentence}`,
    }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}';
  return JSON.parse(raw) as TranslationResult;
}
