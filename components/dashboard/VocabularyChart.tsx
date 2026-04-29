'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SeriesPoint {
  date: string;
  count: number;
}

interface VocabularyChartProps {
  seenSeries: SeriesPoint[];
  knownSeries: SeriesPoint[];
}

export function buildCumulativeData(seenSeries: SeriesPoint[], knownSeries: SeriesPoint[]) {
  const allDates = Array.from(
    new Set([...seenSeries.map(p => p.date), ...knownSeries.map(p => p.date)]),
  ).sort();

  const seenByDate: Record<string, number> = Object.fromEntries(seenSeries.map(p => [p.date, p.count]));
  const knownByDate: Record<string, number> = Object.fromEntries(knownSeries.map(p => [p.date, p.count]));

  let seenCumulative = 0;
  let knownCumulative = 0;

  return allDates.map(date => {
    seenCumulative += seenByDate[date] ?? 0;
    knownCumulative += knownByDate[date] ?? 0;
    return { date, seen: seenCumulative, known: knownCumulative };
  });
}

export function VocabularyChart({ seenSeries, knownSeries }: VocabularyChartProps) {
  const data = buildCumulativeData(seenSeries, knownSeries);

  return (
    <div aria-label="Vocabulary progress chart">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="seen" name="Seen" stroke="#3b82f6" strokeDasharray="5 5" dot={false} />
          <Line type="monotone" dataKey="known" name="Known" stroke="#22c55e" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
