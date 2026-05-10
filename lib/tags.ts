import type { TagColor } from './types';

export const TAG_COLORS: TagColor[] = ['coral', 'bamboo', 'indigo', 'gold'];

export const TAG_COLOR_STYLES: Record<TagColor, { bg: string; text: string }> = {
  coral:  { bg: 'var(--yg-seen)',           text: 'var(--yg-tag-coral-text)' },
  bamboo: { bg: 'var(--yg-known)',           text: 'var(--yg-tag-bamboo-text)' },
  indigo: { bg: 'rgba(91,117,145,0.15)',     text: 'var(--yg-tag-indigo-text)' },
  gold:   { bg: 'rgba(184,153,104,0.15)',    text: 'var(--yg-tag-gold-text)' },
};

export const TAG_COLOR_SWATCHES: Record<TagColor, string> = {
  coral:  'var(--yg-coral)',
  bamboo: 'var(--yg-bamboo)',
  indigo: 'var(--yg-indigo)',
  gold:   'var(--yg-card-gold-hi)',
};
