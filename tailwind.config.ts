import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        yg: {
          bg:          'var(--yg-bg)',
          paper:       'var(--yg-paper)',
          'paper-hi':  'var(--yg-paper-hi)',
          ink:         'var(--yg-ink)',
          'ink-soft':  'var(--yg-ink-soft)',
          'ink-muted': 'var(--yg-ink-muted)',
          rule:        'var(--yg-rule)',
          coral:       'var(--yg-coral)',
          'coral-dark':'var(--yg-coral-dark)',
          bamboo:      'var(--yg-bamboo)',
          'bamboo-dark':'var(--yg-bamboo-dark)',
          indigo:      'var(--yg-indigo)',
          'indigo-dark':'var(--yg-indigo-dark)',
          seen:        'var(--yg-seen)',
          known:       'var(--yg-known)',
        },
      },
      fontFamily: {
        jp: ['var(--font-zen-mincho)', 'Yu Mincho', 'Hiragino Mincho ProN', 'serif'],
        en: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
