'use client';

import { useState } from 'react';
import { lookupWord } from '@/lib/jmdict';
import { useReparse } from '@/components/ui/ReparseToastProvider';

interface CleanupSummary {
  pruned: number;
  normalized: number;
  merged: number;
  frequencyBackfilled: number;
}

export function VocabularyActions() {
  const [cleanupStatus, setCleanupStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [summary, setSummary] = useState<CleanupSummary | null>(null);

  const { reparsePhase, startReparse } = useReparse();

  async function handleCleanup() {
    setCleanupStatus('running');
    setSummary(null);

    const res = await fetch('/api/words?limit=9999');
    if (!res.ok) {
      setCleanupStatus('error');
      return;
    }
    const { words } = await res.json() as { words: Array<{ id: number; dictionary_form: string; reading: string; frequency_tier: string | null }> };

    const normalizations: { id: number; canonical_dictionary_form: string }[] = [];
    const frequencyBackfillIds: number[] = [];

    for (const word of words) {
      const entry = await lookupWord(word.dictionary_form, word.reading);
      if (entry !== null && entry.canonicalForm !== word.dictionary_form) {
        normalizations.push({ id: word.id, canonical_dictionary_form: entry.canonicalForm });
      }
      if (word.frequency_tier === null) {
        frequencyBackfillIds.push(word.id);
      }
    }

    const cleanupRes = await fetch('/api/words/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        normalizations,
        frequency_backfill_ids: frequencyBackfillIds,
      }),
    });

    if (!cleanupRes.ok) {
      setCleanupStatus('error');
      return;
    }
    setSummary(await cleanupRes.json() as CleanupSummary);
    setCleanupStatus('done');
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="font-en text-[14px] font-semibold" style={{ color: 'var(--yg-ink)' }}>
            Vocabulary
          </span>
        </div>

        <p className="font-en text-[13px]" style={{ color: 'var(--yg-ink-soft)' }}>
          Normalize dictionary forms to JMdict headwords, merge duplicates, and backfill frequency data.
        </p>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => { void handleCleanup(); }}
            disabled={cleanupStatus === 'running'}
            className="font-en text-[13px] font-semibold px-5 py-2.5 rounded-full disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)', border: 'none', cursor: 'pointer' }}
          >
            {cleanupStatus === 'running' ? 'Running…' : 'Clean up vocabulary'}
          </button>

          {cleanupStatus === 'done' && summary !== null && (
            <span className="font-en text-[13px]" style={{ color: 'var(--yg-bamboo-dark)' }}>
              Done.
            </span>
          )}
          {cleanupStatus === 'error' && (
            <span role="alert" className="font-en text-[13px]" style={{ color: 'var(--yg-coral-dark)' }}>
              Cleanup failed. Please try again.
            </span>
          )}
        </div>

        {cleanupStatus === 'done' && summary !== null && (
          <p className="font-en text-[13px]" style={{ color: 'var(--yg-ink-soft)' }}>
            {summary.pruned} orphaned words removed · {summary.normalized} words normalized · {summary.merged} duplicates merged ·{' '}
            {summary.frequencyBackfilled} words updated with frequency data
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="font-en text-[14px] font-semibold" style={{ color: 'var(--yg-ink)' }}>
            Re-parse texts
          </span>
        </div>

        <p className="font-en text-[13px]" style={{ color: 'var(--yg-ink-soft)' }}>
          Re-tokenize all texts using the latest pipeline. Run vocabulary cleanup afterward to normalize any newly inserted words.
        </p>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => { void startReparse(); }}
            disabled={reparsePhase === 'running'}
            className="font-en text-[13px] font-semibold px-5 py-2.5 rounded-full disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--yg-ink)', color: 'var(--yg-paper-hi)', border: 'none', cursor: 'pointer' }}
          >
            {reparsePhase === 'running' ? 'Re-parsing…' : 'Re-parse texts'}
          </button>
        </div>
      </div>
    </div>
  );
}
