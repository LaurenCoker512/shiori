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
    <span className="block mt-2 p-3 bg-gray-50 border rounded text-sm" aria-label="Grammar analysis">
      <span className="flex justify-between items-start mb-1">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Grammar</span>
        <button
          className="text-gray-400 hover:text-gray-600 text-xs leading-none ml-2"
          aria-label="Hide grammar analysis"
          onClick={e => { e.stopPropagation(); onClose(); }}
        >
          Hide
        </button>
      </span>
      <span aria-live="polite" aria-atomic="true">
        {loading && <Spinner />}
        {!loading && error && <span>Grammar analysis unavailable</span>}
        {!loading && !error && patterns !== null && patterns.length === 0 && (
          <span className="text-gray-500">No grammar patterns found</span>
        )}
        {!loading && !error && patterns !== null && patterns.length > 0 && (
          <ul>
            {patterns.map(pattern => (
              <li key={pattern.id} className="mb-2">
                <strong>{pattern.pattern}</strong>
                {pattern.jlpt_level !== null && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1 rounded">
                    {pattern.jlpt_level}
                  </span>
                )}
                <p className="text-gray-700 mt-1">{pattern.description_en}</p>
              </li>
            ))}
          </ul>
        )}
      </span>
    </span>
  );
}
