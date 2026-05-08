import Link from 'next/link';

interface ComprehensionEntry {
  text_id: number;
  title: string;
  last_read_at: string | null;
  pct_known: number;
}

interface ProcessingEntry {
  id: number;
  title: string;
}

interface ComprehensionListProps {
  comprehension: ComprehensionEntry[];
  processingTexts?: ProcessingEntry[];
}

const MOODS = ['persimmon', 'moss', 'twilight', 'gold'];

const MOOD_GRADIENTS: Record<string, string> = {
  persimmon: 'linear-gradient(135deg, var(--yg-card-coral-hi), var(--yg-card-coral-lo))',
  moss:      'linear-gradient(135deg, var(--yg-card-bamboo-hi), var(--yg-card-bamboo-lo))',
  twilight:  'linear-gradient(135deg, var(--yg-card-indigo-hi), var(--yg-card-indigo-lo))',
  gold:      'linear-gradient(135deg, var(--yg-card-gold-hi), var(--yg-card-gold-lo))',
};

export function ComprehensionList({ comprehension, processingTexts = [] }: ComprehensionListProps) {
  if (comprehension.length === 0 && processingTexts.length === 0) {
    return (
      <p className="font-en text-sm" style={{ color: 'var(--yg-ink-soft)' }}>
        No texts imported yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
      {processingTexts.map(entry => (
        <div
          key={`processing-${entry.id}`}
          className="relative rounded-xl overflow-hidden flex items-center gap-4 px-5 py-4 border"
          style={{
            background: 'var(--yg-paper-hi)',
            borderColor: 'var(--yg-rule)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
          }}
          aria-label={`${entry.title} — processing`}
        >
          <div className="flex-1 min-w-0">
            <div className="font-jp text-[18px] font-medium leading-[1.3] tracking-tight truncate" style={{ color: 'var(--yg-ink)' }}>
              {entry.title}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--yg-coral)' }}
                aria-hidden="true"
              />
              <span className="font-en text-[11px]" style={{ color: 'var(--yg-ink-muted)' }}>Processing…</span>
            </div>
          </div>
        </div>
      ))}
      {comprehension.map((entry, idx) => {
        const gradient = MOOD_GRADIENTS[MOODS[idx % MOODS.length]];
        const lastRead = entry.last_read_at !== null
          ? new Date(entry.last_read_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })
          : 'Not started';

        return (
          <Link
            key={entry.text_id}
            href={`/texts/${entry.text_id}`}
            className="block"
            style={{ textDecoration: 'none' }}
          >
            <div
              className="relative rounded-xl overflow-hidden flex items-center gap-4 px-5 py-4"
              style={{ background: gradient, color: '#faf3df', boxShadow: '0 4px 12px rgba(0,0,0,0.10)' }}
            >
              {/* Sheen */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.10), transparent 50%)' }}
                aria-hidden="true"
              />
              {/* Title */}
              <div className="relative flex-1 min-w-0">
                <div className="font-jp text-[18px] font-medium leading-[1.3] tracking-tight truncate">
                  {entry.title}
                </div>
                <div className="font-en text-[11px] opacity-70 mt-0.5">{lastRead}</div>
              </div>
              {/* Progress */}
              <div className="relative shrink-0 text-right">
                <div className="font-en text-[22px] font-semibold leading-none">{entry.pct_known}%</div>
                <div className="font-en text-[10px] opacity-70 mt-0.5">known</div>
                <div
                  className="h-1 rounded-sm mt-2"
                  style={{ width: 64, background: 'rgba(250,243,223,0.25)' }}
                >
                  <div
                    className="h-full rounded-sm"
                    style={{ width: `${entry.pct_known}%`, background: '#faf3df' }}
                  />
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
