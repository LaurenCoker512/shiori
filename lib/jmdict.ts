import jlptData from '@/data/jlpt.json';
import type { JMdictEntry, JMdictSense, JlptLevel } from '@/lib/types';

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
  return { id: entry.id, senses, jlpt_level: jlptLevel(dictionaryForm) };
}

export async function lookupWord(
  dictionaryForm: string,
  reading: string,
): Promise<JMdictEntry | null> {
  if (typeof window === 'undefined') return null;

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

  if (!match) return null;

  return buildEntry(match, dictionaryForm);
}
