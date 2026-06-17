// Generates the KClinics "Access & Permissions Request" PDF — an owner-facing
// handover doc the developer (webmaster@kclinics.co.uk) sends to the clinic owner
// listing exactly what access/roles are needed, in which accounts, to finish the
// Google Workspace email migration and switch on in-dashboard account management
// (BLD-312). Plain-English, least-privilege, revoke-after-go-live.
//   node scripts/build-access-request-guide.mjs
//
// Self-contained pdfkit generator, matching the house pattern of
// scripts/build-golive-guide.mjs and scripts/build-workspace-guide.mjs. (A shared
// kit could de-dupe the three engines later; kept inline to match convention and
// avoid touching the already-shipped guides.)
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'KClinics-Access-Request.pdf');
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
const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: 'KClinics — Access & Permissions Request', Author: 'KClinics' } });
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
  doc.font('body').fontSize(7.5).fillColor(C.stone).text('KClinics · Access & Permissions Request', M, H - 37, { width: CW * 0.7 });
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
// Left-aligned table (first column emphasised) — suits prose-heavy columns.
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
// Tick-box list for the owner checklist + revoke list.
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
// Clickable resource link.
function link(label, url) {
  ensure(16); const y = doc.y;
  doc.save(); doc.circle(M + 4.5, y + 5.2, 1.8).fill(C.goldSoft); doc.restore();
  doc.font('semi').fontSize(9).fillColor(C.ink).text(label + '  ', M + 15, y, { continued: true, width: CW - 15, lineGap: 2.4 });
  doc.font('body').fillColor(C.goldDeep).text(url, { link: url, underline: true, lineGap: 2.4 });
  doc.fillColor(C.espresso); doc.moveDown(0.35);
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
    else if (b.checklist) checklist(b.checklist); else if (b.link) link(b.link[0], b.link[1]);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// COVER
// ══════════════════════════════════════════════════════════════════════════════
bg(C.ink);
try { doc.image(photo('KClinic-40.jpg'), 0, 0, { cover: [W, H * 0.58], align: 'center', valign: 'center' }); } catch { /* */ }
doc.save(); doc.rect(0, H * 0.5, W, H * 0.5).fill(C.ink); doc.restore();
doc.save(); doc.rect(0, H * 0.5 - 3, W, 3).fill(C.gold); doc.restore();
kmark(M, H * 0.6, 56, C.goldSoft);
wordmark(M + 42, H * 0.6 + 21, 150, C.porcelain);
doc.font('dispSemi').fontSize(38).fillColor(C.porcelain).text('Access & Permissions', M, H * 0.68, { width: CW });
doc.font('dispItalic').fontSize(29).fillColor(C.goldSoft).text('what I need to finish your setup', { width: CW });
doc.font('body').fontSize(11).fillColor(C.stoneSoft).text('To finish moving kclinics.co.uk email to Google Workspace and switch on managing accounts from your dashboard, I need permission to act in a few accounts. This lists exactly what, why, how to grant it, and how to take it back. None of it touches patient records, card payments or your bank.', M, H * 0.80, { width: CW - 50, lineGap: 3.5 });
doc.font('semi').fontSize(8).fillColor(C.gold).text('FOR THE OWNER · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), M, H - 54, { characterSpacing: 1.5 });

// CONTENTS (reserve a page, filled at the end)
newPage(false); const TOC_PAGE = pageIndex;
doc.x = M; doc.y = TOP; eyebrow('Contents'); h1('What I’m asking for');
doc.font('body').fontSize(9).fillColor(C.stone).text('Part 2 is the fast path — four grants unblock almost everything. Parts 4 to 10 are one account each: what I need, why, and exactly how to grant and later revoke it. The appendix is a tick-box you can work straight through. Everything is granted to the one address you already gave me, webmaster@kclinics.co.uk.', M, doc.y, { width: CW, lineGap: 2.6 });
const TOC_START_Y = doc.y + 18;

// ══════════════════════════════════════════════════════════════════════════════
// 01 — WHAT THIS IS
// ══════════════════════════════════════════════════════════════════════════════
section('What this is, in one minute', 'You have given me a clinic email address (webmaster@kclinics.co.uk) and offered to grant the access needed to finish the job. This document is the precise list — written so you can grant each item in a minute, and remove it just as easily once we are live.');
render([
  { h2: 'How I work with your accounts' },
  { ul: [
    ['Smallest role that does the job —', 'wherever a service offers a limited role, that is what I ask for, not full control.'],
    ['Time-boxed —', 'the powerful grants (like Super Admin) are temporary; remove them the moment go-live is confirmed.'],
    ['One identity —', 'everything is granted to webmaster@kclinics.co.uk, so there is a single thing to review and a single thing to revoke.'],
    ['Screen-share option —', 'for the two or three most sensitive one-time clicks, we can do them together on a call instead of you handing over standing access.'],
    ['Access, not passwords —', 'please invite webmaster@ rather than send a password wherever possible (Part 12). Access can be revoked; a leaked password cannot.'],
  ] },
  { tip: 'Nothing in this document gives access to patient or clinical records, card payments, payouts or your bank. Part 13 lists in plain terms what I will never need or ask for.', label: 'Security' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 02 — THE FAST PATH
// ══════════════════════════════════════════════════════════════════════════════
section('The fast path — four grants unblock almost everything', 'If you do nothing else, these four let me do the rest. Click-by-click for each is in Parts 4 to 8. Grant them all to webmaster@kclinics.co.uk.');
render([
  { table: [['Account', 'Grant me (role)', 'This unlocks'], [
    ['Google Workspace', 'Super Admin (temporary)', 'Create the mailboxes, groups and aliases; copy your old mail across; turn on email-signing (DKIM)'],
    ['Google Cloud', 'Owner on one project', 'The "engine" (Admin SDK + a service account) that powers managing accounts from your dashboard'],
    ['Your DNS (Cloudflare or Hostinger)', 'Edit DNS', 'The few address records that route your mail to Google and keep it out of spam'],
    ['Vercel (website host)', 'Member', 'A couple of settings changes, then a redeploy'],
  ], [26, 26, 48]] },
  { p: 'One more, for the actual mail copy: access to your Hostinger mailboxes (Part 7) — or just an "app password" for each one. That is the piece that physically copies every old email into Google with nothing lost.' },
  { tip: 'Not sure about any of these? Grant what you are comfortable with and we cover the rest on a screen-share. None of it has to happen all at once.', label: 'Tip' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 03 — CONFIRM DNS
// ══════════════════════════════════════════════════════════════════════════════
section('First, confirm who controls your DNS', 'One quick check decides whether the DNS grant (Part 6) is on Cloudflare or on Hostinger. "DNS" is your domain’s address book — it tells the internet where your website and email live.');
render([
  { p: 'Your website records are managed in Cloudflare, but the domain itself is registered at Hostinger — so the live control could be in either. We just need to know which before changing any mail records.' },
  { h3: 'How to check (one minute)' },
  { steps: [
    'Go to whatsmydns.net.',
    'Type kclinics.co.uk and change the dropdown from "A" to "NS".',
    'Click Search and read the results: if they say something ending in ".ns.cloudflare.com", your DNS is on Cloudflare. If they mention Hostinger, it is at Hostinger.',
    'Send me a screenshot of that result if you are unsure — I will confirm in seconds.',
  ] },
  { tip: 'If in doubt, grant me both (Cloudflare member in Part 6 and Hostinger access in Part 7) and I will use whichever is live, then you remove the other.', label: 'Tip' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 04 — GOOGLE WORKSPACE
// ══════════════════════════════════════════════════════════════════════════════
section('Google Workspace (the Admin console)', 'This is where your staff email accounts live. admin.google.com.');
render([
  { h3: 'What I need' },
  { p: 'The "Super Admin" role on webmaster@kclinics.co.uk — temporarily, for the setup.' },
  { h3: 'Why' },
  { p: 'To create the staff mailboxes, the shared inboxes (groups) and the free alternate names (aliases); to run Google’s migration tool that copies your old mail across with nothing lost; to switch on email-signing (DKIM); and to approve the small "service account" that powers managing accounts from your dashboard. These particular tools only work with full admin.' },
  { h3: 'How to grant it' },
  { steps: [
    'Sign in at admin.google.com with your owner account.',
    'Left menu: Directory -> Users.',
    'Click webmaster@kclinics.co.uk.',
    'Open "Admin roles and privileges", then click "Assign roles" (or the pencil/Manage roles).',
    'Turn ON "Super Admin", then Save.',
  ] },
  { h3: 'Taking it back' },
  { p: 'Same screen, turn "Super Admin" off once go-live is confirmed (usually a week or two later).' },
  { tip: 'Super Admin is powerful, so it is time-boxed and removed as soon as we are live. If you would rather not grant it at all, the three or four one-time admin steps can be done together on a screen-share — I narrate, you click.', label: 'Security' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 05 — GOOGLE CLOUD
// ══════════════════════════════════════════════════════════════════════════════
section('Google Cloud Console', 'A separate Google site (console.cloud.google.com) that holds the technical "engine" pieces. This is the access you mentioned giving me.');
render([
  { h3: 'What I need' },
  { p: 'The role "Owner" on a single Google Cloud "project" — either one that already exists for the site, or a new one created just for this.' },
  { h3: 'Why' },
  { p: 'This is where I enable the tool that lets your dashboard manage Workspace accounts, create a "service account" (a robot login the dashboard uses) and its key, and store that key encrypted inside the app. Keeping it to one project means this access touches nothing else.' },
  { h3: 'How to grant it (a project already exists)' },
  { steps: [
    'Go to console.cloud.google.com and pick the project at the top.',
    'Left menu: IAM & Admin -> IAM.',
    'Click "Grant access".',
    'New principals: webmaster@kclinics.co.uk. Role: "Owner". Save.',
  ] },
  { h3: 'How to grant it (no project yet)' },
  { steps: [
    'At the top of console.cloud.google.com click the project dropdown -> "New Project". Name it e.g. "kclinics-platform" and create it.',
    'Then follow the four steps above to add webmaster@ as Owner — or simply tell me and I will create the project once you have added me.',
  ] },
  { h3: 'Taking it back' },
  { p: 'IAM -> remove webmaster@ from the project. I will delete the service-account key at the same time.' },
  { tip: 'You may be asked to confirm you are the Google Cloud "organisation" admin — as the Workspace owner you can grant yourself this, or we do it together on a screen-share. The service-account key is generated inside the console and stored encrypted in the app; it never lands in your inbox.', label: 'Security' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 06 — DNS
// ══════════════════════════════════════════════════════════════════════════════
section('Your DNS (Cloudflare and/or Hostinger)', 'The records that route your mail. The most careful part of the job — and the one I am happy to do with you watching.');
render([
  { h3: 'What I need' },
  { p: 'Permission to edit the DNS records for kclinics.co.uk, in whichever provider Part 3 confirmed is live.' },
  { h3: 'Why' },
  { p: 'The move adds or changes a few records on the bare domain: one that routes incoming mail to Google (the "MX"), and a few that prove your mail is genuine so it is not flagged as spam (SPF, DKIM, DMARC). I will not touch the records that keep your website and your app’s automatic emails working — those are listed as off-limits in the migration plan.' },
  { h3: 'How to grant it — Cloudflare' },
  { steps: [
    'Go to dash.cloudflare.com and click "Manage Account" -> "Members".',
    'Click "Invite".',
    'Enter webmaster@kclinics.co.uk.',
    'For the role, choose "DNS" (lets me edit DNS only). If you cannot find it, "Administrator" is fine and you can remove me afterwards.',
    'Send the invite — I will accept it.',
  ] },
  { h3: 'How to grant it — Hostinger' },
  { p: 'If Part 3 showed your DNS is at Hostinger, the "Account sharing" in Part 7 covers this too — no separate step.' },
  { h3: 'Taking it back' },
  { p: 'Cloudflare -> Members -> remove webmaster@ (or keep me on for quick future tweaks — your call).' },
  { tip: 'Because this is the highest-stakes area, I will make each change carefully and can show you every record before I save it. The single switch that actually moves your mail to Google can be the one thing you click yourself (Part 11): I prepare everything, you press go.', label: 'Important' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 07 — HOSTINGER
// ══════════════════════════════════════════════════════════════════════════════
section('Hostinger (your current mailboxes + domain)', 'Where your email lives today, and where the domain is registered. I need to read the old mail to copy it; I never delete anything there.');
render([
  { h3: 'What I need (either option)' },
  { ul: [
    ['Option A — shared panel access —', 'you add webmaster@ (or my Hostinger account) to your Hostinger panel.'],
    ['Option B — minimum access —', 'you send me an "app password" for each mailbox I am migrating. Narrower, if you prefer.'],
  ] },
  { h3: 'Why' },
  { p: 'To copy every existing email into Google (a read-only copy — nothing is removed from Hostinger), optionally set a temporary forward during the switch, and later close the old mailboxes once you confirm nothing is missing. If your DNS is at Hostinger, this access also covers Part 6.' },
  { h3: 'How to grant it — Option A (shared access)' },
  { steps: [
    'Sign in to Hostinger and open hPanel.',
    'Top-right, click your profile/account menu -> "Account sharing".',
    'Click "Add" / "Share access" and enter my Hostinger account email (I will tell you which).',
    'Grant access to the hosting/email service for kclinics.co.uk (and the domain, if DNS is here).',
  ] },
  { h3: 'How to grant it — Option B (app passwords only)' },
  { steps: [
    'In hPanel open Emails -> the kclinics.co.uk mailboxes.',
    'For each mailbox, open its settings and create/copy an "app password", and note the IMAP server shown (usually imap.hostinger.com).',
    'Send me each mailbox address + app password using the safe method in Part 12 (not plain email).',
  ] },
  { h3: 'Taking it back' },
  { p: 'Remove the shared access, or delete the app passwords, once the old mailboxes are closed.' },
  { tip: 'Account sharing also exposes the domain registration (control of the domain itself), so it is the more sensitive option. The app-password route keeps things narrow if you would rather not share the whole panel.', label: 'Security' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 08 — VERCEL
// ══════════════════════════════════════════════════════════════════════════════
section('Vercel (the website host)', 'The company that runs your website and holds its settings. vercel.com.');
render([
  { h3: 'What I need' },
  { p: 'The "Member" role on the K-Clinics Vercel project/team, for webmaster@kclinics.co.uk.' },
  { h3: 'Why' },
  { p: 'A couple of settings change here (switching the Google calendar sync on, and any keys not managed inside your dashboard), followed by a redeploy to apply them.' },
  { h3: 'How to grant it' },
  { steps: [
    'Go to vercel.com and open the K-Clinics team.',
    'Settings -> Members.',
    'Click "Invite", enter webmaster@kclinics.co.uk, and choose the role "Member".',
    'Send the invite — I will accept.',
  ] },
  { h3: 'Taking it back' },
  { p: 'Settings -> Members -> remove webmaster@.' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 09 — RESEND
// ══════════════════════════════════════════════════════════════════════════════
section('Resend (your app’s email sender) — optional', 'The service that sends your automatic emails — booking confirmations, reminders. Optional access.');
render([
  { h3: 'What I need' },
  { p: 'A "Member" invite (read access is enough) for webmaster@. Optional — skip if you prefer.' },
  { h3: 'Why' },
  { p: 'Only to confirm with my own eyes that the migration does not disturb these automatic emails. They send from a separate subdomain that I deliberately leave untouched, but I like to verify it.' },
  { h3: 'How to grant it' },
  { steps: [
    'Go to resend.com -> Settings -> Team.',
    'Click "Invite", enter webmaster@kclinics.co.uk, role "Member".',
  ] },
  { h3: 'Taking it back' },
  { p: 'Settings -> Team -> remove webmaster@.' },
  { tip: 'Genuinely optional — if you would rather not, I can confirm the same thing from the public DNS instead.', label: 'Tip' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 10 — ADMIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
section('Your admin dashboard (kclinics.co.uk/admin)', 'Your own platform’s back office. I may already have a login; if not, here is what I need.');
render([
  { h3: 'What I need' },
  { p: 'If I do not already have one: an admin login with "Owner" or "Developer" access, for webmaster@kclinics.co.uk.' },
  { h3: 'Why' },
  { p: 'To build and test the in-dashboard account management, and to store the service-account key securely inside the app (encrypted, never in plain text).' },
  { h3: 'How to grant it' },
  { steps: [
    'Sign in to your admin and open the "Staff" area.',
    'Click "Add staff": name "Webmaster", email webmaster@kclinics.co.uk, role "Owner" or "Developer". Save.',
    'I will set my own password / passkey from there. (Your current developer can do this for you if easier.)',
  ] },
  { h3: 'Taking it back' },
  { p: 'Staff -> set webmaster@ to Inactive when my work is done.' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 11 — KEEP IN YOUR HANDS
// ══════════════════════════════════════════════════════════════════════════════
section('Things to keep in your own hands', 'A few moments I would suggest stay with you, so the highest-stakes clicks are yours. None of these block me — I prepare everything first.');
render([
  { ul: [
    ['The final mail switch —', 'you can be the one to save the record that actually moves mail to Google, so that moment is yours. I set everything up; you press go.'],
    ['Approving the service account —', 'the one-time "domain-wide delegation" approval in Workspace can be done by you, or together on a screen-share.'],
    ['Anything you are unsure about —', 'we screen-share: I narrate each step, you click. Nothing happens that you have not seen.'],
  ] },
  { tip: 'This is about you keeping control of the two or three most important clicks — not about slowing anything down.', label: 'Tip' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 12 — SHARING SECRETS SAFELY
// ══════════════════════════════════════════════════════════════════════════════
section('How to send me a password or key safely', 'Most of this is "grant access", not "send a password". But when you do need to send something (like a Hostinger app password), please use a safe method.');
render([
  { ul: [
    ['Best —', 'grant access to webmaster@kclinics.co.uk as described above. Access can be revoked any time; a password, once leaked, cannot.'],
    ['If you must send a secret —', 'use a one-time, self-destructing link (onetimesecret.com) or your password manager’s secure "share" feature. One item per message.'],
    ['Never —', 'plain email, WhatsApp or text message for any password or key — those can be read if an account is compromised.'],
  ] },
  { link: ['One-Time Secret — share a secret that self-destructs', 'https://onetimesecret.com/'] },
  { tip: 'If any password or key is ever shown in a screenshot, email or message, just tell me — I will have it changed straight away. It costs nothing to be safe.', label: 'Security' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 13 — WHAT I WILL NEVER NEED
// ══════════════════════════════════════════════════════════════════════════════
section('What I will never need or ask for', 'For peace of mind, here is what is firmly out of scope. If anyone ever asks you for these in my name, it is not me — check with me first.');
render([
  { ul: [
    ['Patient or clinical records —', 'never needed for any of this work.'],
    ['Card payments, Stripe payouts or merchant details —', 'untouched.'],
    ['Your online / business banking —', 'never.'],
    ['Staff members’ personal passwords —', 'never; I use my own webmaster@ login.'],
    ['Your personal Google password —', 'never; you grant a role to webmaster@, you never share your own password with anyone.'],
  ] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 14 — REVOKE AFTER GO-LIVE
// ══════════════════════════════════════════════════════════════════════════════
section('After go-live — taking access back', 'Once your email works and nothing is missing (give it a week or two), you can remove everything in minutes.');
render([
  { checklist: [
    'Workspace: remove "Super Admin" from webmaster@ (Part 4).',
    'Google Cloud: I delete the service-account key; you remove webmaster@ from the project — or leave read access if you want me on call.',
    'DNS / Cloudflare: remove the member (or keep me on for quick future tweaks).',
    'Hostinger: remove shared access / delete the app passwords once the old mailboxes are closed.',
    'Vercel and Resend: remove the member if you prefer.',
    'Admin dashboard: set webmaster@ to Inactive if my work is finished.',
  ] },
  { tip: 'Many owners keep me on with only the lowest standing access (DNS plus an admin login) for quick fixes, and remove the powerful ones (Super Admin, Cloud Owner) straight after go-live. Entirely your call.', label: 'Tip' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// APPENDIX A — TICK-BOX
// ══════════════════════════════════════════════════════════════════════════════
section('Appendix A — your tick-box', 'Work straight down this list. Everything is granted to webmaster@kclinics.co.uk.', 'Appendix');
render([
  { checklist: [
    'Confirmed who controls DNS — Cloudflare or Hostinger (Part 3).',
    'Google Workspace -> Super Admin on webmaster@ (temporary).',
    'Google Cloud -> Owner on a project (existing, or a new "kclinics-platform").',
    'Cloudflare -> Member with the "DNS" role (if DNS is there).',
    'Hostinger -> shared access, OR an app password per mailbox.',
    'Vercel -> Member.',
    'Resend -> Member (optional).',
    'Admin dashboard -> Owner/Developer login (if I do not already have one).',
  ] },
  { p: 'Anything unclear — send me a screenshot of the screen you are on and I will point to the exact button.' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// APPENDIX B — GLOSSARY
// ══════════════════════════════════════════════════════════════════════════════
section('Appendix B — plain-English glossary', 'The handful of terms used above, in everyday words.', 'Appendix');
render([
  { ul: [
    ['Super Admin —', 'the top-level manager role in Google Workspace; can create accounts and change settings.'],
    ['Owner / IAM (Google Cloud) —', 'permission to manage one Google Cloud "project" — a container that holds the technical pieces.'],
    ['DNS —', 'your domain’s address book; tells the internet where your website and email live.'],
    ['MX record —', 'the single DNS line that says "deliver this domain’s email here".'],
    ['SPF / DKIM / DMARC —', 'DNS lines that prove your email is genuine, so it is not marked as spam.'],
    ['Service account —', 'a "robot" login the dashboard uses to manage Workspace accounts on your behalf.'],
    ['Domain-wide delegation —', 'the one-time approval that lets that robot login act inside your Workspace.'],
    ['App password —', 'a one-off password for a single mailbox, used to copy its mail without sharing your main password.'],
    ['Environment variable —', 'a single setting stored in the website host (Vercel).'],
  ] },
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
