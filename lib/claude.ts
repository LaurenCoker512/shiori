import Anthropic from '@anthropic-ai/sdk';
import type { ParsedContent, JlptLevel } from './types';

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-6';

const TOKENIZE_CHUNK_SIZE = 800;

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
      // Fall back to last sentence-ending punctuation
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
// Token tuple: [surface, dictionary_form, reading, is_content_word (0|1)]
type CompactToken = [string, string, string, 0 | 1];
type CompactResponse = CompactToken[][];

async function tokenizeChunk(chunk: string): Promise<ParsedContent> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: `You are a Japanese NLP tokenizer. Tokenize the following Japanese text into sentences and tokens.

Return ONLY a valid JSON array of sentences with no prose, markdown, or code fences.
Each sentence is an array of token tuples: [surface, dictionary_form, hiragana_reading, is_content_word]
is_content_word is 1 for nouns/verbs/adjectives/adverbs/fixed expressions, 0 for particles/conjunctions/auxiliary verbs/punctuation/whitespace.

Example: [["私","私","わたし",1],["は","は","は",0],["学生","学生","がくせい",1],["です","だ","です",0],["。","。","。",0]]

Full output shape: [[token,token,...],[token,token,...],...]

Rules:
- Split on sentence-ending punctuation (。！？) and newlines between paragraphs.
- Every character in the input must appear in exactly one token's surface (first element).
- dictionary_form for inflected words should be the plain form (e.g. 食べていた → 食べる).

Text to tokenize:
${chunk}`,
    }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  console.log(`[tokenize] chunk=${chunk.length}, stop=${message.stop_reason}, response=\n${raw}\n---`);
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const compact = JSON.parse(json) as CompactResponse;

  return compact.map((tokens, index) => ({
    sentence_index: index,
    raw: tokens.map(t => t[0]).join(''),
    tokens: tokens.map(t => ({
      surface: t[0],
      dictionary_form: t[1],
      reading: t[2],
      is_content_word: t[3] === 1,
    })),
  }));
}

export async function tokenizeText(cleanedText: string): Promise<ParsedContent> {
  const chunks = splitIntoChunks(cleanedText);
  const results: ParsedContent = [];
  let sentenceOffset = 0;

  for (const chunk of chunks) {
    const chunkResult = await tokenizeChunk(chunk);
    results.push(...chunkResult.map(s => ({ ...s, sentence_index: s.sentence_index + sentenceOffset })));
    sentenceOffset += chunkResult.length;
  }

  return results;
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
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(json) as GrammarHint[];
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
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(json) as TranslationResult;
}
