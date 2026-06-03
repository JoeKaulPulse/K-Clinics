// Generates the KClinics Platform Guide & Build Dossier as a branded PDF.
//   node scripts/build-dossier.mjs
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'KClinics-Platform-Guide.pdf');
const img = (f) => path.join(ROOT, 'public', 'treatments', f);
const font = (f) => path.join(ROOT, 'node_modules', 'geist', 'dist', 'fonts', 'geist-sans', f);

// ── Brand palette (lib/theme.ts) ─────────────────────────────────────────────
const C = {
  ink: '#2a2420', inkSoft: '#3d352f', espresso: '#4a3f37', porcelain: '#f6ece3',
  bone: '#efe3d7', sand: '#e3d3c4', stone: '#91766e', stoneSoft: '#b7a294',
  gold: '#a98a6d', goldSoft: '#c2a589', goldBright: '#dcc4a8', jade: '#7b6a5d', blush: '#cdb4a3',
};
const PALETTE = [
  ['Ink', C.ink, 'Primary text · dark sections'], ['Espresso', C.espresso, 'Deep brown'],
  ['Porcelain', C.porcelain, 'Primary light background'], ['Bone', C.bone, 'Secondary surface'],
  ['Sand', C.sand, 'Tertiary surface'], ['Gold', C.gold, 'Metallic accent · buttons'],
  ['Gold soft', C.goldSoft, 'Highlights'], ['Stone', C.stone, 'Muted taupe text'],
  ['Jade', C.jade, 'Secondary accent'], ['Blush', C.blush, 'Soft highlight'],
];

// ── Logo vectors (read live from components/brand/marks.tsx) ──────────────────
const marks = fs.readFileSync(path.join(ROOT, 'components/brand/marks.tsx'), 'utf8');
const K_PATH = (marks.match(/const K_PATH =\s*'([^']+)'/) || [])[1];
const wordmarkBlock = marks.slice(marks.indexOf('function ClinicsWordmark'));
const WORD_PATHS = [...wordmarkBlock.matchAll(/d="([^"]+)"/g)].map((m) => m[1]);

// ── Geometry ──────────────────────────────────────────────────────────────────
const W = 595.28, H = 841.89, M = 56, CW = W - M * 2;
const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: 'KClinics — Platform Guide & Build Dossier', Author: 'KClinics' } });
const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

doc.registerFont('body', font('Geist-Regular.ttf'));
doc.registerFont('med', font('Geist-Medium.ttf'));
doc.registerFont('semi', font('Geist-SemiBold.ttf'));
doc.registerFont('bold', font('Geist-Bold.ttf'));
const DISPLAY = 'Times-Bold';      // serif display (echoes the Fraunces headings)
const DISPLAY_R = 'Times-Roman';

let pageIndex = 0;            // 0 = cover, 1 = contents, 2+ = content
const toc = [];              // { title, page }

function bg(color = C.porcelain) { doc.save(); doc.rect(0, 0, W, H).fill(color); doc.restore(); }
function newPage(color = C.porcelain) { doc.addPage(); pageIndex++; bg(color); doc.x = M; doc.y = M + 6; }
function ensure(h) { if (doc.y + h > H - M - 18) newPage(); }

