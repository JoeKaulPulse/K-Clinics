// Generates the per-type animated email heroes (cid:hero-<motif>) — a small
// line-art icon that draws itself inside a soft champagne band, then catches a
// light sweep. Same drawn-line language across the suite, a motif per email type
// (confirmed tick, clock, envelope, stars, gift…). Frame 0 is a clean static
// band so Outlook (first-frame only) still looks finished. Output is embedded as
// base64 in lib/email-heroes.ts.  Re-run:  node scripts/gen-email-heroes.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const W = 640, H = 196, CX = 320, CY = 98;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const rad = (d) => (d * Math.PI) / 180;

// ── Stroke primitives (each knows its length so the draw is smooth) ──────────
const SA = (o = {}) => `stroke="${o.c || '#856a4a'}" stroke-width="${o.w || 4}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
const dash = (len, p) => `stroke-dasharray="${len.toFixed(2)}" stroke-dashoffset="${(len * (1 - p)).toFixed(2)}"`;

const line = (x1, y1, x2, y2, o) => { const len = Math.hypot(x2 - x1, y2 - y1); return { len, el: (p) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${SA(o)} ${dash(len, p)}/>` }; };
const poly = (pts, o) => {
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const d = 'M' + pts.map((q) => q.join(' ')).join(' L ');
  return { len, el: (p) => `<path d="${d}" ${SA(o)} ${dash(len, p)}/>` };
};
const ring = (cx, cy, r, o) => { const len = 2 * Math.PI * r; return { len, el: (p) => `<circle cx="${cx}" cy="${cy}" r="${r}" ${SA(o)} ${dash(len, p)} transform="rotate(-90 ${cx} ${cy})"/>` }; };
const rect = (x, y, w, h, o) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], o);
const arc = (cx, cy, r, a0, a1, o) => {
  const x0 = cx + r * Math.cos(rad(a0)), y0 = cy + r * Math.sin(rad(a0)), x1 = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1));
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0, sweep = a1 > a0 ? 1 : 0, len = r * Math.abs(rad(a1) - rad(a0));
  const d = `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  return { len, el: (p) => `<path d="${d}" ${SA(o)} ${dash(len, p)}/>` };
};
const star = (cx, cy, r, o) => { const pts = []; for (let i = 0; i <= 10; i++) { const a = -90 + i * 36, rr = i % 2 === 0 ? r : r * 0.45; pts.push([+(cx + rr * Math.cos(rad(a))).toFixed(2), +(cy + rr * Math.sin(rad(a))).toFixed(2)]); } return poly(pts, o); };

const ringO = { w: 2.6, c: '#a98a6d' };
const thin = { w: 3 };

// ── Motifs — ordered primitives, drawn in sequence ───────────────────────────
const MOTIFS = {
  confirmed: [ring(CX, CY, 34, ringO), poly([[302, 99], [315, 112], [340, 79]], { w: 4.5 })],
  reminder: [ring(CX, CY, 32, ringO), line(CX, CY, CX, 80, { w: 3.5 }), line(CX, CY, 335, 103, { w: 3.5 })],
  forms: [rect(294, 64, 52, 66, thin), line(305, 84, 335, 84, thin), line(305, 97, 335, 97, thin), line(305, 110, 326, 110, thin)],
  welcome: [rect(286, 72, 68, 50, thin), poly([[286, 72], [320, 103], [354, 72]], thin)],
  receipt: [rect(284, 78, 72, 44, thin), line(284, 92, 356, 92, thin), line(296, 108, 330, 108, thin)],
  voucher: [rect(290, 86, 60, 42, thin), line(CX, 86, CX, 128, thin), line(290, 100, 350, 100, thin), arc(313, 83, 7, 80, 320, { w: 2.4 }), arc(327, 83, 7, 220, 100, { w: 2.4 })],
  followup: [rect(286, 70, 68, 42, thin), poly([[303, 112], [303, 127], [318, 112]], thin)],
  chat: [rect(286, 70, 68, 42, thin), poly([[303, 112], [303, 127], [318, 112]], thin), ring(305, 90, 2.6, thin), ring(320, 90, 2.6, thin), ring(335, 90, 2.6, thin)],
  review: [star(272, CY, 11, thin), star(296, CY, 11, thin), star(320, CY, 11, thin), star(344, CY, 11, thin), star(368, CY, 11, thin)],
  birthday: [line(300, 130, 340, 130, { w: 3.5 }), rect(314, 96, 12, 32, thin), poly([[320, 96], [315, 88], [320, 79], [325, 88], [320, 96]], { w: 2.4 })],
  winback: [arc(CX, CY, 28, 140, 430, { w: 3.4 }), poly([[316, 119], [326, 127], [333, 114]], { w: 3.4 })],
  secure: [rect(304, 100, 32, 26, thin), arc(CX, 100, 11, 180, 360, thin), line(CX, 108, CX, 116, { w: 2.6 })],
};

function band(inner) {
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
  ${inner}
</svg>`;
}

const DRAW = 20;
function frame(prims, fi) {
  const drawP = clamp(fi / DRAW);
  const n = prims.length;
  const strokes = prims.map((pr, idx) => { const a = idx / n, b = (idx + 1) / n; return pr.el(clamp((drawP - a) / (b - a))); }).join('');
  const gt = clamp((fi - DRAW) / 5);
  const burst = gt > 0 && gt < 1 ? `<circle cx="${CX}" cy="${CY}" r="${(44 + gt * 38).toFixed(0)}" fill="none" stroke="#dcc4a8" stroke-width="3" opacity="${(0.32 * (1 - gt)).toFixed(2)}"/>` : '';
  const shimStart = DRAW - 2;
  const shim = fi >= shimStart ? `<g opacity="0.5"><rect transform="skewX(-18)" x="${(-200 + ((fi - shimStart) / 10) * (W + 380)).toFixed(0)}" y="-20" width="78" height="${H + 40}" fill="url(#shim)"/></g>` : '';
  return band(strokes + burst + shim);
}

async function main() {
  const out = {};
  for (const [name, prims] of Object.entries(MOTIFS)) {
    const order = [];
    for (let i = 0; i < 29; i++) order.push(i);
    for (let h = 0; h < 6; h++) order.push(28); // hold the finished frame
    const frames = [];
    for (const i of order) frames.push(await sharp(Buffer.from(frame(prims, i))).png().toBuffer());
    const gif = await sharp(frames, { join: { animated: true } }).gif({ loop: 0, delay: 70, colours: 64, dither: 0.6 }).toBuffer();
    out[name] = gif.toString('base64');
    console.log(`  ${name}: ${(gif.length / 1024).toFixed(1)} KB`);
  }
  const body = `// AUTO-GENERATED by scripts/gen-email-heroes.mjs — do not edit by hand.\n// Per-type animated email hero bands (cid:hero-<motif>), base64 GIF.\nexport const EMAIL_HEROES: Record<string, string> = {\n${Object.entries(out).map(([k, v]) => `  ${k}: "${v}",`).join('\n')}\n};\n`;
  fs.writeFileSync(path.join(process.cwd(), 'lib/email-heroes.ts'), body);
  console.log(`[email-heroes] wrote lib/email-heroes.ts — ${Object.keys(out).length} motifs`);
}
main().catch((e) => { console.error(e); process.exit(1); });
