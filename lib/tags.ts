import type { TagColor } from './types';

export const TAG_COLORS: TagColor[] = ['coral', 'bamboo', 'indigo', 'gold'];

export const TAG_COLOR_STYLES: Record<TagColor, { bg: string; text: string }> = {
  coral:  { bg: 'var(--yg-seen)',           text: 'var(--yg-coral-dark)' },
  bamboo: { bg: 'var(--yg-known)',           text: 'var(--yg-bamboo-dark)' },
  indigo: { bg: 'rgba(91,117,145,0.15)',     text: 'var(--yg-indigo-dark)' },
  gold:   { bg: 'rgba(184,153,104,0.15)',    text: 'var(--yg-card-gold-lo)' },
};

export const TAG_COLOR_SWATCHES: Record<TagColor, string> = {
  coral:  'var(--yg-coral)',
  bamboo: 'var(--yg-bamboo)',
  indigo: 'var(--yg-indigo)',
  gold:   'var(--yg-card-gold-hi)',
};
