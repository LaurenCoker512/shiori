import Link from 'next/link';
import { Spinner } from '@/components/ui/Spinner';

export interface ImportJob {
  id: number;
  title: string;
  phase: 'pending' | 'processing' | 'ready' | 'error';
  errorMessage?: string;
}

interface ImportToastProps {
  job: ImportJob;
  onDismiss: () => void;
  onCancel: () => void;
}

export function ImportToast({ job, onDismiss, onCancel }: ImportToastProps) {
  const accentColor =
    job.phase === 'ready' ? 'var(--yg-bamboo)' :
    job.phase === 'error' ? 'var(--yg-coral-dark)' :
    'var(--yg-coral)';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={
        job.phase === 'ready' ? `${job.title} is ready to read` :
        job.phase === 'error' ? 'Import failed' :
        `Importing ${job.title}`
      }
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
      {/* Accent bar */}
      <div className="w-1 shrink-0" style={{ background: accentColor }} />

      <div className="flex-1 px-4 py-3.5">
        {job.phase === 'pending' || job.phase === 'processing' ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Spinner />
              <div>
                <div className="font-en text-[12px] font-semibold" style={{ color: 'var(--yg-ink)' }}>
                  {job.title}
                </div>
                <div className="font-jp text-[11px]" style={{ color: 'var(--yg-ink-soft)' }}>
                  インポート中…
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel import"
              className="font-en text-[11px] font-medium px-3 py-1.5 rounded-full shrink-0"
              style={{ background: 'rgba(42,36,28,0.06)', border: 'none', color: 'var(--yg-ink-soft)', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        ) : job.phase === 'ready' ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-en text-[12px] font-semibold mb-1" style={{ color: 'var(--yg-ink)' }}>
                {job.title}
              </div>
              <div className="font-jp text-[11px] mb-2.5" style={{ color: 'var(--yg-ink-soft)' }}>
                準備完了
              </div>
              <Link
                href={`/texts/${job.id}`}
                onClick={onDismiss}
                className="font-en text-[11px] font-semibold px-3 py-1.5 rounded-full inline-block"
                style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)' }}
              >
                Read now →
              </Link>
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
                Import failed
              </div>
              {job.errorMessage !== undefined && (
                <div className="font-en text-[11px] leading-relaxed" style={{ color: 'var(--yg-ink-soft)' }}>
                  {job.errorMessage}
                </div>
              )}
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
