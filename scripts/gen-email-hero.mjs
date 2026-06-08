// Generates the booking-confirmation email hero (cid:hero) — an animated
// "confirmed" tick that draws itself inside a soft champagne band, then catches
// a light sweep. Meaningful (it says "confirmed") and distinct from the dark
// header above it. Frame 0 is a clean static band so Outlook (first-frame only)
// still looks finished. Embedded as base64 in lib/brand-email-assets.ts.
// Re-run:  node scripts/gen-email-hero.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const W = 640, H = 196, CX = 320, CY = 96, R = 34;
const C = 2 * Math.PI * R;                 // ring circumference
const CHECK = 'M302 98 L315 111 L340 80';  // tick path
const L = 15.56 + 36.6;                     // approx tick length
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

function frameSvg(i) {
  const ringP = clamp((i - 2) / 8);
  const checkP = clamp((i - 10) / 6);
  const ringOff = C * (1 - ringP);
  const checkOff = L * (1 - checkP);
  const gt = clamp((i - 15) / 5);
  const burst = gt > 0 && gt < 1 ? `<circle cx="${CX}" cy="${CY}" r="${R + gt * 40}" fill="none" stroke="#dcc4a8" stroke-width="3" opacity="${(0.4 * (1 - gt)).toFixed(3)}"/>` : '';
  const showShim = i >= 16;
  const sx = -200 + ((i - 16) / 9) * (W + 380);
  const shim = showShim ? `<g opacity="0.5"><rect transform="skewX(-18)" x="${sx.toFixed(0)}" y="-20" width="78" height="${H + 40}" fill="url(#shim)"/></g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3e7d9"/><stop offset="1" stop-color="#efe1d3"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="48%" r="42%"><stop offset="0" stop-color="#fbf3e8"/><stop offset="100%" stop-color="#efe1d3" stop-opacity="0"/></radialGradient>
    <linearGradient id="shim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.7"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${W}" height="2" fill="#a98a6d"/>
  <rect x="0" y="${H - 2}" width="${W}" height="2" fill="#a98a6d"/>
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#cbb49c" stroke-width="2.5" opacity="0.35"/>
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#a98a6d" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${ringOff.toFixed(2)}" transform="rotate(-90 ${CX} ${CY})"/>
  ${burst}
  ${checkP > 0 ? `<path d="${CHECK}" fill="none" stroke="#856a4a" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${L.toFixed(2)}" stroke-dashoffset="${checkOff.toFixed(2)}"/>` : ''}
  ${shim}
</svg>`;
}

async function main() {
  const order = [];
  for (let i = 0; i < 27; i++) order.push(i);
  // Hold the finished frame a beat before looping.
  for (let h = 0; h < 6; h++) order.push(26);
  const frames = [];
  for (const i of order) frames.push(await sharp(Buffer.from(frameSvg(i))).png().toBuffer());

  const gif = await sharp(frames, { join: { animated: true } }).gif({ loop: 0, delay: 70, colours: 64, dither: 0.6 }).toBuffer();
  const b64 = gif.toString('base64');

  const file = path.join(process.cwd(), 'lib/brand-email-assets.ts');
  let src = fs.readFileSync(file, 'utf8');
  const line = `export const EMAIL_HERO_GIF_B64 = "${b64}";`;
  if (/export const EMAIL_HERO_GIF_B64 = "[^"]*";/.test(src)) src = src.replace(/export const EMAIL_HERO_GIF_B64 = "[^"]*";/, line);
  else src = src.trimEnd() + '\n\n// Animated booking-confirmation hero (cid:hero). See scripts/gen-email-hero.mjs.\n' + line + '\n';
  fs.writeFileSync(file, src);
  console.log(`[email-hero] wrote EMAIL_HERO_GIF_B64 — ${(gif.length / 1024).toFixed(1)} KB (${order.length} frames)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
