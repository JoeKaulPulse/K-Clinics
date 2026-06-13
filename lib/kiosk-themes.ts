// BLD-137 — kiosk seasonal scene themes. The active theme key is stored as the
// 'kiosk_theme' string setting and resolved by the display page at request time.
// New themes: add an entry here + corresponding THEME_COPY in AttractScene.tsx.

export type KioskThemeKey = 'default' | 'christmas' | 'valentines' | 'summer';

export type KioskThemeMeta = {
  key: KioskThemeKey;
  label: string;
  description: string;
  /** Inline CSS vars applied to the .kd-stage root — override the defaults. */
  stageVars: Record<string, string>;
};

export const KIOSK_THEMES: KioskThemeMeta[] = [
  {
    key: 'default',
    label: 'Default',
    description: 'Classic dark-ink canvas with gold accents.',
    stageVars: {},
  },
  {
    key: 'christmas',
    label: 'Christmas',
    description: 'Deep berry canvas with festive gold and sage green accents.',
    stageVars: {
      '--kd-bg': '#1a0d0d',
      '--kd-gold-bright': '#d4af37',
      '--kd-gold-soft': '#e8d5a3',
      '--kd-accent': '#8b1a1a',
      '--kd-text': '#f5ece0',
    },
  },
  {
    key: 'valentines',
    label: "Valentine's",
    description: 'Deep rose canvas with blush and champagne gold accents.',
    stageVars: {
      '--kd-bg': '#1a0d12',
      '--kd-gold-bright': '#e8a0b0',
      '--kd-gold-soft': '#f2d0d8',
      '--kd-accent': '#c0536a',
      '--kd-text': '#faf0f2',
    },
  },
  {
    key: 'summer',
    label: 'Summer',
    description: 'Warm amber canvas with sun-bright gold and coral accents.',
    stageVars: {
      '--kd-bg': '#1a1005',
      '--kd-gold-bright': '#f5c842',
      '--kd-gold-soft': '#f0d88a',
      '--kd-accent': '#e8773a',
      '--kd-text': '#fef8ee',
    },
  },
];

export const KIOSK_THEME_DEFAULT: KioskThemeKey = 'default';

export function getKioskThemeMeta(key: string): KioskThemeMeta {
  return KIOSK_THEMES.find((t) => t.key === key) ?? KIOSK_THEMES[0];
}

export function isKioskThemeKey(v: unknown): v is KioskThemeKey {
  return typeof v === 'string' && KIOSK_THEMES.some((t) => t.key === v);
}