function eyebrow(text, color = C.gold) {
  ensure(20); doc.font('semi').fontSize(8.5).fillColor(color).text(text.toUpperCase(), M, doc.y, { characterSpacing: 2, width: CW });
  doc.moveDown(0.45);
}
function h1(text) {
  ensure(46); doc.font(DISPLAY).fontSize(26).fillColor(C.ink).text(text, M, doc.y, { width: CW });
  doc.moveDown(0.3);
  const y = doc.y + 2; doc.save(); doc.rect(M, y, 42, 2.4).fill(C.gold); doc.restore(); doc.y = y + 14;
}
function h2(text) { ensure(30); doc.moveDown(0.5); doc.font('semi').fontSize(13).fillColor(C.inkSoft).text(text, M, doc.y, { width: CW }); doc.moveDown(0.35); }
function para(text) { ensure(28); doc.font('body').fontSize(10).fillColor(C.espresso).text(text, M, doc.y, { width: CW, align: 'left', lineGap: 3.2 }); doc.moveDown(0.5); }
function bullets(items, color = C.gold) {
  for (const it of items) {
    const [lead, rest] = Array.isArray(it) ? it : [null, it];
    ensure(20);
    const x = M + 14, y = doc.y;
    doc.save(); doc.circle(M + 4, y + 5.5, 1.8).fill(color); doc.restore();
    doc.font(lead ? 'body' : 'body').fontSize(10).fillColor(C.espresso);
    if (lead) {
      doc.font('semi').fillColor(C.ink).text(lead + '  ', x, y, { continued: true });
      doc.font('body').fillColor(C.espresso).text(rest, { width: CW - 14, lineGap: 2.6 });
    } else {
      doc.text(rest, x, y, { width: CW - 14, lineGap: 2.6 });
    }
    doc.moveDown(0.32);
  }
  doc.moveDown(0.25);
}
function drawPath(d, x, y, scale, color) { doc.save(); doc.translate(x, y); doc.scale(scale); doc.path(d).fill(color); doc.restore(); }
function kmark(x, y, height, color) { drawPath(K_PATH, x, y, height / 234, color); } // viewBox 130x234
function wordmark(x, y, width, color) { const s = width / 531; doc.save(); doc.translate(x, y); doc.scale(s); for (const d of WORD_PATHS) doc.path(d).fill(color); doc.restore(); } // 531x51

// ── Section helper: starts a fresh page + records the contents entry ──────────
function section(title) { newPage(); toc.push({ title, page: pageIndex }); eyebrow(`${String(toc.length).padStart(2, '0')} · Section`); h1(title); }

