import { kuromojiTokenize } from '@/lib/kuromoji';
import { assignKanjiReadings } from '@/lib/llm';
import type { LLMConfig } from '@/lib/llm';
import type { IpadicFeatures } from '@patdx/kuromoji';
import { parseHeadingSentinels, toHiragana } from '@/lib/text-processing';
import { query } from '@/lib/db';
import { registerImportAbort, unregisterImportAbort } from '@/lib/importAbortControllers';
import { lookupFrequencyTier } from '@/lib/frequency';
import type { Token, Sentence } from '@/lib/types';

const KANJI_RE = /[一-鿿㐀-䶿]/;
const SENTENCE_END_RE = /[。！？\n]/;
const CONTENT_POS = new Set(['名詞', '動詞', '形容詞', '形容動詞', '副詞', '感動詞']);

function getSentenceContext(token: IpadicFeatures, allTokens: IpadicFeatures[]): string {
  const idx = allTokens.indexOf(token);
  let start = 0;
  for (let i = idx - 1; i >= 0; i--) {
    if (SENTENCE_END_RE.test(allTokens[i].surface_form)) { start = i + 1; break; }
  }
  let end = allTokens.length;
  for (let i = idx; i < allTokens.length; i++) {
    if (SENTENCE_END_RE.test(allTokens[i].surface_form)) { end = i + 1; break; }
  }
  return allTokens.slice(start, end).map(t => t.surface_form).join('').slice(0, 50);
}

function buildToken(
  kuromoji: IpadicFeatures,
  llmReading?: { surface_reading: string; dict_reading: string },
): Token {
  const dictionaryForm = (kuromoji.basic_form === '*' || !kuromoji.basic_form)
    ? kuromoji.surface_form
    : kuromoji.basic_form;
  const kuroReading = toHiragana(kuromoji.reading ?? kuromoji.surface_form);
  const pureKanaBasic = /^[ぁ-んァ-ン]+$/.test(kuromoji.basic_form ?? '');
  return {
    surface: kuromoji.surface_form,
    dictionary_form: dictionaryForm,
    reading: llmReading?.surface_reading ?? kuroReading,
    dict_reading: llmReading?.dict_reading ?? (pureKanaBasic ? toHiragana(kuromoji.basic_form!) : kuroReading),
    is_content_word: CONTENT_POS.has(kuromoji.pos),
  };
}

export async function buildParsedContent(
  kuroTokens: IpadicFeatures[],
  config: LLMConfig | null,
  signal?: AbortSignal,
): Promise<Sentence[]> {
  const needsLlm = kuroTokens.filter(
    t => KANJI_RE.test(t.surface_form) || t.word_type === 'UNKNOWN',
  );

  let llmReadings: Array<{ surface: string; surface_reading: string; dict_reading: string }> | null = null;
  if (config !== null && needsLlm.length > 0) {
    llmReadings = await assignKanjiReadings(
      config,
      needsLlm.map(t => ({
        surface: t.surface_form,
        dictionary_form: (t.basic_form === '*' || !t.basic_form) ? t.surface_form : t.basic_form,
        sentence_context: getSentenceContext(t, kuroTokens),
      })),
      signal,
    ).catch(() => null);
  }

  // Map by token object reference so duplicate surface forms are handled correctly
  const llmMap = new Map<IpadicFeatures, { surface_reading: string; dict_reading: string }>();
  if (llmReadings !== null) {
    for (let i = 0; i < needsLlm.length; i++) {
      const reading = llmReadings[i];
      if (reading !== undefined) llmMap.set(needsLlm[i], reading);
    }
  }

  const sentences: Sentence[] = [];
  let currentKuroTokens: IpadicFeatures[] = [];
  let sentenceIndex = 0;

  function flushSentence(): void {
    if (currentKuroTokens.length === 0) return;
    const tokens: Token[] = currentKuroTokens.map(t => {
      const needsLlmReading = KANJI_RE.test(t.surface_form) || t.word_type === 'UNKNOWN';
      return buildToken(t, needsLlmReading ? llmMap.get(t) : undefined);
    });
    const raw = tokens.map(t => t.surface).join('');
    // Skip whitespace-only sentences (e.g. standalone newlines from Kuromoji tokenization).
    if (raw.trim().length > 0) {
      sentences.push({ sentence_index: sentenceIndex++, raw, tokens });
    }
    currentKuroTokens = [];
  }

  for (const token of kuroTokens) {
    currentKuroTokens.push(token);
    if (SENTENCE_END_RE.test(token.surface_form)) flushSentence();
  }
  flushSentence();

  return sentences;
}

export async function processImport(
  textId: number,
  userId: number,
  rawContent: string,
  config: LLMConfig | null,
): Promise<void> {
  const abortController = new AbortController();
  registerImportAbort(textId, abortController);

  try {
    await query(
      'UPDATE texts SET import_status = $1 WHERE id = $2',
      ['processing', textId],
    );

    // Normalize literal escape sequences that some export tools write instead of
    // actual whitespace characters (e.g. \n as two chars: backslash + n).
    const normalizedContent = rawContent
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n');

    const kuroTokens = await kuromojiTokenize(normalizedContent);
    const sentences = await buildParsedContent(kuroTokens, config, abortController.signal);
    const parsedContent = parseHeadingSentinels(sentences);

    await query(
      'UPDATE texts SET parsed_content = $1, import_status = $2 WHERE id = $3',
      [JSON.stringify(parsedContent), 'ready', textId],
    );

    const UNIVERSAL_TOKEN = /^[\d\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~a-zA-Z]+$/;
    const contentWords = parsedContent
      .flatMap(s => s.tokens)
      .filter(t => t.is_content_word && !UNIVERSAL_TOKEN.test(t.dictionary_form));
    if (contentWords.length > 0) {
      const forms = contentWords.map(t => t.dictionary_form);
      const readings = contentWords.map(t => toHiragana(t.dict_reading));
      const frequencyTiers = await Promise.all(
        contentWords.map(t => lookupFrequencyTier(t.dictionary_form, toHiragana(t.dict_reading))),
      );
      await query(
        `INSERT INTO words (user_id, dictionary_form, reading, frequency_tier)
         SELECT $1, unnest($2::text[]), unnest($3::text[]), unnest($4::text[])
         ON CONFLICT (user_id, dictionary_form, reading) DO NOTHING`,
        [userId, forms, readings, frequencyTiers],
      );
    }
  } catch (err) {
    unregisterImportAbort(textId);
    // Aborted cancellations are intentional — don't write an error to the (now-deleted) row
    if (err instanceof Error && err.name === 'AbortError') return;
    const message = err instanceof Error ? err.message : 'Unknown error';
    await query(
      'UPDATE texts SET import_status = $1, import_error = $2 WHERE id = $3',
      ['error', message, textId],
    ).catch(() => { /* best-effort — DB may be unavailable */ });
    return;
  }
  unregisterImportAbort(textId);
}
