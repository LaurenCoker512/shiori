import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { VocabularyChart } from '@/components/dashboard/VocabularyChart';
import { WordBrowser } from '@/components/dashboard/WordBrowser';

export default async function VocabularyPage() {
  const user = await getSession();
  if (user === null) redirect('/login');

  const uid = user.id;

  const [seenResult, knownResult] = await Promise.all([
    query<{ date: string; count: string }>(
      `SELECT DATE(seen_at) AS date, COUNT(*) AS count
       FROM words WHERE user_id = $1 AND seen_at IS NOT NULL
       GROUP BY DATE(seen_at) ORDER BY date ASC`,
      [uid],
    ),
    query<{ date: string; count: string }>(
      `SELECT DATE(known_at) AS date, COUNT(*) AS count
       FROM words WHERE user_id = $1 AND known_at IS NOT NULL
       GROUP BY DATE(known_at) ORDER BY date ASC`,
      [uid],
    ),
  ]);

  const seenSeries = seenResult.rows.map(r => ({ date: r.date, count: Number(r.count) }));
  const knownSeries = knownResult.rows.map(r => ({ date: r.date, count: Number(r.count) }));

  return (
    <main className="px-14 py-9 max-w-[1200px] mx-auto">
      <div className="mb-7">
        <span className="font-en text-[11px] font-semibold tracking-[1.5px] uppercase" style={{ color: 'var(--yg-coral)' }}>
          語彙 · Vocabulary
        </span>
        <h1 className="font-jp text-[36px] font-medium tracking-tight mt-1 mb-1" style={{ color: 'var(--yg-ink)' }}>
          語彙帖
        </h1>
        <p className="font-en text-sm" style={{ color: 'var(--yg-ink-soft)' }}>
          Every word you&apos;ve crossed paths with — searchable, filterable.
        </p>
      </div>

      {/* Chart */}
      <div
        className="rounded-2xl p-6 border mb-8"
        style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)' }}
      >
        <div className="font-en text-[11px] tracking-[1px] uppercase mb-0.5" style={{ color: 'var(--yg-ink-muted)' }}>
          Progress
        </div>
        <div className="font-jp text-[18px] font-medium mb-4" style={{ color: 'var(--yg-ink)' }}>語彙の歩み</div>
        <VocabularyChart seenSeries={seenSeries} knownSeries={knownSeries} />
      </div>

      <WordBrowser />
    </main>
  );
}
