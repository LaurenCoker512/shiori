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
  }, [textId, sentenceIndex]);

  return (
    <span
      className="block mt-2 rounded-[10px] p-4 font-en text-sm"
      style={{
        background: 'var(--yg-paper)',
        border: '1px solid var(--yg-rule)',
      }}
      aria-label="Grammar analysis"
    >
      <span className="flex justify-between items-start mb-2">
        <span
          className="font-en text-[10px] font-semibold uppercase tracking-[1.4px]"
          style={{ color: 'var(--yg-ink-muted)' }}
        >
          Grammar
        </span>
        <button
          className="font-en text-[11px] ml-2"
          style={{ color: 'var(--yg-ink-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          aria-label="Hide grammar analysis"
          onClick={e => { e.stopPropagation(); onClose(); }}
        >
          Hide
        </button>
      </span>
      <span aria-live="polite" aria-atomic="true">
        {loading && <Spinner />}
        {!loading && error && <span style={{ color: 'var(--yg-ink-soft)' }}>Grammar analysis unavailable</span>}
        {!loading && !error && patterns !== null && patterns.length === 0 && (
          <span style={{ color: 'var(--yg-ink-muted)' }}>No grammar patterns found</span>
        )}
        {!loading && !error && patterns !== null && patterns.length > 0 && (
          <ul className="space-y-2">
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
      </span>
    </span>
  );
}
