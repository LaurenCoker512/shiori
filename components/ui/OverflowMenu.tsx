'use client';

import { useState } from 'react';

interface OverflowMenuProps {
  onRename: () => void;
  onDelete: () => void;
  onReparse?: () => void;
  onTags?: () => void;
  variant?: 'default' | 'light';
}

export function OverflowMenu({ onRename, onDelete, onReparse, onTags, variant = 'default' }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);

  const isLight = variant === 'light';

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="More options"
        aria-expanded={open}
        className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-xl leading-none transition-colors"
        style={{
          color: isLight ? 'rgba(250,243,223,0.75)' : 'var(--yg-ink-muted)',
          backgroundColor: open
            ? isLight ? 'rgba(250,243,223,0.15)' : 'var(--yg-rule-soft)'
            : 'transparent',
        }}
        onClick={() => setOpen(prev => !prev)}
      >
        ⋮
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
          aria-label="Text options"
          className="absolute right-0 top-full mt-1.5 w-40 rounded-xl overflow-hidden z-20"
          style={{
            background: 'var(--yg-paper-hi)',
            border: '1px solid var(--yg-rule)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.10)',
          }}
        >
          {onTags !== undefined && (
            <button
              type="button"
              role="menuitem"
              className="w-full text-left min-h-11 px-4 py-2.5 font-en text-[13px] flex items-center transition-colors hover:bg-[var(--yg-rule)] focus-visible:outline-none focus-visible:bg-[var(--yg-rule)]"
              style={{ color: 'var(--yg-ink)' }}
              onClick={() => { setOpen(false); onTags(); }}
            >
              Tags
            </button>
          )}
          {onReparse !== undefined && (
            <button
              type="button"
              role="menuitem"
              className="w-full text-left min-h-11 px-4 py-2.5 font-en text-[13px] flex items-center transition-colors hover:bg-[var(--yg-rule)] focus-visible:outline-none focus-visible:bg-[var(--yg-rule)]"
              style={{ color: 'var(--yg-ink)' }}
              onClick={() => { setOpen(false); onReparse(); }}
            >
              Reparse
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="w-full text-left min-h-11 px-4 py-2.5 font-en text-[13px] flex items-center transition-colors hover:bg-[var(--yg-rule)] focus-visible:outline-none focus-visible:bg-[var(--yg-rule)]"
            style={{ color: 'var(--yg-ink)' }}
            onClick={() => { setOpen(false); onRename(); }}
          >
            Rename
          </button>
          <div style={{ borderTop: '1px solid var(--yg-rule)' }} />
          <button
            type="button"
            role="menuitem"
            className="w-full text-left min-h-11 px-4 py-2.5 font-en text-[13px] flex items-center transition-colors hover:bg-[var(--yg-rule)] focus-visible:outline-none focus-visible:bg-[var(--yg-rule)]"
            style={{ color: 'var(--yg-coral-dark)' }}
            onClick={() => { setOpen(false); onDelete(); }}
          >
            Delete
          </button>
          </div>
        </>
      )}
    </div>
  );
}
