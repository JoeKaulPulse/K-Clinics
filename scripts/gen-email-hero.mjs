// Generates the animated email hero band — a textless, on-brand champagne light
// sweep over the ink gradient, embedded as base64 in lib/brand-email-assets.ts
// (cid:hero). Textless on purpose: the headline stays real HTML (Fraunces) below
// it, and frame 0 is a complete static band so Outlook (first-frame only) still
// looks finished. Re-run:  node scripts/gen-email-hero.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const W = 640, H = 160, N = 16;

function frameSvg(shift) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2420"/><stop offset="1" stop-color="#171310"/></linearGradient>
    <radialGradient id="g1" cx="18%" cy="26%" r="55%"><stop offset="0" stop-color="#a98a6d" stop-opacity="0.55"/><stop offset="100%" stop-color="#2a2420" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="82%" cy="74%" r="55%"><stop offset="0" stop-color="#dcc4a8" stop-opacity="0.42"/><stop offset="100%" stop-color="#2a2420" stop-opacity="0"/></radialGradient>
    <linearGradient id="sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f4ebdd" stop-opacity="0"/><stop offset="0.5" stop-color="#f4ebdd" stop-opacity="0.5"/><stop offset="1" stop-color="#f4ebdd" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#g1)"/>
  <rect width="${W}" height="${H}" fill="url(#g2)"/>
  <g transform="skewX(-20)"><rect x="${shift}" y="-40" width="130" height="${H + 80}" fill="url(#sh)"/></g>
  <rect x="0" y="0" width="${W}" height="2" fill="#a98a6d"/>
  <rect x="0" y="${H - 2}" width="${W}" height="2" fill="#a98a6d"/>
</svg>`;
}

async function main() {
  const kmark = fs.readFileSync(path.join(process.cwd(), 'public/brand/k-mark-light.png'));
  const mark = await sharp(kmark).resize({ height: 66 }).png().toBuffer();
  const frames = [];
  for (let i = 0; i < N; i++) {
    // Sheen travels left→right; frame 0 keeps it off-screen so the static
    // fallback is a clean band.
    const shift = -220 + (i * (W + 320)) / (N - 1);
    const base = await sharp(Buffer.from(frameSvg(shift))).png().toBuffer();
    const composed = await sharp(base).composite([{ input: mark, left: Math.round(W / 2 - 22), top: Math.round(H / 2 - 33) }]).png().toBuffer();
    frames.push(composed);
  }
  const gif = await sharp(frames, { join: { animated: true } }).gif({ loop: 0, delay: 110, colours: 96, dither: 0.8 }).toBuffer();
  const b64 = gif.toString('base64');

  const file = path.join(process.cwd(), 'lib/brand-email-assets.ts');
  let src = fs.readFileSync(file, 'utf8');
  const line = `export const EMAIL_HERO_GIF_B64 = "${b64}";`;
  if (/export const EMAIL_HERO_GIF_B64 = "[^"]*";/.test(src)) src = src.replace(/export const EMAIL_HERO_GIF_B64 = "[^"]*";/, line);
  else src = src.trimEnd() + '\n\n// Animated email hero band (cid:hero). See scripts/gen-email-hero.mjs.\n' + line + '\n';
  fs.writeFileSync(file, src);
  console.log(`[email-hero] wrote EMAIL_HERO_GIF_B64 — ${(gif.length / 1024).toFixed(1)} KB (${N} frames)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
