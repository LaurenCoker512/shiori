import { promises as fs } from 'fs';
import path from 'path';
import type { Word } from '@/lib/types';

type FrequencyTier = NonNullable<Word['frequency_tier']>;

// jpdb.json: { headword: [[reading | null, rank], ...] } sorted asc by rank
type SurfaceIndex = Record<string, Array<[string | null, number]>>;

// jpdb-by-entry.json: { jmdict_id: { rank, headword, reading, canonical } }
interface EntryRecord { rank: number; headword: string; reading: string | null; canonical: string }
type EntryIndex = Record<string, EntryRecord>;

interface FrequencyData {
  surface: SurfaceIndex;
  // "headword|reading" (reading empty string when null) → best rank
  byHeadwordReading: Map<string, number>;
}

let cache: FrequencyData | null = null;

export function _resetCacheForTesting() { cache = null; }

async function getFrequencyData(): Promise<FrequencyData> {
  if (cache !== null) return cache;
  const base = path.join(process.cwd(), 'data/frequency');
  const [raw1, raw2] = await Promise.all([
    fs.readFile(path.join(base, 'jpdb.json'), 'utf8'),
    fs.readFile(path.join(base, 'jpdb-by-entry.json'), 'utf8'),
  ]);
  const surface = JSON.parse(raw1) as SurfaceIndex;
  const entryIndex = JSON.parse(raw2) as EntryIndex;

  // Build headword|reading → best rank map from the by-entry index.
  // Collisions (same headword+reading in multiple entries) keep the lowest rank.
  const byHeadwordReading = new Map<string, number>();
  for (const rec of Object.values(entryIndex)) {
    const key = `${rec.headword}|${rec.reading ?? ''}`;
    const existing = byHeadwordReading.get(key);
    if (existing === undefined || rec.rank < existing) {
      byHeadwordReading.set(key, rec.rank);
    }
  }

  cache = { surface, byHeadwordReading };
  return cache;
}

export function rankToTier(rank: number): FrequencyTier {
  if (rank <= 1500) return 'very-common';
  if (rank <= 5000) return 'common';
  if (rank <= 15000) return 'uncommon';
  if (rank <= 30000) return 'rare';
  return 'very-rare';
}

export async function lookupFrequencyTier(
  dictionaryForm: string,
  reading: string,
): Promise<FrequencyTier | null> {
  const data = await getFrequencyData();

  // Primary: by-entry map (headword + reading — avoids homophone ambiguity)
  const entryRank = data.byHeadwordReading.get(`${dictionaryForm}|${reading}`);
  if (entryRank !== undefined) return rankToTier(entryRank);

  // Fallback: surface index with reading match, then best rank for any reading
  const entries = data.surface[dictionaryForm];
  if (!entries || entries.length === 0) return null;
  const readingMatch = entries.find(([r]) => r === reading);
  const rank = readingMatch ? readingMatch[1] : entries[0]![1];
  return rankToTier(rank);
}
