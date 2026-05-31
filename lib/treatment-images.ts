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
const resolve = (file?: string) => (file && available.has(file) ? `${BASE}/treatments/${file}` : null);

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
  'laser-hair-removal-what-to-expect': 'Laser-Hair-Removal-1-1.png',
  'anti-wrinkle-injections-natural-results': 'HydraFacial-Anti-Ageing.png',
  'achieve-the-perfect-smile-veneers-whitening': 'baner-7.jpg',
  'skincare-after-laser-treatments': 'Carbon-Laser-Peel.png',
};
export function articleImage(slug: string): string | null {
  return resolve(articleMap[slug]);
}
