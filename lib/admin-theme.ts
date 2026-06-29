// Admin portal colour-scheme (BLD: dark/system mode). Scoped to /admin only —
// the public marketing site stays on the brand light palette. The choice is
// stored in a cookie so it survives reloads and can be resolved before paint.
//
// How it works:
//  • The switcher writes `kc_admin_theme` = 'light' | 'dark' | 'system'.
//  • A tiny script in the root <head> (THEME_NO_FLASH_SCRIPT) runs before paint,
//    and ONLY on /admin routes resolves the choice (system → matchMedia) and
//    sets `data-theme="dark|light"` on <html>. Non-admin routes never get the
//    attribute, so dark styling can't leak onto the public site.
//  • globals.css redefines the --color-* tokens under html[data-theme="dark"];
//    because the admin UI is built on those tokens, the whole portal re-skins.

export type AdminTheme = 'light' | 'dark' | 'system';
export const ADMIN_THEME_COOKIE = 'kc_admin_theme';
export const ADMIN_THEMES: AdminTheme[] = ['light', 'system', 'dark'];

export function isAdminTheme(v: unknown): v is AdminTheme {
  return v === 'light' || v === 'dark' || v === 'system';
}

// Inline, dependency-free. Kept tiny and resilient (try/catch) since it runs on
// every page load. Re-runnable: the admin switcher calls the same logic live.
export const THEME_NO_FLASH_SCRIPT = `(function(){try{
var p=location.pathname;
var el=document.documentElement;
if(p.indexOf('/admin')!==0){el.removeAttribute('data-theme');return;}
var m=document.cookie.match(/(?:^|; )kc_admin_theme=([^;]+)/);
var v=m?decodeURIComponent(m[1]):'system';
var dark=v==='dark'||(v!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
el.setAttribute('data-theme',dark?'dark':'light');
}catch(e){}})();`;
