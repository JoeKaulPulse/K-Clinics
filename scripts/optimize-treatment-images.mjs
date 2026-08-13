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
//  - Keeps the original file if the JPEG re-encode isn't actually smaller
//    (and, for an in-place re-encode, if it isn't smaller by MIN_GAIN_RATIO —
//    so re-running this script doesn't put already-optimised files through
//    another generation of lossy encoding for a fraction of a percent).
//  - Every rename is applied to the three explicit image maps in import/ and
//    to the inline filenames in lib/treatment-images.ts and lib/articles.ts,
//    so nothing that references a file by its old name breaks. DB-authored
//    content (which can't be edited from here) is handled by the basename
//    fallback in lib/treatment-images.ts#resolve, not by renaming rows.
//
// public/treatments/manifest.json is NOT written here: scripts/gen-image-manifest.mjs
// regenerates it from the folder on every dev start and prebuild.
//
// Usage: node scripts/optimize-treatment-images.mjs [--dry-run]
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const DIR = path.resolve(import.meta.dirname, '../public/treatments');
const SIZE_THRESHOLD = 200 * 1024; // 200KB
const MAX_DIMENSION = 2400; // px, long edge — generous ceiling for web use
const JPEG_QUALITY = 82;
// A re-encode that only shaves a fraction of a percent is an already-optimised
// file being pushed through a lossy codec again: no real saving, but a fresh
// round of generation loss and a churny binary diff every time this script is
// re-run. Only rewrite in place when the saving is worth the quality cost.
const MIN_GAIN_RATIO = 0.9; // output must be <=90% of the original
const DRY_RUN = process.argv.includes('--dry-run');

const MAP_FILES = [
  path.resolve(import.meta.dirname, '../import/slug-image-map.json'),
  path.resolve(import.meta.dirname, '../import/package-image-map.json'),
  path.resolve(import.meta.dirname, '../import/page-image-map.json'),
];
// Source files that name a treatment image inline, as a single-quoted string.
const TS_FILES = [
  path.resolve(import.meta.dirname, '../lib/treatment-images.ts'), // articleMap
  path.resolve(import.meta.dirname, '../lib/articles.ts'), // Article.image
];

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

  // A rename always has to be worth doing (it moves the file); an in-place
  // re-encode additionally has to clear MIN_GAIN_RATIO so re-runs are a no-op
  // on files this script has already compressed.
  const sameName = dest === file;
  const limit = sameName ? before * MIN_GAIN_RATIO : before;
  if (outBuf.length >= limit) {
    console.log(`[skip] ${file} — JPEG (${outBuf.length}) not enough smaller than original (${before}), keeping as-is.`);
    continue;
  }

  totalBefore += before;
  totalAfter += outBuf.length;
  console.log(`[convert] ${file} (${before}) -> ${dest} (${outBuf.length}, ${(100 * outBuf.length / before).toFixed(1)}%)`);

  if (!DRY_RUN) {
    // Write to a temp file, drop the source, then move into place. Writing dest
    // first and unlinking src afterwards is only safe while the two names
    // differ as FILES: on a case-insensitive filesystem (macOS, Windows) a
    // `PHOTO.JPG` source and its `PHOTO.jpg` destination are the SAME file, so
    // the unlink would delete the freshly written output. Going via a temp name
    // is correct on every filesystem, including the in-place (dest === src) case.
    const tmpPath = `${destPath}.optimize-tmp`;
    fs.writeFileSync(tmpPath, outBuf);
    if (destPath !== srcPath) fs.unlinkSync(srcPath);
    fs.renameSync(tmpPath, destPath);
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

for (const tsPath of TS_FILES) {
  let ts = fs.readFileSync(tsPath, 'utf8');
  let tsChanged = 0;
  for (const [from, to] of renameMap) {
    const needle = `'${from}'`;
    if (ts.includes(needle)) { ts = ts.split(needle).join(`'${to}'`); tsChanged++; }
  }
  if (tsChanged) {
    fs.writeFileSync(tsPath, ts);
    console.log(`[optimize-treatment-images] updated ${tsChanged} reference(s) in ${path.relative(process.cwd(), tsPath)}`);
  }
}
