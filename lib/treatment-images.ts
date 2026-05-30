// Slug → real image filename, derived from the existing site's WordPress export.
// Images live in /public/treatments/<filename>.
//
// To activate real imagery: drop the downloaded media files into
// public/treatments/ (keep the original filenames) and list the present files
// in public/treatments/manifest.json (an array of filenames). Only files listed
// there are used — so the build never references a missing image, and the
// generative-art placeholder shows for anything not yet uploaded.
import map from '@/import/slug-image-map.json';
import present from '@/public/treatments/manifest.json';

const imageMap = map as Record<string, string>;
const available = new Set(present as string[]);

export function treatmentImage(slug: string): string | null {
  const file = imageMap[slug];
  return file && available.has(file) ? `/treatments/${file}` : null;
}
