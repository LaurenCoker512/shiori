'use client';

import { useEffect, useState } from 'react';
import type { GrammarPattern } from '@/lib/types';
import { Spinner } from '@/components/ui/Spinner';

interface GrammarTooltipProps {
  textId: number;
  sentenceIndex: number;
  onClose: () => void;
}

export function GrammarTooltip({ textId, sentenceIndex, onClose }: GrammarTooltipProps) {
  const [patterns, setPatterns] = useState<GrammarPattern[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/sentences/${textId}/${sentenceIndex}/grammar`)
      .then(r => r.json())
      .then((data: { patterns?: GrammarPattern[] }) => {
        setPatterns(Array.isArray(data.patterns) ? data.patterns : []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [textId, sentenceIndex]);

  return (
    <div className="mt-2 p-3 bg-gray-50 border rounded text-sm" aria-label="Grammar analysis">
      <div aria-live="polite" aria-atomic="true">
        {loading && <Spinner />}
        {!loading && error && <p>Grammar analysis unavailable</p>}
        {!loading && !error && patterns !== null && patterns.length === 0 && (
          <p className="text-gray-500">No grammar patterns found</p>
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
      </div>
    </div>
  );
}
