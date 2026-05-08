'use client';

const GREETINGS = [
  { until: 5,  text: 'A quiet night for reading.' },
  { until: 12, text: 'Good morning. Begin the day with words.' },
  { until: 17, text: 'Good afternoon. Make time for a page or two.' },
  { until: 21, text: 'Good evening. Settle in with something good.' },
  { until: 24, text: 'The evening is yours.' },
  { until: 24, text: 'A quiet night for reading.' },
];

export function TimeGreeting() {
  const hour = new Date().getHours();
  const { text } = GREETINGS.find(g => hour < g.until) ?? GREETINGS[GREETINGS.length - 1];
  return <>{text}</>;
}
