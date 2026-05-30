// ─────────────────────────────────────────────────────────────────────────────
// Editable brand palette.
//
// These are the DEFAULT brand colours. In the headless-WordPress setup they can
// be overridden from the CMS: expose an ACF "Options" colour group (or a custom
// /wp-json/kclinics/v1/theme endpoint) returning any subset of these keys, and
// `getTheme()` merges them over the defaults. The values are injected as CSS
// custom properties on <html> (see ThemeStyle), so a colour change in WordPress
// re-skins the entire site with no code change.
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
  ink: '#2b1d24',
  inkSoft: '#3a2730',
  espresso: '#4a3038',
  porcelain: '#f8f1ec',
  bone: '#f1e6df',
  sand: '#e7d4ca',
  stone: '#9a8479',
  stoneSoft: '#c3ada0',
  gold: '#b08544',
  goldSoft: '#c9a86a',
  goldBright: '#e3c98f',
  jade: '#7a4f57',
  blush: '#d8a9a0',
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

const WP_API = process.env.WORDPRESS_API_URL?.replace(/\/$/, '') ?? '';

/** Fetches palette overrides from WordPress (if configured), merged over defaults. */
export async function getTheme(): Promise<ThemeTokens> {
  if (!WP_API) return defaultTheme;
  try {
    const res = await fetch(`${WP_API}/kclinics/v1/theme`, { next: { revalidate: 300 } });
    if (!res.ok) return defaultTheme;
    const data = (await res.json()) as Partial<ThemeTokens>;
    const clean = Object.fromEntries(
      Object.entries(data).filter(([k, v]) => k in cssVar && typeof v === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(v)),
    ) as Partial<ThemeTokens>;
    return { ...defaultTheme, ...clean };
  } catch {
    return defaultTheme;
  }
}

/** Renders the active theme as a CSS variable override on :root. */
export function themeToCss(theme: ThemeTokens): string {
  const decls = (Object.keys(theme) as (keyof ThemeTokens)[])
    .map((k) => `${cssVar[k]}:${theme[k]};`)
    .join('');
  return `:root{${decls}}`;
}
