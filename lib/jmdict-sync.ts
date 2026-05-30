let started = false;

// Downloads and populates the jpdict IndexedDB for the 'words' series.
// Safe to call multiple times — only runs once per page session.
export async function syncJpdictWords(): Promise<void> {
  if (started || typeof window === 'undefined') return;
  started = true;

  try {
    const { JpdictIdb, updateWithRetry } = await import('@birchill/jpdict-idb');
    const db = new JpdictIdb();
    await db.ready;

    updateWithRetry({
      db,
      lang: 'en',
      series: 'words',
      onUpdateError: ({ error, nextRetry }) => {
        if (nextRetry === undefined) {
          console.warn('[jmdict] dictionary sync failed:', error);
        }
      },
    });
  } catch (err) {
    console.warn('[jmdict] dictionary sync init failed:', err);
    started = false;
  }
}
