// Generates the KClinics Google Workspace Email Migration Guide (brand-styled PDF).
//   node scripts/build-workspace-guide.mjs
//
// A no-data-loss, lowest-cost runbook to move every @kclinics.co.uk mailbox from
// Hostinger to Google Workspace, convert role addresses to free aliases/groups,
// and manage Workspace from /admin (BLD-312). Mirrors the house pdfkit pattern in
// scripts/build-golive-guide.mjs. The prose source of truth is
// docs/GOOGLE_WORKSPACE_MIGRATION.md — keep the two in step.
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'KClinics-Workspace-Migration-Guide.pdf');
const photo = (f) => path.join(ROOT, 'public', 'treatments', f);
const geist = (f) => path.join(ROOT, 'node_modules', 'geist', 'dist', 'fonts', 'geist-sans', f);
const fraunces = (f) => path.join(ROOT, 'assets', 'fonts', f);

// ── Brand palette (lib/theme.ts) ─────────────────────────────────────────────
const C = {
  ink: '#2a2420', inkSoft: '#3d352f', espresso: '#4a3f37', porcelain: '#f6ece3',
  bone: '#efe3d7', sand: '#e3d3c4', stone: '#91766e', stoneSoft: '#b7a294',
  gold: '#a98a6d', goldSoft: '#c2a589', goldBright: '#dcc4a8', goldDeep: '#856a4a', jade: '#7b6a5d', blush: '#cdb4a3', white: '#ffffff',
  paper2: '#ece1d3',
};

// ── Logo vectors (read live from components/brand/marks.tsx) ──────────────────
const marks = fs.readFileSync(path.join(ROOT, 'components/brand/marks.tsx'), 'utf8');
const K_PATH = (marks.match(/const K_PATH =\s*'([^']+)'/) || [])[1];
const WORD_PATHS = [...marks.slice(marks.indexOf('function ClinicsWordmark')).matchAll(/d="([^"]+)"/g)].map((m) => m[1]);

// ── Geometry & document ───────────────────────────────────────────────────────
const W = 595.28, H = 841.89, M = 56, CW = W - M * 2, TOP = 94, BOT = 70;
const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: 'KClinics — Google Workspace Email Migration Guide', Author: 'KClinics' } });
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
// 'Courier' is a built-in PDF font — used for code/record blocks (ASCII only).

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
  doc.font('body').fontSize(7.5).fillColor(C.stone).text('KClinics · Google Workspace Email Migration Guide', M, H - 37, { width: CW * 0.7 });
  doc.font('semi').fontSize(7.5).fillColor(C.stone).text(String(i), W - M - 40, H - 37, { width: 40, align: 'right' });
  doc.restore();
}
function newPage(withHeader = true) { doc.addPage(); pageIndex++; bg(); if (withHeader) header(); doc.x = M; doc.y = TOP; }
function ensure(h) { if (doc.y + h > H - BOT) newPage(); }

