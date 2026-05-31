import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { jsonResponse } from '@/lib/api';
import { lookupFrequencyTier } from '@/lib/frequency';
import { toHiragana } from '@/lib/text-processing';

interface NormalizationItem {
  id: number;
  canonical_dictionary_form: string;
}

interface CleanupPayload {
  normalizations: NormalizationItem[];
  frequency_backfill_ids: number[];
}

interface WordRow {
  id: number;
  status: string;
  user_translation: string | null;
}

const STATUS_RANK: Record<string, number> = { known: 0, seen: 1, unseen: 2 };

function pickWinner(a: WordRow, b: WordRow): [winner: WordRow, loser: WordRow] {
  const statusDiff = (STATUS_RANK[a.status] ?? 3) - (STATUS_RANK[b.status] ?? 3);
  if (statusDiff < 0) return [a, b];
  if (statusDiff > 0) return [b, a];
  if (a.user_translation !== null && b.user_translation === null) return [a, b];
  if (a.user_translation === null && b.user_translation !== null) return [b, a];
  return a.id < b.id ? [a, b] : [b, a];
}

async function mergeWords(winner: WordRow, loser: WordRow, userId: number): Promise<void> {
  if (winner.user_translation === null && loser.user_translation !== null) {
    await query(`UPDATE words SET user_translation = $1 WHERE id = $2`, [loser.user_translation, winner.id]);
  }
  await query(`DELETE FROM words WHERE id = $1 AND user_id = $2`, [loser.id, userId]);
}

