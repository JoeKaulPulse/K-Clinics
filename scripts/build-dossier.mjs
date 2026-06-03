// Generates the KClinics Platform Guide & Operating Manual (brand-styled PDF).
//   node scripts/build-dossier.mjs
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'KClinics-Platform-Guide.pdf');
const photo = (f) => path.join(ROOT, 'public', 'treatments', f);
const geist = (f) => path.join(ROOT, 'node_modules', 'geist', 'dist', 'fonts', 'geist-sans', f);
const fraunces = (f) => path.join(ROOT, 'assets', 'fonts', f);

// ── Brand palette (lib/theme.ts) ─────────────────────────────────────────────
const C = {
  ink: '#2a2420', inkSoft: '#3d352f', espresso: '#4a3f37', porcelain: '#f6ece3',
  bone: '#efe3d7', sand: '#e3d3c4', stone: '#91766e', stoneSoft: '#b7a294',
  gold: '#a98a6d', goldSoft: '#c2a589', goldBright: '#dcc4a8', jade: '#7b6a5d', blush: '#cdb4a3', white: '#ffffff',
};
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`; };
const PALETTE = [
  ['Ink', C.ink, 'Primary text · dark sections'], ['Espresso', C.espresso, 'Deep brown detail'],
  ['Porcelain', C.porcelain, 'Primary background'], ['Bone', C.bone, 'Secondary surface'],
  ['Sand', C.sand, 'Tertiary surface'], ['Gold', C.gold, 'Metallic accent'],
  ['Gold soft', C.goldSoft, 'Highlights / on-ink'], ['Stone', C.stone, 'Muted taupe text'],
  ['Jade', C.jade, 'Secondary accent'], ['Blush', C.blush, 'Soft highlight'],
];

// ── Logo vectors (read live from components/brand/marks.tsx) ──────────────────
const marks = fs.readFileSync(path.join(ROOT, 'components/brand/marks.tsx'), 'utf8');
const K_PATH = (marks.match(/const K_PATH =\s*'([^']+)'/) || [])[1];
const WORD_PATHS = [...marks.slice(marks.indexOf('function ClinicsWordmark')).matchAll(/d="([^"]+)"/g)].map((m) => m[1]);

// ── Geometry & document ───────────────────────────────────────────────────────
const W = 595.28, H = 841.89, M = 56, CW = W - M * 2, TOP = 94, BOT = 70;
const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: 'KClinics — Platform Guide & Operating Manual', Author: 'KClinics' } });
const out = fs.createWriteStream(OUT);
doc.pipe(out);

doc.registerFont('disp', fraunces('Fraunces-Black.ttf'));
doc.registerFont('dispSemi', fraunces('Fraunces-SemiBold.ttf'));
doc.registerFont('dispReg', fraunces('Fraunces-Regular.ttf'));
doc.registerFont('dispLight', fraunces('Fraunces-Light.ttf'));
doc.registerFont('dispItalic', fraunces('Fraunces-Italic.ttf'));
doc.registerFont('body', geist('Geist-Regular.ttf'));
doc.registerFont('med', geist('Geist-Medium.ttf'));
doc.registerFont('semi', geist('Geist-SemiBold.ttf'));
doc.registerFont('bold', geist('Geist-Bold.ttf'));

let pageIndex = 0, secNo = 0, currentSection = '';
const toc = [];

const bg = (c = C.porcelain) => { doc.save(); doc.rect(0, 0, W, H).fill(c); doc.restore(); };
function header() {
  doc.save();
  doc.font('semi').fontSize(7).fillColor(C.gold).text('KCLINICS', M, 46, { characterSpacing: 2.5 });
  doc.font('body').fontSize(7.5).fillColor(C.stone).text(currentSection, M, 46, { width: CW, align: 'right' });
  doc.lineWidth(0.5).strokeColor(C.sand).moveTo(M, 64).lineTo(W - M, 64).stroke();
  doc.restore();
}
function footer(i) {
  doc.save();
  doc.lineWidth(0.5).strokeColor(C.sand).moveTo(M, H - 44).lineTo(W - M, H - 44).stroke();
  doc.font('body').fontSize(7.5).fillColor(C.stone).text('KClinics · Platform Guide & Operating Manual', M, H - 37, { width: CW * 0.7 });
  doc.font('semi').fontSize(7.5).fillColor(C.stone).text(String(i), W - M - 40, H - 37, { width: 40, align: 'right' });
  doc.restore();
}
function newPage(withHeader = true) { doc.addPage(); pageIndex++; bg(); if (withHeader) header(); doc.x = M; doc.y = TOP; }
function ensure(h) { if (doc.y + h > H - BOT) newPage(); }

// ── Block renderers ───────────────────────────────────────────────────────────
function eyebrow(t, c = C.gold) { ensure(18); doc.font('semi').fontSize(8).fillColor(c).text(t.toUpperCase(), M, doc.y, { characterSpacing: 2, width: CW }); doc.moveDown(0.4); }
function h1(t) { ensure(56); doc.font('disp').fontSize(26).fillColor(C.ink).text(t, M, doc.y, { width: CW }); const y = doc.y + 4; doc.save(); doc.rect(M, y, 44, 2.5).fill(C.gold); doc.restore(); doc.y = y + 15; }
function h2(t) { ensure(34); doc.moveDown(0.5); doc.font('dispSemi').fontSize(14).fillColor(C.ink).text(t, M, doc.y, { width: CW }); doc.moveDown(0.4); }
function h3(t) { ensure(22); doc.moveDown(0.25); doc.font('semi').fontSize(8.5).fillColor(C.gold).text(t.toUpperCase(), M, doc.y, { characterSpacing: 1.2, width: CW }); doc.moveDown(0.35); }
function p(t) { ensure(24); doc.font('body').fontSize(9.6).fillColor(C.espresso).text(t, M, doc.y, { width: CW, lineGap: 2.8, align: 'left' }); doc.moveDown(0.45); }
function ul(items, color = C.gold) {
  for (const it of items) {
    const [lead, rest] = Array.isArray(it) ? it : [null, it];
    ensure(16);
    const x = M + 15, y = doc.y;
    doc.save(); doc.circle(M + 4.5, y + 5.2, 1.8).fill(color); doc.restore();
    if (lead) {
      doc.font('semi').fontSize(9.6).fillColor(C.ink).text(lead + '  ', x, y, { continued: true, width: CW - 15, lineGap: 2.4 });
      doc.font('body').fillColor(C.espresso).text(rest, { lineGap: 2.4 });
    } else { doc.font('body').fontSize(9.6).fillColor(C.espresso).text(rest, x, y, { width: CW - 15, lineGap: 2.4 }); }
    doc.moveDown(0.3);
  }
  doc.moveDown(0.15);
}
function steps(items) {
  items.forEach((s, i) => {
    const x = M + 26; doc.font('body').fontSize(9.6);
    ensure(Math.max(18, doc.heightOfString(s, { width: CW - 26, lineGap: 2.4 }) + 5));
    const y = doc.y;
    doc.save(); doc.circle(M + 9, y + 7, 8.5).fill(C.ink); doc.fillColor(C.goldBright).font('semi').fontSize(8.5).text(String(i + 1), M, y + 3.6, { width: 18, align: 'center' }); doc.restore();
    doc.font('body').fontSize(9.6).fillColor(C.espresso).text(s, x, y + 0.5, { width: CW - 26, lineGap: 2.4 });
    doc.moveDown(0.4);
  });
  doc.moveDown(0.15);
}
function tip(text, label = 'Tip') {
  doc.font('body').fontSize(9); const inner = CW - 26;
  const h = doc.heightOfString(text, { width: inner, lineGap: 2.5 }) + 30; ensure(h + 6);
  const y = doc.y;
  doc.save(); doc.roundedRect(M, y, CW, h, 6).fill(C.bone); doc.rect(M, y, 3, h).fill(C.gold); doc.restore();
  doc.font('semi').fontSize(7.5).fillColor(C.gold).text(label.toUpperCase(), M + 14, y + 11, { characterSpacing: 1.5 });
  doc.font('body').fontSize(9).fillColor(C.inkSoft).text(text, M + 14, y + 23, { width: inner, lineGap: 2.5 });
  doc.y = y + h + 8;
}
function table(headers, rows, widths) {
  const rowH = 22, tot = widths.reduce((a, b) => a + b, 0);
  ensure(rowH + 8 + rows.length * rowH);
  let y = doc.y;
  doc.save(); doc.rect(M, y, CW, rowH).fill(C.ink); doc.restore();
  let cx = M;
  headers.forEach((hd, i) => { const last = i === headers.length - 1; doc.font('semi').fontSize(7.5).fillColor(last ? C.goldBright : C.porcelain).text(hd.toUpperCase(), cx + 9, y + 7.5, { width: (widths[i] / tot) * CW - 14, characterSpacing: 0.6, align: last ? 'right' : 'left' }); cx += (widths[i] / tot) * CW; });
  y += rowH;
  rows.forEach((r, ri) => {
    doc.save(); doc.rect(M, y, CW, rowH).fill(ri % 2 ? C.bone : C.porcelain); doc.restore();
    cx = M;
    r.forEach((cell, i) => { const last = i === r.length - 1; doc.font(last ? 'semi' : 'body').fontSize(8.4).fillColor(last ? C.gold : C.inkSoft).text(cell, cx + 9, y + 6.5, { width: (widths[i] / tot) * CW - 14, align: last ? 'right' : 'left' }); cx += (widths[i] / tot) * CW; });
    y += rowH;
  });
  doc.y = y + 9;
}
function drawPath(d, x, y, scale, color) { doc.save(); doc.translate(x, y); doc.scale(scale); doc.path(d).fill(color); doc.restore(); }
const kmark = (x, y, hgt, color) => drawPath(K_PATH, x, y, hgt / 234, color);
function wordmark(x, y, width, color) { const s = width / 531; doc.save(); doc.translate(x, y); doc.scale(s); for (const d of WORD_PATHS) doc.path(d).fill(color); doc.restore(); }
function section(title, intro) { secNo++; currentSection = title; newPage(); toc.push({ title, page: pageIndex }); eyebrow(`${String(secNo).padStart(2, '0')} · Section`); h1(title); if (intro) p(intro); }
function render(blocks) { for (const b of blocks) { if (b.h2) h2(b.h2); else if (b.h3) h3(b.h3); else if (b.p) p(b.p); else if (b.ul) ul(b.ul); else if (b.steps) steps(b.steps); else if (b.tip) tip(b.tip, b.label); else if (b.table) table(b.table[0], b.table[1], b.table[2]); } }

// ══════════════════════════════════════════════════════════════════════════════
// COVER
// ══════════════════════════════════════════════════════════════════════════════
bg(C.ink);
try { doc.image(photo('baner-laser-1.jpg'), 0, 0, { cover: [W, H * 0.58], align: 'center', valign: 'center' }); } catch { /* */ }
doc.save(); doc.rect(0, H * 0.5, W, H * 0.5).fill(C.ink); doc.restore();
kmark(M, H * 0.6, 56, C.goldSoft);
wordmark(M + 42, H * 0.6 + 21, 150, C.porcelain);
doc.font('dispSemi').fontSize(43).fillColor(C.porcelain).text('Platform Guide', M, H * 0.68, { width: CW });
doc.font('dispItalic').fontSize(38).fillColor(C.goldSoft).text('& Operating Manual', { width: CW });
doc.font('body').fontSize(11).fillColor(C.stoneSoft).text('The complete, plain-English guide to the KClinics platform — every tool and how to use it, the brand guidelines, how data is kept safe, and what a build of this scope represents.', M, H * 0.82, { width: CW - 64, lineGap: 3.5 });
doc.font('semi').fontSize(8).fillColor(C.gold).text('CONFIDENTIAL · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), M, H - 54, { characterSpacing: 1.5 });

// CONTENTS (reserve)
newPage(false); const TOC_PAGE = pageIndex;
doc.x = M; doc.y = TOP; eyebrow('Contents'); h1('What’s inside');
doc.font('body').fontSize(9).fillColor(C.stone).text('Written for non-technical staff. Sections 3–4 are the brand guidelines; sections 5–27 are practical how-to guides; the remainder cover security, architecture, going live, the roadmap and cost.', M, doc.y, { width: CW, lineGap: 2.6 });
const TOC_START_Y = doc.y + 18;

// ══════════════════════════════════════════════════════════════════════════════
section('The platform at a glance', 'KClinics runs on one bespoke platform that replaces a patchwork of separate tools — website builder, booking system, payment processor, CRM, email/SMS, telephony, a learning academy and a content management system — all sharing a single database and one design language.');
render([
  { h2: 'Twelve capabilities, one system' },
  { ul: [
    ['Marketing website & CMS —', 'the public site plus a full visual page builder.'],
    ['Booking & payments —', 'online booking, deposits, courses and card payments via Stripe.'],
    ['CRM —', 'clients, clinical records, consultations, reviews and loyalty.'],
    ['Operations —', 'staff scheduling, time-off, inventory, reordering, suppliers and SOPs.'],
    ['Marketing engine —', 'campaigns, lifecycle automations, promotions, discounts, gift vouchers and referrals.'],
    ['Finance —', 'cashflow forecasting, reporting and live bank/accounting feeds.'],
    ['Telephony & live chat —', 'call logging and an AI-or-human website chat.'],
    ['K Academy (LMS) —', 'a full training platform: courses, lessons, quizzes, cohorts and certificates.'],
    ['Client portal —', 'self-service appointments, forms, loyalty and aftercare.'],
    ['AI tools —', 'the “Get My Plan” photo consultation and SEO suggestions.'],
    ['Security & compliance —', 'encryption, audit trail, 2FA and granular access control.'],
    ['Multi-location & multi-language —', 'multiple clinics and English/Ukrainian.'],
  ] },
  { h2: 'What makes it different' },
  { ul: [
    ['Owned, not rented —', 'the clinic owns the code, data and design; nothing is trapped in a subscription.'],
    ['Joined up —', 'a booking, payment, loyalty point and client record are the same data, not exports between apps.'],
    ['Editable by anyone —', 'staff change content, pricing, imagery, navigation and the blog with no developer.'],
  ] },
  { tip: 'In this manual, “Admin” is the private dashboard you sign in to; “the live site” is the public website clients see; a “draft” is a private change; “publish” makes it live.' },
]);

section('Getting started — the admin', 'Everything staff do happens in the Admin dashboard, organised into eight groups in the left-hand menu.');
render([
  { h2: 'Signing in' },
  { steps: ['Visit your address + /admin/login (e.g. kclinics.co.uk/admin/login).', 'Enter your work email and password (new staff set theirs from the invite link).', 'You land on the Overview dashboard; clinicians land on “My Day”.'] },
  { h2: 'The menu, grouped by job' },
  { ul: [
    ['Today —', 'Overview, My Day, Calendar, Tasks, Time-off.'],
    ['Clients —', 'Bookings, Consultations, Live chat, Calls, Clients, Reviews, Discounts, Promotions, Rewards.'],
    ['Catalogue —', 'Services & pricing, Pages, Reusable blocks, Journal, Media, Academy, Gallery, Careers, Gift vouchers.'],
    ['Operations —', 'Schedule, Inventory, Reorder, Suppliers, SOPs.'],
    ['Marketing —', 'Campaigns, Automations.'],
    ['Finance —', 'Cashflow, Reports.'],
    ['Admin —', 'Security, Staff & access, Activity log, Site & globals, Locations, SEO, Integrations, Settings.'],
  ] },
  { h2: 'Golden rules' },
  { ul: [
    ['You can’t easily break things —', 'almost everything saves as a draft, can be previewed, and can be rolled back.'],
    ['You only see what your role allows —', 'menus and actions adapt to your permissions.'],
    ['Every action is logged —', 'the Activity log keeps an immutable record for accountability.'],
  ] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// BRAND GUIDELINES 1 — IDENTITY & LOGO
// ══════════════════════════════════════════════════════════════════════════════
section('Brand guidelines — identity & logo', 'The KClinics identity is “considered luxury”: warm, calm and precise. It rests on the hook-shaped “K” monogram, the KCLINICS wordmark, a taupe-and-cream palette, and the Fraunces/Geist type pairing.');
{
  h2('The logo'); p('The primary logo is the monogram and wordmark locked together. Use it as supplied — never redraw or rebuild it.');
  // lockup on ink
  ensure(70); let y = doc.y; doc.save(); doc.roundedRect(M, y, CW, 64, 8).fill(C.ink); doc.restore();
  kmark(M + 24, y + 12, 40, C.goldSoft); wordmark(M + 54, y + 26, 120, C.porcelain);
  doc.font('body').fontSize(8).fillColor(C.stoneSoft).text('Primary lockup · reversed on ink', M + 210, y + 28, { width: CW - 230 }); doc.y = y + 78;

  h2('Logo variants'); ensure(96); y = doc.y; const cw3 = (CW - 24) / 3;
  // a) lockup on porcelain  b) monogram  c) wordmark
  doc.save(); doc.roundedRect(M, y, cw3, 70, 7).lineWidth(0.7).stroke(C.line || C.sand); doc.restore();
  kmark(M + 16, y + 14, 30, C.gold); wordmark(M + 38, y + 27, 78, C.ink);
  doc.save(); doc.roundedRect(M + cw3 + 12, y, cw3, 70, 7).lineWidth(0.7).stroke(C.sand); doc.restore();
  kmark(M + cw3 + 12 + cw3 / 2 - 11, y + 14, 42, C.gold);
  doc.save(); doc.roundedRect(M + 2 * (cw3 + 12), y, cw3, 70, 7).lineWidth(0.7).stroke(C.sand); doc.restore();
  wordmark(M + 2 * (cw3 + 12) + 18, y + 30, cw3 - 36, C.ink);
  doc.font('body').fontSize(7.5).fillColor(C.stone);
  doc.text('Full lockup (default)', M, y + 76, { width: cw3, align: 'center' });
  doc.text('Monogram (avatar, favicon, app)', M + cw3 + 12, y + 76, { width: cw3, align: 'center' });
  doc.text('Wordmark (tight horizontal spaces)', M + 2 * (cw3 + 12), y + 76, { width: cw3, align: 'center' });
  doc.y = y + 94;

  h2('Clear space & minimum size'); ensure(96); y = doc.y;
  doc.save(); doc.roundedRect(M, y, CW * 0.52, 80, 7).fill(C.bone); doc.restore();
  const kx = M + 26, ky = y + 18; kmark(kx, ky, 44, C.gold);
  doc.save(); doc.dash(2, { space: 2 }).lineWidth(0.6).strokeColor(C.stone).rect(kx - 14, ky - 14, 130, 72).stroke().undash(); doc.restore();
  doc.font('body').fontSize(7.5).fillColor(C.stone).text('Keep clear space of at least the monogram’s width (1×) on all sides.', M + CW * 0.52 + 14, y + 8, { width: CW * 0.48 - 14, lineGap: 2.4 });
  doc.font('semi').fontSize(8).fillColor(C.ink).text('Minimum sizes', M + CW * 0.52 + 14, y + 40);
  doc.font('body').fontSize(8).fillColor(C.espresso).text('Wordmark: 24 mm wide (print) / 120 px (screen). Monogram: 8 mm / 28 px.', M + CW * 0.52 + 14, y + 52, { width: CW * 0.48 - 14, lineGap: 2.4 });
  doc.y = y + 92;

  h2('Don’t'); render([{ ul: [
    ['Don’t recolour —', 'use only palette colours; the gold monogram or a single ink/porcelain.'],
    ['Don’t distort —', 'never stretch, squash, rotate or skew.'],
    ['Don’t decorate —', 'no shadows, glows, outlines, gradients or textures.'],
    ['Don’t rearrange —', 'keep the monogram and wordmark spacing as supplied.'],
    ['Don’t crowd —', 'respect the clear space; keep off busy backgrounds (use the ink scrim over photos).'],
    ['Don’t substitute —', 'never retype “KClinics” in another font in place of the wordmark.'],
  ] }]);
}

// BRAND GUIDELINES 2 — COLOUR, TYPE, ICONOGRAPHY, PHOTOGRAPHY, VOICE
section('Brand guidelines — colour, type & assets', 'The visual system is deliberately restrained: cream space, ink text, and gold used sparingly as the jewel.');
{
  h2('Colour'); p('Porcelain dominates as the background; ink carries text and dark sections; gold is the accent and should stay scarce (roughly one-tenth of any layout). The remaining tones are supporting surfaces and details.');
  // palette swatches
  ensure(150); const cols = 5, gap = 10, sw = (CW - gap * (cols - 1)) / cols, sh = 40; let py = doc.y;
  PALETTE.forEach((pp, i) => { const cx = M + (i % cols) * (sw + gap); const cy = py + Math.floor(i / cols) * (sh + 30);
    doc.save(); doc.roundedRect(cx, cy, sw, sh, 5).fill(pp[1]); if ([C.porcelain, C.bone, C.sand].includes(pp[1])) doc.lineWidth(0.5).roundedRect(cx, cy, sw, sh, 5).stroke(C.stoneSoft); doc.restore();
    doc.font('semi').fontSize(7.5).fillColor(C.ink).text(pp[0], cx, cy + sh + 4, { width: sw });
    doc.font('body').fontSize(6).fillColor(C.stone).text(pp[1].toUpperCase(), cx, cy + sh + 13, { width: sw });
    doc.font('body').fontSize(5.6).fillColor(C.stoneSoft).text('RGB ' + hexRgb(pp[1]), cx, cy + sh + 21, { width: sw }); });
  doc.y = py + 2 * (sh + 30) + 2;
  h2('Typography'); ensure(74);
  doc.font('disp').fontSize(24).fillColor(C.ink).text('Fraunces', M, doc.y); doc.font('dispLight').fontSize(13).fillColor(C.stone).text('Display serif — headings & numbers only.', M, doc.y + 2, { width: CW });
  doc.moveDown(0.4); doc.font('semi').fontSize(16).fillColor(C.ink).text('Geist', M, doc.y); doc.font('body').fontSize(11).fillColor(C.stone).text('Clean sans — body copy, UI and the admin.', M, doc.y + 1, { width: CW });
  doc.moveDown(0.6);
  render([{ ul: [
    ['Hierarchy —', 'Fraunces Black/SemiBold for page titles and section heads; Geist Regular for body; Geist SemiBold for labels (often letter-spaced uppercase).'],
    ['Never —', 'set long body copy in Fraunces, or introduce a third typeface.'],
  ] }]);
  h2('Iconography'); render([{ ul: [
    ['Style —', 'fine single-weight line icons (~1.5px stroke), rounded caps and corners, drawn on a square grid.'],
    ['Colour —', 'ink or stone by default; gold only to highlight.'],
    ['Avoid —', 'filled, multicolour, skeuomorphic or emoji-style icons.'],
  ] }]);
  h2('Photography'); render([{ ul: [
    ['Mood —', 'natural light, warm neutral tones, real treatments and genuine results; calm clinical-luxury.'],
    ['People —', 'diverse ages and skin tones; relaxed, confident, never over-posed.'],
    ['Avoid —', 'heavy filters, cold colour casts, harsh stock clichés.'],
    ['With text —', 'always overlay on the ink scrim (semi-dark layer) so wording stays legible.'],
  ] }]);
  h2('Tone of voice'); render([{ ul: [
    ['Warm & expert —', 'reassuring and knowledgeable, never clinical or cold.'],
    ['Plain English —', 'explain, don’t jargon; short sentences; British spelling.'],
    ['Considered, not hyped —', 'confident and understated; avoid exclamation marks and pressure tactics.'],
  ] }]);
}

section('The marketing website', 'A premium, fast, search-optimised site that turns visitors into bookings. Every page is server-rendered for speed and ranking.');
render([
  { h2: 'Public pages' },
  { ul: [
    ['Treatments & dentistry —', '150+ treatments, each with a rich page (hero, benefits, the journey, FAQs, pricing, related treatments) and a category directory.'],
    ['Packages, pricing, offers & membership —', 'bundles, transparent prices, live promotions and the loyalty programme.'],
    ['The Journal —', 'a native blog (66 imported articles), fully admin-managed.'],
    ['About, team, clinics & contact —', 'story, clinician profiles, locations with a live map, and the enquiry form.'],
    ['Gallery & reviews —', 'consented before/after cases and verified 5-star reviews.'],
    ['Careers & gift vouchers —', 'live vacancies with applications, and online gift-card purchase.'],
  ] },
  { h2: 'Conversion & AI tools' },
  { ul: [
    ['Online booking —', 'choose treatment, clinician (optional), time, details, forms and payment.'],
    ['Manage my booking —', 'a self-serve reschedule/cancel link unique to each appointment.'],
    ['Get My Plan (AI consultation) —', 'clients upload photos; the assistant analyses skin/teeth/hair and recommends real treatments from the catalogue.'],
    ['Treatment finder —', 'an interactive concern-to-treatment matcher.'],
    ['Refer a friend —', 'shareable referral codes that reward both people once the friend qualifies.'],
  ] },
  { tip: 'Behind the scenes: per-page SEO, structured data, sitemaps and an llms.txt help the site rank on Google and be understood by AI search engines.' },
]);

section('The page builder — your website editor', 'Build and edit any marketing page from modular, on-brand sections — no code, and impossible to break the design.');
render([
  { h2: 'Edit a page' },
  { steps: ['Go to Admin → Pages — every page is listed (builder-editable, managed-elsewhere, or built-in).', 'Click Edit (or Customise to take over a page; it opens pre-filled with the current content).', 'Or click the “Edit this page” button shown on any public page while you’re signed in.', 'Make changes, then Save draft (private) or Publish (live).'] },
  { h2: 'Work with sections' },
  { steps: ['Add: click “+ Section” between sections and choose a type.', 'Edit: click a section to open its fields.', 'Reorder: drag the handle, or use the up/down arrows.', 'Duplicate, hide or delete with the row icons (hidden sections stay saved but don’t show live).'] },
  { h2: 'Section types' },
  { ul: [
    ['Hero, Rich text, Image + text —', 'headers, formatted copy, and image-beside-text (with a focal-point control).'],
    ['Feature grid, Stats, Steps, Pricing table —', 'cards, headline numbers, numbered processes and price lists.'],
    ['Quote, Gallery, Video, Logos, Marquee —', 'testimonials, image grids, YouTube/Vimeo, partners and scrolling ribbons.'],
    ['CTA, FAQ, Tag list, Table of contents, Info cards —', 'call-to-actions, accordions, pill tags, auto-contents and linked cards.'],
    ['Contact details, Map, Enquiry form —', 'live clinic details, the location map and the contact form.'],
  ] },
  { h2: 'Preview, schedule & undo' },
  { steps: ['Click Live preview to see the page beside the editor at desktop/tablet/mobile sizes; edits autosave and the preview refreshes.', 'To schedule, set “Go live at” (and optionally “Take down at”), then Publish.', 'Open Version history and click Restore to revert; Unpublish returns the route to its built-in design.'] },
  { tip: 'The Audit panel flags missing image descriptions, empty headings or buttons with no link before you publish. Per-section Layout controls add a cream/sand background band and spacing — on-brand by design.' },
]);

section('Writing content — the editor & media', 'Inside Rich text and the Journal you write with a what-you-see-is-what-you-get editor and pull images from one shared library.');
render([
  { h2: 'The text editor' },
  { ul: [
    ['Type naturally —', 'bold and italic appear as you type.'],
    ['Format —', 'select text and use B / I / link, or press Cmd-B (Ctrl-B), Cmd-I and Cmd-K.'],
    ['Slash menu —', 'on an empty line type “/” to insert a heading, list, quote, image, button or divider.'],
  ] },
  { h2: 'The media library' },
  { steps: ['Go to Admin → Media (or click “Library” on any image field).', 'Drag images onto the upload area, or click to choose files.', 'Add alt text to each image — important for accessibility and SEO.', 'Use an image by clicking “Library” on any image field and selecting it.'] },
  { tip: 'On Image + text sections, click the image to set its focal point — the part kept in view when the image is cropped to fit.' },
]);

section('Global settings, menus & the banner', 'Change the clinic’s details once and they update everywhere — header, footer, contact pages and search listings.');
render([
  { h2: 'Global details' },
  { steps: ['Go to Admin → Site & globals.', 'Update phone, email, WhatsApp, address, opening hours, social links or brand text.', 'Click Save — changes appear site-wide within moments.'] },
  { h2: 'Announcement bar' },
  { steps: ['Open the Announcement bar section in Site & globals.', 'Tick “Show banner”, add a message, optional link and start/end dates.', 'Save — a dismissible banner shows on every page during that window.'] },
  { h2: 'Navigation' },
  { steps: ['Open the Navigation tab in Site & globals.', 'Add, rename, reorder or remove header menu items, mega-menu columns and footer links.', 'Save to publish the new menus.'] },
  { tip: 'Every change here is versioned — use Restore in the sidebar if you change your mind.' },
]);

section('The Journal & reusable blocks', 'Publish articles natively, and build a section once to reuse across many pages.');
render([
  { h2: 'Add a blog post' },
  { steps: ['Admin → Journal → New post.', 'Add a title and write the body with the block/WYSIWYG editor.', 'Set category, cover image, excerpt and SEO in the sidebar.', 'Save & publish — it appears in the Journal, search-optimised.'] },
  { h2: 'Reusable blocks' },
  { steps: ['Admin → Reusable blocks → create a block (e.g. a “Book now” call-to-action).', 'In any page, use the section inserter and pick it under “Reusable blocks”.', 'Edit the block once and every page using it updates.'] },
]);

section('Services, pricing & treatment content', 'Operational pricing and per-treatment marketing copy live together in one place.');
render([
  { h2: 'Prices, durations, courses & offers' },
  { steps: ['Admin → Services & pricing.', 'Open a service to edit its variants — single price, duration, cost (for margin tracking) and course bundles.', 'Use Bulk price change to adjust a category by a percentage.', 'Add an offer (percent or fixed, with a date window) — it promotes automatically on the site.'] },
  { h2: 'Treatment page copy' },
  { steps: ['In a service, click “Edit page content”.', 'Update the hero, benefits, the journey, FAQs and SEO for that treatment.', 'Save — the treatment page and its listing cards update together.'] },
]);

section('Today — dashboard, day & tasks', 'Your starting point each morning: what’s happening today and what needs doing.');
render([
  { ul: [
    ['Overview —', 'KPIs at a glance: 30-day revenue, upcoming appointments, consultation-to-booking conversion, new clients, today’s schedule, birthdays, low-stock alerts and pending time-off approvals.'],
    ['My Day —', 'a clinician’s appointments for the day — time, client, treatment, medical flags, status and actual-vs-booked minutes — with previous/next-day navigation.'],
    ['Calendar —', 'the week/month view of all bookings and staff availability.'],
    ['Tasks —', 'a simple board of open vs done tasks; create, assign to staff, set priority and due dates, and attach to a client. The nav badge shows your open count.'],
    ['Time-off —', 'request holiday, sick, training or personal leave; managers approve/decline. Approved time-off immediately blocks that person’s bookable hours and syncs to their calendar.'],
  ] },
]);

section('Bookings & the booking engine', 'Every appointment, with the availability logic that prevents clashes.');
render([
  { h2: 'Managing bookings' },
  { steps: ['Admin → Bookings — filter by upcoming/past/status and search by client or treatment.', 'Open a booking to reschedule, cancel, change the practitioner, or mark its status.', 'Take a card payment or deposit, and attach the client’s health/consent forms.', 'Use “New booking” to book a client in directly.'] },
  { h2: 'How availability works' },
  { ul: [
    ['Schedules —', 'each clinician’s weekly working pattern (and location per day) defines when they’re bookable.'],
    ['Resources —', 'rooms/equipment can be required by a treatment so two bookings never need the same machine at once.'],
    ['Time-off & closures —', 'leave and clinic closures automatically remove slots.'],
    ['SOP acknowledgement —', 'clinicians confirm the treatment’s safety checklist against the booking before treating.'],
  ] },
  { tip: 'Clients can self-serve reschedule or cancel via the unique “Manage my booking” link in their confirmation email — changes flow straight back into the calendar.' },
]);

section('Clients & clinical records', 'The single client record — contact, history, consent and encrypted clinical data.');
render([
  { h2: 'The client directory' },
  { steps: ['Admin → Clients — search by name, email or phone; sort and filter.', 'Open a client for their full profile: bookings, interactions, notes, tags, loyalty and assessments.', 'Flags highlight marketing opt-in, names needing review, likely test/junk and imported records.'] },
  { h2: 'Clinical & consent' },
  { ul: [
    ['Health assessments —', 'medical history, treatment consent, pre-treatment, skin and dental questionnaires, completed by the client.'],
    ['Encryption —', 'clinical answers are encrypted (AES-256-GCM); only staff with the clinical permission can decrypt and view them, and each view is logged.'],
    ['GDPR —', 'clients can export their data or request erasure from their portal.'],
  ] },
]);

section('Consultations, live chat & calls', 'Three inbound channels, all captured against the client record.');
render([
  { h2: 'Consultations' },
  { steps: ['Admin → Consultations — the enquiry pipeline (New → Contacted → Booked → Completed → Closed).', 'Open one to respond and convert it into a booking.'] },
  { h2: 'Live chat' },
  { ul: [
    ['Two modes —', 'an AI assistant (answers from the real treatment catalogue) or a human staff member replying from the CRM.'],
    ['Hand-off —', 'staff can take over an AI conversation at any time; history is preserved and the nav badge shows unread chats.'],
  ] },
  { h2: 'Calls (telephony)' },
  { ul: [
    ['Call log —', 'inbound/outbound calls via the VoIP integration, auto-matched to the client or supplier by number.'],
    ['Recordings & transcripts —', 'available where enabled; click-to-dial and notes are built in.'],
  ] },
]);

section('Reviews, loyalty, discounts, promotions & vouchers', 'The tools that win repeat business and bring new clients in.');
render([
  { ul: [
    ['Reviews —', 'requests are sent automatically after a visit; staff moderate (approve/publish/hide). Only consented 5-star reviews show on the site; optional Google sync.'],
    ['Loyalty (Beauty Points) —', 'clients earn points per pound plus review, birthday and referral bonuses, redeemable as money off (capped) — all automatic.'],
    ['Discounts —', 'the first-visit welcome offer, with abuse guardrails (flagging repeat claims) and staff override.'],
    ['Promotions —', 'universal codes (one code for everyone) or campaign codes (a unique code per recipient, tracked individually).'],
    ['Gift vouchers —', 'clients buy e-gift cards online (paid via Stripe); recipients get a code and balance, redeemable in clinic, with a 12-month expiry.'],
    ['Referrals —', 'give-and-get codes that reward both parties once the referred friend completes a qualifying treatment.'],
  ] },
  { h2: 'Send a promotion' },
  { steps: ['Admin → Promotions → create a universal code, or launch a campaign to a client segment.', 'For a campaign, the system generates a unique code per recipient and tracks redemptions individually.', 'Codes are entered by clients at checkout and validated automatically.'] },
]);

section('Staff rewards & gamification', 'A motivation layer that rewards great service and efficient, low-waste working.');
render([
  { ul: [
    ['Leaderboard —', 'staff ranked by points over 30/90 days and all-time.'],
    ['Earning —', 'points from client review ratings, efficiency (actual vs booked time), low consumable waste, and manager awards.'],
    ['Redeeming —', 'staff redeem points for perks from a managed catalogue; managers approve and mark fulfilled.'],
    ['Manager controls —', 'award or deduct points, and manage the reward catalogue.'],
  ] },
]);

// ── ACADEMY (big) ──
section('K Academy — the training platform (LMS)', 'A complete learning-management system inside the platform: market courses, enrol students, deliver theory and quizzes online, schedule practical cohorts and live classes, and issue certificates — a significant product in its own right.');
render([
  { h2: 'For the clinic (admin)' },
  { ul: [
    ['Courses —', 'title, level, price, deposit, duration, format, accreditations (e.g. OFQUAL/VTCT/CPD), outcomes and prerequisites; mark courses featured.'],
    ['Curriculum —', 'modules of theory (text/video, key points, citations, resources), ordered lessons, and per-module quizzes with a pass mark.'],
    ['Cohorts —', 'scheduled practical days with capacity, trainer and location; status Open/Full/Closed.'],
    ['Enrolments —', 'applications move Applied → Offered → Paid → Enrolled → Completed; deposits/instalments and finance interest tracked.'],
    ['Live classes —', 'schedule online sessions that appear in enrolled students’ calendars with a join link.'],
  ] },
  { h2: 'For students (the academy portal)' },
  { ul: [
    ['Separate login —', 'students have their own accounts, distinct from clients.'],
    ['Learn online —', 'work through modules and lessons, with progress tracked.'],
    ['Quizzes & certificates —', 'attempt quizzes, see scores, and download a certificate on completion.'],
    ['Public landing —', 'the marketing Academy pages showcase featured courses and capture enrolments.'],
  ] },
  { h2: 'Manage a course' },
  { steps: ['Admin → Academy → create or open a course and set its details and accreditations.', 'Add modules, lessons and a quiz; set the pass mark.', 'Open a cohort with dates, capacity and trainer.', 'Review applications and move them through to Enrolled; schedule any live classes.'] },
]);

section('Gallery & careers', 'Showcase results and hire your team.');
render([
  { h2: 'Before & after gallery' },
  { steps: ['Admin → Gallery → upload a case (treatment category, before and after images, caption).', 'Confirm client consent and publish — only published, consented cases show on the site.', 'Reorder cases to control what appears first.'] },
  { h2: 'Careers' },
  { steps: ['Admin → Careers → create a vacancy (title, department, location, type, description) and set it active.', 'Active vacancies appear on the public /careers page with an application form.', 'Track applications through New → Reviewing → Interview → Offered → Hired/Rejected.'] },
]);

section('Operations — stock, suppliers & SOPs', 'Keep the clinic supplied, safe and consistent.');
render([
  { h2: 'Schedule' },
  { p: 'Admin → Schedule sets each clinician’s weekly working pattern and the location they work from each day — this drives the booking engine’s availability.' },
  { h2: 'Inventory & reorder' },
  { ul: [
    ['Inventory —', 'track items (cost, retail, supplier, batch, expiry, low-stock threshold) and movements (received, used, wasted, returned, adjusted).'],
    ['Reorder —', 'the system lists everything at/below its threshold, grouped by supplier, rounded to minimum order quantities, with an estimated cost — ready to order.'],
    ['Suppliers —', 'contacts, account references and category; inbound calls match to suppliers, and bills can surface via Xero.'],
  ] },
  { h2: 'SOPs (standard operating procedures)' },
  { steps: ['Admin → SOPs → edit the safety checklist for each treatment (or rely on the sensible default).', 'Before treating, the clinician reads and acknowledges the SOP against the booking.', 'The acknowledgement is recorded in the audit trail.'] },
]);

section('Marketing — campaigns & automations', 'Reach clients deliberately, and let the routine follow-ups run themselves.');
render([
  { h2: 'Campaigns' },
  { steps: ['Admin → Campaigns → compose a name, subject and body.', 'Choose the audience (opted-in subscribers) and send.', 'The history shows each campaign’s recipients and date.'] },
  { h2: 'Lifecycle automations (always on)' },
  { ul: [
    ['Appointment reminder —', '24 hours before, with a manage link.'],
    ['Form reminder —', '2 days before, to clients with outstanding pre-treatment forms.'],
    ['Birthday greeting —', 'on the day, with a complimentary upgrade.'],
    ['Post-treatment follow-up —', '3 days after, with aftercare and a rebooking prompt.'],
    ['Review request —', '7 days after a completed treatment.'],
    ['Win-back —', '6 months since the last visit, with a re-engagement offer.'],
  ] },
  { tip: 'Automations respect marketing opt-in/unsubscribe and never send twice in the same window; they run on a daily scheduled job.' },
]);

section('Finance — cashflow & reports', 'Plan working capital and measure performance.');
render([
  { ul: [
    ['Cashflow —', 'model income and expenses by category and cadence, set ring-fenced reserves (e.g. refurbishment, bonuses), and view a 12-month forecast — informed by live bank/accounting feeds where connected.'],
    ['Reports —', 'choose a period (30/90/365 days or all-time) for revenue, appointment counts, actual clinical hours and consumables cost, plus clinician performance, top treatments and inventory valuation.'],
  ] },
]);

section('Staff, roles & access control', 'Add your team and decide precisely what each person can do.');
render([
  { h2: 'Add a staff member' },
  { steps: ['Admin → Staff & access → add a user (name, email, role).', 'Pick a role (Owner, Administrator, Practitioner, Front desk, General staff) for sensible defaults.', 'For clinicians, set title, competencies (which treatments they deliver), public profile, photo, bio and calendar colour.', 'Fine-tune individual permissions, then send the secure invite.'] },
  { h2: 'Editors vs publishers' },
  { ul: [
    ['Draft —', 'staff with content access can create and save drafts.'],
    ['Publish —', 'only those with the “Publish website content” permission can make changes live.'],
    ['Sensitive areas —', 'clinical records, finance, exports and security are gated separately and marked sensitive.'],
  ] },
]);

section('Security, audit & compliance', 'Built for a clinic handling personal and health data under UK GDPR.');
render([
  { h2: 'Protecting data' },
  { ul: [
    ['Encryption —', 'clinical assessments, AI analysis and OAuth tokens are encrypted (AES-256-GCM) with a rotating keyring; the Integrations page shows re-encryption progress during a key rotation.'],
    ['Least privilege —', 'granular per-permission access; staff see only what their role allows.'],
    ['Payments —', 'handled by Stripe; card numbers never touch clinic servers (PCI-compliant).'],
  ] },
  { h2: 'Accounts & accountability' },
  { ul: [
    ['Security centre —', 'sign-in success/failure telemetry, brute-force lockouts, CAPTCHA and a two-factor (2FA) policy with recovery codes.'],
    ['Activity log —', 'an immutable, append-only record of every significant action (who, what, when).'],
    ['Privacy by design —', 'cookie consent, call-recording notice, GDPR export/erasure and published policies.'],
  ] },
]);

section('Locations, SEO & integrations', 'Run multiple sites, stay found, and connect external services.');
render([
  { h2: 'Locations' },
  { p: 'Admin → Locations adds clinics (address, contact, calendar colour, primary flag) and assigns staff; each clinician works one location per day so calendars never clash across sites.' },
  { h2: 'SEO command centre' },
  { ul: [
    ['Per-page audit —', 'every page scored on on-page, technical, AI-answer (GEO) and local search, with an overall health score.'],
    ['Edit —', 'title, meta description, canonical, focus keyword, social image, no-index and custom structured data.'],
    ['AI suggestions —', 'the assistant proposes copy, keywords and structure improvements per page.'],
  ] },
  { h2: 'Integrations' },
  { ul: [
    ['Status board —', 'Admin → Integrations shows each service (Stripe, Resend, Twilio, Xero, TrueLayer/bank feed, Google Calendar, DeepL, yay.com) as connected or needing setup, with the keys required.'],
    ['Connect —', 'create an account with the provider, copy its key(s), add them as sensitive environment variables in hosting (Vercel), then redeploy.'],
  ] },
  { tip: 'Keys live only in the hosting environment — never in the code or this document — and any service can be swapped without touching the rest.' },
]);

section('The client portal', 'What clients can do for themselves, reducing front-desk load.');
render([
  { ul: [
    ['Dashboard —', 'next appointment, visit count, member-since date, loyalty balance, personalised offers and any outstanding forms.'],
    ['Appointments —', 'view, add to calendar, reschedule/cancel, and redeem loyalty points against the price.'],
    ['Health forms —', 'complete encrypted assessments before treatment.'],
    ['Profile & privacy —', 'edit details and preferences; download data or request erasure (GDPR).'],
    ['Invoices, rewards & aftercare —', 'payment history, points redemption, and post-treatment guidance.'],
  ] },
]);

section('Data migration', 'The legacy WordPress/WooCommerce site was retired and its data brought over with bespoke, repeatable importers.');
render([
  { ul: [
    ['Clients —', '102 records with contact details, consent and history.'],
    ['Bookings —', '~276 appointments, re-titled with correct treatment names and linked to practitioners.'],
    ['Clinical & consent —', '70 consent records and 156 skin-quiz/care-plan entries, encrypted at rest.'],
    ['Reviews, loyalty & staff —', '9 reviews, 12 loyalty records and 7 staff accounts with booking links.'],
    ['Journal —', '66 published articles imported into the native blog.'],
    ['Integrity —', 'importers are safe to re-run; 28 junk/test accounts flagged; unrecoverable records reported, never guessed.'],
  ] },
]);

section('Technical architecture', 'Modern, mainstream and maintainable — any competent developer or agency can take it on.');
render([
  { ul: [
    ['Framework —', 'Next.js (App Router) + React + TypeScript — server-rendered and type-safe.'],
    ['Database —', 'PostgreSQL via the Prisma toolkit, with a clean, versioned schema (~70 models).'],
    ['Hosting —', 'Vercel — global CDN, automatic HTTPS, preview deployments and instant rollbacks.'],
    ['Design system —', 'brand tokens (colours, fonts, spacing) defined once and reused everywhere.'],
    ['AI —', 'Claude powers the photo consultation, live-chat assistant and SEO suggestions.'],
    ['Resilience —', 'if the database is briefly unavailable, the public site still renders.'],
  ] },
]);

section('Going live — pre-launch checklist', 'The steps to point the domain at the platform and switch payments live.');
render([
  { steps: [
    'Point kclinics.co.uk at the platform in DNS (GoDaddy), with www redirecting to the non-www address.',
    'Set the public site address (NEXT_PUBLIC_SITE_URL) to https://kclinics.co.uk.',
    'Switch Stripe from test to live keys once the business bank account is connected.',
    'Add the live Stripe webhook for the new domain so payments confirm correctly.',
    'Configure the remaining integrations (Xero, TrueLayer, Google Calendar, translation, VoIP) with the live domain’s redirect URLs.',
    'Run the health check, then complete a test booking and a test payment end to end.',
  ] },
  { tip: 'Each of these is a settings change, not a rebuild — the platform is already production-ready.' },
]);

section('Recommendations & future roadmap', 'Sensible next steps to extend the platform once live, in rough priority order. (Loyalty, referrals, gift vouchers, automations and AI consultation already exist — these are genuinely new.)');
render([
  { h3: 'Near-term' },
  { ul: [
    ['Client e-sign —', 'a custom e-signature tool so clients sign off treatment plans on a tablet at the appointment and sign health-declaration/consent forms digitally — captured, timestamped, encrypted and attached to the booking and client record (with a tamper-evident audit trail).'],
    ['Deposit-protected booking rules —', 'configurable rules that require a deposit or card-on-file for higher-value or no-show-prone treatments, with automatic late-cancellation fees.'],
    ['Two-way conversational SMS —', 'clients reply to reminders to confirm, reschedule or ask a question, threaded into the CRM.'],
    ['Waitlist & smart fill —', 'auto-offer cancelled slots to a waitlist to close no-show gaps.'],
  ] },
  { h3: 'Medium-term' },
  { ul: [
    ['Memberships & subscriptions —', 'recurring monthly plans (e.g. skin memberships) billed automatically via Stripe.'],
    ['Photo progress timelines —', 'standardised before/during/after photos per client, shown as a progress timeline in the portal and record.'],
    ['Native payment plans —', 'in-house instalments for courses, alongside Clearpay/Klarna.'],
    ['Clinician mobile app / PWA —', 'home-screen access to the day’s list, client notes and SOP sign-off.'],
    ['Consent-form versioning —', 'track which version of a consent/health form a client signed, with a full revision history.'],
    ['A/B testing in the page builder —', 'test two versions of a page and keep the winner.'],
  ] },
  { h3: 'Longer-term' },
  { ul: [
    ['AI no-show prediction —', 'flag high-risk bookings and prompt a confirmation or deposit.'],
    ['Automated purchase orders —', 'turn the reorder list into emailed POs to suppliers, with delivery tracking.'],
    ['Franchise mode —', 'controlled brand, pricing and content rollout to additional sites/franchisees.'],
    ['Deeper analytics —', 'cohort retention, treatment profitability and marketing attribution dashboards.'],
    ['Native month-end —', 'tighter Xero automation to speed the accounting close.'],
  ] },
]);

section('Cost & value of the build', 'An informed market estimate of what a platform of this breadth and polish would cost to commission conventionally. Build costs only (excluding hosting and maintenance); a guide, not a quote.');
render([
  { table: [['Component', 'Typical cost'], [
    ['Premium bespoke marketing site (~30 pages, catalogue, SEO)', '£15k – £40k'],
    ['Online booking + Stripe payments + client portal', '£20k – £50k'],
    ['Full admin CRM (operations, finance, marketing, staff, security)', '£60k – £150k+'],
    ['K Academy / LMS (courses, lessons, quizzes, cohorts, certificates)', '£25k – £60k'],
    ['Bespoke CMS / page builder (a product in its own right)', '£20k – £40k'],
    ['Legacy data migration (custom importers + encryption)', '£5k – £20k'],
    ['Integrations (Stripe, Resend, Twilio, Xero, TrueLayer, calendar, VoIP, AI)', '£12k – £35k'],
  ], [72, 28]] },
  { h2: 'Headline' },
  { ul: [
    ['UK agency / studio —', 'approximately £180k – £350k for the whole platform, as a 9–14 month engagement with a small team.'],
    ['Senior solo contractor —', 'a leaner equivalent in the region of £90k – £180k.'],
    ['Off-the-shelf alternative —', 'cheaper upfront (≈£5k–£20k) by renting separate tools — with ongoing fees, no bespoke fit and no ownership of code or data.'],
  ] },
  { p: 'The lasting value is owning a tailored, integrated platform — marketing, CMS, CRM, payments, an academy and migrated data in one system — rather than renting and stitching together a dozen separate products.' },
  { tip: 'Excludes ongoing costs: hosting/infrastructure (typically £50–£300 per month at this scale) and maintenance/support (agencies usually charge 15–20% of build cost per year).' },
]);

section('Glossary & support', 'Plain-English definitions and where to get help.');
render([
  { h2: 'Glossary' },
  { ul: [
    ['Admin —', 'the private dashboard staff sign in to.'],
    ['Draft / Publish —', 'a privately-saved change vs. a change made live.'],
    ['Section / Reusable block —', 'a building block of a page / one shared across pages.'],
    ['Permission —', 'a specific thing a staff member is allowed to do.'],
    ['Cohort / Enrolment —', 'a scheduled Academy intake / a student’s place on a course.'],
    ['SOP —', 'standard operating procedure — a treatment’s safety checklist.'],
    ['Integration / Environment variable —', 'an external service / a secret setting (API key) stored safely in hosting.'],
    ['SEO / GEO —', 'optimisation for traditional search / for AI answer engines.'],
  ] },
  { h2: 'Getting help' },
  { p: 'For day-to-day questions, this manual and the on-screen hints in each tool come first. For work needing a developer (new features, integrations, or anything in the roadmap), keep a short written brief of what you want and the outcome you expect — it makes any developer faster and cheaper.' },
]);

// ── FILL CONTENTS (single page, compact) ──
doc.switchToPage(TOC_PAGE);
doc.y = TOC_START_Y;
const rowH = toc.length > 26 ? 16 : 18;
toc.forEach((e, i) => {
  const y = doc.y; const num = String(i + 1).padStart(2, '0');
  doc.font('semi').fontSize(9).fillColor(C.gold).text(num, M, y + 1, { width: 22 });
  doc.font('med').fontSize(10.5).fillColor(C.ink).text(e.title, M + 26, y, { width: CW - 76 });
  doc.font('body').fontSize(9).fillColor(C.stone).text(String(e.page), M + CW - 34, y + 1, { width: 34, align: 'right' });
  const dy = y + 12; doc.save(); doc.lineWidth(0.4).strokeColor(C.stoneSoft).dash(1, { space: 3 }).moveTo(M + 26, dy).lineTo(M + CW - 40, dy).stroke().undash(); doc.restore();
  doc.y = y + rowH;
});

// FOOTERS
for (let i = 1; i <= pageIndex; i++) { doc.switchToPage(i); footer(i); }

doc.end();
out.on('finish', () => console.log('✓ Wrote', OUT, '(' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB,', pageIndex + 1, 'pages)'));