// ── Block renderers ───────────────────────────────────────────────────────────
function eyebrow(t, c = C.gold) { ensure(18); doc.font('semi').fontSize(8).fillColor(c).text(t.toUpperCase(), M, doc.y, { characterSpacing: 2, width: CW }); doc.moveDown(0.4); }
function h1(t) { ensure(56); doc.font('disp').fontSize(25).fillColor(C.ink).text(t, M, doc.y, { width: CW }); const y = doc.y + 4; doc.save(); doc.rect(M, y, 44, 2.5).fill(C.gold); doc.restore(); doc.y = y + 15; }
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
  const accent = label.toLowerCase().includes('warn') || label.toLowerCase().includes('important') || label.toLowerCase().includes('security') ? C.blush : C.gold;
  doc.save(); doc.roundedRect(M, y, CW, h, 6).fill(C.bone); doc.rect(M, y, 3, h).fill(accent); doc.restore();
  doc.font('semi').fontSize(7.5).fillColor(accent === C.blush ? C.goldDeep : C.gold).text(label.toUpperCase(), M + 14, y + 11, { characterSpacing: 1.5 });
  doc.font('body').fontSize(9).fillColor(C.inkSoft).text(text, M + 14, y + 23, { width: inner, lineGap: 2.5 });
  doc.y = y + h + 8;
}
// Left-aligned table (first column emphasised) — suits prose-heavy columns better
// than the go-live guide's value-table; same brand header + zebra rows.
function table(headers, rows, widths) {
  const tot = widths.reduce((a, b) => a + b, 0);
  const colW = (i) => (widths[i] / tot) * CW - 14;
  const rowHeights = rows.map((r) => Math.max(20, ...r.map((cell, i) => { doc.font(i === 0 ? 'semi' : 'body').fontSize(8.4); return doc.heightOfString(String(cell), { width: colW(i) }) + 12; })));
  const headH = 22;
  ensure(headH + 6 + (rowHeights[0] || 20));
  let y = doc.y;
  doc.save(); doc.rect(M, y, CW, headH).fill(C.ink); doc.restore();
  let cx = M;
  headers.forEach((hd, i) => { doc.font('semi').fontSize(7.5).fillColor(i === 0 ? C.goldBright : C.porcelain).text(hd.toUpperCase(), cx + 9, y + 7.5, { width: colW(i), characterSpacing: 0.6 }); cx += (widths[i] / tot) * CW; });
  y += headH;
  rows.forEach((r, ri) => {
    const rh = rowHeights[ri];
    if (y + rh > H - BOT) { doc.y = y; newPage(); y = doc.y; }
    doc.save(); doc.rect(M, y, CW, rh).fill(ri % 2 ? C.bone : C.porcelain); doc.restore();
    cx = M;
    r.forEach((cell, i) => { doc.font(i === 0 ? 'semi' : 'body').fontSize(8.4).fillColor(i === 0 ? C.ink : C.inkSoft).text(String(cell), cx + 9, y + 6, { width: colW(i) }); cx += (widths[i] / tot) * CW; });
    y += rh;
  });
  doc.y = y + 9;
}
// Monospace block for DNS records, zone files and code signatures. ASCII only —
// the built-in Courier font has no glyphs for arrows/dashes, so use -> and <-.
function code(text, accent = C.stoneSoft) {
  doc.font('Courier').fontSize(8.2); const inner = CW - 26;
  const h = doc.heightOfString(text, { width: inner, lineGap: 2 }) + 20; ensure(h + 6);
  const y = doc.y;
  doc.save(); doc.roundedRect(M, y, CW, h, 5).fill(C.paper2); doc.rect(M, y, 3, h).fill(accent); doc.restore();
  doc.font('Courier').fontSize(8.2).fillColor(C.espresso).text(text, M + 14, y + 10, { width: inner, lineGap: 2 });
  doc.y = y + h + 8;
}
// Tick-box list for the runbook + test-matrix appendices.
function checklist(items) {
  for (const it of items) {
    doc.font('body').fontSize(9.4);
    ensure(Math.max(15, doc.heightOfString(it, { width: CW - 18, lineGap: 2.4 }) + 4));
    const y = doc.y;
    doc.save(); doc.lineWidth(1).roundedRect(M + 2, y + 1.5, 8, 8, 1.5).stroke(C.stone); doc.restore();
    doc.font('body').fontSize(9.4).fillColor(C.espresso).text(it, M + 18, y, { width: CW - 18, lineGap: 2.4 });
    doc.moveDown(0.28);
  }
  doc.moveDown(0.15);
}
// Clickable resource link — "label" then the URL in gold, hyperlinked.
function link(label, url) {
  ensure(16); const y = doc.y;
  doc.save(); doc.circle(M + 4.5, y + 5.2, 1.8).fill(C.goldSoft); doc.restore();
  doc.font('semi').fontSize(9).fillColor(C.ink).text(label + '  ', M + 15, y, { continued: true, width: CW - 15, lineGap: 2.4 });
  doc.font('body').fillColor(C.goldDeep).text(url, { link: url, underline: true, lineGap: 2.4 });
  doc.fillColor(C.espresso); doc.moveDown(0.35);
}
// Honest schematic of the screen you'll see (NOT a real screenshot).
function mock(title, rows) {
  const rowH = 19, pad = 12, headH = 24;
  const h = headH + pad + rows.length * rowH + pad;
  ensure(h + 10);
  const y = doc.y;
  doc.save();
  doc.roundedRect(M, y, CW, h, 7).fill(C.white);
  doc.roundedRect(M, y, CW, h, 7).lineWidth(0.8).stroke(C.sand);
  doc.roundedRect(M, y, CW, headH, 7).fill(C.ink); doc.rect(M, y + headH - 7, CW, 7).fill(C.ink);
  doc.circle(M + 14, y + 12, 2.4).fill(C.goldSoft); doc.circle(M + 23, y + 12, 2.4).fill(C.stoneSoft); doc.circle(M + 32, y + 12, 2.4).fill(C.stoneSoft);
  doc.font('semi').fontSize(8).fillColor(C.porcelain).text(title, M + 44, y + 8, { width: CW - 56 });
  doc.restore();
  let ry = y + headH + pad - 4;
  rows.forEach((r) => {
    const [lab, val, action] = Array.isArray(r) ? r : [r, '', ''];
    doc.font('body').fontSize(7.8).fillColor(C.stone).text(lab, M + 14, ry + 3, { width: CW * 0.34 });
    doc.save(); doc.roundedRect(M + CW * 0.36, ry, CW * (action ? 0.4 : 0.58), 14, 3).fill(C.porcelain); doc.restore();
    doc.font('med').fontSize(7.8).fillColor(C.inkSoft).text(val, M + CW * 0.36 + 7, ry + 3, { width: CW * (action ? 0.4 : 0.58) - 12 });
    if (action) { doc.save(); doc.roundedRect(M + CW * 0.78, ry, CW * 0.18, 14, 7).fill(C.goldDeep); doc.restore(); doc.font('semi').fontSize(7.4).fillColor(C.white).text(action, M + CW * 0.78, ry + 3.2, { width: CW * 0.18, align: 'center' }); }
    ry += rowH;
  });
  doc.y = y + h + 9;
}
function drawPath(d, x, y, scale, color) { doc.save(); doc.translate(x, y); doc.scale(scale); doc.path(d).fill(color); doc.restore(); }
const kmark = (x, y, hgt, color) => drawPath(K_PATH, x, y, hgt / 234, color);
function wordmark(x, y, width, color) { const s = width / 531; doc.save(); doc.translate(x, y); doc.scale(s); for (const d of WORD_PATHS) doc.path(d).fill(color); doc.restore(); }
function section(title, intro, eyebrowText) { secNo++; currentSection = title; newPage(); toc.push({ title, page: pageIndex }); eyebrow(eyebrowText || `${String(secNo).padStart(2, '0')} · Part`); h1(title); if (intro) p(intro); }
function render(blocks) {
  for (const b of blocks) {
    if (b.h2) h2(b.h2); else if (b.h3) h3(b.h3); else if (b.p) p(b.p);
    else if (b.ul) ul(b.ul); else if (b.steps) steps(b.steps); else if (b.tip) tip(b.tip, b.label);
    else if (b.table) table(b.table[0], b.table[1], b.table[2]);
    else if (b.code) code(b.code); else if (b.checklist) checklist(b.checklist);
    else if (b.link) link(b.link[0], b.link[1]); else if (b.mock) mock(b.mock[0], b.mock[1]);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// COVER
// ══════════════════════════════════════════════════════════════════════════════
bg(C.ink);
try { doc.image(photo('KClinic-39.jpg'), 0, 0, { cover: [W, H * 0.58], align: 'center', valign: 'center' }); } catch { /* */ }
doc.save(); doc.rect(0, H * 0.5, W, H * 0.5).fill(C.ink); doc.restore();
doc.save(); doc.rect(0, H * 0.5 - 3, W, 3).fill(C.gold); doc.restore();
kmark(M, H * 0.6, 56, C.goldSoft);
wordmark(M + 42, H * 0.6 + 21, 150, C.porcelain);
doc.font('dispSemi').fontSize(40).fillColor(C.porcelain).text('Email Migration', M, H * 0.68, { width: CW });
doc.font('dispItalic').fontSize(34).fillColor(C.goldSoft).text('to Google Workspace', { width: CW });
doc.font('body').fontSize(11).fillColor(C.stoneSoft).text('Move every kclinics.co.uk mailbox off Hostinger with no lost email, at the lowest sustainable cost — turning role addresses into free aliases and groups — and end up managing every Workspace account from the admin dashboard.', M, H * 0.82, { width: CW - 64, lineGap: 3.5 });
doc.font('semi').fontSize(8).fillColor(C.gold).text('FOR THE OWNER & DEVELOPER · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), M, H - 54, { characterSpacing: 1.5 });

// CONTENTS (reserve a page, filled at the end)
newPage(false); const TOC_PAGE = pageIndex;
doc.x = M; doc.y = TOP; eyebrow('Contents'); h1('What’s inside');
doc.font('body').fontSize(9).fillColor(C.stone).text('Parts 1 to 5 are the decisions and prep. Parts 6 to 11 are the migration itself, written click-by-click. Part 16 is the developer spec for managing Workspace from /admin (BLD-312). The appendices are tick-box runbooks to print.', M, doc.y, { width: CW, lineGap: 2.6 });
const TOC_START_Y = doc.y + 18;

// ══════════════════════════════════════════════════════════════════════════════
// 01 — HOW TO USE THIS GUIDE
// ══════════════════════════════════════════════════════════════════════════════
section('How to use this guide', 'This guide moves every company mailbox at kclinics.co.uk from Hostinger to Google Workspace without losing a single email, for the lowest ongoing cost, and sets you up to manage all Workspace accounts from your own admin dashboard. You do not need to be technical to follow the owner steps.');
render([
  { h2: 'The golden rule' },
  { tip: 'Your old Hostinger mailboxes stay switched on and untouched until the very end. Every step here COPIES mail into Google; nothing is moved or deleted at the source until you have checked the copy. If anything looks wrong, you roll back by pointing one DNS record back at Hostinger.', label: 'Important' },
  { h2: 'Two audiences, one document' },
  { ul: [
    ['Owner / manager —', 'Parts 1 to 9 and 11 to 20, plus the appendices: numbered, plain-English steps.'],
    ['Developer —', 'Part 16 is the build spec for managing Workspace from /admin, tracked on the Build board as BLD-312.'],
  ] },
  { h2: 'Roughly how long' },
  { p: 'A quiet evening for Phases 1 to 4, the cutover on a low-traffic morning, then a one-to-two-week safety window before you close anything at Hostinger. You can stop and resume at any point up to the cutover.' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 02 — WHERE YOU ARE TODAY
// ══════════════════════════════════════════════════════════════════════════════
section('Where you are today', 'Two facts about the current setup decide the whole migration. Read this before touching anything.');
render([
  { table: [['Thing', 'Today', 'Where it lives'], [
    ['Staff mailboxes (the inboxes people log into)', 'Hostinger webmail', 'Hostinger'],
    ['Shared clinic calendar', 'Hostinger (CalDAV)', 'Hostinger'],
    ['App email: confirmations, reminders, campaigns', 'Resend', 'mail.kclinics.co.uk'],
    ['Chat replies / inbound routing', 'Resend Inbound', 'reply.mail.kclinics.co.uk'],
    ['Website', 'Vercel', 'apex A / CNAME'],
    ['DNS records', 'Cloudflare', 'where Resend / Turnstile records live'],
    ['Domain registrar', 'Hostinger', '—'],
  ], [40, 30, 30]] },
  { h2: 'The two facts that make this safe' },
  { ul: [
    ['Resend uses subdomains, not the apex —', 'it sends and receives on mail. and reply.mail., which carry their own mail (MX) records. Pointing the bare kclinics.co.uk at Google does not touch Resend, so the platform keeps sending and receiving exactly as before.'],
    ['The app already replies to apex addresses —', 'EMAIL_REPLY_TO is hello@kclinics.co.uk and CLINIC_NOTIFY_EMAIL is frontdesk@kclinics.co.uk. The moment those addresses live in Workspace, customer replies and booking alerts land in Gmail with no code or settings change.'],
  ] },
  { tip: 'Check who actually controls DNS before you start. The records are in Cloudflare, but the domain is registered at Hostinger. Look up the nameservers (whatsmydns.net, or run "dig NS kclinics.co.uk"). If they say *.ns.cloudflare.com, make every DNS change in Cloudflare; if they point at Hostinger, make them there. Everywhere below that says "in your DNS provider" means this one.', label: 'Important' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 03 — THE COST MODEL
// ══════════════════════════════════════════════════════════════════════════════
section('The cost model — pay the least', 'Google Workspace bills per user mailbox (a "seat"). Almost everything else is free. The whole strategy: buy a seat only for a real person who must log in and send as themselves; turn every other address into a free alias or group.');
render([
  { h2: 'The three ways to hold an address (only one costs money)' },
  { table: [['Mechanism', 'Cost', 'Use it for'], [
    ['User (seat)', 'Paid, per month', 'A real human who logs in, sends and stores mail'],
    ['Alias on a user', 'Free (up to 30)', 'A second name for one person — mail lands in their Gmail'],
    ['Group (Collaborative Inbox)', 'Free', 'A shared role address several people answer'],
  ], [30, 22, 48]] },
  { p: 'One person owns a role address -> make it an ALIAS. Several people share it -> make it a GROUP. Neither costs a seat. This single decision is where the savings are.' },
  { h2: 'Pick the cheapest edition that fits' },
  { table: [['Edition (approx UK, early 2026)', 'Storage', 'Choose it when'], [
    ['Business Starter ~£5–6 /user/mo', '30 GB', 'Default. Plenty for a clinic inbox. Pick this unless forced up.'],
    ['Business Standard ~£10–12 /user/mo', '2 TB', 'You need Vault retention, Meet recording, or UK/EU data region'],
    ['Business Plus ~£18 /user/mo', '5 TB', 'Heavier compliance / storage only'],
  ], [42, 16, 42]] },
  { tip: 'Confirm live prices at workspace.google.com/pricing before committing — editions and the bundled Gemini AI changed in 2025.', label: 'Tip' },
  { h2: 'Cost notes that move the bill' },
  { ul: [
    ['Flexible vs Annual —', 'Flexible = pay monthly, change seats anytime, slightly dearer. Annual = about 20% cheaper but you commit a seat count for a year. Start on Flexible through the migration; move the stable core seats to Annual once headcount settles.'],
    ['Mix editions —', 'Starter for most staff, Standard only for the one mailbox that needs Vault. Buy the expensive tier only where it is required.'],
    ['Suspended is not free —', 'a suspended user keeps all their mail but may still consume a paid licence. To actually stop paying for a seat you remove its licence or delete the account, and only after its mail is exported (Part 19).'],
    ['Free trial —', '14 days. Do the whole test migration inside it before any card is charged.'],
  ] },
  { h2: 'Inventory — fill this in before you buy anything' },
  { p: 'List every address that exists or forwards at Hostinger and mark each one. Seats are the only column you pay for.' },
  { table: [['Address', 'Decision', 'Why'], [
    ['hello@', 'Group', 'shared, customer-facing; app replies-to here'],
    ['frontdesk@', 'Group', 'shared; app booking alerts land here'],
    ['info@ / support@', 'Group, or alias of hello@', 'shared / duplicate of hello'],
    ['inna.k@ (a real person)', 'Seat', 'a human who sends as herself'],
    ['owner@ / joe@', 'Seat (super-admin)', 'runs the account'],
    ['each clinician', 'Seat', 'sends as themselves'],
    ['departed staff', 'Alias/forward, then archive', 'do not pay for a leaver'],
    ['chat@mail. / replies@reply.mail.', 'Leave alone', 'these belong to Resend, not Workspace'],
  ], [34, 34, 32]] },
  { tip: 'Illustrative maths: say 6 real staff need to send as themselves and there are 6 role addresses. Lowest cost = 6 seats, with all 6 role addresses free as groups/aliases. The naive "a seat per address" way is 12 seats — double the bill, forever. Replace the numbers with your real headcount.', label: 'Tip' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 04 — THE PLAN AT A GLANCE
// ══════════════════════════════════════════════════════════════════════════════
section('The plan at a glance', 'Seven phases. Only Phase 5 changes where new mail goes; everything before it is invisible to live mail.');
render([
  { code:
'Phase 1  Sign up + verify the domain (TXT only)        -> no effect on live mail\n' +
'Phase 2  Create seats, groups and aliases              -> no effect on live mail\n' +
'Phase 3  Pre-copy ALL old mail in (Data Migration Svc) -> reads Hostinger, copies to Google\n' +
'Phase 4  Turn on Google sending auth (SPF/DKIM/DMARC)  -> does NOT touch Resend\n' +
'Phase 5  Cutover: point the APEX mailbox (MX) at Google-> new mail now lands in Gmail\n' +
'Phase 6  Delta re-copy + verify                        -> catch mail that arrived mid-switch\n' +
'Phase 7  Grace period, then decommission Hostinger     -> only after everything verified' },
  { p: 'Realistic timeline: a quiet evening for Phases 1 to 4, the cutover on a low-traffic morning, then a one-to-two-week grace period before decommissioning.' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 05 — PRE-FLIGHT CHECKLIST
// ══════════════════════════════════════════════════════════════════════════════
section('Pre-flight checklist', 'Gather these once and the rest goes quickly. Most are things you already have as a business owner.');
render([
  { checklist: [
    'A password manager ready (you will create several strong passwords).',
    'Admin access to the DNS provider (Part 2 — Cloudflare or Hostinger) and to the Hostinger email control panel.',
    'The Part 3 inventory completed and agreed.',
    'For each mailbox you are migrating: its IMAP login — server host, username (the full email) and password (or an app password if the mailbox has 2FA). Hostinger IMAP is typically imap.hostinger.com, port 993, SSL.',
    'A maintenance window chosen for the cutover (early morning is calmest).',
    'Staff told: "On <date> your email moves to Gmail. Keep using the old webmail until then; we will send your new login."',
  ] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 06 — PHASE 1
// ══════════════════════════════════════════════════════════════════════════════
section('Phase 1 — Sign up and prove you own the domain', 'Safe: no mail moves. You create the account and add one TXT record.');
render([
  { steps: [
    'Go to workspace.google.com and click "Get started". Enter the business name, number of staff and country (United Kingdom).',
    'When asked "Does your business have a domain?", choose "Yes, I have one" and type kclinics.co.uk.',
    'Create the first admin account — this is your master login and super-admin (e.g. owner@kclinics.co.uk). Use a strong password and turn on 2-Step Verification immediately.',
    'Choose Business Starter and the Flexible plan. Do not add extra seats yet. The 14-day trial means no charge during setup.',
    'Google gives you a TXT record to verify the domain. In your DNS provider add it: Type TXT, Name @, Content = the google-site-verification=... value Google shows, then Save.',
    'Back in Google, click Verify. This only proves ownership — it does not change where email goes. Live mail is still flowing to Hostinger.',
  ] },
  { link: ['Verify your domain', 'https://support.google.com/a/answer/60216'] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 07 — PHASE 2
// ══════════════════════════════════════════════════════════════════════════════
section('Phase 2 — Create seats, groups and aliases', 'Still no mail moved. All of this is in the Google Admin console at admin.google.com.');
render([
  { h3: 'Seats (real people)' },
  { steps: [
    'Directory -> Users -> Add new user.',
    'Enter their name and primary email (e.g. inna.k@kclinics.co.uk) — match the existing address exactly so their migrated mail history lines up.',
    'Save, and give them the auto-generated password to change on first login.',
  ] },
  { mock: ['Google Admin · Add a user', [['First / last name', 'Inna  K', ''], ['Primary email', 'inna.k @ kclinics.co.uk', ''], ['', 'Add new user', 'Create']]] },
  { h3: 'Aliases (free second names for one person)' },
  { steps: [
    'Directory -> Users, click the person.',
    'User information -> Email aliases -> Add an alias (e.g. add inna@ as an alias of inna.k@). Mail to the alias lands in their Gmail; they can "Send mail as" it.',
  ] },
  { h3: 'Groups (free shared inboxes)' },
  { steps: [
    'Directory -> Groups -> Create group. Name it (e.g. "Front Desk") and set the group email to the role address (hello@kclinics.co.uk).',
    'Add the staff who should answer it as members.',
    'Open the group -> Settings: set "Who can post" to Anyone on the web (so customers can email it) and enable Collaborative Inbox so staff can assign and resolve messages.',
  ] },
  { link: ['Add users', 'https://support.google.com/a/answer/33310'] },
  { link: ['Add email aliases', 'https://support.google.com/a/answer/33327'] },
  { link: ['Create a group + Collaborative Inbox', 'https://support.google.com/a/answer/167430'] },
  { tip: 'Do not recreate chat@mail... or replies@reply.mail... — those belong to Resend and must stay exactly where they are (Part 13).', label: 'Important' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 08 — PHASE 3
// ══════════════════════════════════════════════════════════════════════════════
section('Phase 3 — Pre-copy all existing mail in', 'Google\'s free, built-in Data Migration Service (DMS) copies mail over IMAP. It reads from Hostinger and writes to Gmail, and never deletes or changes anything on Hostinger. Run it now, before cutover, so the bulk is already in Gmail when you flip the switch.');
render([
  { steps: [
    'Admin console -> Account -> Data migration (or Apps -> Data migration).',
    'Migration source: choose "Other IMAP server" (Hostinger is generic IMAP).',
    'Connection protocol IMAP; server imap.hostinger.com (confirm in the Hostinger panel), with the role/admin mailbox credentials.',
    'Migration start date: choose "migrate everything" (no start date) for a full history copy.',
    'Select users: map each source Hostinger mailbox to its destination Workspace user from Phase 2, using each mailbox\'s IMAP password (or app password).',
    'Start the migration and let it run. Large mailboxes take hours — that is fine, nothing is offline.',
  ] },
  { link: ['Migrate email with the Data Migration Service', 'https://support.google.com/a/answer/6167866'] },
  { link: ['IMAP migration specifics', 'https://support.google.com/a/answer/7044263'] },
  { h2: 'What IMAP migration does not carry' },
  { ul: [
    ['Contacts —', 'in Hostinger webmail export contacts to CSV, then Google Contacts -> Import.'],
    ['Calendar —', 'export any Hostinger calendar to .ics and import it in Google Calendar (Settings -> Import & export). The shared clinic calendar is created fresh in Workspace; re-share it with staff (Part 15).'],
  ] },
  { tip: 'For up to ~100 mailboxes DMS is the right tool. (Google Workspace Migrate, the heavyweight alternative, needs a Windows server and is overkill for a clinic.)', label: 'Tip' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 09 — PHASE 4
// ══════════════════════════════════════════════════════════════════════════════
section('Phase 4 — Turn on Google’s sending authentication', 'This makes mail sent from Gmail as @kclinics.co.uk pass spam checks. Resend\'s own SPF/DKIM live on the mail. subdomain and are left exactly as they are.');
render([
  { h3: 'SPF (apex)' },
  { p: 'In your DNS provider find any existing apex TXT that starts v=spf1 (Hostinger may have added one) and replace its value with the line below. There must be only ONE SPF record on the apex. Resend\'s SPF is a separate record on mail.kclinics.co.uk — do not merge or remove it.' },
  { code: 'v=spf1 include:_spf.google.com ~all' },
  { h3: 'DKIM (apex)' },
  { steps: [
    'Admin console -> Apps -> Google Workspace -> Gmail -> Authenticate email.',
    'Generate new record (2048-bit). Google gives a TXT for host google._domainkey.',
    'Add that TXT in your DNS provider, then come back and click "Start authentication".',
  ] },
  { h3: 'DMARC (apex)' },
  { p: 'Add a TXT at host _dmarc (skip if one already exists — tighten it instead). Start gentle so nothing is rejected mid-migration, then after a clean week raise p=none to quarantine, then reject.' },
  { code: 'v=DMARC1; p=none; rua=mailto:postmaster@kclinics.co.uk; fo=1' },
  { link: ['Set up DKIM', 'https://support.google.com/a/answer/174124'] },
  { link: ['Add a DMARC record', 'https://support.google.com/a/answer/2466580'] },
  { tip: 'Relaxed alignment (the default) means Resend\'s subdomain mail keeps passing DMARC, so tightening the policy does not break the platform\'s email.', label: 'Tip' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 10 — PHASE 5
// ══════════════════════════════════════════════════════════════════════════════
section('Phase 5 — Cutover: point the apex at Google', 'The only step that changes where new mail for @kclinics.co.uk lands.');
render([
  { steps: [
    'The day before, in your DNS provider lower the TTL on the apex MX record(s) to 300 seconds (5 min). This makes rollback fast.',
    'On the morning of cutover, remove the old Hostinger apex MX records and add Google\'s single MX record below.',
    'Do NOT change the mail. or reply.mail. records (Part 13) — they are different hostnames with their own MX and are unaffected.',
    'Wait for propagation (usually minutes with the lowered TTL; allow up to an hour). Send a test from an outside account to hello@kclinics.co.uk and confirm it arrives in the Workspace Group.',
  ] },
  { table: [['Type', 'Name', 'Mail server', 'Priority'], [
    ['MX', '@ (apex)', 'smtp.google.com', '1'],
  ], [16, 20, 46, 18]] },
  { p: 'If your panel insists on the legacy set, use Google\'s five ASPMX records instead (the Admin console shows them). Either works; do not mix.' },
  { link: ['Set up MX records for Gmail', 'https://support.google.com/a/answer/140034'] },
  { tip: 'Belt-and-braces (optional): in the Hostinger panel set each old mailbox to also forward a copy to its new address during the switch. Combined with the Phase 6 delta copy, this guarantees zero gap.', label: 'Tip' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 11 — PHASE 6 & 7
// ══════════════════════════════════════════════════════════════════════════════
section('Phase 6 & 7 — Delta copy, verify, grace period', 'Catch anything that arrived mid-switch, verify, then keep Hostinger as a safety net.');
render([
  { steps: [
    'Re-run the Data Migration Service for each mailbox (same setup as Phase 3). DMS pulls only what is new, sweeping up anything that hit Hostinger between the first copy and the MX cutover. Nothing is duplicated.',
    'Verify against the test matrix in Appendix B before declaring done.',
    'Keep the Hostinger mailboxes live and paid for one to two weeks after cutover as a safety net (and so any straggler mail or forward still resolves).',
    'Only once Appendix B passes and staff confirm nothing is missing do you move to decommission (Part 19).',
  ] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 12 — ALIASES & GROUPS PLAYBOOK
// ══════════════════════════════════════════════════════════════════════════════
section('Aliases and groups playbook', 'The money-saver, in detail. For each role/shared address, decide and apply one of these. All three cost nothing ongoing.');
render([
  { h3: 'Becomes an ALIAS when one person owns it' },
  { p: 'Admin console -> Directory -> Users -> [person] -> Email aliases -> Add an alias. Their Gmail now also receives anything sent to the alias, and they can "Send mail as" it (Gmail -> Settings -> Accounts -> "Send mail as"). Cost: nil.' },
  { h3: 'Becomes a GROUP when several people share it' },
  { p: 'Admin console -> Directory -> Groups -> Create group with the role address, add the team as members, enable Collaborative Inbox. Everyone sees it, can claim, reply and mark resolved. Cost: nil.' },
  { h3: 'Becomes a forward, then nothing, for a leaver or dead address' },
  { p: 'Make it an alias/forward to the relevant manager so nothing bounces, archive the old mailbox\'s contents to that manager (Part 19), then drop the source seat. Cost: nil ongoing.' },
  { tip: 'Keep the per-person alias count under 30. If a single inbox needs more than 30 names, that is a sign it should be a Group instead.', label: 'Tip' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 13 — KEEP RESEND & THE SITE WORKING
// ══════════════════════════════════════════════════════════════════════════════
section('Keep Resend and the website working', 'The rule is simple: only the apex\'s mail (MX), SPF, DKIM and DMARC change. Everything on the mail. and reply.mail. subdomains is left alone.');
render([
  { h3: 'Do not touch — these belong to Resend / Vercel' },
  { table: [['Record', 'Host', 'If you break it'], [
    ['SPF (v=spf1 ... resend ...)', 'mail.kclinics.co.uk', 'App emails go to spam'],
    ['DKIM CNAME / TXT', '*._domainkey.mail.kclinics.co.uk', 'App emails fail signing'],
    ['MX + CNAME + CAA', 'reply.mail.kclinics.co.uk', 'Chat replies stop threading'],
    ['A / CNAME', '@ and www', 'Website goes down'],
  ], [30, 42, 28]] },
  { h3: 'Change / add — these are the migration (apex only)' },
  { table: [['Record', 'Host', 'Action'], [
    ['MX', '@', 'Remove Hostinger\'s; add smtp.google.com (pri 1)'],
    ['SPF TXT', '@', 'Replace apex value with v=spf1 include:_spf.google.com ~all'],
    ['DKIM TXT', 'google._domainkey', 'Add (from Admin console)'],
    ['DMARC TXT', '_dmarc', 'Add p=none, tighten later'],
    ['Verification TXT', '@', 'Temporary; remove after verifying'],
  ], [22, 30, 48]] },
  { p: 'Because mail. and reply.mail. are separate hostnames, their MX records are read independently of the apex. Google receiving on kclinics.co.uk and Resend receiving on reply.mail.kclinics.co.uk coexist with zero conflict.' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 14 — DNS REFERENCE
// ══════════════════════════════════════════════════════════════════════════════
section('DNS reference — before and after', 'The whole zone at a glance. Only the bottom block changes.');
render([
  { code:
'# Website (unchanged) ----------------------------------------------\n' +
'@        A/CNAME   -> Vercel\n' +
'www      CNAME     -> Vercel\n' +
'\n' +
'# App email via Resend (UNCHANGED -- do not edit) -----------------\n' +
'mail              TXT         v=spf1 include:resend ... ~all\n' +
'*._domainkey.mail CNAME/TXT   (Resend DKIM)\n' +
'reply.mail        MX/CNAME/CAA (Resend Inbound)\n' +
'\n' +
'# Company mailboxes via Google Workspace (THIS migration) ---------\n' +
'@                 MX    smtp.google.com (priority 1)        <- was Hostinger\n' +
'@                 TXT   v=spf1 include:_spf.google.com ~all <- replace apex SPF\n' +
'google._domainkey TXT   (Google DKIM, from Admin console)\n' +
'_dmarc            TXT   v=DMARC1; p=none; rua=mailto:postmaster@kclinics.co.uk' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 15 — WHAT CHANGES IN THE PLATFORM
// ══════════════════════════════════════════════════════════════════════════════
section('What changes in the platform', 'Almost nothing, by design.');
render([
  { table: [['Area', 'Change?', 'Detail'], [
    ['Resend sending (EMAIL_FROM)', 'No', 'Keep sending from the mail.kclinics.co.uk subdomain. Do not switch EMAIL_FROM to an apex address.'],
    ['EMAIL_REPLY_TO = hello@', 'No', 'Already an apex address; once hello@ is a Workspace Group, replies land in Gmail.'],
    ['CLINIC_NOTIFY_EMAIL = frontdesk@', 'No', 'Same — booking alerts land in the Workspace Group.'],
    ['Chat inbound (reply.mail.)', 'No', 'Stays on Resend Inbound.'],
    ['Shared calendar', 'Optional', 'Revive the parked Google Calendar sync (GOOGLE_INTEGRATION_ENABLED=true) and retire the HOSTINGER_CALDAV_* vars.'],
  ], [30, 14, 56]] },
  { p: 'Net result: the mailbox migration needs no env changes to keep the live site sending and receiving. The only optional follow-up is moving the calendar sync from Hostinger CalDAV to Google.' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 16 — MANAGE WORKSPACE FROM /ADMIN (BLD-312)
// ══════════════════════════════════════════════════════════════════════════════
section('Manage Workspace from /admin (BLD-312)', 'Goal: create/suspend users, manage aliases and groups, and see seat usage from the admin dashboard without logging into the Google Admin console. This is a build task; the spec below matches the patterns already in the codebase. (Developer-facing.)');
render([
  { h3: 'Authentication — service account + domain-wide delegation' },
  { p: 'Directory operations need a super-admin context. For a single internal tool, use a Google Cloud service account with domain-wide delegation (DWD) that impersonates a designated super-admin (e.g. admin@kclinics.co.uk). No per-request user OAuth, no interactive re-consent.' },
  { steps: [
    'In the same Google Cloud project as the existing GOOGLE_CLIENT_ID, enable the Admin SDK API.',
    'Create a service account and a JSON key.',
    'Admin console -> Security -> API controls -> Domain-wide delegation: authorise the service account client ID for the admin.directory scopes (use the .readonly variants for Phase A).',
    'Store the credentials encrypted via the existing managed-secrets pattern (setSecret -> encryptJson): GOOGLE_WORKSPACE_SA_KEY (the JSON), GOOGLE_WORKSPACE_ADMIN_EMAIL (the super-admin to impersonate), GOOGLE_WORKSPACE_CUSTOMER_ID (optional, defaults to my_customer).',
  ] },
  { h3: 'New library — lib/google-workspace.ts' },
  { p: 'Follow the hand-rolled token style already in lib/google-auth.ts (the codebase calls Google token endpoints directly with fetch rather than pulling in the googleapis SDK; jose is already a dependency for signing).' },
  { code:
'workspaceConfigured(): Promise<boolean>   // SA key + admin email present\n' +
'directoryToken(scopes): Promise<string>   // jose-signed SA JWT, sub=admin,\n' +
'                                           // exchange at oauth2.googleapis.com, cache\n' +
'listWorkspaceUsers() / getWorkspaceUser(email)\n' +
'createWorkspaceUser(input) / suspendWorkspaceUser(email) / restoreWorkspaceUser(email)\n' +
'deleteWorkspaceUser(email)                 // guard hard; only post-archive\n' +
'addUserAlias(email, alias) / removeUserAlias(email, alias)\n' +
'listGroups() / createGroup(email, name)\n' +
'addGroupMember(group, member) / removeGroupMember(group, member)' },
  { p: 'Every function returns a safe no-op when workspaceConfigured() is false, so the feature stays dormant until the key is supplied (the inert-until-credentialed pattern in INTEGRATIONS.md).' },
  { h3: 'Routes — app/api/admin/integrations/google-workspace/*' },
  { p: 'Reuse the integrations route convention. Because auth is a service account, there is no connect/callback pair; instead a "paste the service-account key + Test" form saves the secret via setSecret.' },
  { table: [['Route', 'Method', 'Purpose'], [
    ['.../test', 'GET', 'workspaceConfigured() + a user count to prove the connection'],
    ['.../users', 'GET / POST', 'list / create users'],
    ['.../users/[email]', 'PATCH / DELETE', 'suspend·restore / delete'],
    ['.../users/[email]/aliases', 'POST / DELETE', 'add / remove alias'],
    ['.../groups', 'GET / POST', 'list / create groups'],
    ['.../groups/[email]/members', 'POST / DELETE', 'add / remove member'],
  ], [40, 24, 36]] },
  { p: 'Gate every handler with sessionCan(session, "settings.manage") (or a new workspace.manage permission) and call logAudit on every write, exactly as the google-business callback does.' },
  { h3: 'UI, registration and the Staff tie-in' },
  { ul: [
    ['New page —', 'app/admin/workspace/page.tsx: a Users table (status, last login, storage, suspend/alias actions) and a Groups tab, gated on the same permission, mirroring app/admin/staff/page.tsx.'],
    ['Register —', 'a nav entry in lib/admin-nav.ts and an entry in getIntegrations() (lib/integrations.ts) so it shows on the Integrations page with a status + manageHref.'],
    ['Staff lifecycle —', 'on create of an active AdminUser with an @kclinics.co.uk email, offer "Create Workspace mailbox"; on deactivate, offer "Suspend Workspace mailbox". No schema change needed — resolve the Workspace user by AdminUser.email; add only nullable, additive fields later if you cache the link.'],
  ] },
  { h3: 'Build it in phases' },
  { ul: [
    ['Phase A — read-only —', '.readonly scopes; dashboard lists users, groups, aliases, last-login and storage. Proves the auth and powers the Part 3 seat audit.'],
    ['Phase B — provisioning —', 'write scopes; create/suspend users, manage aliases and group membership; wire into staff create/deactivate.'],
    ['Phase C — automation —', 'auto-provision on staff create, auto-suspend on deactivate, and surface seat usage vs licences so the owner can prune unused seats.'],
  ] },
  { tip: 'The service-account key can administer every account — store it only via setSecret (encrypted with encryptJson), grant least-privilege scopes (start read-only), gate the UI behind an owner-level permission, logAudit every write, and keep the impersonated admin a dedicated super-admin with 2-Step Verification.', label: 'Security' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 17 — ROLLBACK
// ══════════════════════════════════════════════════════════════════════════════
section('Rollback', 'If anything is wrong after the MX cutover, you recover in minutes because nothing at the source was deleted.');
render([
  { steps: [
    'In your DNS provider, revert the apex MX back to Hostinger\'s values (you lowered the TTL to 300s in Phase 5, so this propagates fast).',
    'New mail flows to Hostinger again; the Workspace copies you already migrated stay intact.',
    'Diagnose, fix, and re-attempt the cutover. No mail is lost either way because both sides retain their copies.',
  ] },
  { tip: 'Keep Hostinger paid until you have decided NOT to roll back (the Part 11 grace period).', label: 'Important' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 18 — SECURITY & COMPLIANCE
// ══════════════════════════════════════════════════════════════════════════════
section('Security and compliance (clinic-specific)', 'A clinic has record-keeping duties; decide these before, not after.');
render([
  { ul: [
    ['Enforce 2-Step Verification —', 'for all staff (Admin -> Security -> Authentication). Non-negotiable for a clinic.'],
    ['Retention / eDiscovery —', 'if you must retain or legally-hold email, that is Google Vault, which needs Business Standard or above. Put the owner/records mailbox on Standard and leave the rest on Starter, or use a third-party backup. Decide before, not after.'],
    ['Data region —', 'UK/EU data-region controls also require Standard or above. Note it if your DPO requires data residency.'],
    ['Leavers —', 'suspend (do not delete) on day one to preserve evidence; transfer/export, then delete after your retention window, updating the Part 3 inventory so you stop paying.'],
    ['Record it —', 'note the change in docs/COMPLIANCE_ROADMAP.md if email handling is referenced there.'],
  ] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 19 — DECOMMISSION HOSTINGER
// ══════════════════════════════════════════════════════════════════════════════
section('Decommission Hostinger', 'Only after the Part 11 grace period passes and staff confirm nothing is missing.');
render([
  { steps: [
    'Confirm Appendix B passes and staff report nothing missing.',
    'For any mailbox you are closing, do a final delta DMS run (Phase 6) so the last few days of mail are in Google.',
    'Export a local archive of each old mailbox you are not keeping (Hostinger webmail export, or one last IMAP pull) and store it with your records.',
    'Turn off any Hostinger email forwarding you set up in Phase 5.',
    'Cancel the Hostinger email/mailbox plan. KEEP the domain registration and KEEP DNS as-is — you are only stopping the mailbox service.',
    'Remove the now-unused HOSTINGER_CALDAV_* env vars if you moved the calendar to Google (Part 15).',
  ] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 20 — ONGOING COST CONTROL
// ══════════════════════════════════════════════════════════════════════════════
section('Ongoing cost control', 'Keep the bill at its floor.');
render([
  { ul: [
    ['Review seats vs licences monthly —', 'Phase C surfaces this in /admin.'],
    ['New shared address = Group or alias, never a seat —', 'make it the default question whenever anyone asks for "a new email address".'],
    ['Suspend leavers immediately —', 'delete (after archiving) at the end of the retention window so you stop paying.'],
    ['Annual for the core —', 'move stable core seats to the Annual plan once headcount is steady; keep new or seasonal staff on Flexible.'],
    ['Re-confirm pricing at renewal —', 'editions and bundled features change.'],
  ] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// APPENDIX A
// ══════════════════════════════════════════════════════════════════════════════
section('Appendix A — per-mailbox runbook', 'Repeat for each mailbox in the Part 3 inventory.', 'Appendix');
render([
  { checklist: [
    'Decision recorded (Seat / Alias / Group / Archive-and-drop).',
    'IMAP login captured (host, user, app password).',
    'Destination created in Workspace (user / alias / group).',
    'Phase 3 full copy done.',
    'Contacts CSV + calendar .ics imported (if a real person).',
    'Phase 6 delta copy done (post-cutover).',
    'Owner spot-checked: oldest mail, newest mail, a folder, an attachment.',
    '(Leaver only) archived locally, source seat dropped.',
  ] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// APPENDIX B
// ══════════════════════════════════════════════════════════════════════════════
section('Appendix B — post-cutover test matrix', 'Tick every line before you decommission Hostinger.', 'Appendix');
render([
  { checklist: [
    'External -> hello@ lands in the Workspace Group inbox.',
    'External -> frontdesk@ lands in the Group; app booking alert visible.',
    'External -> a person\'s seat (e.g. inna.k@) lands in their Gmail.',
    'Reply from Gmail "as" hello@ shows the right From address.',
    'Book a test appointment -> confirmation email still sends (Resend).',
    'Reply to a booking email -> lands at hello@ in Workspace.',
    'Live-chat email reply -> still threads (reply.mail. on Resend, untouched).',
    'Old mail present: oldest message, newest message, a folder, an attachment.',
    'DKIM/SPF/DMARC pass (send to mail-tester.com — aim 10/10).',
    'mxtoolbox.com shows apex MX = smtp.google.com; mail. records unchanged.',
  ] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// APPENDIX C
// ══════════════════════════════════════════════════════════════════════════════
section('Appendix C — official references', 'Google\'s own help articles, kept current with live screenshots.', 'Appendix');
render([
  { link: ['Workspace setup overview', 'https://support.google.com/a/answer/53926'] },
  { link: ['Verify your domain', 'https://support.google.com/a/answer/60216'] },
  { link: ['Set up Gmail MX records', 'https://support.google.com/a/answer/140034'] },
  { link: ['Add users', 'https://support.google.com/a/answer/33310'] },
  { link: ['Email aliases', 'https://support.google.com/a/answer/33327'] },
  { link: ['Groups + Collaborative Inbox', 'https://support.google.com/a/answer/167430'] },
  { link: ['Data Migration Service', 'https://support.google.com/a/answer/6167866'] },
  { link: ['IMAP migration', 'https://support.google.com/a/answer/7044263'] },
  { link: ['Set up DKIM', 'https://support.google.com/a/answer/174124'] },
  { link: ['Add a DMARC record', 'https://support.google.com/a/answer/2466580'] },
  { link: ['Admin SDK Directory API', 'https://developers.google.com/admin-sdk/directory'] },
  { link: ['Domain-wide delegation', 'https://developers.google.com/identity/protocols/oauth2/service-account'] },
  { link: ['Workspace pricing', 'https://workspace.google.com/pricing'] },
]);

// ── FILL CONTENTS ──
doc.switchToPage(TOC_PAGE);
doc.y = TOC_START_Y;
const rowH = toc.length > 24 ? 16 : 19;
toc.forEach((e, i) => {
  const y = doc.y; const num = String(i + 1).padStart(2, '0');
  doc.font('semi').fontSize(9).fillColor(C.gold).text(num, M, y + 1, { width: 22 });
  doc.font('med').fontSize(10).fillColor(C.ink).text(e.title, M + 26, y, { width: CW - 76 });
  doc.font('body').fontSize(9).fillColor(C.stone).text(String(e.page), M + CW - 34, y + 1, { width: 34, align: 'right' });
  const dy = y + 12; doc.save(); doc.lineWidth(0.4).strokeColor(C.stoneSoft).dash(1, { space: 3 }).moveTo(M + 26, dy).lineTo(M + CW - 40, dy).stroke().undash(); doc.restore();
  doc.y = y + rowH;
});

// FOOTERS
for (let i = 1; i <= pageIndex; i++) { doc.switchToPage(i); footer(i); }

doc.end();
out.on('finish', () => console.log('✓ Wrote', OUT, '(' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB,', pageIndex + 1, 'pages)'));
