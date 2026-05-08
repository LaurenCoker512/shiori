import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import type { GrammarPattern } from '@/lib/types';
import { GrammarPatternLog } from '@/components/dashboard/GrammarPatternLog';

export default async function GrammarPage() {
  const user = await getSession();
  if (user === null) redirect('/login');

  const grammarResult = await query<GrammarPattern & { sentence_count: string }>(
    `SELECT gp.*, COUNT(sp.id) AS sentence_count
     FROM grammar_patterns gp
     LEFT JOIN sentence_patterns sp ON sp.grammar_pattern_id = gp.id
     WHERE gp.user_id = $1
     GROUP BY gp.id ORDER BY gp.first_encountered_at ASC`,
    [user.id],
  );

  const grammarPatterns = grammarResult.rows.map(r => ({
    ...r,
    sentence_count: Number(r.sentence_count),
  }));

  return (
    <main className="px-14 py-9 max-w-[1200px] mx-auto">
      <div className="mb-7">
        <span className="font-en text-[11px] font-semibold tracking-[1.5px] uppercase" style={{ color: 'var(--yg-coral)' }}>
          文法 · Grammar
        </span>
        <h1 className="font-jp text-[36px] font-medium tracking-tight mt-1 mb-1" style={{ color: 'var(--yg-ink)' }}>
          文法帖
        </h1>
        <p className="font-en text-sm" style={{ color: 'var(--yg-ink-soft)' }}>
          Grammar patterns Shiori found in your texts.
        </p>
      </div>

      <GrammarPatternLog patterns={grammarPatterns} />
    </main>
  );
}
