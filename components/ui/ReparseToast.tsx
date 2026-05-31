import { Spinner } from '@/components/ui/Spinner';

export interface ReparseJob {
  phase: 'running' | 'done' | 'error';
  // single-text mode: title is set, current/total are 1/1
  title?: string;
  current: number;
  total: number;
}

interface ReparseToastProps {
  job: ReparseJob;
  onDismiss: () => void;
}

export function ReparseToast({ job, onDismiss }: ReparseToastProps) {
  const isSingle = job.title !== undefined;

  const accentColor =
    job.phase === 'done' ? 'var(--yg-bamboo)' :
    job.phase === 'error' ? 'var(--yg-coral-dark)' :
    'var(--yg-coral)';

  const ariaLabel =
    job.phase === 'done'
      ? isSingle ? `Re-parse of ${job.title} complete` : 'Re-parse complete'
      : job.phase === 'error'
      ? 'Re-parse failed'
      : isSingle
      ? `Re-parsing ${job.title}`
      : `Re-parsing texts, ${job.current} of ${job.total} complete`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className="fixed bottom-6 right-6 z-50 flex overflow-hidden"
      style={{
        width: 320,
        background: 'var(--yg-paper-hi)',
        border: '1px solid var(--yg-rule)',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
        animation: 'yg-slide-up 0.2s ease-out',
      }}
    >
      <div className="w-1 shrink-0" style={{ background: accentColor }} />

      <div className="flex-1 px-4 py-3.5">
        {job.phase === 'running' ? (
          <div className="flex items-center gap-3">
            <Spinner />
            <div>
              <div className="font-en text-[12px] font-semibold" style={{ color: 'var(--yg-ink)' }}>
                {isSingle ? job.title : 'Re-parsing texts'}
              </div>
              <div className="font-en text-[11px]" style={{ color: 'var(--yg-ink-soft)' }}>
                {isSingle ? 'Re-parsing…' : job.total > 0 ? `${job.current} of ${job.total} complete` : 'Loading…'}
              </div>
            </div>
          </div>
        ) : job.phase === 'done' ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-en text-[12px] font-semibold mb-1" style={{ color: 'var(--yg-ink)' }}>
                {isSingle ? job.title : 'Re-parse complete'}
              </div>
              <div className="font-en text-[11px] leading-relaxed" style={{ color: 'var(--yg-ink-soft)' }}>
                {isSingle ? 'Re-parse complete.' : 'Run vocabulary cleanup to normalize any newly inserted words.'}
              </div>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              className="w-6 h-6 flex items-center justify-center rounded-full shrink-0 font-en text-sm"
              style={{ background: 'rgba(42,36,28,0.06)', border: 'none', color: 'var(--yg-ink-soft)', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-en text-[12px] font-semibold mb-1" style={{ color: 'var(--yg-ink)' }}>
                Re-parse failed
              </div>
              <div className="font-en text-[11px]" style={{ color: 'var(--yg-ink-soft)' }}>
                {isSingle ? 'Please try again.' : 'Please try again from Settings.'}
              </div>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              className="w-6 h-6 flex items-center justify-center rounded-full shrink-0 font-en text-sm"
              style={{ background: 'rgba(42,36,28,0.06)', border: 'none', color: 'var(--yg-ink-soft)', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
