'use client';

import { useState } from 'react';
import type { GrammarPattern } from '@/lib/types';
import { Spinner } from '@/components/ui/Spinner';

interface SentenceEntry {
  text_id: number;
  title: string;
  sentence_index: number;
  sentence_raw: string;
}

interface GrammarPatternLogProps {
  patterns: (GrammarPattern & { sentence_count: number })[];
}

export function GrammarPatternLog({ patterns }: GrammarPatternLogProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sentencesMap, setSentencesMap] = useState<Record<number, SentenceEntry[]>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);

  async function handleToggle(pattern: GrammarPattern & { sentence_count: number }) {
    if (expandedId === pattern.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(pattern.id);

    if (sentencesMap[pattern.id] !== undefined) return;

    setLoadingId(pattern.id);
    const res = await fetch(`/api/grammar-patterns/${pattern.id}/sentences`);
    const data = await res.json() as { sentences: SentenceEntry[] };
    setSentencesMap(prev => ({ ...prev, [pattern.id]: data.sentences }));
    setLoadingId(null);
  }

  if (patterns.length === 0) {
    return <p className="text-gray-500 text-sm">No grammar patterns encountered yet.</p>;
  }

  return (
    <ul className="divide-y divide-gray-200">
      {patterns.map(pattern => {
        const isExpanded = expandedId === pattern.id;
        const sentences = sentencesMap[pattern.id];
        const isLoading = loadingId === pattern.id;

        const groups: Record<string, SentenceEntry[]> = {};
        if (sentences !== undefined) {
          for (const s of sentences) {
            if (groups[s.title] === undefined) groups[s.title] = [];
            groups[s.title].push(s);
          }
        }

        return (
          <li key={pattern.id}>
            <button
              type="button"
              className="w-full text-left py-3 flex justify-between items-center hover:bg-gray-50"
              onClick={() => { void handleToggle(pattern); }}
              aria-expanded={isExpanded}
            >
              <div className="flex items-center gap-2">
                <strong>{pattern.pattern}</strong>
                {pattern.jlpt_level !== null && (
                  <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{pattern.jlpt_level}</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{pattern.sentence_count} sentences</span>
                <span aria-hidden="true">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </button>
            {isExpanded && (
              <div className="pb-3 pl-4">
                {isLoading ? (
                  <Spinner />
                ) : (
                  Object.entries(groups).map(([title, titleSentences]) => (
                    <div key={title} className="mb-3">
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">{title}</h4>
                      <ul className="space-y-1">
                        {titleSentences.map(s => (
                          <li key={`${s.text_id}-${s.sentence_index}`} className="text-sm text-gray-800">
                            {s.sentence_raw}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
