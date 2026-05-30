import { promises as fs } from 'fs';
import path from 'path';
import type { Word } from '@/lib/types';

type FrequencyTier = NonNullable<Word['frequency_tier']>;

interface FrequencyData {
  jpdb: Record<string, number>;
  jpdbByEntry: Record<string, number>;
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
  cache = { jpdb: JSON.parse(raw1) as Record<string, number>, jpdbByEntry: JSON.parse(raw2) as Record<string, number> };
  return cache;
}

function rankToTier(rank: number): FrequencyTier {
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
  const entryKey = `${dictionaryForm}|${reading}`;
  const rank = data.jpdbByEntry[entryKey] ?? data.jpdb[dictionaryForm] ?? null;
  return rank !== null ? rankToTier(rank) : null;
}
