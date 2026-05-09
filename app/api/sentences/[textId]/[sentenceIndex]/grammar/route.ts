import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { analyzeGrammar, describeGrammarPattern, buildLLMConfig } from '@/lib/claude';
import type { GrammarPattern, Sentence } from '@/lib/types';
import { jsonResponse } from '@/lib/api';

export async function GET(
  _request: Request,
  { params }: { params: { textId: string; sentenceIndex: string } },
): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);
  const llmConfig = buildLLMConfig(user);
  if (llmConfig === null) {
    return jsonResponse({ error: 'API key not configured. Add your key in Settings.' }, 403);
  }

  const textId = parseInt(params.textId, 10);
  const sentenceIndex = parseInt(params.sentenceIndex, 10);

  if (isNaN(textId) || isNaN(sentenceIndex)) {
    return jsonResponse({ error: 'Invalid params' }, 400);
  }

  const cachedRows = await query<{ grammar_pattern_id: number | null }>(
    'SELECT grammar_pattern_id FROM sentence_patterns WHERE text_id = $1 AND sentence_index = $2',
    [textId, sentenceIndex],
  );

  if (cachedRows.rows.length > 0) {
    const patternIds = cachedRows.rows
      .map(r => r.grammar_pattern_id)
      .filter((id): id is number => id !== null);

    if (patternIds.length === 0) {
      return jsonResponse({ patterns: [] });
    }

    const patternsResult = await query<GrammarPattern>(
      'SELECT * FROM grammar_patterns WHERE id = ANY($1)',
      [patternIds],
    );
    return jsonResponse({ patterns: patternsResult.rows });
  }

  const textResult = await query<{ parsed_content: Sentence[] }>(
    'SELECT parsed_content FROM texts WHERE id = $1 AND user_id = $2',
    [textId, user.id],
  );

  if (textResult.rows.length === 0) {
    return jsonResponse({ error: 'Not found' }, 404);
  }

  const sentence = textResult.rows[0].parsed_content.find(
    s => s.sentence_index === sentenceIndex,
  );

  if (!sentence) {
    return jsonResponse({ error: 'Sentence not found' }, 404);
  }

  try {
    const grammarHints = await analyzeGrammar(llmConfig, sentence.raw);

    if (grammarHints.length === 0) {
      await query(
        'INSERT INTO sentence_patterns (text_id, sentence_index, grammar_pattern_id) VALUES ($1, $2, NULL)',
        [textId, sentenceIndex],
      );
      return jsonResponse({ patterns: [] });
    }

    const patterns: GrammarPattern[] = [];

    for (const hint of grammarHints) {
      const existingResult = await query<GrammarPattern>(
        'SELECT * FROM grammar_patterns WHERE user_id = $1 AND pattern = $2',
        [user.id, hint.pattern],
      );

      let grammarPattern: GrammarPattern;

      if (existingResult.rows.length > 0) {
        grammarPattern = existingResult.rows[0];
      } else {
        const description = await describeGrammarPattern(llmConfig, hint.pattern);
        const insertResult = await query<GrammarPattern>(
          `INSERT INTO grammar_patterns (user_id, pattern, description_en, jlpt_level)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [user.id, hint.pattern, description, hint.jlpt_level ?? null],
        );
        grammarPattern = insertResult.rows[0];
      }

      await query(
        `INSERT INTO sentence_patterns (text_id, sentence_index, grammar_pattern_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [textId, sentenceIndex, grammarPattern.id],
      );

      patterns.push(grammarPattern);
    }

    return jsonResponse({ patterns });
  } catch {
    return jsonResponse({ patterns: [], error: 'Grammar analysis unavailable' }, 500);
  }
}
