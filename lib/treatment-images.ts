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
const resolve = (file?: string) => (file && available.has(file) ? `/treatments/${file}` : null);

export function treatmentImage(slug: string): string | null {
  return resolve((treatMap as Record<string, string>)[slug]);
}
export function packageImage(slug: string): string | null {
  return resolve((pkgMap as Record<string, string>)[slug]);
}
export function pageImage(key: string): string | null {
  return resolve((pageMap as Record<string, string>)[key]);
}
