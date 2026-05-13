import Link from 'next/link';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { ComprehensionList } from '@/components/dashboard/ComprehensionList';
import { TimeGreeting } from '@/components/ui/TimeGreeting';
import type { Tag } from '@/lib/types';

export default async function LibraryPage() {
  const user = await getSession();
  if (user === null) redirect('/login');

  const uid = user.id;

  const [comprehensionResult, processingResult] = await Promise.all([
  query<{ text_id: number; title: string; last_read_at: string | null; pct_known: string; tags: Tag[] }>(
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
         AND w.user_id = $1
       WHERE t.user_id = $1
         AND (token->>'is_content_word')::boolean = true
       GROUP BY t.id, t.title, t.last_read_at
     )
     SELECT
       ts.text_id, ts.title, ts.last_read_at,
       ROUND(ts.known_count::numeric / NULLIF(ts.total_count, 0) * 100, 1) AS pct_known,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', tg.id, 'name', tg.name, 'color', tg.color))
           FILTER (WHERE tg.id IS NOT NULL),
         '[]'
       ) AS tags
     FROM token_stats ts
     LEFT JOIN text_tags tt ON tt.text_id = ts.text_id
     LEFT JOIN tags tg      ON tg.id = tt.tag_id
     GROUP BY ts.text_id, ts.title, ts.last_read_at, ts.known_count, ts.total_count
     ORDER BY ts.last_read_at DESC NULLS LAST`,
    [uid],
  ),
  query<{ id: number; title: string }>(
    `SELECT id, title FROM texts WHERE user_id = $1 AND import_status IN ('pending', 'processing') ORDER BY id DESC`,
    [uid],
  ),
  ]);

  const comprehension = comprehensionResult.rows.map(r => ({
    text_id: r.text_id,
    title: r.title,
    last_read_at: r.last_read_at,
    pct_known: Number(r.pct_known),
    tags: r.tags ?? [],
  }));

  const processingTexts = processingResult.rows;
  const mostRecentText = comprehension[0] ?? null;

  return (
    <main className="px-4 sm:px-8 lg:px-14 py-6 sm:py-9 max-w-[1200px] mx-auto">
      {/* Page header */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-7">
        <div>
          <h1 className="font-jp text-[36px] font-medium tracking-tight mb-1.5" style={{ color: 'var(--yg-ink)' }}>
            ようこそ、{user.name}さん。
          </h1>
          <p className="font-en text-sm" style={{ color: 'var(--yg-ink-soft)' }}>
            <TimeGreeting />
          </p>
        </div>
        <Link
          href="/import"
          className="font-en text-[13px] font-medium inline-flex items-center gap-2 px-[18px] py-2.5 rounded-full"
          style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)' }}
        >
          <span className="text-base leading-none -mt-0.5">+</span>
          Import a text
        </Link>
      </div>

      {/* Continue reading hero */}
      <div className="mb-9">
        {mostRecentText !== null ? (
          <div
            className="rounded-2xl p-7 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--yg-coral) 0%, var(--yg-coral-dark) 100%)',
              color: '#faf3df',
              boxShadow: '0 6px 24px rgba(157, 90, 106, 0.22)',
            }}
          >
            <div
              className="absolute right-[-30px] bottom-[-50px] font-jp text-[240px] leading-none select-none pointer-events-none"
              style={{ color: 'rgba(255,255,255,0.07)', fontWeight: 400 }}
              aria-hidden="true"
            >
              雨
            </div>
            <div className="relative">
              <div className="font-en text-[11px] opacity-75 tracking-[2px] uppercase mb-2.5">
                Continue reading
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex-1 min-w-0">
                  <h2 className="font-en text-[28px] font-semibold mb-4 tracking-tight leading-[1.2] truncate">
                    {mostRecentText.title}
                  </h2>
                  <Link
                    href={`/texts/${mostRecentText.text_id}`}
                    className="font-en text-[13px] font-semibold inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full"
                    style={{ background: '#faf3df', color: 'var(--yg-coral-dark)' }}
                  >
                    Resume <span>→</span>
                  </Link>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-en text-[22px] font-semibold leading-none">{mostRecentText.pct_known}%</div>
                  <div className="font-en text-[10px] opacity-70 mt-0.5">known</div>
                  <div
                    className="h-1 rounded-sm mt-2"
                    style={{ width: 64, background: 'rgba(250,243,223,0.25)' }}
                  >
                    <div
                      className="h-full rounded-sm"
                      style={{ width: `${mostRecentText.pct_known}%`, background: '#faf3df' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl p-7 flex flex-col items-center justify-center gap-4 border"
            style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)' }}
          >
            <p className="font-en text-sm" style={{ color: 'var(--yg-ink-soft)' }}>No texts imported yet.</p>
            <Link
              href="/import"
              className="font-en text-[13px] font-medium px-5 py-2 rounded-full"
              style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)' }}
            >
              Import your first text
            </Link>
          </div>
        )}
      </div>

      {/* Library */}
      <section>
        <div className="mb-3.5">
          <h2 className="font-jp text-[20px] font-medium tracking-tight mb-1" style={{ color: 'var(--yg-ink)' }}>本棚</h2>
          <p className="font-en text-[13px]" style={{ color: 'var(--yg-ink-soft)' }}>
            Your library · {comprehension.length + processingTexts.length} {comprehension.length + processingTexts.length === 1 ? 'text' : 'texts'}
          </p>
        </div>
        <ComprehensionList comprehension={comprehension} processingTexts={processingTexts} />
      </section>
    </main>
  );
}

