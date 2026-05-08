import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VocabularyChart, buildCumulativeData } from '@/components/dashboard/VocabularyChart';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: ({ dataKey, name }: { dataKey: string; name: string }) => (
    <div data-testid={`series-${dataKey}`} aria-label={name} />
  ),
  Line: ({ dataKey, name }: { dataKey: string; name: string }) => (
    <div data-testid={`series-${dataKey}`} aria-label={name} />
  ),
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  defs: () => null,
  linearGradient: () => null,
  stop: () => null,
}));

describe('VocabularyChart', () => {
  it('renders both "seen" and "known" series', () => {
    render(<VocabularyChart seenSeries={[{ date: '2024-01-01', count: 1 }]} knownSeries={[{ date: '2024-01-01', count: 1 }]} />);
    expect(screen.getByTestId('series-known')).toBeInTheDocument();
    expect(screen.getByTestId('series-seen')).toBeInTheDocument();
  });

  it('cumulative sum computed correctly', () => {
    const seen = [
      { date: '2024-01-01', count: 3 },
      { date: '2024-01-02', count: 2 },
    ];
    const result = buildCumulativeData(seen, []);
    expect(result.map(p => p.seen)).toEqual([3, 5]);
  });
});
