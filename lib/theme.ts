// ─────────────────────────────────────────────────────────────────────────────
// Editable brand palette.
//
// These are the brand colours, injected as CSS custom properties on <html>
// (see ThemeStyle). Edit `defaultTheme` below to re-skin the site.
//
// Editor mapping (what each role controls):
//   ink         – primary text + dark sections
//   porcelain   – primary light background
//   bone        – secondary light surface
//   gold        – primary metallic accent (buttons, highlights)
//   jade        – secondary accent
//   blush       – soft highlight
// ─────────────────────────────────────────────────────────────────────────────

export type ThemeTokens = {
  ink: string;
  inkSoft: string;
  espresso: string;
  porcelain: string;
  bone: string;
  sand: string;
  stone: string;
  stoneSoft: string;
  gold: string;
  goldSoft: string;
  goldBright: string;
  jade: string;
  blush: string;
};

export const defaultTheme: ThemeTokens = {
  // Official KClinics "warm taupe & cream" identity (cream #F6ECE3, taupe #91766E).
  ink: '#2a2420',
  inkSoft: '#3d352f',
  espresso: '#4a3f37',
  porcelain: '#f6ece3',
  bone: '#efe3d7',
  sand: '#e3d3c4',
  stone: '#7d6259', // body text — AA on porcelain (4.79:1). Was #91766e (3.59:1, fails WCAG AA); the lighter taupe is the logo/accent colour, not body text.
  stoneSoft: '#b7a294',
  gold: '#a98a6d',
  goldSoft: '#c2a589',
  goldBright: '#dcc4a8',
  jade: '#2f7152', // jade green — positive / success / active / healthy accent
  blush: '#cdb4a3',
};

// Maps token keys → CSS custom property names.
const cssVar: Record<keyof ThemeTokens, string> = {
  ink: '--color-ink',
  inkSoft: '--color-ink-soft',
  espresso: '--color-espresso',
  porcelain: '--color-porcelain',
  bone: '--color-bone',
  sand: '--color-sand',
  stone: '--color-stone',
  stoneSoft: '--color-stone-soft',
  gold: '--color-gold',
  goldSoft: '--color-gold-soft',
  goldBright: '--color-gold-bright',
  jade: '--color-jade',
  blush: '--color-blush',
};

/** The active theme. (Palette is built-in; edit defaultTheme to change brand colours.) */
export async function getTheme(): Promise<ThemeTokens> {
  return defaultTheme;
}

const CSS_COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^(rgb|rgba|hsl|hsla)\(/;

function sanitizeColorValue(v: string): string {
  const s = v.trim();
  if (!CSS_COLOR_RE.test(s)) return 'transparent';
  return s.replace(/[}<>"'`]/g, '');
}

/** Renders the active theme as a CSS variable override on :root. */
export function themeToCss(theme: ThemeTokens): string {
  const decls = (Object.keys(theme) as (keyof ThemeTokens)[])
    .map((k) => `${cssVar[k]}:${sanitizeColorValue(String(theme[k]))};`)
    .join('');
  return `:root{${decls}}`;
}
