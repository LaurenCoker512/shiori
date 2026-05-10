'use client';

import { createContext, useContext, useState } from 'react';

interface KnownWordCountContextType {
  knownWordCount: number;
  adjustKnownWordCount: (delta: number) => void;
}

const KnownWordCountContext = createContext<KnownWordCountContextType | null>(null);

export function KnownWordCountProvider({ initialCount, children }: { initialCount: number; children: React.ReactNode }) {
  const [knownWordCount, setKnownWordCount] = useState(initialCount);
  function adjustKnownWordCount(delta: number) {
    setKnownWordCount(prev => Math.max(0, prev + delta));
  }
  return (
    <KnownWordCountContext.Provider value={{ knownWordCount, adjustKnownWordCount }}>
      {children}
    </KnownWordCountContext.Provider>
  );
}

export function useKnownWordCount() {
  const ctx = useContext(KnownWordCountContext);
  if (ctx === null) throw new Error('useKnownWordCount must be used within KnownWordCountProvider');
  return ctx;
}
