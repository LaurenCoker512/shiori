'use client';

interface ConfirmDialogProps {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm action"
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(44,42,40,0.45)' }}
    >
      <div
        className="rounded-2xl p-7 max-w-sm w-full mx-4"
        style={{
          background: 'var(--yg-paper-hi)',
          border: '1px solid var(--yg-rule)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
        }}
      >
        <p
          className="font-en text-[15px] leading-relaxed mb-6"
          style={{ color: 'var(--yg-ink)' }}
        >
          {message}
        </p>
        <div className="flex gap-2.5 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-5 py-2 rounded-full font-en text-[13px] font-medium border transition-colors"
            style={{
              color: 'var(--yg-ink-soft)',
              borderColor: 'var(--yg-rule)',
              backgroundColor: 'transparent',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 px-5 py-2 rounded-full font-en text-[13px] font-semibold"
            style={{
              backgroundColor: 'var(--yg-coral-dark)',
              color: '#faf3df',
              border: 'none',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
