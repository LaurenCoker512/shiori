'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

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

  if (data.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center font-en text-sm" style={{ color: 'var(--yg-ink-muted)' }}>
        No data yet
      </div>
    );
  }

  return (
    <div aria-label="Vocabulary progress chart">
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="knownGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--yg-bamboo)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--yg-bamboo)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: 'var(--yg-ink-muted)', fontFamily: 'var(--font-dm-sans)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              background: 'var(--yg-paper-hi)',
              border: '1px solid var(--yg-rule)',
              borderRadius: 8,
              fontSize: 11,
              fontFamily: 'var(--font-dm-sans)',
              color: 'var(--yg-ink)',
            }}
          />
          <Area
            type="monotone"
            dataKey="known"
            name="Known"
            stroke="var(--yg-bamboo)"
            strokeWidth={2.2}
            fill="url(#knownGrad)"
            dot={false}
            activeDot={{ r: 3, fill: 'var(--yg-paper-hi)', stroke: 'var(--yg-bamboo)', strokeWidth: 1.8 }}
          />
          <Line
            type="monotone"
            dataKey="seen"
            name="Seen"
            stroke="var(--yg-coral)"
            strokeWidth={1.5}
            strokeOpacity={0.7}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 font-en text-[11px]" style={{ color: 'var(--yg-ink-soft)' }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--yg-bamboo)' }} />
          Known
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full opacity-70" style={{ background: 'var(--yg-coral)' }} />
          Seen
        </span>
      </div>
    </div>
  );
}
