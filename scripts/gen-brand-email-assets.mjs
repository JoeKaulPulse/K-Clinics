// Regenerates the brand wordmark used in the email header — rasterises the
// official "CLINICS" vector (components/brand/marks.tsx) to a crisp, porcelain
// PNG and embeds it as base64 in lib/brand-email-assets.ts (cid:kwordmark).
//
// Email clients don't render inline SVG, so the header carries the real brand
// wordmark as an inline image instead of retyped serif text. Re-run if the
// wordmark artwork changes:  node scripts/gen-brand-email-assets.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// "CLINICS" wordmark — path data copied verbatim from components/brand/marks.tsx.
const WORDMARK_PATHS = [
  'M0.875977 25.8821C0.875977 39.8949 13.026 50.8986 27.1821 50.8986H90.1532V43.113H27.1821C16.8829 43.113 9.09142 34.814 9.09142 25.8821C9.16306 24.8134 9.23471 24.0253 9.45562 23.2372L9.66459 22.2401C11.4557 14.4485 18.8831 8.80043 26.6746 8.80043C26.8179 8.80043 26.9672 8.80043 27.1105 8.80043H90.0816V0.937256H27.1105C13.1693 0.937256 0.875977 11.8693 0.875977 25.8821Z',
  'M111.468 43.1847V0.937256H103.312V50.9762H176.087V43.1847H111.468Z',
  'M189.252 50.9762H197.467V0.937256H189.252V50.9762Z',
  'M213.498 50.6181H221.713V13.0933C289.831 44.8326 300.626 50.1225 302.411 50.827L302.704 50.9763V0.937353H294.548V38.4621L213.498 0.656738V50.9762Z',
  'M318.723 50.9762H326.938V0.937256H318.723V50.9762Z',
  'M340.82 25.8821C340.82 39.8949 352.97 50.8986 367.126 50.8986H430.103V43.113H367.126C356.838 43.113 349.047 34.814 349.047 25.8821C349.113 24.8134 349.184 24.0253 349.399 23.2372L349.608 22.2401C351.399 14.4485 358.839 8.80043 366.63 8.80043C366.767 8.80043 366.911 8.80043 367.054 8.80043H430.025V0.937256H367.054C353.113 0.937256 340.82 11.8693 340.82 25.8821Z',
  'M441.118 50.8269H515.033C523.392 50.8269 530.181 44.2534 530.181 36.3186C530.181 28.3181 522.753 21.8878 515.099 21.8878H456.2C452.343 21.8878 449.274 18.8787 449.274 15.2367C449.274 11.4454 452.486 8.80043 455.848 8.80043C455.985 8.80043 456.128 8.80043 456.278 8.80043H530.181V0.937256H456.278C448.343 0.937256 441.19 7.23019 441.19 15.2367V15.5173C441.19 23.7447 448.701 29.8167 456.128 29.8167H515.171C518.89 29.8167 521.965 32.6766 521.965 36.3902C521.965 40.0382 518.89 43.0414 515.033 43.0414H441.118V50.8269Z',
];

// Porcelain fill so it sits cleanly on the dark (#2a2420) header band.
const FILL = '#f3e9dd';
const RENDER_W = 1062; // 2× the 531 viewBox for retina crispness

async function main() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 531 51" width="${RENDER_W}" height="${Math.round((RENDER_W * 51) / 531)}">${WORDMARK_PATHS.map((d) => `<path fill="${FILL}" d="${d}"/>`).join('')}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const b64 = png.toString('base64');

  const file = path.join(process.cwd(), 'lib/brand-email-assets.ts');
  let src = fs.readFileSync(file, 'utf8');
  const line = `export const K_WORDMARK_LIGHT_B64 = "${b64}";`;
  if (/export const K_WORDMARK_LIGHT_B64 = "[^"]*";/.test(src)) {
    src = src.replace(/export const K_WORDMARK_LIGHT_B64 = "[^"]*";/, line);
  } else {
    src = src.trimEnd() + '\n\n// "CLINICS" wordmark, porcelain — header lockup (cid:kwordmark). See scripts/gen-brand-email-assets.mjs.\n' + line + '\n';
  }
  fs.writeFileSync(file, src);
  console.log(`[brand-email-assets] wrote K_WORDMARK_LIGHT_B64 (${(b64.length / 1024).toFixed(1)} KB base64)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
