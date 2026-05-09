'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ImportToast } from './ImportToast';
import type { ImportJob } from './ImportToast';
import { ConfirmDialog } from './ConfirmDialog';

const STORAGE_KEY = 'shiori-import';
const IMPORT_EVENT = 'shiori-import-created';
const POLL_INTERVAL_MS = 10000;

interface StoredImport {
  id: number;
  title: string;
}

interface StatusResponse {
  status: string;
  error?: string;
}

function readStoredImport(): ImportJob | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const stored = JSON.parse(raw) as StoredImport;
    if (typeof stored.id === 'number' && typeof stored.title === 'string') {
      return { id: stored.id, title: stored.title, phase: 'pending' };
    }
  } catch { /* malformed entry */ }
  return null;
}

export function ImportToastProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [job, setJob] = useState<ImportJob | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read on mount (handles page refresh with a pending import in storage)
  useEffect(() => {
    const stored = readStoredImport();
    if (stored !== null) setJob(stored);
  }, []);

  // Listen for same-tab imports dispatched by ImportForm after writing to localStorage
  useEffect(() => {
    function handleImportCreated() {
      const stored = readStoredImport();
      if (stored !== null) setJob(stored);
    }
    window.addEventListener(IMPORT_EVENT, handleImportCreated);
    return () => window.removeEventListener(IMPORT_EVENT, handleImportCreated);
  }, []);

  useEffect(() => {
    if (job === null || job.phase === 'ready' || job.phase === 'error') {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (intervalRef.current !== null) return;

    intervalRef.current = setInterval(() => {
      fetch(`/api/texts/${job.id}/status`)
        .then(r => r.json())
        .then((data: StatusResponse) => {
          if (data.status === 'ready') {
            try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
            setJob(prev => prev !== null ? { ...prev, phase: 'ready' } : null);
            // Refresh server components so the new text appears in the library
            router.refresh();
          } else if (data.status === 'error') {
            try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
            setJob(prev => prev !== null ? { ...prev, phase: 'error', errorMessage: data.error } : null);
          } else {
            setJob(prev => prev !== null && prev.phase === 'pending' ? { ...prev, phase: 'processing' } : prev);
          }
        })
        .catch(() => { /* network error — keep polling */ });
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [job, router]);

  function handleDismiss() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    setJob(null);
  }

  function handleCancelRequest() {
    setShowCancelConfirm(true);
  }

  async function handleCancelConfirm() {
    setShowCancelConfirm(false);
    const textId = job?.id;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    setJob(null);
    if (textId !== undefined) {
      await fetch(`/api/texts/${textId}`, { method: 'DELETE' });
      router.refresh();
    }
  }

  function handleCancelAbort() {
    setShowCancelConfirm(false);
  }

  return (
    <>
      {children}
      {job !== null && (
        <ImportToast job={job} onDismiss={handleDismiss} onCancel={handleCancelRequest} />
      )}
      {showCancelConfirm && (
        <ConfirmDialog
          message="Cancel this import? The text will be deleted and cannot be recovered."
          confirmLabel="Cancel import"
          onConfirm={() => { void handleCancelConfirm(); }}
          onCancel={handleCancelAbort}
        />
      )}
    </>
  );
}
