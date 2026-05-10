'use client';

import { useState } from 'react';
import type { GrammarPattern, JlptLevel } from '@/lib/types';
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

const JLPT_ORDER: (JlptLevel | null)[] = ['N5', 'N4', 'N3', 'N2', 'N1', null];

function groupByJlpt(patterns: (GrammarPattern & { sentence_count: number })[]) {
  const map = new Map<JlptLevel | null, (GrammarPattern & { sentence_count: number })[]>();
  for (const level of JLPT_ORDER) map.set(level, []);
  for (const p of patterns) {
    const key = JLPT_ORDER.includes(p.jlpt_level) ? p.jlpt_level : null;
    map.get(key)!.push(p);
  }
  return map;
}

export function GrammarPatternLog({ patterns }: GrammarPatternLogProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(JLPT_ORDER.map(l => l ?? 'Other')),
  );
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sentencesMap, setSentencesMap] = useState<Record<number, SentenceEntry[]>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);

  function toggleSection(label: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  async function handleTogglePattern(pattern: GrammarPattern & { sentence_count: number }) {
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
    return (
      <p className="font-en text-sm" style={{ color: 'var(--yg-ink-soft)' }}>
        No grammar patterns encountered yet.
      </p>
    );
  }

  const grouped = groupByJlpt(patterns);

  return (
    <div className="flex flex-col gap-6">
      {JLPT_ORDER.map(level => {
        const sectionPatterns = grouped.get(level) ?? [];
        if (sectionPatterns.length === 0) return null;

        const label = level ?? 'Other';
        const isOpen = expandedSections.has(label);

        return (
          <section key={label}>
            <button
              type="button"
              onClick={() => toggleSection(label)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-3 mb-3"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <span
                className="font-en text-[13px] font-bold tracking-[1px] uppercase"
                style={{ color: 'var(--yg-coral-dark)' }}
              >
                {label}
              </span>
              <span
                className="font-en text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: 'var(--yg-seen)', color: 'var(--yg-coral-dark)' }}
              >
                {sectionPatterns.length} {sectionPatterns.length === 1 ? 'pattern' : 'patterns'}
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--yg-rule)' }} aria-hidden="true" />
              <span
                className="font-en text-xs transition-transform"
                style={{
                  color: 'var(--yg-ink-muted)',
                  display: 'inline-block',
                  transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                }}
                aria-hidden="true"
              >
                ▼
              </span>
            </button>

            {isOpen && (
              <div className="flex flex-col gap-2">
                {sectionPatterns.map(pattern => {
                  const isExpanded = expandedId === pattern.id;
                  const sentences = sentencesMap[pattern.id];
                  const isLoading = loadingId === pattern.id;

                  const byText: Record<string, SentenceEntry[]> = {};
                  if (sentences !== undefined) {
                    for (const s of sentences) {
                      if (byText[s.title] === undefined) byText[s.title] = [];
                      byText[s.title].push(s);
                    }
                  }

                  return (
                    <div
                      key={pattern.id}
                      className="rounded-xl border overflow-hidden"
                      style={{ background: 'var(--yg-paper-hi)', borderColor: 'var(--yg-rule)' }}
                    >
                      <button
                        type="button"
                        className="w-full text-left px-[18px] py-3.5 flex justify-between items-center"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                        onClick={() => { void handleTogglePattern(pattern); }}
                        aria-expanded={isExpanded}
                      >
                        <span className="font-jp text-[18px] font-medium tracking-tight" style={{ color: 'var(--yg-ink)' }}>
                          {pattern.pattern}
                        </span>
                        <div className="flex items-center gap-3">
                          <span
                            className="font-en text-[11px] font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: 'var(--yg-known)', color: 'var(--yg-bamboo-dark)' }}
                          >
                            {pattern.sentence_count}×
                          </span>
                          <span className="font-en text-sm" style={{ color: 'var(--yg-ink-muted)' }} aria-hidden="true">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div
                          className="px-[18px] pb-4 pt-3 border-t"
                          style={{ borderColor: 'var(--yg-rule)' }}
                        >
                          <p className="font-en text-[13px] leading-relaxed mb-4" style={{ color: 'var(--yg-ink-soft)' }}>
                            {pattern.description_en}
                          </p>
                          {isLoading ? (
                            <Spinner />
                          ) : (
                            Object.entries(byText).map(([title, titleSentences]) => (
                              <div key={title} className="mb-3 last:mb-0">
                                <h4 className="font-en text-[11px] font-semibold mb-1.5" style={{ color: 'var(--yg-ink-muted)' }}>
                                  {title}
                                </h4>
                                <ul className="space-y-1.5">
                                  {titleSentences.map(s => (
                                    <li
                                      key={`${s.text_id}-${s.sentence_index}`}
                                      className="font-jp text-[13px] leading-relaxed"
                                      style={{ color: 'var(--yg-ink-soft)' }}
                                    >
                                      {s.sentence_raw}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
