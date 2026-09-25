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
// BLD-1608 follow-up: BLD-1270 left ~134 ambiguous basenames untouched entirely
// (both `X.png` and `X.jpg` present) because it couldn't tell whether the two
// were unrelated content sharing a name or the same photo pre/post-conversion.
// A number of those `.png` sides are still the live-referenced image (present
// in one of MAP_FILES/TS_FILES below) at full WordPress-export size, while
// their same-basename sibling is a *different*, unrelated photo that nothing
// in the codebase references — a coincidental filename collision, not a real
// ambiguity about which file is "the" image. For exactly that shape (the
// oversized side is referenced, the colliding sibling is not referenced
// anywhere) this script now converts the referenced side too, but to a new,
// non-colliding filename rather than renaming onto the taken `<base>.jpg` —
// and it leaves the original oversized file on disk untouched rather than
// deleting it. Two reasons for the extra caution here that don't apply to the
// unambiguous rename path below:
//  - lib/treatment-images.ts#resolve()'s basename-only fallback (for
//    DB-authored WordPress content citing the pre-conversion filename) only
//    answers when a basename maps to exactly one present file. Deleting the
//    oversized original would leave the unrelated sibling as that one file,
//    so any legacy reference to the old name would silently start resolving
//    to the WRONG photo instead of failing loudly. Converting to an unrelated
//    new filename (not sharing a basename with anything) sidesteps this
//    entirely: it's additive, so the existing ambiguous pair — and its
//    "decline rather than guess" fallback behaviour — is left exactly as-is.
//  - This sandbox cannot reach the production database (every direct
//    connection attempt times out) to positively confirm no Post row's
//    content/coverImage cites one of these exact original filenames, so the
//    conservative choice is to keep the original resolvable under its exact
//    name rather than remove it.
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

// What does the live app actually reference by exact filename today? Read
// this up front (before any conversion) so the ambiguous-but-referenced check
// below can tell "the live photo" apart from "an unrelated same-named file".
function loadReferencedFiles() {
  const referenced = new Set();
  for (const mapPath of MAP_FILES) {
    const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    for (const v of Object.values(data)) if (typeof v === 'string') referenced.add(v);
  }
  for (const tsPath of TS_FILES) {
    const ts = fs.readFileSync(tsPath, 'utf8');
    for (const m of ts.matchAll(/'([^'\s]+\.(?:png|jpe?g))'/gi)) referenced.add(m[1]);
  }
  return referenced;
}
const referencedFiles = loadReferencedFiles();

const allFiles = fs.readdirSync(DIR).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f));
const allFilesLower = new Set(allFiles.map((f) => f.toLowerCase()));
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

// The ambiguous-but-safely-convertible case described above: this file IS
// referenced by the live app, its basename-sibling(s) are NOT referenced by
// anything, and it's over threshold. Converts additively (new filename,
// original left in place) — see the comment block above.
const ambiguousCandidates = allFiles.filter((f) => {
  if (!/\.(png|jpe?g)$/i.test(f)) return false;
  const base = basenameOf(f);
  if (!ambiguousBases.has(base)) return false;
  if (!referencedFiles.has(f)) return false;
  const siblings = byBase.get(base).filter((s) => s !== f);
  if (siblings.some((s) => referencedFiles.has(s))) return false; // sibling also live — genuinely ambiguous, leave alone
  const size = fs.statSync(path.join(DIR, f)).size;
  return size > SIZE_THRESHOLD;
});

console.log(`[optimize-treatment-images] ${allFiles.length} images total, ${ambiguousBases.size} ambiguous basename(s), ${candidates.length} candidate(s) for conversion, ${ambiguousCandidates.length} referenced-but-ambiguous candidate(s) for additive conversion.`);

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

// Additive pass: referenced-but-ambiguous files (see comment block above).
// New filename, original left on disk, only the live reference is repointed.
let additiveBefore = 0;
let additiveAfter = 0;
const leftInPlace = []; // { file, size } — old files still on disk, now unreferenced

for (const file of ambiguousCandidates) {
  const srcPath = path.join(DIR, file);
  const before = fs.statSync(srcPath).size;

  const meta = await sharp(srcPath).metadata();
  if (meta.hasAlpha) {
    const stats = await sharp(srcPath).stats();
    const alphaChannel = stats.channels[stats.channels.length - 1];
    if (alphaChannel && alphaChannel.min < 255) {
      console.log(`[skip-ambiguous] ${file} — has real alpha transparency, JPEG can't represent it.`);
      continue;
    }
  }

  // Find a filename that doesn't collide with anything currently on disk,
  // checked case-insensitively (this folder is also deployed to filesystems
  // that fold case, so two names differing only by case are the same file).
  const base = file.replace(/\.[^.]+$/, '');
  let dest = `${base}-opt.jpg`;
  let n = 2;
  while (allFilesLower.has(dest.toLowerCase())) {
    dest = `${base}-opt${n}.jpg`;
    n++;
  }
  const destPath = path.join(DIR, dest);

  let img = sharp(srcPath).rotate().flatten({ background: '#ffffff' });
  if ((meta.width || 0) > MAX_DIMENSION || (meta.height || 0) > MAX_DIMENSION) {
    img = img.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true });
  }
  const outBuf = await img.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();

  if (outBuf.length >= before) {
    console.log(`[skip-ambiguous] ${file} — JPEG (${outBuf.length}) not smaller than original (${before}), keeping as-is.`);
    continue;
  }

  additiveBefore += before;
  additiveAfter += outBuf.length;
  console.log(`[convert-ambiguous] ${file} (${before}) -> ${dest} (${outBuf.length}, ${(100 * outBuf.length / before).toFixed(1)}%) — original left in place, unreferenced`);

  if (!DRY_RUN) {
    fs.writeFileSync(destPath, outBuf);
    allFilesLower.add(dest.toLowerCase());
  }
  renames.push({ from: file, to: dest });
  leftInPlace.push({ file, size: before });
}

if (ambiguousCandidates.length) {
  console.log(`[optimize-treatment-images] ${leftInPlace.length} referenced-but-ambiguous file(s) additively converted. ${(additiveBefore / 1024 / 1024).toFixed(1)}MB -> ${(additiveAfter / 1024 / 1024).toFixed(1)}MB (new files; ${(leftInPlace.reduce((s, x) => s + x.size, 0) / 1024 / 1024).toFixed(1)}MB of original files intentionally left on disk, now unreferenced).`);
}

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
