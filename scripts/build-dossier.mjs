// Generates the KClinics Platform Guide & Operating Manual as a branded PDF.
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
const PALETTE = [
  ['Ink', C.ink, 'Text · dark sections'], ['Espresso', C.espresso, 'Deep brown'],
  ['Porcelain', C.porcelain, 'Primary background'], ['Bone', C.bone, 'Secondary surface'],
  ['Sand', C.sand, 'Tertiary surface'], ['Gold', C.gold, 'Metallic accent'],
  ['Gold soft', C.goldSoft, 'Highlights'], ['Stone', C.stone, 'Muted taupe'],
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

let pageIndex = 0;       // 0 cover, 1 contents, 2+ content
let currentSection = '';
let secNo = 0;
const toc = [];

const bg = (c = C.porcelain) => { doc.save(); doc.rect(0, 0, W, H).fill(c); doc.restore(); };
function header() {
  doc.save();
  doc.font('semi').fontSize(7).fillColor(C.gold).text('KCLINICS', M, 46, { characterSpacing: 2.5 });
  doc.font('body').fontSize(7.5).fillColor(C.stone).text(currentSection, M, 46, { width: CW, align: 'right', characterSpacing: 0.3 });
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
function h1(t) { ensure(54); doc.font('disp').fontSize(27).fillColor(C.ink).text(t, M, doc.y, { width: CW }); const y = doc.y + 4; doc.save(); doc.rect(M, y, 44, 2.5).fill(C.gold); doc.restore(); doc.y = y + 16; }
function h2(t) { ensure(34); doc.moveDown(0.55); doc.font('dispSemi').fontSize(14.5).fillColor(C.ink).text(t, M, doc.y, { width: CW }); doc.moveDown(0.4); }
function h3(t) { ensure(24); doc.moveDown(0.3); doc.font('semi').fontSize(9).fillColor(C.gold).text(t.toUpperCase(), M, doc.y, { characterSpacing: 1.2, width: CW }); doc.moveDown(0.35); }
function p(t) { ensure(26); doc.font('body').fontSize(9.7).fillColor(C.espresso).text(t, M, doc.y, { width: CW, lineGap: 3, align: 'left' }); doc.moveDown(0.5); }
function ul(items, color = C.gold) {
  for (const it of items) {
    const [lead, rest] = Array.isArray(it) ? it : [null, it];
    ensure(18);
    const x = M + 15, y = doc.y;
    doc.save(); doc.circle(M + 4.5, y + 5.5, 1.8).fill(color); doc.restore();
    if (lead) {
      doc.font('semi').fontSize(9.7).fillColor(C.ink).text(lead + ' ', x, y, { continued: true });
      doc.font('body').fillColor(C.espresso).text(' ' + rest, { width: CW - 15, lineGap: 2.6 });
    } else { doc.font('body').fontSize(9.7).fillColor(C.espresso).text(rest, x, y, { width: CW - 15, lineGap: 2.6 }); }
    doc.moveDown(0.34);
  }
  doc.moveDown(0.2);
}
function steps(items) {
  items.forEach((s, i) => {
    const x = M + 26;
    doc.font('body').fontSize(9.7);
    const th = doc.heightOfString(s, { width: CW - 26, lineGap: 2.6 });
    ensure(Math.max(20, th + 6));
    const y = doc.y;
    doc.save(); doc.circle(M + 9, y + 7, 8.5).fill(C.ink); doc.fillColor(C.goldBright).font('semi').fontSize(8.5).text(String(i + 1), M, y + 3.6, { width: 18, align: 'center' }); doc.restore();
    doc.font('body').fontSize(9.7).fillColor(C.espresso).text(s, x, y + 0.5, { width: CW - 26, lineGap: 2.6 });
    doc.moveDown(0.45);
  });
  doc.moveDown(0.2);
}
function tip(text, label = 'Tip') {
  doc.font('body').fontSize(9);
  const inner = CW - 26;
  const h = doc.heightOfString(text, { width: inner, lineGap: 2.6 }) + 30;
  ensure(h + 6);
  const y = doc.y;
  doc.save(); doc.roundedRect(M, y, CW, h, 6).fill(C.bone); doc.rect(M, y, 3, h).fill(C.gold); doc.restore();
  doc.font('semi').fontSize(7.5).fillColor(C.gold).text(label.toUpperCase(), M + 14, y + 11, { characterSpacing: 1.5 });
  doc.font('body').fontSize(9).fillColor(C.inkSoft).text(text, M + 14, y + 23, { width: inner, lineGap: 2.6 });
  doc.y = y + h + 9;
}
function table(headers, rows, widths) {
  const rowH = 24, tot = widths.reduce((a, b) => a + b, 0);
  ensure(rowH * (rows.length + 1) + 8);
  let y = doc.y;
  doc.save(); doc.rect(M, y, CW, rowH).fill(C.ink); doc.restore();
  let cx = M;
  headers.forEach((hd, i) => { doc.font('semi').fontSize(8).fillColor(i === headers.length - 1 ? C.goldBright : C.porcelain).text(hd.toUpperCase(), cx + 10, y + 8.5, { width: (widths[i] / tot) * CW - 14, characterSpacing: 0.8, align: i === headers.length - 1 ? 'right' : 'left' }); cx += (widths[i] / tot) * CW; });
  y += rowH;
  rows.forEach((r, ri) => {
    const cellH = rowH;
    doc.save(); doc.rect(M, y, CW, cellH).fill(ri % 2 ? C.bone : C.porcelain); doc.restore();
    cx = M;
    r.forEach((cell, i) => { const last = i === r.length - 1; doc.font(last ? 'semi' : 'body').fontSize(8.8).fillColor(last ? C.gold : C.inkSoft).text(cell, cx + 10, y + 7.5, { width: (widths[i] / tot) * CW - 16, align: last ? 'right' : 'left' }); cx += (widths[i] / tot) * CW; });
    y += cellH;
  });
  doc.y = y + 10;
}

function drawPath(d, x, y, scale, color) { doc.save(); doc.translate(x, y); doc.scale(scale); doc.path(d).fill(color); doc.restore(); }
const kmark = (x, y, hgt, color) => drawPath(K_PATH, x, y, hgt / 234, color);
function wordmark(x, y, width, color) { const s = width / 531; doc.save(); doc.translate(x, y); doc.scale(s); for (const d of WORD_PATHS) doc.path(d).fill(color); doc.restore(); }

function section(title, intro) { secNo++; currentSection = title; newPage(); toc.push({ title, page: pageIndex }); eyebrow(`${String(secNo).padStart(2, '0')} · Section`); h1(title); if (intro) p(intro); }

// Render a structured block list.
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
doc.font('body').fontSize(11).fillColor(C.stoneSoft).text('A complete, plain-English guide to the KClinics platform — what every tool does, how to use it, how it keeps data safe, and what a build of this scope represents.', M, H * 0.82, { width: CW - 70, lineGap: 3.5 });
doc.font('semi').fontSize(8).fillColor(C.gold).text('CONFIDENTIAL · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), M, H - 54, { characterSpacing: 1.5 });

// CONTENTS (reserve)
newPage(false);
const TOC_PAGE = pageIndex;
doc.x = M; doc.y = TOP;
eyebrow('Contents'); h1('What’s inside');
p('This manual is written for non-technical staff. Sections 5–14 are practical, step-by-step guides; sections 15–22 cover how the platform is built, kept secure, and where it can go next.');

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT
// ══════════════════════════════════════════════════════════════════════════════
section('The platform at a glance', 'KClinics runs on one bespoke platform that replaces a patchwork of separate tools — a website builder, a booking system, a payment processor, a CRM, an email/SMS tool and a content management system — all sharing a single database and design language.');
render([
  { h2: 'Three connected layers' },
  { ul: [
    ['Marketing website —', 'the public face: treatments, packages, the journal, the clinic story, and booking/enquiry flows.'],
    ['Client experience —', 'online booking, payments and deposits, a client portal, consultations, reviews and the Beauty Points loyalty programme.'],
    ['Admin (the CRM + CMS) —', 'the operational heart: bookings, clients, calendar, inventory, suppliers, finance, marketing, staff and access control — plus a full content management system for the website.'],
  ] },
  { h2: 'What makes it different' },
  { ul: [
    ['Owned, not rented —', 'the clinic owns the code, the data and the design. Nothing is trapped inside a third-party subscription.'],
    ['Joined up —', 'a booking, a payment, a loyalty point and a client record are the same data — not exports passed between systems.'],
    ['Editable by anyone —', 'staff can change almost everything (page content, pricing copy, imagery, navigation, blog) with no developer.'],
    ['Fast & found —', 'server-rendered for speed, with built-in SEO so the clinic ranks and loads quickly.'],
  ] },
  { tip: 'Throughout this manual, “Admin” means the private dashboard you reach by signing in. “The live site” means the public website your clients see.' },
]);

section('Getting started — the admin', 'Everything staff do happens in the Admin dashboard. Here is how to find your way around.');
render([
  { h2: 'Signing in' },
  { steps: [
    'Go to your site address followed by /admin/login (for example, kclinics.co.uk/admin/login).',
    'Enter your work email and password. New staff set their password via the link the clinic sends them.',
    'You arrive at the Overview. The left-hand menu is how you move between every tool.',
  ] },
  { h2: 'The left-hand menu, grouped by job' },
  { ul: [
    ['Today —', 'overview, my day, calendar, tasks, time-off.'],
    ['Clients —', 'bookings, consultations, live chat, calls, client records, reviews, discounts, promotions, rewards.'],
    ['Catalogue —', 'pages, reusable blocks, journal, media library, services & pricing, academy, before-&-after gallery, careers, gift vouchers.'],
    ['Operations —', 'staff rota/schedule, inventory, reordering, suppliers, SOPs.'],
    ['Marketing —', 'campaigns and automations.'],
    ['Finance —', 'cashflow and reports.'],
    ['Admin —', 'security, staff & access, activity log, locations, SEO, integrations, settings, and Site & globals.'],
  ] },
  { h2: 'Two words you’ll see everywhere' },
  { ul: [
    ['Draft —', 'a change you’ve saved privately. The public can’t see it yet.'],
    ['Publish —', 'makes a change live on the public website.'],
  ] },
  { tip: 'You can change things safely. Almost everything saves as a draft first, can be previewed, and can be rolled back to an earlier version. You won’t break the live site by experimenting.' },
]);

section('Brand assets in one place', 'The identity is a warm “taupe & cream” palette with a metallic gold accent, the hook-shaped “K” monogram and KCLINICS wordmark, the Fraunces display serif paired with the Geist sans, and a curated photography library. These are defined once and flow to every page.');
// (brand asset visuals are drawn below, after this section's heading)
{
  h2('Logo'); ensure(74);
  const y = doc.y; doc.save(); doc.roundedRect(M, y, CW, 66, 8).fill(C.ink); doc.restore();
  kmark(M + 24, y + 13, 40, C.goldSoft); wordmark(M + 54, y + 27, 120, C.porcelain);
  doc.font('body').fontSize(8).fillColor(C.stoneSoft).text('Monogram + wordmark · reversed on ink', M + 210, y + 29, { width: CW - 230 });
  doc.y = y + 80;
  h2('Colour palette'); ensure(150);
  const cols = 5, gap = 10, sw = (CW - gap * (cols - 1)) / cols, sh = 44; let py = doc.y;
  PALETTE.forEach((pp, i) => { const cx = M + (i % cols) * (sw + gap); const cy = py + Math.floor(i / cols) * (sh + 28);
    doc.save(); doc.roundedRect(cx, cy, sw, sh, 5).fill(pp[1]); if ([C.porcelain, C.bone, C.sand].includes(pp[1])) doc.lineWidth(0.5).roundedRect(cx, cy, sw, sh, 5).stroke(C.stoneSoft); doc.restore();
    doc.font('semi').fontSize(8).fillColor(C.ink).text(pp[0], cx, cy + sh + 4, { width: sw });
    doc.font('body').fontSize(6.5).fillColor(C.stone).text(pp[1].toUpperCase(), cx, cy + sh + 13.5, { width: sw }); });
  doc.y = py + 2 * (sh + 28) + 4;
  h2('Typography'); ensure(54);
  doc.font('dispSemi').fontSize(21).fillColor(C.ink).text('Fraunces — display serif', M, doc.y, { width: CW });
  doc.font('body').fontSize(11).fillColor(C.espresso).text('Geist — the clean sans used for body copy, UI and the admin.', M, doc.y + 5, { width: CW });
  doc.moveDown(1);
  h2('Photography'); ensure(92);
  const files = ['baner-laser-1.jpg', 'HydraFacial-Anti-Ageing.png', 'Body-SMAS-HIFU-Lifting-1.png', 'baner-12.jpg'];
  const g = 8, iw = (CW - g * 3) / 4, ih = 72, iy = doc.y;
  files.forEach((f, i) => { try { doc.save(); doc.roundedRect(M + i * (iw + g), iy, iw, ih, 5).clip(); doc.image(photo(f), M + i * (iw + g), iy, { cover: [iw, ih] }); doc.restore(); } catch { /* */ } });
  doc.y = iy + ih + 8; doc.font('body').fontSize(8).fillColor(C.stone).text('A curated library of laser, skin, aesthetics and dentistry imagery, managed in the admin media library.', M, doc.y, { width: CW });
}

section('The marketing website', 'A premium, fast, search-optimised site that presents the clinic and turns visitors into bookings. Every page is server-rendered for speed and ranking.');
render([
  { h2: 'The pages your clients see' },
  { ul: [
    ['Treatments & dentistry —', 'a catalogue of 150+ treatments, each with its own rich page: hero, benefits, the treatment journey, FAQs, pricing and related treatments.'],
    ['Packages & pricing —', 'curated bundles and transparent price lists.'],
    ['The Journal —', 'a native blog (66 migrated articles), managed entirely in the admin — no WordPress.'],
    ['About, team, clinic & contact —', 'the story, the people, the location with a live map and an enquiry form.'],
    ['Conversion tools —', 'online booking, free-consultation enquiry, a treatment finder quiz, the AI “Get My Plan”, gift vouchers, refer-a-friend and membership.'],
  ] },
  { h2: 'Working for you in the background' },
  { ul: [
    ['Search & AI visibility —', 'per-page SEO, structured data, sitemaps and an llms.txt so AI search engines understand the site.'],
    ['Speed —', 'pages are pre-built and cached, yet update within moments of an edit.'],
    ['Accessibility —', 'proper headings, alt text, skip links and keyboard support throughout.'],
  ] },
]);

section('The page builder — your website editor', 'The heart of the content system: build and edit any marketing page from modular, on-brand sections — no code, and impossible to break the design.');
render([
  { h2: 'How to edit a page' },
  { steps: [
    'Go to Admin → Pages. You’ll see every page on the site, grouped into “editable in the builder”, “managed elsewhere”, and “built-in”.',
    'Click Edit next to a page (or Customise to take over a page for the first time — it opens pre-filled with the current content).',
    'You can also click the âEdit this pageâ button that appears on any public page when you’re signed in — it jumps straight to that page’s editor.',
    'Make your changes (see below), then click Save draft to keep them privately, or Publish to make them live.',
  ] },
  { h2: 'Working with sections' },
  { p: 'A page is a stack of sections. You control the content and the order; the design stays locked to the brand.' },
  { steps: [
    'Add a section: click the “+ Section” button between any two sections and pick a type.',
    'Edit a section: click it to expand its fields, then type into them.',
    'Reorder: drag the ⠿ handle up or down (or use the ▲▼ arrows).',
    'Duplicate, hide or delete: use the icons on the section’s row. Hidden sections stay saved but don’t show on the live site.',
  ] },
  { h2: 'The section types available' },
  { ul: [
    ['Hero —', 'a bold page header with heading, intro and buttons.'],
    ['Rich text —', 'formatted content (headings, lists, links, images).'],
    ['Image + text —', 'an image beside a heading and copy, with a focal-point control.'],
    ['Feature grid · Stats · Steps/timeline —', 'cards, headline numbers, or a numbered process.'],
    ['Pricing table · Logos · Info cards —', 'prices, partner logos, or small linked cards.'],
    ['Quote · Gallery · Video · Marquee —', 'testimonials, image grids, YouTube/Vimeo embeds, scrolling ribbons.'],
    ['CTA · FAQ · Tag list · Table of contents —', 'call-to-action banners, accordions, pill tags, and auto-built page contents.'],
    ['Contact details · Map · Enquiry form —', 'live clinic details, the location map and the contact form.'],
  ] },
  { tip: 'Per-section “Layout” controls let you add a cream or sand background band and adjust spacing — useful for rhythm — without touching the core design.' },
  { h2: 'Preview before you publish' },
  { steps: [
    'Click Live preview in the toolbar. The page appears beside the editor exactly as visitors will see it.',
    'Switch between Desktop, Tablet and Mobile to check how it looks on phones.',
    'Your edits autosave to the draft and the preview refreshes itself as you work.',
  ] },
  { h2: 'Publishing, scheduling & undo' },
  { steps: [
    'Click Publish to go live immediately.',
    'To schedule: set a “Go live at” date/time (and optionally a “Take down at”), then Publish — it appears and disappears on its own.',
    'Made a mistake? Open Version history in the sidebar and click Restore on an earlier version.',
    'Unpublish returns the page to its original built-in design.',
  ] },
  { tip: 'The Audit panel flags problems before you publish — a missing image description, an empty heading, or a button with no link. Aim for a clean, problem-free result.' },
]);

section('Writing content — the editor & media', 'Inside Rich text and the Journal you write with a simple, what-you-see-is-what-you-get editor, and pull images from one shared library.');
render([
  { h2: 'The text editor' },
  { ul: [
    ['Type naturally —', 'bold and italic show as bold and italic as you type.'],
    ['Format —', 'select text and use the B / I / link buttons, or press Cmd-B (or Ctrl-B), Cmd-I, and Cmd-K for a link.'],
    ['Slash menu —', 'on an empty line, type “/” to insert a heading, list, quote, image, button, divider and more.'],
  ] },
  { h2: 'The media library' },
  { steps: [
    'Go to Admin → Media (or click “Library” on any image field).',
    'Drag images straight onto the upload area, or click it to choose files.',
    'Add alt text to each image (a short description) — important for accessibility and SEO.',
    'To use an image, click “Library” on any image field and select it.',
  ] },
  { tip: 'On Image + text sections you can click the image to set its focal point — the part that always stays in view when the image is cropped to fit.' },
]);

section('Global settings, menus & the banner', 'Change the clinic’s details once, and they update everywhere — header, footer, contact pages and search listings.');
render([
  { h2: 'Editing the global details' },
  { steps: [
    'Go to Admin → Site & globals.',
    'Update phone, email, WhatsApp, address, opening hours, social links or brand text.',
    'Click Save. The change appears across the whole site within moments.',
  ] },
  { h2: 'The announcement bar' },
  { steps: [
    'In Site & globals, open the Announcement bar section.',
    'Tick “Show banner”, write your message and (optionally) a link and start/end dates.',
    'Save. A dismissible banner appears at the top of every page during that window.',
  ] },
  { h2: 'Navigation menus' },
  { steps: [
    'In Site & globals, open the Navigation tab.',
    'Add, rename, reorder or remove header menu items, mega-menu columns and footer links.',
    'Save to publish the new menus.',
  ] },
  { tip: 'Every save here is versioned too — use Restore in the sidebar if you change your mind.' },
]);

section('The Journal (blog) & reusable blocks', 'Publish articles natively, and build a section once to reuse across many pages.');
render([
  { h2: 'Add a blog post' },
  { steps: [
    'Go to Admin → Journal → New post.',
    'Add a title, then write the body using the block/WYSIWYG editor.',
    'Set a category, cover image, excerpt and SEO details in the sidebar.',
    'Click Save & publish. It appears in the Journal and is fully search-optimised.',
  ] },
  { h2: 'Reusable blocks' },
  { steps: [
    'Go to Admin → Reusable blocks → create a block (e.g. a “Book now” call-to-action).',
    'In any page, use the section inserter and choose your block under “Reusable blocks”.',
    'Edit the block once and every page that uses it updates automatically.',
  ] },
]);

section('Services, pricing & treatment content', 'Operational pricing and marketing copy for each treatment live together in one place.');
render([
  { h2: 'Edit prices, durations and offers' },
  { steps: [
    'Go to Admin → Services & pricing.',
    'Open a service to edit its variants — price, duration, cost (for margin tracking) and course bundles.',
    'Use “Bulk price change” to adjust a whole category by a percentage.',
    'Add a special offer (percentage or fixed amount, with a date window) — it promotes automatically on the site.',
  ] },
  { h2: 'Edit a treatment’s page copy' },
  { steps: [
    'In Services & pricing, open a service and click “Edit page content”.',
    'Update the hero, benefits, the journey, FAQs and SEO for that treatment.',
    'Save — the treatment page and its cards on the listing grids update together.',
  ] },
]);

section('The CRM — daily operations', 'The tools the team uses to run the clinic day to day. Access to each is controlled by per-user permissions.');
render([
  { h2: 'Bookings' },
  { p: 'Calendar and list views of every appointment.' },
  { steps: [
    'Open Admin → Bookings.',
    'Click an appointment to view or edit it — reschedule, cancel, or change the practitioner.',
    'Take a card payment or deposit, and attach the client’s health/consent forms.',
  ] },
  { h2: 'Clients' },
  { ul: [
    ['Records —', 'contact details, full history, notes, tags and consent.'],
    ['Clinical —', 'encrypted skin assessments and consent forms, visible only to permitted staff.'],
    ['Search & filter —', 'find clients quickly; junk/test accounts are flagged.'],
  ] },
  { h2: 'Consultations, calendar & calls' },
  { ul: [
    ['Consultations —', 'incoming enquiries with status, assignment and replies.'],
    ['Calendar & schedule —', 'staff working hours, time-off and availability.'],
    ['Calls —', 'call log, click-to-dial, recordings and notes (VoIP).'],
  ] },
]);

section('The CRM — commercial & marketing', 'Tools that drive revenue, retention and reporting.');
render([
  { ul: [
    ['Finance —', 'cashflow forecasting, cash reserves and ring-fenced funds.'],
    ['Reports —', 'revenue, treatment and performance reporting.'],
    ['Campaigns —', 'create and send marketing emails to client segments.'],
    ['Automations —', 'hands-off birthday greetings, follow-ups and review requests.'],
    ['Reviews —', 'moderate, approve and publish client reviews (only 5-star, with consent, appear on the site).'],
    ['Rewards —', 'the Beauty Points loyalty programme — points per pound, plus review/birthday/referral bonuses.'],
    ['Inventory & suppliers —', 'stock levels, batches, expiry, usage/wastage, reordering and supplier records.'],
  ] },
  { tip: 'Reviews shown on the website are real and consented — there are no invented testimonials. If there are no eligible reviews yet, the rating widgets simply don’t appear.' },
]);

section('Staff, access control & security centre', 'Add team members, decide exactly what each can do, and manage the clinic’s security posture.');
render([
  { h2: 'Add a staff member' },
  { steps: [
    'Go to Admin → Staff & access → add a user with their name, email and role.',
    'Choose a role (Owner, Administrator, Practitioner, Front desk, General staff) — each comes with sensible default permissions.',
    'Fine-tune individual permissions if needed (e.g. allow drafting but not publishing).',
    'They receive a secure invite to set their own password.',
  ] },
  { h2: 'Roles & the “publish” permission' },
  { ul: [
    ['Editors —', 'can create and save drafts of website content.'],
    ['Publishers —', 'hold the “Publish website content” permission and can make changes live.'],
    ['Sensitive areas —', 'clinical records, finance, exports and security are gated separately and marked sensitive.'],
  ] },
  { h2: 'The security centre' },
  { ul: [
    ['Threat monitoring & lockouts —', 'watches for suspicious sign-ins and can lock accounts.'],
    ['Two-factor authentication —', 'set a 2FA policy for staff accounts.'],
    ['Key rotation —', 'rotate the encryption keys that protect health data, in one click.'],
    ['Activity log —', 'every significant staff action is timestamped and attributable.'],
  ] },
]);

section('Client experience, booking & payments', 'How clients discover, book and pay — feeding the same records the team works from.');
render([
  { ul: [
    ['Online booking —', 'choose a treatment, time and (optionally) a practitioner; pay or leave a deposit at checkout.'],
    ['Payments —', 'card payments, deposits and prepaid courses via Stripe. The clinic never stores card numbers.'],
    ['Client portal —', 'clients manage appointments, see Beauty Points and complete consent/health forms.'],
    ['Loyalty —', 'points earned automatically, redeemable against treatments.'],
    ['Migrated history —', 'existing clients keep their history; passwords reset securely on first login.'],
  ] },
]);

section('Integrations & how to connect them', 'The platform plugs into best-in-class services. Each is configured in Admin → Integrations (or Settings), with keys stored safely and never shown in the code.');
render([
  { table: [['Service', 'What it does'], [
    ['Stripe', 'Payments, deposits & prepaid courses'],
    ['Resend', 'Email from the clinic’s domain'],
    ['Twilio', 'SMS reminders & notifications'],
    ['Vercel Blob', 'Image storage & delivery'],
    ['Xero', 'Accounting & reconciliation'],
    ['TrueLayer', 'Open-banking connectivity'],
    ['CalDAV', 'Calendar synchronisation'],
    ['DeepL', 'Translation (EN + UK)'],
    ['yay.com', 'VoIP telephony'],
  ], [50, 50]] },
  { h2: 'How to connect a service' },
  { steps: [
    'Create an account with the provider and copy its API key(s).',
    'In the hosting dashboard (Vercel), add the key as an environment variable — mark it “sensitive”.',
    'Redeploy. The Integrations page shows a green status when a service is connected.',
  ] },
  { tip: 'Keys live only in the hosting environment, never in the codebase or this document. A service can be swapped without touching the rest of the platform.' },
]);

section('Data migration — what moved across', 'The legacy WordPress/WooCommerce site was retired and its data brought over with bespoke, repeatable importers.');
render([
  { ul: [
    ['Clients —', '102 records with contact details, consent and history.'],
    ['Bookings —', '~276 appointments, re-titled with correct treatment names and linked to practitioners.'],
    ['Clinical & consent —', '70 consent records and 156 skin-quiz/care-plan entries, encrypted at rest.'],
    ['Reviews, loyalty & staff —', '9 reviews, 12 loyalty records and 7 staff accounts with booking links.'],
    ['Journal —', '66 published articles imported into the native blog.'],
    ['Integrity —', 'importers are safe to re-run; 28 junk/test accounts were flagged; unrecoverable records were reported, never guessed.'],
  ] },
]);

section('Security & compliance', 'Security is built in at every layer — appropriate for a clinic handling personal and health data under UK GDPR.');
render([
  { h2: 'Protecting data' },
  { ul: [
    ['Health-data encryption —', 'clinical assessments and consent are encrypted (AES-256-GCM) with a rotating keyring; decryption is permission-gated.'],
    ['Secrets —', 'all keys live in the hosting environment, never in code.'],
    ['Least privilege —', 'granular per-permission access; staff see only what their role allows.'],
    ['Payments —', 'handled by Stripe; card data never touches clinic servers (PCI-compliant).'],
  ] },
  { h2: 'Accounts & accountability' },
  { ul: [
    ['Authentication —', 'signed sessions, hashed passwords, separate client and staff identities.'],
    ['Audit trail —', 'staff actions and content revisions are recorded.'],
    ['Privacy by design —', 'cookie consent, call-recording notice, data-export and deletion paths, and published policies.'],
  ] },
]);

section('Technical architecture', 'Modern, mainstream and maintainable — chosen so any competent developer or agency could take it on.');
render([
  { ul: [
    ['Framework —', 'Next.js (App Router) + React + TypeScript — server-rendered and type-safe.'],
    ['Database —', 'PostgreSQL via the Prisma toolkit, with a clean, versioned schema.'],
    ['Hosting —', 'Vercel — global CDN, automatic HTTPS, preview deployments and instant rollbacks.'],
    ['Design system —', 'brand tokens (colours, fonts, spacing) defined once and reused everywhere.'],
    ['Content —', 'structured blocks rendered to clean HTML, cached and refreshed on demand.'],
    ['Resilience —', 'if the database is briefly unavailable, the public site still renders.'],
  ] },
]);

section('Going live — pre-launch checklist', 'The steps to point the domain at the platform and switch payments to live.');
render([
  { steps: [
    'Point kclinics.co.uk at the platform in your DNS (GoDaddy), with www redirecting to the non-www address.',
    'Set the site’s public address (NEXT_PUBLIC_SITE_URL) to https://kclinics.co.uk.',
    'Switch Stripe from test to live keys once the business bank account is connected.',
    'Add the live Stripe webhook for the new domain so payments confirm correctly.',
    'Configure the remaining integrations (Xero, TrueLayer, CalDAV, translation) with the live domain’s redirect URLs.',
    'Run the health check, then do a test booking and a test payment end to end.',
  ] },
  { tip: 'Each of these is a settings change, not a rebuild — the platform is already production-ready.' },
]);

section('Recommendations & future roadmap', 'Sensible next steps to extend the platform once live, in rough priority order.');
render([
  { h3: 'Near-term (quick wins)' },
  { ul: [
    ['Automated review requests —', 'text/email clients a few days after a visit to grow genuine 5-star reviews.'],
    ['Waitlist & cancellations —', 'auto-offer freed slots to a waitlist to cut no-show gaps.'],
    ['Abandoned-booking nudges —', 'gently follow up visitors who start but don’t finish booking.'],
    ['Google Business & reviews sync —', 'surface live Google ratings alongside on-site reviews.'],
  ] },
  { h3: 'Medium-term (growth)' },
  { ul: [
    ['Memberships & subscriptions —', 'recurring monthly plans (e.g. skin memberships) billed via Stripe.'],
    ['Gift-card balances & store credit —', 'track redeemable balances in the client record.'],
    ['Client mobile app / PWA —', 'home-screen access to bookings, points and rebooking.'],
    ['Advanced analytics —', 'cohort retention, treatment profitability and marketing attribution dashboards.'],
    ['A/B testing in the page builder —', 'test two versions of a page and keep the winner.'],
  ] },
  { h3: 'Longer-term (scale)' },
  { ul: [
    ['Multi-location —', 'per-clinic calendars, stock and reporting under one brand.'],
    ['Franchise mode —', 'controlled brand + content rollout to franchisees.'],
    ['AI front desk —', 'the existing assistant handling rebooking and FAQs end to end.'],
    ['Native accounting close —', 'deeper Xero automation for month-end.'],
  ] },
]);

section('Cost & value of the build', 'An informed market estimate of what a platform of this breadth and polish would cost to commission conventionally. These are build costs (excluding ongoing hosting and maintenance) and a guide, not a quote.');
render([
  { table: [['Component', 'Typical cost'], [
    ['Premium bespoke marketing site (~30 pages, catalogue, SEO)', '£15k – £40k'],
    ['Online booking + Stripe payments + client portal', '£20k – £50k'],
    ['Full admin CRM (operations, finance, marketing, staff & permissions, security, LMS)', '£60k – £150k+'],
    ['Legacy data migration (custom importers + health-data encryption)', '£5k – £20k'],
    ['Integrations (Stripe, Resend, Twilio, Xero, TrueLayer, CalDAV, translation)', '£10k – £30k'],
    ['Bespoke CMS / page builder (a product in its own right)', '£20k – £40k'],
  ], [72, 28]] },
  { h2: 'Headline' },
  { ul: [
    ['UK agency / studio —', 'approximately £150k – £300k for the whole platform, as a 6–12 month engagement with a small team.'],
    ['Senior solo contractor —', 'a leaner equivalent in the region of £70k – £150k.'],
    ['Off-the-shelf alternative —', 'cheaper upfront (≈£5k–£20k) by renting separate tools — but with ongoing fees, no bespoke fit and no ownership of the code or data.'],
  ] },
  { p: 'The lasting value is not the line items: it is owning a tailored, integrated platform — marketing, CMS, CRM, payments and migrated data in one system — rather than renting and stitching together five separate products.' },
  { tip: 'Excludes ongoing costs: hosting/infrastructure (typically £50–£300 per month at this scale) and maintenance/support (agencies usually charge 15–20% of build cost per year).' },
]);

section('Glossary & support', 'Plain-English definitions of terms used in this manual, and where to get help.');
render([
  { h2: 'Glossary' },
  { ul: [
    ['Admin —', 'the private dashboard staff sign in to.'],
    ['Draft / Publish —', 'a privately-saved change vs. a change made live.'],
    ['Section —', 'a building block of a page (hero, text, gallery, etc.).'],
    ['Reusable block —', 'a section saved once and shared across pages.'],
    ['Permission —', 'a specific thing a staff member is allowed to do.'],
    ['Integration —', 'an external service the platform connects to (e.g. Stripe).'],
    ['Environment variable —', 'a secret setting (like an API key) stored safely in hosting.'],
    ['SEO —', 'search-engine optimisation — helping the site rank on Google.'],
    ['CDN —', 'a global network that serves the site quickly everywhere.'],
  ] },
  { h2: 'Getting help' },
  { p: 'For day-to-day questions, this manual and the on-screen hints in each tool are the first port of call. For changes that need a developer (new features, integrations, or anything in this document’s “future roadmap”), keep a short written brief of what you want and the outcome you expect — it makes any developer faster and cheaper.' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// FILL CONTENTS
// ══════════════════════════════════════════════════════════════════════════════
doc.switchToPage(TOC_PAGE);
doc.y = TOP + 96;
toc.forEach((e, i) => {
  const y = doc.y; const num = String(i + 1).padStart(2, '0');
  doc.font('semi').fontSize(9.5).fillColor(C.gold).text(num, M, y + 1, { width: 24 });
  doc.font('med').fontSize(11).fillColor(C.ink).text(e.title, M + 28, y, { width: CW - 80 });
  doc.font('body').fontSize(9.5).fillColor(C.stone).text(String(e.page), M + CW - 36, y + 1, { width: 36, align: 'right' });
  const dy = y + 12.5; doc.save(); doc.lineWidth(0.4).strokeColor(C.stoneSoft).dash(1, { space: 3 }).moveTo(M + 28, dy).lineTo(M + CW - 42, dy).stroke().undash(); doc.restore();
  doc.y = y + 20;
});

// FOOTERS on every page except cover
for (let i = 1; i <= pageIndex; i++) { doc.switchToPage(i); footer(i); }

doc.end();
out.on('finish', () => console.log('✓ Wrote', OUT, '(' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB,', pageIndex + 1, 'pages)'));
