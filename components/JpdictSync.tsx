'use client';

import { useEffect } from 'react';

export function JpdictSync() {
  useEffect(() => {
    void import('@/lib/jmdict-sync').then(m => m.syncJpdictWords());
  }, []);
  return null;
}
