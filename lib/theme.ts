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
  stone: '#91766e',
  stoneSoft: '#b7a294',
  gold: '#a98a6d',
  goldSoft: '#c2a589',
  goldBright: '#dcc4a8',
  jade: '#7b6a5d',
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

/** Renders the active theme as a CSS variable override on :root. */
export function themeToCss(theme: ThemeTokens): string {
  const decls = (Object.keys(theme) as (keyof ThemeTokens)[])
    .map((k) => `${cssVar[k]}:${theme[k]};`)
    .join('');
  return `:root{${decls}}`;
}
