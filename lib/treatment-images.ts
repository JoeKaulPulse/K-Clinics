// Slug → real image filename, derived from the existing site's WordPress export.
// Images live in /public/treatments/<filename>.
//
// To activate real imagery: drop the downloaded media files into
// public/treatments/ (keep the original filenames) and list the present files
// in public/treatments/manifest.json (an array of filenames). Only files listed
// there are used — so the build never references a missing image, and the
// generative-art placeholder shows for anything not yet uploaded.
import treatMap from '@/import/slug-image-map.json';
import pkgMap from '@/import/package-image-map.json';
import pageMap from '@/import/page-image-map.json';
import present from '@/public/treatments/manifest.json';

const available = new Set(present as string[]);
// On GitHub Pages the site is served from a sub-path (/K-Clinics). next/image
// doesn't prepend basePath to unoptimized /public images in a static export, so
// we prefix it here. Empty on Vercel/dev, so paths stay root-relative there.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// BLD-1270: scripts/optimize-treatment-images.mjs recompressed the oversized
// source images to JPEG, so 75 files changed extension (X.png -> X.jpg). Every
// reference the repo owns (the import/ maps, articleMap below, lib/articles.ts)
// was rewritten by that script — but WordPress-imported article bodies live in
// the DB (Post.content) and still cite the pre-conversion filename, which a
// build script can't edit. So when the exact filename isn't present, fall back
// to a basename-only match.
//
// Two guards keep the fallback from ever guessing:
//  - it answers ONLY when a basename maps to exactly one file that is actually
//    present, the same ambiguity rule the conversion script used to decide what
//    it was allowed to rename. A basename carrying more than one extension
//    (both X.png and X.jpg on disk) was never converted, so its exact names
//    still match above and no guess is needed; declining there is what stops a
//    stale reference resolving to a different image.
//  - it applies ONLY to the extensions the conversion script renames. A
//    reference to any other format (.svg, .webp, .avif) was never rewritten, so
//    substituting a same-named raster for it would be a guess, not a repair.
const CONVERTIBLE = /\.(png|jpe?g)$/i;
const baseKey = (file: string) => file.replace(/\.[^.]+$/, '').toLowerCase();
const byBase = new Map<string, string[]>();
for (const f of present as string[]) {
  const key = baseKey(f);
  const list = byBase.get(key);
  if (list) list.push(f);
  else byBase.set(key, [f]);
}
const resolve = (file?: string) => {
  if (!file) return null;
  if (available.has(file)) return `${BASE}/treatments/${file}`;
  if (!CONVERTIBLE.test(file)) return null;
  const sameBase = byBase.get(baseKey(file));
  return sameBase && sameBase.length === 1 ? `${BASE}/treatments/${sameBase[0]}` : null;
};

export function treatmentImage(slug: string): string | null {
  return resolve((treatMap as Record<string, string>)[slug]);
}
export function packageImage(slug: string): string | null {
  return resolve((pkgMap as Record<string, string>)[slug]);
}
export function pageImage(key: string): string | null {
  return resolve((pageMap as Record<string, string>)[key]);
}

// Journal article → hero image (real photography from the media library).
const articleMap: Record<string, string> = {
  'laser-hair-removal-what-to-expect': 'Laser-Hair-Removal-1-1.jpg',
  'anti-wrinkle-injections-natural-results': 'HydraFacial-Anti-Ageing.png',
  'achieve-the-perfect-smile-veneers-whitening': 'baner-7.jpg',
  'skincare-after-laser-treatments': 'Carbon-Laser-Peel.png',
  'hifu-vs-rf-non-surgical-lifting': 'Body-SMAS-HIFU-Lifting-1.png',
  'preparing-for-your-first-consultation': 'HydraFacial-Anti-Ageing.png',
};
export function articleImage(slug: string): string | null {
  return resolve(articleMap[slug]);
}

// BLD-1230: WordPress-imported Journal posts (the `Post` DB table) still carry
// their original https://kclinics.co.uk/wp-content/uploads/... image URLs in
// `coverImage` and inline <img> tags. That path now 403s (the live firewall
// blocks /wp-content/* as a WordPress-attack signature), breaking every
// migrated article's images site-wide. Rewrite any such URL to its migrated
// local copy when the file has already been downloaded into
// public/treatments/ (see manifest.json above) — otherwise leave it
// untouched so a URL that isn't actually broken is never altered.
export function resolveMigratedImage(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /\/wp-content\/uploads\/.*\/([^/?#]+)$/i.exec(url.split(/[?#]/)[0]);
  if (!m) return url;
  let file = m[1];
  try { file = decodeURIComponent(file); } catch { /* malformed escape → use raw */ }
  return resolve(file) ?? url;
}
