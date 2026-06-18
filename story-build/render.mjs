import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const MODE = process.argv[2] || 'contact';
const FPS = Number(process.argv[3] || 30);
const HTML = 'file://' + path.resolve('story-build/scene.html');

const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars'] });
const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true, bypassCSP: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 120)));
await p.goto(HTML, { waitUntil: 'load', timeout: 60000 });
await p.waitForFunction('window.__ready === true', { timeout: 30000 }).catch(() => console.log('READY TIMEOUT'));
const TOTAL = await p.evaluate('window.__total');
console.log('TOTAL', TOTAL, 'pageerrors:', errs.slice(0, 3));

if (MODE === 'contact') {
  const times = [0.4, 1.7, 3.2, 5.3, 6.8, 7.85, 9.15, 10.8, 13.2, 17.4, 20.2, 22.2];
  const tiles = [];
  for (let i = 0; i < times.length; i++) {
    await p.evaluate(t => window.render(t), times[i]);
    await p.waitForTimeout(40);
    const buf = await p.screenshot({ type: 'png' });
    const lab = await sharp({ create: { width: 360, height: 640, channels: 3, background: '#000' } }).png().toBuffer();
    const small = await sharp(buf).resize(360, 640).png().toBuffer();
    tiles.push({ input: await sharp(small).composite([{ input: Buffer.from(`<svg width="360" height="40"><rect width="360" height="40" fill="rgba(0,0,0,0.5)"/><text x="8" y="27" font-family="monospace" font-size="22" fill="#dcc4a8">t=${times[i]}s</text></svg>`), top: 0, left: 0 }]).png().toBuffer(), top: Math.floor(i / 4) * 640, left: (i % 4) * 360 });
  }
  await sharp({ create: { width: 360 * 4, height: 640 * 3, channels: 3, background: '#111' } })
    .composite(tiles).jpeg({ quality: 86 }).toFile('story-build/recon/scene-contact.jpg');
  console.log('CONTACT_SHEET_DONE story-build/recon/scene-contact.jpg');
} else {
  const dir = 'story-build/frames';
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const N = Math.ceil(TOTAL * FPS);
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    const t = f / FPS;
    await p.evaluate(tt => window.render(tt), t);
    await p.screenshot({ path: path.join(dir, String(f).padStart(4, '0') + '.png') });
    if (f % 60 === 0) console.log(`frame ${f}/${N} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log('FRAMES_DONE', N, 'frames in', ((Date.now() - t0) / 1000).toFixed(0) + 's', 'pageerrors:', errs.slice(0, 3));
}
await b.close();
