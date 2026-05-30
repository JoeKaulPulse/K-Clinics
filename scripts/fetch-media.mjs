// Download all referenced media from the existing kclinics.co.uk site.
// Run this on a machine that CAN reach kclinics.co.uk (the build environment
// cannot). It reads import/image-manifest.txt, downloads each file into
// public/treatments/, and writes public/treatments/manifest.json.
//
//   node scripts/fetch-media.mjs
//
// Re-run any time; it skips files already downloaded.

import fs from 'fs';
import path from 'path';
import https from 'https';

const ROOT = path.resolve(import.meta.dirname, '..');
const MANIFEST = path.join(ROOT, 'import/image-manifest.txt');
const OUT = path.join(ROOT, 'public/treatments');

const urls = fs.readFileSync(MANIFEST, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

function download(url) {
  return new Promise((resolve) => {
    const file = path.basename(url.split('?')[0]);
    const dest = path.join(OUT, file);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return resolve({ file, ok: true, skipped: true });
    const req = https.get(url, { headers: { 'User-Agent': UA, Accept: 'image/*' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve({ file, ok: false, status: res.statusCode }); }
      const ws = fs.createWriteStream(dest);
      res.pipe(ws);
      ws.on('finish', () => ws.close(() => resolve({ file, ok: true })));
    });
    req.on('error', (e) => resolve({ file, ok: false, error: e.message }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ file, ok: false, error: 'timeout' }); });
  });
}

const present = [];
let ok = 0, fail = 0, skip = 0, done = 0;
const CONCURRENCY = 12;
let cursor = 0;
async function worker() {
  while (cursor < urls.length) {
    const url = urls[cursor++];
    const r = await download(url);
    if (r.ok) { present.push(r.file); r.skipped ? skip++ : ok++; }
    else { fail++; if (fail < 30) console.warn('  FAIL', r.status || r.error, url); }
    done++;
    if (done % 25 === 0) process.stdout.write(`\r${done}/${urls.length} (ok ${ok}, skip ${skip}, fail ${fail})`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify([...new Set(present)].sort(), null, 2));
console.log(`\nDone. ${present.length} files in public/treatments/, manifest.json written. (fail ${fail})`);
