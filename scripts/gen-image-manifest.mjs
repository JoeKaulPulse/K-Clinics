// Auto-generates public/treatments/manifest.json by scanning the folder for
// image files actually present. Runs automatically before every build, so any
// images committed to public/treatments/ are picked up with no manual step.
import fs from 'fs';
import path from 'path';

const DIR = path.resolve(import.meta.dirname, '../public/treatments');
fs.mkdirSync(DIR, { recursive: true });

const files = fs
  .readdirSync(DIR)
  .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
  .sort();

fs.writeFileSync(path.join(DIR, 'manifest.json'), JSON.stringify(files, null, 2) + '\n');
console.log(`[image-manifest] ${files.length} image(s) in public/treatments/`);
