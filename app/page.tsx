import Link from 'next/link';
import { query } from '@/lib/db';
import type { Word, GrammarPattern } from '@/lib/types';
import { VocabularyChart } from '@/components/dashboard/VocabularyChart';
import { ComprehensionList } from '@/components/dashboard/ComprehensionList';
import { WordBrowser } from '@/components/dashboard/WordBrowser';
import { GrammarPatternLog } from '@/components/dashboard/GrammarPatternLog';

export default async function DashboardPage() {
  const [seenResult, knownResult, comprehensionResult, grammarResult, wordsResult, wordsCountResult] =
    await Promise.all([
      query<{ date: string; count: string }>(
        `SELECT DATE(seen_at) AS date, COUNT(*) AS count
         FROM words WHERE user_id = 1 AND seen_at IS NOT NULL
         GROUP BY DATE(seen_at) ORDER BY date ASC`,
      ),
      query<{ date: string; count: string }>(
        `SELECT DATE(known_at) AS date, COUNT(*) AS count
         FROM words WHERE user_id = 1 AND known_at IS NOT NULL
         GROUP BY DATE(known_at) ORDER BY date ASC`,
      ),
      query<{ text_id: number; title: string; last_read_at: string | null; pct_known: string }>(
        `WITH token_stats AS (
           SELECT
             t.id AS text_id, t.title, t.last_read_at,
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
         FROM token_stats ORDER BY last_read_at DESC NULLS LAST`,
      ),
      query<GrammarPattern & { sentence_count: string }>(
        `SELECT gp.*, COUNT(sp.id) AS sentence_count
         FROM grammar_patterns gp
         LEFT JOIN sentence_patterns sp ON sp.grammar_pattern_id = gp.id
         WHERE gp.user_id = 1
         GROUP BY gp.id ORDER BY gp.first_encountered_at ASC`,
      ),
      query<Word>(
        `SELECT * FROM words WHERE user_id = 1 ORDER BY seen_at DESC NULLS LAST LIMIT 50`,
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM words WHERE user_id = 1`,
      ),
    ]);

  const seenSeries = seenResult.rows.map(r => ({ date: r.date, count: Number(r.count) }));
  const knownSeries = knownResult.rows.map(r => ({ date: r.date, count: Number(r.count) }));
  const comprehension = comprehensionResult.rows.map(r => ({
    text_id: r.text_id,
    title: r.title,
    last_read_at: r.last_read_at,
    pct_known: Number(r.pct_known),
  }));
  const grammarPatterns = grammarResult.rows.map(r => ({
    ...r,
    sentence_count: Number(r.sentence_count),
  }));
  const initialWords = wordsResult.rows;
  const initialTotal = Number(wordsCountResult.rows[0]?.total ?? 0);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">栞 Dashboard</h1>
        <Link href="/import" className="text-blue-600 hover:underline text-sm">
          + Import text
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">Vocabulary Progress</h2>
          <VocabularyChart seenSeries={seenSeries} knownSeries={knownSeries} />
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-4">Texts</h2>
          <ComprehensionList comprehension={comprehension} />
        </section>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Word Browser</h2>
        <WordBrowser initialWords={initialWords} initialTotal={initialTotal} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Grammar Patterns</h2>
        <GrammarPatternLog patterns={grammarPatterns} />
      </section>
    </main>
  );
}
