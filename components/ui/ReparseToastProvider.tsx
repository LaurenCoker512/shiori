'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ReparseToast } from './ReparseToast';
import type { ReparseJob } from './ReparseToast';
import { clearTTSCacheForText, clearAllTTSCache } from '@/lib/ttsCache';

interface ReparseContextValue {
  reparsePhase: 'idle' | 'running' | 'done' | 'error';
  startReparse: () => Promise<void>;
  reparseSingle: (textId: number, title: string) => Promise<void>;
}

const ReparseContext = createContext<ReparseContextValue | null>(null);

export function useReparse(): ReparseContextValue {
  const ctx = useContext(ReparseContext);
  if (ctx === null) throw new Error('useReparse must be used within ReparseToastProvider');
  return ctx;
}

export function ReparseToastProvider({ children }: { children: React.ReactNode }) {
  const [job, setJob] = useState<ReparseJob | null>(null);
  const runningRef = useRef(false);

  const startReparse = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setJob({ phase: 'running', current: 0, total: 0 });

    try {
      const textsRes = await fetch('/api/texts');
      if (!textsRes.ok) throw new Error('Failed to fetch texts');

      const { texts } = await textsRes.json() as { texts: Array<{ id: number }> };
      setJob({ phase: 'running', current: 0, total: texts.length });

      for (let i = 0; i < texts.length; i++) {
        await fetch(`/api/texts/${texts[i]!.id}/reparse`, { method: 'POST' });
        setJob({ phase: 'running', current: i + 1, total: texts.length });
      }

      await clearAllTTSCache().catch(() => {/* best-effort */});
      setJob(prev => prev !== null ? { ...prev, phase: 'done' } : null);
    } catch {
      setJob(prev => prev !== null ? { ...prev, phase: 'error' } : null);
    } finally {
      runningRef.current = false;
    }
  }, []);

  const reparseSingle = useCallback(async (textId: number, title: string) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setJob({ phase: 'running', title, current: 1, total: 1 });

    try {
      const res = await fetch(`/api/texts/${textId}/reparse`, { method: 'POST' });
      if (!res.ok) throw new Error('Reparse failed');
      await clearTTSCacheForText(textId).catch(() => {/* best-effort */});
      setJob(prev => prev !== null ? { ...prev, phase: 'done' } : null);
    } catch {
      setJob(prev => prev !== null ? { ...prev, phase: 'error' } : null);
    } finally {
      runningRef.current = false;
    }
  }, []);

  function dismiss() {
    setJob(null);
  }

  const phase = job?.phase ?? 'idle';

  return (
    <ReparseContext.Provider value={{ reparsePhase: phase, startReparse, reparseSingle }}>
      {children}
      {job !== null && <ReparseToast job={job} onDismiss={dismiss} />}
    </ReparseContext.Provider>
  );
}
