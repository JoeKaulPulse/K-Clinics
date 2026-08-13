// One-off (re-runnable) batch pass: recompress oversized public/treatments/
// source PNG/JPEG files down to JPEG so next/image's on-request optimizer
// starts from a sane source size instead of raw WordPress-export originals
// (some 1-2MB+ each). See BLD-1270.
//
// JPEG, not WebP/AVIF: this folder's images are also embedded directly (not
// through next/image) by lib/og.tsx's Open Graph card renderer, which runs
// on Satori/resvg (next/og) — that renderer cannot decode WebP/AVIF raster
// images embedded via data URI (confirmed: converting to WebP broke
// prerendering for every treatment/journal OG card, "TypeError: u2 is not
// iterable"). JPEG is universally supported by both next/image and next/og,
// so it's the only safe target for a batch pass that doesn't know in advance
// which files a future OG card might reference.
//
// Safety rules, in order:
//  - Only touches files above SIZE_THRESHOLD (small images are already fine).
//  - Skips any basename that exists under more than one extension in the
//    folder (e.g. both `1.png` and `1.jpg`) — converting one to `<base>.jpg`
//    would silently collide with or shadow the other, and DB-authored content
//    (WordPress-imported article HTML) can reference either by its exact
//    original filename via lib/treatment-images.ts#resolveMigratedImage.
//    Ambiguous basenames are left alone entirely.
//  - Skips any source with meaningful alpha transparency (JPEG has none —
//    flattening it would visibly change the image over a non-matching page
//    background). Opaque PNGs (the vast majority of these — WordPress-export
//    photos) convert freely.
//  - Keeps the original file if the JPEG re-encode isn't actually smaller.
//  - Every rename is applied to the three explicit image maps in import/ and
//    to the hardcoded articleMap in lib/treatment-images.ts, so nothing that
//    references a file by its old name breaks. DB-authored content (which
//    can't be edited from here) is handled by resolveMigratedImage's
//    basename-fallback match, not by renaming rows.
//
// Usage: node scripts/optimize-treatment-images.mjs [--dry-run]
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const DIR = path.resolve(import.meta.dirname, '../public/treatments');
const SIZE_THRESHOLD = 200 * 1024; // 200KB
const MAX_DIMENSION = 2400; // px, long edge — generous ceiling for web use
const JPEG_QUALITY = 82;
const DRY_RUN = process.argv.includes('--dry-run');

const MAP_FILES = [
  path.resolve(import.meta.dirname, '../import/slug-image-map.json'),
  path.resolve(import.meta.dirname, '../import/package-image-map.json'),
  path.resolve(import.meta.dirname, '../import/page-image-map.json'),
];
const TREATMENT_IMAGES_TS = path.resolve(import.meta.dirname, '../lib/treatment-images.ts');

function basenameOf(file) {
  return file.replace(/\.[^.]+$/, '').toLowerCase();
}

const allFiles = fs.readdirSync(DIR).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f));
const byBase = new Map();
for (const f of allFiles) {
  const base = basenameOf(f);
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(f);
}
const ambiguousBases = new Set([...byBase.entries()].filter(([, v]) => v.length > 1).map(([k]) => k));

const candidates = allFiles.filter((f) => {
  if (!/\.(png|jpe?g)$/i.test(f)) return false;
  if (ambiguousBases.has(basenameOf(f))) return false;
  const size = fs.statSync(path.join(DIR, f)).size;
  return size > SIZE_THRESHOLD;
});

console.log(`[optimize-treatment-images] ${allFiles.length} images total, ${ambiguousBases.size} ambiguous basename(s) skipped, ${candidates.length} candidate(s) for conversion.`);

const renames = []; // { from, to }
let totalBefore = 0;
let totalAfter = 0;

for (const file of candidates) {
  const srcPath = path.join(DIR, file);
  const before = fs.statSync(srcPath).size;

  const meta = await sharp(srcPath).metadata();
  if (meta.hasAlpha) {
    const stats = await sharp(srcPath).stats();
    const alphaChannel = stats.channels[stats.channels.length - 1];
    // min < 255 means at least one pixel is not fully opaque — real transparency.
    if (alphaChannel && alphaChannel.min < 255) {
      console.log(`[skip] ${file} — has real alpha transparency, JPEG can't represent it.`);
      continue;
    }
  }

  const dest = `${file.replace(/\.[^.]+$/, '')}.jpg`;
  const destPath = path.join(DIR, dest);

  let img = sharp(srcPath).rotate().flatten({ background: '#ffffff' });
  if ((meta.width || 0) > MAX_DIMENSION || (meta.height || 0) > MAX_DIMENSION) {
    img = img.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true });
  }
  const outBuf = await img.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();

  if (outBuf.length >= before) {
    console.log(`[skip] ${file} — JPEG (${outBuf.length}) not smaller than original (${before}), keeping as-is.`);
    continue;
  }

  totalBefore += before;
  totalAfter += outBuf.length;
  console.log(`[convert] ${file} (${before}) -> ${dest} (${outBuf.length}, ${(100 * outBuf.length / before).toFixed(1)}%)`);

  if (!DRY_RUN) {
    fs.writeFileSync(destPath, outBuf);
    if (destPath !== srcPath) fs.unlinkSync(srcPath);
  }
  if (dest !== file) renames.push({ from: file, to: dest });
}

console.log(`\n[optimize-treatment-images] ${renames.length} file(s) converted. ${(totalBefore / 1024 / 1024).toFixed(1)}MB -> ${(totalAfter / 1024 / 1024).toFixed(1)}MB.`);

if (DRY_RUN || renames.length === 0) {
  console.log('[optimize-treatment-images] dry run or nothing to update — skipping reference rewrite.');
  process.exit(0);
}

const renameMap = new Map(renames.map((r) => [r.from, r.to]));

for (const mapPath of MAP_FILES) {
  const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  let changed = 0;
  for (const key of Object.keys(data)) {
    const cur = data[key];
    if (renameMap.has(cur)) { data[key] = renameMap.get(cur); changed++; }
  }
  if (changed) {
    fs.writeFileSync(mapPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`[optimize-treatment-images] updated ${changed} entr${changed === 1 ? 'y' : 'ies'} in ${path.relative(process.cwd(), mapPath)}`);
  }
}

let ts = fs.readFileSync(TREATMENT_IMAGES_TS, 'utf8');
let tsChanged = 0;
for (const [from, to] of renameMap) {
  const needle = `'${from}'`;
  if (ts.includes(needle)) { ts = ts.split(needle).join(`'${to}'`); tsChanged++; }
}
if (tsChanged) {
  fs.writeFileSync(TREATMENT_IMAGES_TS, ts);
  console.log(`[optimize-treatment-images] updated ${tsChanged} reference(s) in lib/treatment-images.ts`);
}
