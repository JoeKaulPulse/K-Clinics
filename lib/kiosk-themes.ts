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
      '--color-ink': '#1a0d0d',
      '--color-gold-bright': '#d4af37',
      '--color-gold': '#c49b2e',
      '--color-gold-soft': '#e8d5a3',
      '--color-blush': '#e0b8b8',
    },
  },
  {
    key: 'valentines',
    label: "Valentine's",
    description: 'Deep rose canvas with blush and champagne gold accents.',
    stageVars: {
      '--color-ink': '#1a0d12',
      '--color-gold-bright': '#e8a0b0',
      '--color-gold': '#d4748a',
      '--color-gold-soft': '#f2d0d8',
      '--color-blush': '#f0c8d0',
    },
  },
  {
    key: 'summer',
    label: 'Summer',
    description: 'Warm amber canvas with sun-bright gold and coral accents.',
    stageVars: {
      '--color-ink': '#1a1005',
      '--color-gold-bright': '#f5c842',
      '--color-gold': '#e0a830',
      '--color-gold-soft': '#f0d88a',
      '--color-blush': '#f2c87a',
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