export async function POST(request: Request): Promise<Response> {
  const user = await getSession();
  if (user === null) return jsonResponse({ error: 'Unauthorized' }, 401);

  const body = await request.json() as CleanupPayload;
  const { normalizations, frequency_backfill_ids } = body;

  // 0. Prune words not referenced in any text's current parsed_content.
  // dict_reading in JSON may be katakana (LLM sometimes ignores the hiragana
  // instruction) while word.reading is always stored as hiragana. Normalize
  // in JS before comparing so we never incorrectly delete real words.
  const rawContentWords = await query<{ dictionary_form: string; raw_reading: string }>(
    `SELECT DISTINCT
       t->>'dictionary_form' AS dictionary_form,
       t->>'dict_reading'    AS raw_reading
     FROM texts,
          jsonb_array_elements(parsed_content) AS s,
          jsonb_array_elements(s->'tokens') AS t
     WHERE texts.user_id = $1
       AND (t->>'is_content_word')::boolean = true`,
    [user.id],
  );

  const keepSeen = new Set<string>();
  const keepForms: string[] = [];
  const keepReadings: string[] = [];
  for (const { dictionary_form, raw_reading } of rawContentWords.rows) {
    const reading = toHiragana(raw_reading);
    const key = `${dictionary_form}|${reading}`;
    if (!keepSeen.has(key)) {
      keepSeen.add(key);
      keepForms.push(dictionary_form);
      keepReadings.push(reading);
    }
  }

  const pruneResult = keepForms.length > 0
    ? await query<{ id: number }>(
        `DELETE FROM words w
         WHERE w.user_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM unnest($2::text[], $3::text[]) AS cw(dictionary_form, reading)
             WHERE cw.dictionary_form = w.dictionary_form
               AND cw.reading = w.reading
           )
         RETURNING id`,
        [user.id, keepForms, keepReadings],
      )
    : await query<{ id: number }>(
        `DELETE FROM words WHERE user_id = $1 RETURNING id`,
        [user.id],
      );
  const pruned = pruneResult.rows.length;

  let normalized = 0;
  let merged = 0;

  // 1. Apply normalizations, handling unique-constraint collisions inline
  for (const { id, canonical_dictionary_form } of normalizations) {
    const wordResult = await query<{ reading: string; status: string; user_translation: string | null }>(
      `SELECT reading, status, user_translation FROM words WHERE id = $1 AND user_id = $2`,
      [id, user.id],
    );
    if (wordResult.rows.length === 0) continue;
    const wordRow = wordResult.rows[0]!;

    // Check for an existing row with the canonical form + same reading
    const conflictResult = await query<WordRow>(
      `SELECT id, status, user_translation FROM words
       WHERE user_id = $1 AND dictionary_form = $2 AND reading = $3 AND id != $4`,
      [user.id, canonical_dictionary_form, wordRow.reading, id],
    );

    if (conflictResult.rows.length > 0) {
      // Collision: merge the two rows without touching the unique constraint
      const existing = conflictResult.rows[0]!;
      const thisWord: WordRow = { id, status: wordRow.status, user_translation: wordRow.user_translation };
      const [winner] = pickWinner(thisWord, existing);

      if (winner.id === id) {
        // Winner is the word being normalized — delete the conflicting row first to free
        // the unique constraint slot, then rename this row to the canonical form.
        await mergeWords(winner, existing, user.id);
        await query(`UPDATE words SET dictionary_form = $1 WHERE id = $2`, [canonical_dictionary_form, id]);
      } else {
        // Winner is the existing canonical row — just remove the word being normalized
        await mergeWords(winner, thisWord, user.id);
      }
      normalized++;
      merged++;
    } else {
      // No collision — straightforward update; skip if already canonical (idempotent)
      const result = await query<{ id: number }>(
        `UPDATE words SET dictionary_form = $1 WHERE id = $2 AND user_id = $3 AND dictionary_form != $1 RETURNING id`,
        [canonical_dictionary_form, id, user.id],
      );
      normalized += result.rows.length;
    }
  }

  // 2. Dedup pass — catch any pre-existing duplicates not caused by the normalizations above
  const dupResult = await query<{ dictionary_form: string; reading: string }>(
    `SELECT dictionary_form, reading FROM words WHERE user_id = $1 GROUP BY dictionary_form, reading HAVING COUNT(*) > 1`,
    [user.id],
  );

  for (const { dictionary_form, reading } of dupResult.rows) {
    const groupResult = await query<WordRow>(
      `SELECT id, status, user_translation FROM words WHERE user_id = $1 AND dictionary_form = $2 AND reading = $3`,
      [user.id, dictionary_form, reading],
    );
    const group = groupResult.rows;
    if (group.length <= 1) continue;

    group.sort((a, b) => {
      const statusDiff = (STATUS_RANK[a.status] ?? 3) - (STATUS_RANK[b.status] ?? 3);
      if (statusDiff !== 0) return statusDiff;
      if (a.user_translation !== null && b.user_translation === null) return -1;
      if (a.user_translation === null && b.user_translation !== null) return 1;
      return a.id - b.id;
    });

    const winner = group[0]!;
    const losers = group.slice(1);

    if (winner.user_translation === null) {
      const translationSource = losers.find(l => l.user_translation !== null);
      if (translationSource !== undefined) {
        await query(`UPDATE words SET user_translation = $1 WHERE id = $2`, [translationSource.user_translation, winner.id]);
      }
    }

    const loserIds = losers.map(l => l.id);
    await query(`DELETE FROM words WHERE id = ANY($1::int[]) AND user_id = $2`, [loserIds, user.id]);
    merged += loserIds.length;
  }

  // 3. Frequency backfill
  let frequencyBackfilled = 0;
  if (frequency_backfill_ids.length > 0) {
    const wordsResult = await query<{ id: number; dictionary_form: string; reading: string }>(
      `SELECT id, dictionary_form, reading FROM words WHERE id = ANY($1::int[]) AND user_id = $2 AND frequency_tier IS NULL`,
      [frequency_backfill_ids, user.id],
    );
    for (const word of wordsResult.rows) {
      const tier = await lookupFrequencyTier(word.dictionary_form, word.reading);
      if (tier !== null) {
        const result = await query<{ id: number }>(
          `UPDATE words SET frequency_tier = $1 WHERE id = $2 AND user_id = $3 AND frequency_tier IS NULL RETURNING id`,
          [tier, word.id, user.id],
        );
        frequencyBackfilled += result.rows.length;
      }
    }
  }

  return jsonResponse({ pruned, normalized, merged, frequencyBackfilled });
}