// ══════════════════════════════════════════════════════════════════════════════
// COVER
// ══════════════════════════════════════════════════════════════════════════════
bg(C.ink);
try { doc.image(img('baner-laser-1.jpg'), 0, 0, { cover: [W, H * 0.62], align: 'center', valign: 'center' }); } catch { /* */ }
doc.save(); doc.rect(0, H * 0.42, W, H * 0.2).fill(C.ink); doc.restore(); // gradient-ish band
doc.save(); doc.rect(0, H * 0.6, W, H * 0.4).fill(C.ink); doc.restore();
// logo
kmark(M, H * 0.66, 54, C.goldSoft);
wordmark(M + 40, H * 0.66 + 20, 150, C.porcelain);
doc.font(DISPLAY).fontSize(40).fillColor(C.porcelain).text('Platform Guide', M, H * 0.73, { width: CW });
doc.font(DISPLAY_R).fontSize(40).fillColor(C.goldSoft).text('& Build Dossier', { width: CW });
doc.font('body').fontSize(11).fillColor(C.stoneSoft).text('A complete guide to the KClinics platform — what it does, how it works, its security, and what a build of this scope represents.', M, H * 0.86, { width: CW - 80, lineGap: 3 });
doc.font('semi').fontSize(8).fillColor(C.gold).text('CONFIDENTIAL · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), M, H - M, { characterSpacing: 1.5 });

// ══════════════════════════════════════════════════════════════════════════════
// CONTENTS (reserved — filled after content render)
// ══════════════════════════════════════════════════════════════════════════════
newPage();
const TOC_PAGE = pageIndex;
eyebrow('Contents'); h1('What’s inside');

// ══════════════════════════════════════════════════════════════════════════════
// 1. OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════
section('The platform at a glance');
para('KClinics runs on a single, bespoke platform that replaces what is normally a patchwork of separate tools — a website builder, a booking system, a payments processor, a CRM, an email/SMS tool and a content management system. Everything shares one database and one design language, so the client experience, the clinic’s day-to-day operations and the marketing site are joined up rather than stitched together.');
para('It is built on modern, widely-supported foundations (Next.js, React and PostgreSQL, hosted on Vercel), which means it is fast, secure, search-engine friendly, and inexpensive to run relative to its capability.');
h2('Three connected layers');
bullets([
  ['Marketing website —', 'the public face: treatments, packages, the journal, the clinic story, and conversion-focused booking and enquiry flows.'],
  ['Client experience —', 'online booking, payments and deposits (Stripe), a client portal, consultations, reviews and a Beauty Points loyalty programme.'],
  ['Admin CRM —', 'the operational heart: bookings, clients and clinical records, calendar, inventory, suppliers, finance, marketing, staff and access control — plus a full content management system.'],
]);
h2('Designed around three principles');
bullets([
  ['Owned, not rented —', 'the clinic owns the code, the data and the design. Nothing is locked inside a third-party SaaS.'],
  ['Joined up —', 'a booking, a payment, a loyalty point and a client record are the same data, not exports between systems.'],
  ['Editable —', 'non-technical staff can change almost everything — page content, pricing, imagery, navigation, blog — without a developer.'],
]);

// ══════════════════════════════════════════════════════════════════════════════
// 2. BRAND ASSETS
// ══════════════════════════════════════════════════════════════════════════════
section('Brand assets in one place');
para('The identity is a warm “taupe & cream” palette with a metallic gold accent, a custom hook-shaped “K” monogram, the KCLINICS wordmark, a serif display face paired with a clean sans for UI, and a library of clinical/beauty photography. These tokens are defined once in code and flow to every page automatically.');
// Logo lockup
h2('Logo'); ensure(70);
{ const y = doc.y; doc.save(); doc.roundedRect(M, y, CW, 64, 8).fill(C.ink); doc.restore();
  kmark(M + 22, y + 12, 40, C.goldSoft); wordmark(M + 52, y + 26, 120, C.porcelain);
  doc.font('body').fontSize(8).fillColor(C.stoneSoft).text('Monogram + wordmark · reversed on ink', M + 200, y + 28, { width: CW - 220 });
  doc.y = y + 78; }
// Palette swatches
h2('Colour palette'); ensure(120);
{ const cols = 5, gap = 10, sw = (CW - gap * (cols - 1)) / cols, sh = 46; let y = doc.y;
  PALETTE.forEach((p, i) => { const cx = M + (i % cols) * (sw + gap); const cy = y + Math.floor(i / cols) * (sh + 26);
    doc.save(); doc.roundedRect(cx, cy, sw, sh, 5).fill(p[1]); if (p[1] === C.porcelain || p[1] === C.bone || p[1] === C.sand) { doc.lineWidth(0.5).roundedRect(cx, cy, sw, sh, 5).stroke(C.stoneSoft); } doc.restore();
    doc.font('semi').fontSize(8).fillColor(C.ink).text(p[0], cx, cy + sh + 3, { width: sw });
    doc.font('body').fontSize(6.5).fillColor(C.stone).text(p[1].toUpperCase(), cx, cy + sh + 13, { width: sw }); });
  doc.y = y + 2 * (sh + 26) + 6; }
// Typography
h2('Typography'); ensure(60);
doc.font(DISPLAY).fontSize(22).fillColor(C.ink).text('Fraunces — display serif', M, doc.y, { width: CW });
doc.font('body').fontSize(11).fillColor(C.espresso).text('Geist — the clean sans used for body copy, UI and the admin.', M, doc.y + 4, { width: CW });
doc.moveDown(0.8);
// Photography strip
h2('Photography'); ensure(90);
{ const files = ['baner-laser-1.jpg', 'HydraFacial-Anti-Ageing.png', 'Body-SMAS-HIFU-Lifting-1.png', 'baner-12.jpg'];
  const gap = 8, iw = (CW - gap * 3) / 4, ih = 70, y = doc.y;
  files.forEach((f, i) => { try { doc.save(); doc.roundedRect(M + i * (iw + gap), y, iw, ih, 5).clip(); doc.image(img(f), M + i * (iw + gap), y, { cover: [iw, ih] }); doc.restore(); } catch { /* */ } });
  doc.y = y + ih + 8; doc.font('body').fontSize(8).fillColor(C.stone).text('A curated library of laser, skin, aesthetics and dentistry imagery, managed in the admin media library.', M, doc.y, { width: CW }); }

// ══════════════════════════════════════════════════════════════════════════════
// 3. MARKETING WEBSITE
// ══════════════════════════════════════════════════════════════════════════════
section('The marketing website');
para('A premium, fast, search-optimised site that presents the clinic and converts visitors into bookings. Every page is server-rendered for speed and SEO, with refined motion and a consistent luxury aesthetic.');
h2('Key areas');
bullets([
  ['Treatments & dentistry —', 'a full catalogue (150+ treatments) with rich, individually-editable pages: hero, benefits, the treatment journey, FAQs, pricing and related treatments.'],
  ['Packages & pricing —', 'curated bundles and transparent price lists.'],
  ['The Journal —', 'a native blog with 66 migrated articles, fully managed in the admin (no WordPress).'],
  ['Clinic & about —', 'story, team, locations, contact with live map and enquiry form.'],
  ['Conversion flows —', 'online booking, free-consultation enquiry, treatment finder, AI “Get My Plan”, gift vouchers, refer-a-friend and membership.'],
]);
h2('Built in for growth');
bullets([
  ['Search & AI visibility —', 'per-page SEO, structured data (JSON-LD), sitemaps and an llms.txt for AI search engines.'],
  ['Performance —', 'static generation with on-demand revalidation; pages stay fast and update instantly when edited.'],
  ['Accessibility —', 'semantic markup, skip links, alt text and keyboard support throughout.'],
]);

// ══════════════════════════════════════════════════════════════════════════════
// 4. THE CMS / PAGE BUILDER
// ══════════════════════════════════════════════════════════════════════════════
section('The content management system');
para('A bespoke, best-in-class CMS lets staff edit the entire marketing site without code — content, images, layout and structure — while the design system keeps everything on-brand. It is comparable to a tailored Webflow or Sanity, built specifically for this site.');
h2('Page builder');
bullets([
  ['Modular sections (ACF-style) —', '16 pre-built, on-brand section types: hero, rich text, image + text, feature grid, stats, CTA, FAQ, gallery, quote, marquee, two-column, steps/timeline, pricing table, logos, video and info cards.'],
  ['Visual editing —', 'drag-and-drop reorder, duplicate, show/hide, and a live split-screen preview at desktop, tablet and mobile widths.'],
  ['WYSIWYG + slash commands —', 'rich text renders live as you type (bold, italic, links); type “/” to insert a block.'],
  ['Draft → preview → publish —', 'with scheduled go-live/take-down, full revision history and one-click rollback.'],
  ['Reusable blocks —', 'build a section once, reuse it across pages, edit it once and every page updates.'],
  ['Per-page SEO + live audit —', 'title, description, share image and a panel flagging missing alt text, headings and meta issues.'],
]);
h2('Everything is editable');
bullets([
  ['Pages —', 'editorial pages, legal/policy pages and brand-new pages, all from a single directory with content search.'],
  ['Global variables —', 'phone, email, social links, address, opening hours, booking links and brand text, controlled in one place and reflected everywhere.'],
  ['Navigation & announcement bar —', 'header mega-menu, footer links and a site-wide banner, all editable.'],
  ['Media library —', 'drag-and-drop image uploads (Vercel Blob), search, alt text and focal-point cropping.'],
  ['Service content —', 'each treatment’s marketing copy is editable inside its service in the admin.'],
  ['“Edit this page” —', 'logged-in staff get an edit shortcut on every public page.'],
]);

// ══════════════════════════════════════════════════════════════════════════════
// 5. ADMIN CRM
// ══════════════════════════════════════════════════════════════════════════════
section('The admin CRM');
para('The operational core of the business, organised into focused modules. Access to each is governed by granular, per-user permissions.');
h2('Daily operations');
bullets([
  ['Bookings —', 'calendar and list views, reschedule/cancel, link to clients, take card payments and deposits, attach health forms.'],
  ['Clients —', 'full records with contact details, history, notes, tags, consent and encrypted clinical assessments.'],
  ['Consultations —', 'incoming enquiries with status, assignment and responses.'],
  ['Calendar & scheduling —', 'staff working hours, time-off and availability.'],
  ['Calls (telephony) —', 'call log, click-to-dial, recordings and notes.'],
]);
h2('Commercial & marketing');
bullets([
  ['Services & pricing —', 'every service, variant, cost, margin, course and special offer; bulk price changes.'],
  ['Finance —', 'cashflow forecasting, reserves and reporting.'],
  ['Campaigns & automations —', 'email marketing plus automated birthday and follow-up flows.'],
  ['Reviews & rewards —', 'moderate client reviews; run the Beauty Points loyalty programme.'],
  ['Inventory & suppliers —', 'stock levels, batches, expiry, usage and supplier records.'],
]);
h2('Administration');
bullets([
  ['Staff & access control —', 'create staff, assign roles and fine-tune individual permissions.'],
  ['Security centre —', 'threat monitoring, lockouts, 2FA policy and encryption-key rotation.'],
  ['Academy / LMS —', 'training courses, lessons and certificates for the K Academy.'],
  ['Settings & integrations —', 'one place to configure the platform and connect external services.'],
]);

// ══════════════════════════════════════════════════════════════════════════════
// 6. CLIENT EXPERIENCE
// ══════════════════════════════════════════════════════════════════════════════
section('Client experience, booking & payments');
para('Clients can discover treatments, book online and pay securely without phoning the clinic — while every interaction feeds the same records the team works from.');
bullets([
  ['Online booking —', 'choose a treatment, time and (optionally) practitioner; pay or leave a deposit at checkout.'],
  ['Payments —', 'card payments, deposits and prepaid courses via Stripe (PCI-compliant; no card data stored by the clinic).'],
  ['Client portal —', 'manage appointments, see Beauty Points, and access consent/health forms.'],
  ['Loyalty —', 'earn points per pound, plus review, birthday and referral bonuses, redeemable against treatments.'],
  ['Migrated history —', 'existing clients keep their history; passwords reset securely on first login.'],
]);

// ══════════════════════════════════════════════════════════════════════════════
// 7. INTEGRATIONS
// ══════════════════════════════════════════════════════════════════════════════
section('Integrations');
para('The platform connects to best-in-class external services, each isolated behind its own configuration so keys are never exposed and a service can be swapped without touching the rest.');
bullets([
  ['Stripe —', 'payments, deposits and prepaid courses.'],
  ['Resend —', 'transactional and marketing email from the clinic’s domain.'],
  ['Twilio —', 'SMS reminders and notifications.'],
  ['Vercel Blob —', 'media/image storage and delivery.'],
  ['Xero —', 'accounting (invoices, bills, reconciliation).'],
  ['TrueLayer —', 'open-banking payment/data connectivity.'],
  ['CalDAV (Hostinger) —', 'calendar synchronisation.'],
  ['DeepL / translation —', 'multi-language support (English + Ukrainian in the admin).'],
  ['yay.com —', 'VoIP telephony.'],
]);

// ══════════════════════════════════════════════════════════════════════════════
// 8. DATA MIGRATION
// ══════════════════════════════════════════════════════════════════════════════
section('Data migration');
para('The legacy WordPress/WooCommerce site was decommissioned and its data moved across with care, using bespoke, repeatable importers.');
bullets([
  ['Clients —', '102 client records with contact details, consent and history.'],
  ['Bookings —', '~276 appointments, re-titled with correct treatment names and linked to practitioners.'],
  ['Clinical & consent —', '70 consent records, 156 skin-quiz/care-plan entries, encrypted at rest.'],
  ['Reviews, loyalty & staff —', '9 reviews, 12 loyalty records and 7 staff accounts with their booking links.'],
  ['Journal —', '66 published blog articles imported into the native CMS.'],
  ['Integrity —', 'idempotent importers (safe to re-run); 28 junk/test accounts flagged; unrecoverable orphaned records reported rather than guessed.'],
]);

// ══════════════════════════════════════════════════════════════════════════════
// 9. SECURITY & COMPLIANCE
// ══════════════════════════════════════════════════════════════════════════════
section('Security & compliance');
para('Security is built in at every layer — appropriate for a clinic handling personal and health data under UK GDPR.');
h2('Data protection');
bullets([
  ['Health-data encryption —', 'clinical assessments and consent are encrypted with AES-256-GCM using a rotating keyring; decryption is permission-gated.'],
  ['Secrets management —', 'all keys live in environment variables (never in code); sensitive values are marked sensitive in hosting.'],
  ['Least privilege —', 'granular per-permission access control; staff see only what their role allows; sensitive actions are flagged.'],
  ['Role-based publishing —', 'editors can draft; only authorised staff can publish content live.'],
]);
h2('Application & account security');
bullets([
  ['Authentication —', 'signed (JWT) sessions, bcrypt-hashed passwords, separate client and staff identities.'],
  ['Security centre —', 'threat monitoring, account lockouts, two-factor policy and one-click key rotation.'],
  ['Payments —', 'handled by Stripe; card details never touch the clinic’s servers (PCI-compliant).'],
  ['Audit trail —', 'staff actions and content revisions are timestamped and attributable.'],
  ['Privacy by design —', 'cookie consent, call-recording notice, data-export and deletion paths, and published policies.'],
]);

// ══════════════════════════════════════════════════════════════════════════════
// 10. TECHNICAL ARCHITECTURE
// ══════════════════════════════════════════════════════════════════════════════
section('Technical architecture');
para('Modern, mainstream and maintainable — chosen so any competent agency or developer could pick the project up.');
bullets([
  ['Framework —', 'Next.js (App Router) + React + TypeScript — server-rendered, type-safe.'],
  ['Database —', 'PostgreSQL via Prisma ORM (Prisma Postgres), with a clean, versioned schema.'],
  ['Hosting —', 'Vercel — global CDN, automatic HTTPS, preview deployments and instant rollbacks.'],
  ['Styling —', 'a tokenised design system (Tailwind + CSS variables) so the brand is defined once.'],
  ['Content —', 'structured JSON blocks rendered to clean HTML; cached and tag-revalidated.'],
  ['Resilience —', 'graceful fallbacks — if the database is briefly unavailable the public site still renders.'],
]);

// ══════════════════════════════════════════════════════════════════════════════
// 11. EVERYDAY TASKS (training)
// ══════════════════════════════════════════════════════════════════════════════
section('Everyday tasks — quick guide');
para('Common things staff will do, and where to do them. All editing happens under Admin (sign in, then use the left-hand menu).');
const tasks = [
  ['Edit a page', 'Admin → Pages → choose the page (or “Edit this page” from the live site) → edit sections → Preview → Publish.'],
  ['Change phone / email / hours / socials', 'Admin → Site & globals → edit the fields → Save. Updates everywhere instantly.'],
  ['Add a blog post', 'Admin → Journal → New post → write with the block editor → Publish.'],
  ['Edit a treatment’s page copy', 'Admin → Services → the service → “Edit page content”.'],
  ['Upload images', 'Admin → Media → drag in images → add alt text. Pick them anywhere an image is used.'],
  ['Run an announcement banner', 'Admin → Site & globals → Announcement bar → message + dates → Save.'],
  ['Schedule a page to go live later', 'In the page builder → set “Go live at” → Publish.'],
  ['Manage a booking / take payment', 'Admin → Bookings → open the booking → reschedule, charge or attach forms.'],
  ['Add or restrict a staff member', 'Admin → Staff → add user, set role, fine-tune permissions.'],
];
for (const [t, how] of tasks) {
  ensure(34);
  doc.font('semi').fontSize(10).fillColor(C.ink).text(t, M, doc.y, { width: CW });
  doc.font('body').fontSize(9.5).fillColor(C.espresso).text(how, M, doc.y + 1, { width: CW, lineGap: 2.5 });
  doc.moveDown(0.55);
}

// ══════════════════════════════════════════════════════════════════════════════
// 12. COST & VALUE
// ══════════════════════════════════════════════════════════════════════════════
section('Cost & value of the build');
para('An informed market estimate of what a platform of this breadth and polish would cost to commission conventionally. These are build costs (excluding ongoing hosting and maintenance), and a guide rather than a quote — actual figures vary by team and region.');
h2('Indicative component costs (UK)');
const COSTS = [
  ['Premium bespoke marketing site (~30 pages, catalogue, SEO)', '£15k – £40k'],
  ['Online booking + Stripe payments + client portal', '£20k – £50k'],
  ['Full admin CRM (operations, finance, marketing, staff & permissions, security, LMS)', '£60k – £150k+'],
  ['Legacy data migration (custom importers + health-data encryption)', '£5k – £20k'],
  ['Integrations (Stripe, Resend, Twilio, Xero, TrueLayer, CalDAV, translation)', '£10k – £30k'],
  ['Bespoke CMS / page builder (a product in its own right)', '£20k – £40k'],
];
ensure(20 + COSTS.length * 26);
{ let y = doc.y; const rowH = 26, labelW = CW - 110;
  doc.save(); doc.rect(M, y, CW, rowH).fill(C.ink); doc.restore();
  doc.font('semi').fontSize(8.5).fillColor(C.porcelain).text('COMPONENT', M + 12, y + 9, { characterSpacing: 1, width: labelW - 12 });
  doc.font('semi').fontSize(8.5).fillColor(C.goldBright).text('TYPICAL COST', M + labelW, y + 9, { characterSpacing: 1, width: 110, align: 'right' });
  y += rowH;
  COSTS.forEach((r, i) => { doc.save(); doc.rect(M, y, CW, rowH).fill(i % 2 ? C.bone : C.porcelain); doc.restore();
    doc.font('body').fontSize(9).fillColor(C.inkSoft).text(r[0], M + 12, y + 8, { width: labelW - 16 });
    doc.font('semi').fontSize(9.5).fillColor(C.gold).text(r[1], M + labelW, y + 8, { width: 110 - 12, align: 'right' }); y += rowH; });
  doc.y = y + 10; }
h2('Headline');
bullets([
  ['UK agency / studio —', 'approximately £150k – £300k for the whole platform, as a 6–12 month engagement with a small team.'],
  ['Senior solo contractor —', 'a leaner equivalent in the region of £70k – £150k.'],
  ['Off-the-shelf alternative —', 'cheaper upfront (≈£5k–£20k) by renting separate SaaS tools — but with ongoing fees, no bespoke fit and no ownership of the code or data.'],
]);
para('The lasting value is not the line items: it is owning a tailored, integrated platform — marketing, CMS, CRM, payments and migrated data in one system — rather than renting and stitching together five separate products.');
doc.moveDown(0.4);
doc.font('body').fontSize(8).fillColor(C.stone).text('Excludes ongoing costs: hosting/infrastructure (typically £50–£300/month at this scale) and maintenance/support.', M, doc.y, { width: CW, lineGap: 2 });

// ══════════════════════════════════════════════════════════════════════════════
// FILL CONTENTS PAGE
// ══════════════════════════════════════════════════════════════════════════════
doc.switchToPage(TOC_PAGE);
doc.y = M + 90;
toc.forEach((e, i) => {
  const y = doc.y; const num = String(i + 1).padStart(2, '0');
  doc.font('semi').fontSize(10).fillColor(C.gold).text(num, M, y, { width: 26 });
  doc.font('med').fontSize(11.5).fillColor(C.ink).text(e.title, M + 30, y, { width: CW - 90 });
  doc.font('body').fontSize(10).fillColor(C.stone).text(String(e.page), M + CW - 40, y, { width: 40, align: 'right' });
  const dotY = y + 13; doc.save(); doc.lineWidth(0.4).strokeColor(C.stoneSoft).dash(1, { space: 3 }).moveTo(M + 30, dotY).lineTo(M + CW - 44, dotY).stroke().undash(); doc.restore();
  doc.y = y + 22;
});

// ══════════════════════════════════════════════════════════════════════════════
// FOOTERS (every page except the cover)
// ══════════════════════════════════════════════════════════════════════════════
for (let i = 1; i <= pageIndex; i++) {
  doc.switchToPage(i);
  const y = H - 34;
  doc.save(); doc.lineWidth(0.5).strokeColor(C.sand).moveTo(M, y).lineTo(W - M, y).stroke(); doc.restore();
  doc.font('body').fontSize(7.5).fillColor(C.stone).text('KClinics · Platform Guide & Build Dossier', M, y + 7, { width: CW * 0.6 });
  doc.font('semi').fontSize(7.5).fillColor(C.stone).text(String(i), W - M - 40, y + 7, { width: 40, align: 'right' });
}

doc.end();
stream.on('finish', () => console.log('✓ Wrote', OUT, '(' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB,', pageIndex + 1, 'pages)'));
