'use client';

import { useEffect, useState } from 'react';
import type { GrammarPattern } from '@/lib/types';
import { Spinner } from '@/components/ui/Spinner';

interface GrammarTooltipProps {
  textId: number;
  sentenceIndex: number;
  initialPatterns?: GrammarPattern[] | null;
  onPatternsLoaded?: (patterns: GrammarPattern[]) => void;
  onClose: () => void;
}

export function GrammarTooltip({
  textId,
  sentenceIndex,
  initialPatterns,
  onPatternsLoaded,
  onClose,
}: GrammarTooltipProps) {
  const hasInitialData = Array.isArray(initialPatterns);
  const [patterns, setPatterns] = useState<GrammarPattern[] | null>(hasInitialData ? initialPatterns : null);
  const [loading, setLoading] = useState(!hasInitialData);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (hasInitialData) return;
    fetch(`/api/sentences/${textId}/${sentenceIndex}/grammar`)
      .then(r => r.json())
      .then((data: { patterns?: GrammarPattern[] }) => {
        const fetched = Array.isArray(data.patterns) ? data.patterns : [];
        setPatterns(fetched);
        setLoading(false);
        onPatternsLoaded?.(fetched);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [textId, sentenceIndex, hasInitialData, onPatternsLoaded]);

  return (
    <div
      role="dialog"
      aria-label="Grammar analysis"
      className="fixed z-40 overflow-hidden"
      style={{
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(460px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 48px)',
        background: 'var(--yg-paper-hi)',
        border: '1px solid var(--yg-rule)',
        borderRadius: 16,
        boxShadow: '0 12px 40px rgba(0,0,0,0.10)',
        animation: 'yg-slide-up 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div className="flex justify-between items-center px-5 pt-4 pb-3 border-b" style={{ borderColor: 'var(--yg-rule)' }}>
        <span
          className="font-en text-[10px] font-semibold uppercase tracking-[1.4px]"
          style={{ color: 'var(--yg-ink-muted)' }}
        >
          Grammar
        </span>
        <button
          className="font-en text-[11px]"
          style={{ color: 'var(--yg-ink-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          aria-label="Close grammar analysis"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(100vh - 48px - 44px)' }}>
        <div aria-live="polite" aria-atomic="true">
          {loading && <Spinner />}
          {!loading && error && <span className="font-en text-sm" style={{ color: 'var(--yg-ink-soft)' }}>Grammar analysis unavailable</span>}
          {!loading && !error && patterns !== null && patterns.length === 0 && (
            <span className="font-en text-sm" style={{ color: 'var(--yg-ink-muted)' }}>No grammar patterns found</span>
          )}
          {!loading && !error && patterns !== null && patterns.length > 0 && (
            <ul className="space-y-3">
              {patterns.map(pattern => (
                <li key={pattern.id}>
                  <div className="flex items-center gap-2">
                    <strong className="font-jp text-[15px]" style={{ color: 'var(--yg-ink)' }}>
                      {pattern.pattern}
                    </strong>
                    {pattern.jlpt_level !== null && (
                      <span
                        className="font-en text-[10px] font-semibold tracking-[1px]"
                        style={{ color: 'var(--yg-coral)' }}
                      >
                        {pattern.jlpt_level}
                      </span>
                    )}
                  </div>
                  <p className="font-en text-[13px] mt-0.5 leading-relaxed" style={{ color: 'var(--yg-ink-soft)' }}>
                    {pattern.description_en}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
