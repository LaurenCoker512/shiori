import jlptData from '@/data/jlpt.json';
import type { JMdictEntry, JMdictSense, JlptLevel } from '@/lib/types';
import { deinflect } from '@/lib/deinflect';

function jlptLevel(dictionaryForm: string): JlptLevel | null {
  const level = (jlptData as Record<string, string>)[dictionaryForm];
  return (level as JlptLevel) ?? null;
}

function buildEntry(
  entry: import('@birchill/jpdict-idb').WordResult,
  dictionaryForm: string,
): JMdictEntry {
  const senses: JMdictSense[] = entry.s.map((s) => ({
    pos: s.pos ?? [],
    glosses: s.g.slice(0, 3).map((g) => g.str),
    info: s.inf ?? undefined,
  }));
  const canonicalForm = entry.k?.[0]?.ent ?? entry.r[0]?.ent ?? dictionaryForm;
  return { id: entry.id, senses, jlpt_level: jlptLevel(dictionaryForm), canonicalForm };
}

async function isJpdictReady(): Promise<boolean> {
  // indexedDB.databases() is not available in Firefox; fall through and let
  // getWords return [] (it gracefully handles a missing/wrong-version DB).
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return true;
  const dbs = await indexedDB.databases();
  return dbs.some(d => d.name === 'jpdict' && d.version === 4);
}

export async function lookupWord(
  dictionaryForm: string,
  reading: string,
): Promise<JMdictEntry | null> {
  if (typeof window === 'undefined') return null;

  // Don't call getWords when the jpdict database doesn't exist yet.
  // @birchill/jpdict-idb aborts its upgrade transaction in that case, which
  // causes idb to create a transaction.done promise (stored in a WeakMap,
  // never awaited) that rejects with AbortError — an unhandled rejection that
  // crashes the Next.js dev overlay.
  if (!await isJpdictReady()) return null;

  const { getWords } = await import('@birchill/jpdict-idb');
  const results = await getWords(dictionaryForm);

  const match =
    results.find(
      (r) =>
        r.k?.some((k) => k.ent === dictionaryForm) ||
        r.r?.some((rd) => rd.ent === reading),
    ) ??
    results[0] ??
    null;

  if (!match) {
    const candidates = deinflect(dictionaryForm);
    for (const { baseForm, derivationChain } of candidates) {
      const deinflected = await getWords(baseForm);
      if (deinflected.length > 0) {
        return { ...buildEntry(deinflected[0]!, baseForm), derivationChain };
      }
    }
    return null;
  }

  return buildEntry(match, dictionaryForm);
}
