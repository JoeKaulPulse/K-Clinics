// Generates the KClinics Go-Live & Activation Guide (brand-styled PDF).
//   node scripts/build-golive-guide.mjs
//
// A plain-English, step-by-step owner's manual for switching the platform on:
// every account to open, every key to create, and every integration to connect —
// with links to each provider's own (screenshot-rich) help articles.
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'KClinics-Go-Live-Guide.pdf');
const photo = (f) => path.join(ROOT, 'public', 'treatments', f);
const geist = (f) => path.join(ROOT, 'node_modules', 'geist', 'dist', 'fonts', 'geist-sans', f);
const fraunces = (f) => path.join(ROOT, 'assets', 'fonts', f);

// ── Brand palette (lib/theme.ts) ─────────────────────────────────────────────
const C = {
  ink: '#2a2420', inkSoft: '#3d352f', espresso: '#4a3f37', porcelain: '#f6ece3',
  bone: '#efe3d7', sand: '#e3d3c4', stone: '#91766e', stoneSoft: '#b7a294',
  gold: '#a98a6d', goldSoft: '#c2a589', goldBright: '#dcc4a8', goldDeep: '#856a4a', jade: '#7b6a5d', blush: '#cdb4a3', white: '#ffffff',
};

// ── Logo vectors (read live from components/brand/marks.tsx) ──────────────────
const marks = fs.readFileSync(path.join(ROOT, 'components/brand/marks.tsx'), 'utf8');
const K_PATH = (marks.match(/const K_PATH =\s*'([^']+)'/) || [])[1];
const WORD_PATHS = [...marks.slice(marks.indexOf('function ClinicsWordmark')).matchAll(/d="([^"]+)"/g)].map((m) => m[1]);

// ── Geometry & document ───────────────────────────────────────────────────────
const W = 595.28, H = 841.89, M = 56, CW = W - M * 2, TOP = 94, BOT = 70;
const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: 'KClinics — Go-Live & Activation Guide', Author: 'KClinics' } });
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
  doc.font('body').fontSize(7.5).fillColor(C.stone).text('KClinics · Go-Live & Activation Guide', M, H - 37, { width: CW * 0.7 });
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
  const accent = label.toLowerCase().includes('warn') || label.toLowerCase().includes('important') || label.toLowerCase().includes('security') ? C.blush : C.gold;
  doc.save(); doc.roundedRect(M, y, CW, h, 6).fill(C.bone); doc.rect(M, y, 3, h).fill(accent); doc.restore();
  doc.font('semi').fontSize(7.5).fillColor(accent === C.blush ? C.goldDeep : C.gold).text(label.toUpperCase(), M + 14, y + 11, { characterSpacing: 1.5 });
  doc.font('body').fontSize(9).fillColor(C.inkSoft).text(text, M + 14, y + 23, { width: inner, lineGap: 2.5 });
  doc.y = y + h + 8;
}
function table(headers, rows, widths) {
  const tot = widths.reduce((a, b) => a + b, 0);
  // Pre-measure variable row heights so long cells don't clip.
  const colW = (i) => (widths[i] / tot) * CW - 14;
  const rowHeights = rows.map((r) => Math.max(22, ...r.map((cell, i) => { doc.font('body').fontSize(8.4); return doc.heightOfString(String(cell), { width: colW(i) }) + 13; })));
  const headH = 22;
  ensure(headH + 6 + (rowHeights[0] || 22));
  let y = doc.y;
  doc.save(); doc.rect(M, y, CW, headH).fill(C.ink); doc.restore();
  let cx = M;
  headers.forEach((hd, i) => { const last = i === headers.length - 1; doc.font('semi').fontSize(7.5).fillColor(last ? C.goldBright : C.porcelain).text(hd.toUpperCase(), cx + 9, y + 7.5, { width: colW(i), characterSpacing: 0.6, align: last ? 'right' : 'left' }); cx += (widths[i] / tot) * CW; });
  y += headH;
  rows.forEach((r, ri) => {
    const rh = rowHeights[ri];
    if (y + rh > H - BOT) { doc.y = y; newPage(); y = doc.y; }
    doc.save(); doc.rect(M, y, CW, rh).fill(ri % 2 ? C.bone : C.porcelain); doc.restore();
    cx = M;
    r.forEach((cell, i) => { const last = i === r.length - 1; doc.font(last ? 'semi' : 'body').fontSize(8.4).fillColor(last ? C.gold : C.inkSoft).text(String(cell), cx + 9, y + 6.5, { width: colW(i), align: last ? 'right' : 'left' }); cx += (widths[i] / tot) * CW; });
    y += rh;
  });
  doc.y = y + 9;
}
// Clickable resource link — "label" then the URL in gold, hyperlinked.
function link(label, url) {
  ensure(16); const y = doc.y;
  doc.save(); doc.circle(M + 4.5, y + 5.2, 1.8).fill(C.goldSoft); doc.restore();
  doc.font('semi').fontSize(9).fillColor(C.ink).text(label + '  ', M + 15, y, { continued: true, width: CW - 15, lineGap: 2.4 });
  doc.font('body').fillColor(C.goldDeep).text(url, { link: url, underline: true, lineGap: 2.4 });
  doc.fillColor(C.espresso); doc.moveDown(0.35);
}
// Honest schematic of the screen you'll see (NOT a real screenshot) — a titled
// panel with labelled "fields" so the owner recognises the page.
function mock(title, rows) {
  const rowH = 19, pad = 12, headH = 24;
  const h = headH + pad + rows.length * rowH + pad;
  ensure(h + 10);
  const y = doc.y;
  doc.save();
  doc.roundedRect(M, y, CW, h, 7).fill(C.white);
  doc.roundedRect(M, y, CW, h, 7).lineWidth(0.8).stroke(C.sand);
  doc.roundedRect(M, y, CW, headH, 7).fill(C.ink); doc.rect(M, y + headH - 7, CW, 7).fill(C.ink);
  // window dots
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
function section(title, intro) { secNo++; currentSection = title; newPage(); toc.push({ title, page: pageIndex }); eyebrow(`${String(secNo).padStart(2, '0')} · Step`); h1(title); if (intro) p(intro); }
function render(blocks) {
  for (const b of blocks) {
    if (b.h2) h2(b.h2); else if (b.h3) h3(b.h3); else if (b.p) p(b.p);
    else if (b.ul) ul(b.ul); else if (b.steps) steps(b.steps); else if (b.tip) tip(b.tip, b.label);
    else if (b.table) table(b.table[0], b.table[1], b.table[2]);
    else if (b.link) link(b.link[0], b.link[1]); else if (b.mock) mock(b.mock[0], b.mock[1]);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// COVER
// ══════════════════════════════════════════════════════════════════════════════
bg(C.ink);
try { doc.image(photo('KClinic-39.jpg'), 0, 0, { cover: [W, H * 0.58], align: 'center', valign: 'center' }); } catch { /* */ }
doc.save(); doc.rect(0, H * 0.5, W, H * 0.5).fill(C.ink); doc.restore();
// gold hairline under the photo
doc.save(); doc.rect(0, H * 0.5 - 3, W, 3).fill(C.gold); doc.restore();
kmark(M, H * 0.6, 56, C.goldSoft);
wordmark(M + 42, H * 0.6 + 21, 150, C.porcelain);
doc.font('dispSemi').fontSize(43).fillColor(C.porcelain).text('Go-Live &', M, H * 0.68, { width: CW });
doc.font('dispItalic').fontSize(38).fillColor(C.goldSoft).text('Activation Guide', { width: CW });
doc.font('body').fontSize(11).fillColor(C.stoneSoft).text('A plain-English, step-by-step manual for the owner — every account to open, every key to create and every integration to connect to switch the platform fully on. No technical knowledge assumed.', M, H * 0.82, { width: CW - 64, lineGap: 3.5 });
doc.font('semi').fontSize(8).fillColor(C.gold).text('FOR THE OWNER · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), M, H - 54, { characterSpacing: 1.5 });

// CONTENTS (reserve a page, filled at the end)
newPage(false); const TOC_PAGE = pageIndex;
doc.x = M; doc.y = TOP; eyebrow('Contents'); h1('What’s inside');
doc.font('body').fontSize(9).fillColor(C.stone).text('Work through the steps in order — each one lights up part of the platform. Allow about two hours in total; you can stop and resume any time. Steps marked “optional” can wait until after launch.', M, doc.y, { width: CW, lineGap: 2.6 });
const TOC_START_Y = doc.y + 18;

// ══════════════════════════════════════════════════════════════════════════════
// 01 — HOW TO USE THIS GUIDE
// ══════════════════════════════════════════════════════════════════════════════
section('How to use this guide', 'This guide takes you from a finished website to a fully live clinic — taking real bookings and card payments, sending real emails, and feeding your calendar, accounts and bank into the system. You do not need to understand any of the technology; just follow the steps.');
render([
  { h2: 'The idea in one paragraph' },
  { p: 'Your website is built and ready. To switch it fully on, you create accounts with a handful of trusted services (for payments, email, your calendar, your accounts and your bank), copy a few “keys” from each one, and paste them into one settings screen at your website’s host. Each key you add lights up another feature. Nothing breaks while keys are missing — the related feature simply waits quietly until you add it.' },
  { h2: 'What a “key” is' },
  { p: 'A key (sometimes called an “API key”, “secret” or “token”) is just a long password that lets two services talk to each other securely. You’ll copy keys from services like Stripe and paste them into your host (Vercel). Treat every key like a password: never post one in a public place.' },
  { h2: 'The order to do things' },
  { ul: [
    ['Set up the foundations first —', 'email & calendar (Step 4), the host (Step 5), the secret settings (Step 6) and the database (Step 7).'],
    ['Then payments & email —', 'Stripe (Step 8) and Resend (Step 9) — these make bookings and confirmations real.'],
    ['Then the “nice to have” connections —', 'accounting, bank feed, telephony and the Google extras (Steps 11–15), in any order.'],
    ['Finish with the go-live checklist —', 'Step 16: a short set of tests before you announce it.'],
  ] },
  { tip: 'Keep this PDF open on one side of your screen and the service you’re setting up on the other. Where a step says “copy this and send it to your developer”, use the secure method you’ve agreed (see Step 3) — never plain email or text message for secret keys.', label: 'Tip' },
  { h2: 'A note on screenshots' },
  { p: 'Each service updates its own screens regularly, so instead of screenshots that quickly go out of date, every step links to that company’s own official help article — which always shows their current screens with live screenshots. Look for the gold links. Where it helps, this guide also shows a simple sketch of the screen you’re looking for so you can recognise it.' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 02 — BEFORE YOU START
// ══════════════════════════════════════════════════════════════════════════════
section('Before you start — what you’ll need', 'Gather these once and the rest goes quickly. Most are things you already have as a business owner.');
render([
  { h2: 'Have these to hand' },
  { ul: [
    ['A laptop or desktop —', 'a few of these steps are fiddly on a phone.'],
    ['Your domain —', 'the address of the website (e.g. kclinics.co.uk) and the login for wherever you bought it (Hostinger, GoDaddy, etc.).'],
    ['Business details —', 'registered company name and number, registered address, and the names/dates of birth of the owners/directors (Stripe and the bank feed are legally required to ask).'],
    ['A business bank account —', 'sort code and account number, for card-payment payouts (Stripe) and the live bank feed (TrueLayer).'],
    ['A mobile phone —', 'for the text/app codes used to secure your new accounts.'],
    ['About two hours —', 'spread over one or two sittings if you prefer.'],
  ] },
  { h2: 'The accounts you’ll create (all have free tiers to start)' },
  { table: [['Service', 'What it does', 'Cost to begin'], [
    ['Google Workspace', 'Professional email + calendar', 'Free trial, then ~£5/user/mo'],
    ['Vercel', 'Hosts the website', 'Free tier; Pro ~£16/mo'],
    ['Neon / Vercel Postgres', 'The database', 'Free tier; small paid plan advised'],
    ['Stripe', 'Card payments', 'Free; ~1.5%+20p per card'],
    ['Resend', 'Sends the emails', 'Free up to 3,000/mo'],
    ['Cloudflare Turnstile', 'Blocks spam/bots', 'Free'],
    ['Xero', 'Accounting (optional)', 'Your existing plan'],
    ['TrueLayer', 'Live bank feed (optional)', 'Free sandbox; paid live'],
  ], [34, 40, 26]] },
  { tip: 'You may already have some of these (Xero, a bank, perhaps Google). Tick those off and only create the ones you’re missing.', label: 'Tip' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 03 — YOUR LOGINS, KEPT SAFE
// ══════════════════════════════════════════════════════════════════════════════
section('Keep your logins & keys safe', 'You’re about to create several accounts and copy several secret keys. A little organisation now prevents lockouts and protects client data later.');
render([
  { h2: 'Use a password manager' },
  { p: 'Install a password manager (1Password, Bitwarden and the password manager built into Chrome/Safari are all fine) and let it create and store a long, unique password for every new account. You’ll never need to remember them, and you won’t reuse one.' },
  { link: ['1Password — getting started', 'https://support.1password.com/explore/get-started/'] },
  { link: ['Bitwarden — getting started', 'https://bitwarden.com/help/getting-started-webvault/'] },
  { h2: 'Turn on two-step login everywhere' },
  { p: 'For every account in this guide, switch on two-step verification (also called 2FA / MFA) — a code from your phone in addition to the password. It’s the single biggest protection against someone breaking in.' },
  { h2: 'Sharing secret keys with your developer — safely' },
  { p: 'Some steps produce a secret key that your developer needs (or that you paste into the host yourself). Never send a secret key by plain email, WhatsApp or text — those can be read if an account is compromised.' },
  { ul: [
    ['Best —', 'paste it straight into the host (Vercel) yourself, following this guide. Then it never travels anywhere.'],
    ['Or —', 'share via your password manager’s secure “share” feature, or a one-time secret link (e.g. onetimesecret.com).'],
  ] },
  { link: ['One-Time Secret — share a secret that self-destructs', 'https://onetimesecret.com/'] },
  { tip: 'If a secret key is ever shown in a screenshot, email or message, treat it as compromised: go back to that service and “roll”/regenerate the key, then update it in the host.', label: 'Security' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 04 — EMAIL & CALENDAR (GOOGLE WORKSPACE)
// ══════════════════════════════════════════════════════════════════════════════
section('Email & calendar — Google Workspace', 'Strongly recommended. Professional inboxes (hello@, frontdesk@) plus a shared Google Calendar that the booking system can write appointments into. Google’s calendar and email are far easier to live with day-to-day than Hostinger’s, and they connect cleanly to the platform.');
render([
  { h2: 'Why Workspace over Hostinger email' },
  { ul: [
    ['Reliable, familiar inbox —', 'Gmail on every device, brilliant search, shared mailboxes.'],
    ['Calendar that just works —', 'a shared clinic calendar the booking system pushes appointments into, visible to every clinician.'],
    ['Cleaner integration —', 'one Google login also powers the optional clinician calendar-sync and Google reviews later.'],
  ] },
  { h2: 'Step by step' },
  { steps: [
    'Go to workspace.google.com and click “Get started”. Enter your business name, number of staff and country.',
    'Enter your domain (e.g. kclinics.co.uk) when asked “Does your business have a domain?” — choose “Yes, I have one”.',
    'Create your first admin account — this becomes your main login (e.g. owner@kclinics.co.uk). Choose a strong password (save it in your password manager).',
    'Verify you own the domain: Google gives you a TXT record to add at your domain provider (Hostinger). Google walks you through it; copy the value, add it in Hostinger’s DNS settings, then click “Verify”.',
    'Add your mailboxes: in the Google Admin console, create hello@, frontdesk@ (and any staff) — or set them up as aliases/groups so several people can read one inbox.',
    'Switch email delivery to Google: add Google’s MX records at Hostinger (Google shows the exact values). Allow up to an hour for email to start arriving in Gmail.',
  ] },
  { link: ['Workspace sign-up & setup overview', 'https://support.google.com/a/answer/53926'] },
  { link: ['Verify your domain', 'https://support.google.com/a/answer/60216'] },
  { link: ['Set up Gmail (MX records)', 'https://support.google.com/a/answer/140034'] },
  { link: ['Add users / mailboxes', 'https://support.google.com/a/answer/33310'] },
  { mock: ['Google Admin · Add a user', [['First / last name', 'Front Desk', ''], ['Primary email', 'frontdesk @ kclinics.co.uk', ''], ['', 'Add new user', 'Create']]] },
  { h2: 'Create the shared clinic calendar' },
  { steps: [
    'In Google Calendar (calendar.google.com), under “Other calendars” click the “+” → “Create new calendar”. Name it “KClinics — Appointments”. Click “Create calendar”.',
    'Open that calendar’s “Settings and sharing”. Share it with each clinician (and frontdesk@) with “Make changes to events” permission.',
    'Scroll to “Integrate calendar” and copy the “Calendar ID” — your developer needs this to point the booking system at the right calendar.',
  ] },
  { link: ['Create a new Google calendar', 'https://support.google.com/calendar/answer/37095'] },
  { link: ['Share a calendar with staff', 'https://support.google.com/calendar/answer/37082'] },
  { tip: 'Send your developer (securely) your Calendar ID. Confirmed bookings will then appear automatically on this shared calendar, and the clinician-level two-way sync can be switched on later in Step 14.', label: 'Tip' },
  { h2: 'If you decide to stay on Hostinger instead' },
  { p: 'The platform can still push confirmed appointments to a Hostinger calendar via a standard called CalDAV. You’d provide three things from Hostinger: the calendar’s full address (URL), the mailbox username, and an “app password”. It works — but the day-to-day experience is poorer, which is why Workspace is recommended.' },
  { link: ['Hostinger — email & app passwords help', 'https://support.hostinger.com/en/articles/1583248-how-to-set-up-email-accounts'] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 05 — THE HOST (VERCEL)
// ══════════════════════════════════════════════════════════════════════════════
section('The website host — Vercel', 'Vercel is the company that runs your website on the internet. It also holds the “settings drawer” where every key from this guide is pasted. You’ll come back to this one screen again and again, so it’s worth getting familiar with it.');
render([
  { h2: 'The one screen you’ll keep returning to' },
  { p: 'In Vercel this is called Environment Variables. Think of it as a private, locked drawer of settings for your site. Each setting has a NAME (always in capitals, e.g. STRIPE_SECRET_KEY) and a VALUE (the key you copied). You add each one, then “redeploy” to apply it.' },
  { h2: 'How to add a key (you’ll do this many times)' },
  { steps: [
    'Sign in at vercel.com and open your project (K-Clinics).',
    'Click “Settings” (top menu), then “Environment Variables” (left menu).',
    'In “Key”, type the NAME exactly as shown in this guide (capitals, underscores, no spaces).',
    'In “Value”, paste the key you copied. Leave the environment set to “Production” (also tick “Preview” if you want test deployments live too).',
    'Click “Save”.',
    'When you’ve added a batch, go to the “Deployments” tab → open the latest → the “⋯” menu → “Redeploy” to apply them.',
  ] },
  { mock: ['Vercel · Settings · Environment Variables', [['Key', 'STRIPE_SECRET_KEY', ''], ['Value', 'sk_live_••••••••••••••••', ''], ['Environment', 'Production', 'Save']]] },
  { link: ['Vercel — environment variables (official)', 'https://vercel.com/docs/projects/environment-variables'] },
  { link: ['Vercel — redeploy a project', 'https://vercel.com/docs/deployments/managing-deployments#redeploy-a-project'] },
  { h2: 'Connect your domain' },
  { steps: [
    'In the project, open “Settings” → “Domains”.',
    'Type your domain (kclinics.co.uk) and click “Add”. Vercel shows the DNS records to add at Hostinger.',
    'Add those records at Hostinger; Vercel confirms with a green tick (can take up to an hour).',
    'Set the www version to redirect to the plain domain (Vercel offers this as a one-click option).',
  ] },
  { link: ['Vercel — add a custom domain', 'https://vercel.com/docs/projects/domains/add-a-domain'] },
  { tip: 'After connecting the domain, make sure NEXT_PUBLIC_SITE_URL (in Environment Variables) is exactly https://kclinics.co.uk — it’s used in every email and booking link.', label: 'Important' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 06 — THE SECRET SETTINGS (KEYS YOU GENERATE)
// ══════════════════════════════════════════════════════════════════════════════
section('The secret settings (keys you generate)', 'A few keys aren’t copied from another company — you create them yourself. They’re the locks that secure staff logins, client logins and the encryption of clinical data. You only do this once.');
render([
  { h2: 'The easiest way to generate them' },
  { p: 'Your own admin dashboard has a generator built in. Once you can sign in to the admin (your developer will have created your first login), go to Admin → Security centre → “Generate a new secret”. Each click produces one strong value. Generate one for each row below and paste it into Vercel under the matching NAME.' },
  { mock: ['Admin · Security centre', [['Generate a new secret', 'k8Q2…long…random…value', 'Generate'], ['Copy', 'then paste into Vercel', 'Copy']]] },
  { p: 'No admin access yet? Any reputable random-string generator works, or a developer can run a one-line command. Each value should be long and unique — never reuse one across rows.' },
  { h2: 'The keys to create' },
  { table: [['Paste into Vercel as', 'What it protects', 'Rule'], [
    ['ADMIN_JWT_SECRET', 'Staff/admin logins', 'Any long random value'],
    ['CLIENT_JWT_SECRET', 'Client portal logins', 'A different long value'],
    ['CRON_SECRET', 'Automatic daily jobs', 'A different long value'],
    ['HEALTH_ENCRYPTION_KEY', 'Encrypts clinical data', 'Set once — never change'],
    ['HEALTH_HMAC_KEY', 'Protects clinical data integrity', 'Set once — never change'],
  ], [40, 38, 22]] },
  { tip: 'NEVER change HEALTH_ENCRYPTION_KEY (or HEALTH_HMAC_KEY) once any health or clinical data has been saved — doing so would make existing encrypted records unreadable, permanently. Rotation, if ever needed, has its own safe procedure handled by a developer.', label: 'Warning' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 07 — THE DATABASE
// ══════════════════════════════════════════════════════════════════════════════
section('The database', 'The database is the secure store for everything the clinic records — clients, bookings, consultations, forms, finance. It’s almost certainly already connected; this step is about confirming it’s on a paid plan so it never sleeps.');
render([
  { h2: 'Confirm it’s connected' },
  { p: 'In Vercel → Environment Variables you should see a DATABASE_URL (or the Postgres variables that Vercel’s own database adds automatically). If it’s there, the database is connected.' },
  { h2: 'Move off the free tier' },
  { p: 'Free database tiers pause themselves after inactivity — which can make the site fail to load or log in until they wake up. For a live clinic, put the database on the smallest paid plan so it’s always on. (You may have already done this — confirm it.)' },
  { link: ['Neon — pricing & plans', 'https://neon.tech/pricing'] },
  { link: ['Vercel Postgres — overview', 'https://vercel.com/docs/storage/vercel-postgres'] },
  { tip: 'This is the single most common cause of an “it was working yesterday” outage. A few pounds a month for an always-on database removes the risk entirely.', label: 'Important' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 08 — STRIPE (PAYMENTS)
// ══════════════════════════════════════════════════════════════════════════════
section('Payments — Stripe', 'Stripe takes card details securely at booking (no charge then) and lets you charge after the treatment, or apply a late-cancellation fee. This is the most important integration for taking money — work through it carefully.');
render([
  { h2: '8.1 — Create & activate the account' },
  { steps: [
    'Go to stripe.com and create an account with your business email.',
    'Click “Activate account” (or “Complete your profile”). Enter your business type, company name & number, registered address, and the directors’ details. Stripe is legally required to collect these.',
    'Add your business bank account (sort code + account number) — this is where your takings are paid out.',
    'Turn on two-step login (Stripe → Settings → Security).',
  ] },
  { link: ['Stripe — activate your account', 'https://support.stripe.com/questions/getting-started-with-stripe-create-or-connect-an-account'] },
  { link: ['Stripe — add a bank account for payouts', 'https://support.stripe.com/questions/managing-bank-accounts-and-payout-settings'] },
  { h2: '8.2 — Copy your LIVE keys' },
  { p: 'Stripe has a “Test mode” and a “Live mode”, each with its own keys. For real payments you need the LIVE keys. Make sure the “Test mode” toggle (top-right) is OFF.' },
  { steps: [
    'In the Stripe Dashboard, toggle OFF “Test mode” (top-right).',
    'Open “Developers” → “API keys”.',
    'Copy the “Publishable key” — it starts with pk_live_. This one is safe to be public.',
    'Next to “Secret key”, click “Reveal”, then copy it — it starts with sk_live_. This one is secret — handle it like a password.',
  ] },
  { mock: ['Stripe · Developers · API keys (Live mode)', [['Publishable key', 'pk_live_51•••••••••', 'Copy'], ['Secret key', 'sk_live_51••••••• (hidden)', 'Reveal']]] },
  { link: ['Stripe — find your API keys', 'https://support.stripe.com/questions/locate-api-keys-in-the-dashboard'] },
  { h2: '8.3 — Paste them into Vercel' },
  { table: [['Paste into Vercel as', 'The value you copied'], [
    ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_live_…'],
    ['STRIPE_SECRET_KEY', 'sk_live_…'],
  ], [56, 44]] },
  { h2: '8.4 — Set up the webhook (so the site hears back from Stripe)' },
  { p: 'A “webhook” lets Stripe notify your site the instant a card is saved or a payment succeeds. Without it, payments can appear stuck.' },
  { steps: [
    'In Stripe → “Developers” → “Webhooks” → “Add endpoint”.',
    'Endpoint URL: https://kclinics.co.uk/api/stripe/webhook',
    'Click “Select events” and add: setup_intent.succeeded and payment_intent.succeeded (add payment_intent.payment_failed too if offered).',
    'Click “Add endpoint”. On the new endpoint’s page, find “Signing secret”, click “Reveal”, and copy it — it starts with whsec_.',
    'Paste that into Vercel as STRIPE_WEBHOOK_SECRET, then redeploy.',
  ] },
  { link: ['Stripe — webhooks quickstart', 'https://docs.stripe.com/webhooks'] },
  { h2: '8.5 — Test it before going live' },
  { p: 'Before announcing the site, make one test booking end-to-end. While still in Test mode you can use Stripe’s test card 4242 4242 4242 4242 (any future expiry, any CVC) to confirm the flow without real money, then switch to Live.' },
  { link: ['Stripe — test card numbers', 'https://docs.stripe.com/testing'] },
  { tip: 'The platform deliberately does NOT confirm a sale in the admin until the card is captured and the slot is confirmed — so a half-finished booking never looks like a real one. Do a live £-test with a real card once, then refund yourself, to be completely sure payouts reach your bank.', label: 'Tip' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 09 — RESEND (EMAIL SENDING)
// ══════════════════════════════════════════════════════════════════════════════
section('Transactional email — Resend', 'Resend is what actually sends booking confirmations, reminders, password resets and review requests. You verify that you own your domain, then copy one key.');
render([
  { steps: [
    'Go to resend.com and create an account.',
    'Open “Domains” → “Add Domain” and enter kclinics.co.uk.',
    'Resend shows several DNS records (SPF, DKIM, DMARC). Add them at your domain provider (Hostinger) — or, if your domain’s DNS is managed by Google/Cloudflare, add them there. These records are what stop your emails landing in spam.',
    'Back in Resend, click “Verify”. Wait for all records to show a green tick (can take up to an hour).',
    'Open “API Keys” → “Create API Key”, name it “KClinics production”, and copy the key — it starts with re_.',
  ] },
  { mock: ['Resend · Domains', [['Domain', 'kclinics.co.uk', ''], ['SPF · DKIM · DMARC', '3 records — add at DNS', 'Verify']]] },
  { link: ['Resend — verify a domain', 'https://resend.com/docs/dashboard/domains/introduction'] },
  { link: ['Resend — create an API key', 'https://resend.com/docs/dashboard/api-keys/introduction'] },
  { h2: 'Paste into Vercel' },
  { table: [['Paste into Vercel as', 'Value'], [
    ['RESEND_API_KEY', 're_… (the key you copied)'],
    ['EMAIL_FROM', 'K Clinics <hello@kclinics.co.uk>'],
    ['EMAIL_REPLY_TO', 'hello@kclinics.co.uk'],
    ['CLINIC_NOTIFY_EMAIL', 'frontdesk@kclinics.co.uk'],
  ], [40, 60]] },
  { tip: 'There must be only ONE SPF record on a domain. If you also set up Google Workspace email (Step 4), don’t add two — merge them into a single line: v=spf1 include:_spf.google.com include:amazonses.com ~all. DKIM and the “send” subdomain don’t clash, so those sit happily alongside Google.', label: 'Important' },
  { h2: 'Switch on delivery tracking & list hygiene (the webhook)' },
  { p: 'A webhook lets Resend tell the platform when an email is delivered, opened, clicked, bounced or marked as spam — which powers the open/click rates in your dashboard and, crucially, automatically stops emailing anyone who bounces or complains (protecting your sender reputation). In production this is required: without it the dashboard shows no stats.' },
  { steps: [
    'In Resend → “Webhooks” → “Add Endpoint”.',
    'Endpoint URL: https://kclinics.co.uk/api/webhooks/resend',
    'Select these events: email.delivered, email.opened, email.clicked, email.bounced, email.complained.',
    'Click “Add”, then on the endpoint’s page copy the “Signing Secret” (it starts with whsec_).',
    'Paste it into Vercel as RESEND_WEBHOOK_SECRET, then redeploy.',
    'Finally, in Resend → Domains → kclinics.co.uk → Settings, turn ON “Open Tracking” and “Click Tracking” (so opens/clicks are recorded).',
  ] },
  { link: ['Resend — webhooks', 'https://resend.com/docs/dashboard/webhooks/introduction'] },
  { table: [['Paste into Vercel as', 'Value'], [
    ['RESEND_WEBHOOK_SECRET', 'whsec_… (the signing secret)'],
  ], [44, 56]] },
  { tip: 'Until the domain is verified, emails simply don’t send (nothing breaks — bookings still work). Once verified, send yourself a test from Admin → Marketing to confirm the logo and styling look right.', label: 'Tip' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 10 — TURNSTILE (SPAM PROTECTION)
// ══════════════════════════════════════════════════════════════════════════════
section('Spam & bot protection — Cloudflare Turnstile', 'A free, invisible check that stops bots spamming your booking and contact forms. Two keys, five minutes.');
render([
  { steps: [
    'Go to cloudflare.com, create a free account, and open the “Turnstile” product.',
    'Click “Add site”. Name it “KClinics”, enter your domain kclinics.co.uk, and choose the “Managed” widget.',
    'Copy the two keys it gives you: the “Site Key” (public) and the “Secret Key” (private).',
  ] },
  { link: ['Cloudflare Turnstile — get started', 'https://developers.cloudflare.com/turnstile/get-started/'] },
  { h2: 'Paste into Vercel' },
  { table: [['Paste into Vercel as', 'Value'], [
    ['NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'the Site Key'],
    ['TURNSTILE_SECRET_KEY', 'the Secret Key'],
  ], [56, 44]] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 11 — XERO (ACCOUNTING)
// ══════════════════════════════════════════════════════════════════════════════
section('Accounting — Xero', 'Optional. Connects your books so the platform can read your cash position and supplier bills. Two keys to create, then a one-click “Connect” inside your own admin.');
render([
  { steps: [
    'Sign in to the Xero developer portal at developer.xero.com and open “My Apps” → “New app”.',
    'Choose “Web app”. Name it “KClinics”. Company URL: https://kclinics.co.uk.',
    'For the “OAuth 2.0 redirect URI”, paste exactly: https://kclinics.co.uk/api/admin/integrations/xero/callback',
    'Create the app, then open it and copy the “Client id”. Under “Client secrets”, generate one and copy it (you only see it once).',
  ] },
  { link: ['Xero — getting started / create an app', 'https://developer.xero.com/documentation/getting-started-guide/'] },
  { link: ['Xero — manage your apps', 'https://developer.xero.com/app/manage'] },
  { h2: 'Paste into Vercel, then connect' },
  { table: [['Paste into Vercel as', 'Value'], [
    ['XERO_CLIENT_ID', 'the Client id'],
    ['XERO_CLIENT_SECRET', 'the Client secret'],
  ], [50, 50]] },
  { p: 'After redeploying, go to Admin → Integrations → Xero → “Connect”, sign in to Xero and approve. The cash-position and supplier data then flows in automatically.' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 12 — TRUELAYER (BANK FEED)
// ══════════════════════════════════════════════════════════════════════════════
section('Live bank feed — TrueLayer', 'Optional. A secure, read-only feed of your bank transactions so the platform can show live cashflow. Two keys, then a one-click “Connect” inside your admin.');
render([
  { steps: [
    'Go to console.truelayer.com and create an account, then create an application.',
    'In the app’s settings, add this exact Redirect URI: https://kclinics.co.uk/api/admin/integrations/truelayer/callback',
    'Copy the “Client ID” and generate/copy the “Client Secret”.',
    'When you’re ready for real (not sandbox) data, switch the app to “Live” and complete TrueLayer’s short verification.',
  ] },
  { link: ['TrueLayer — quickstart', 'https://docs.truelayer.com/docs/quickstart'] },
  { link: ['TrueLayer — console', 'https://console.truelayer.com/'] },
  { h2: 'Paste into Vercel, then connect' },
  { table: [['Paste into Vercel as', 'Value'], [
    ['TRUELAYER_CLIENT_ID', 'the Client ID'],
    ['TRUELAYER_CLIENT_SECRET', 'the Client Secret'],
  ], [50, 50]] },
  { p: 'After redeploying, go to Admin → Integrations → Bank feed → “Connect”, choose your bank and approve read-only access. The feed is view-only — it can never move money.' },
  { tip: 'The connection is read-only and uses bank-grade open-banking security. You can revoke it from your bank’s app at any time.', label: 'Security' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 13 — TELEPHONY (YAY.COM)
// ══════════════════════════════════════════════════════════════════════════════
section('Telephone calls — yay.com', 'Optional. Logs your inbound calls and voicemails against the right client automatically. One secret to set, one webhook to paste in yay.');
render([
  { steps: [
    'Create one secret value for the link (Admin → Security centre → “Generate a new secret”, or any long random value). Paste it into Vercel as YAY_WEBHOOK_SECRET and redeploy.',
    'Sign in to your yay.com account and open “Web Hooks”.',
    'For both the “Call Ended” and “Voicemail Notify” hooks, set the URL to: https://kclinics.co.uk/api/integrations/yay?token=YOUR_SECRET (replace YOUR_SECRET with the value above).',
    'Paste the same secret value into each hook’s “Auth Token” field and save.',
  ] },
  { link: ['yay.com — help centre', 'https://help.yay.com/'] },
  { tip: 'Click-to-dial (starting a call from inside the admin) is a later add-on that needs extra yay credentials and this server’s address allow-listed — leave it until after launch.', label: 'Tip' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 14 — GOOGLE EXTRAS
// ══════════════════════════════════════════════════════════════════════════════
section('Google extras — calendar sync, reviews, search', 'Optional polish that builds on your Google Workspace account. Add these after launch if you prefer.');
render([
  { h2: 'Clinician availability sync (read-only)' },
  { p: 'Each clinician connects their own Google Calendar so their personal busy-time blocks their booking slots. It’s strictly read-only — the platform only reads when they’re busy and can never see event details, edit or add anything to their calendar. Their appointments already live in the admin Calendar (one column per clinician), which is your holistic, all-staff overview — so nothing is pushed into Google.' },
  { steps: [
    'In the Google Cloud Console (console.cloud.google.com), create a project and enable the “Google Calendar API”.',
    'Under “Credentials”, create an “OAuth client ID” (type: Web application).',
    'Add this exact redirect URL: https://kclinics.co.uk/api/admin/gcal/callback',
    'Copy the Client ID and Client Secret.',
    'Paste the three values below into Vercel, set GOOGLE_INTEGRATION_ENABLED to true, and redeploy.',
    'In Admin → Schedule, each clinician clicks “Connect Google Calendar” and signs in to their own Google account once.',
  ] },
  { link: ['Google — create OAuth credentials', 'https://developers.google.com/workspace/guides/create-credentials'] },
  { link: ['Google — enable an API', 'https://support.google.com/googleapi/answer/6158841'] },
  { table: [['Paste into Vercel as', 'Value'], [
    ['GOOGLE_CLIENT_ID', 'the OAuth Client ID'],
    ['GOOGLE_CLIENT_SECRET', 'the OAuth Client Secret'],
    ['GOOGLE_REDIRECT_URI', 'https://kclinics.co.uk/api/admin/gcal/callback'],
    ['GOOGLE_INTEGRATION_ENABLED', 'true'],
  ], [40, 60]] },
  { tip: 'The redirect URL must match character-for-character between Google Cloud and the GOOGLE_REDIRECT_URI setting — note it is /api/admin/gcal/callback. If they differ, Google shows a “redirect_uri_mismatch” error.', label: 'Important' },
  { h2: 'Send happy clients to Google reviews' },
  { steps: [
    'Find your clinic’s “Place ID” using Google’s Place ID finder.',
    'Paste it into Vercel as GOOGLE_PLACE_ID.',
  ] },
  { link: ['Google — Place ID finder', 'https://developers.google.com/maps/documentation/places/web-service/place-id'] },
  { h2: 'Get found on Google (Search Console)' },
  { steps: [
    'Go to Google Search Console and add your domain as a property.',
    'Choose the “HTML tag” verification method and copy the content="…" value.',
    'Paste just that value into Vercel as GOOGLE_SITE_VERIFICATION, redeploy, then click “Verify”.',
    'Finally, submit your sitemap: https://kclinics.co.uk/sitemap.xml',
  ] },
  { link: ['Google — verify your site in Search Console', 'https://support.google.com/webmasters/answer/9008080'] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 15 — SMS (OPTIONAL)
// ══════════════════════════════════════════════════════════════════════════════
section('Text-message reminders — Twilio (optional)', 'Email is the default and is free. If you also want SMS appointment reminders, add Twilio.');
render([
  { steps: [
    'Create an account at twilio.com and buy a UK phone number capable of SMS.',
    'From the Twilio Console dashboard, copy the “Account SID” and “Auth Token”.',
  ] },
  { link: ['Twilio — SMS quickstart', 'https://www.twilio.com/docs/messaging/quickstart'] },
  { table: [['Paste into Vercel as', 'Value'], [
    ['TWILIO_ACCOUNT_SID', 'AC… (Account SID)'],
    ['TWILIO_AUTH_TOKEN', 'the Auth Token'],
    ['TWILIO_FROM', '+44… (your Twilio number)'],
  ], [40, 60]] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 16 — GO-LIVE CHECKLIST
// ══════════════════════════════════════════════════════════════════════════════
section('The go-live checklist', 'Run through this the day you switch on. If every line is ticked, you’re ready to announce the site.');
render([
  { h2: 'Foundations' },
  { ul: [
    ['Domain connected —', 'kclinics.co.uk loads with a padlock (https), www redirects to the plain domain.'],
    ['Database on a paid, always-on plan —', 'no sleeping free tier.'],
    ['Secret keys set —', 'ADMIN, CLIENT, CRON, HEALTH encryption + HMAC all present in Vercel.'],
    ['NEXT_PUBLIC_SITE_URL —', 'exactly https://kclinics.co.uk.'],
  ] },
  { h2: 'Money & messages' },
  { ul: [
    ['Stripe in LIVE mode —', 'live keys set, webhook added with its signing secret, bank account added.'],
    ['One real test booking taken —', 'card saved, then charged and refunded successfully to your own bank.'],
    ['Resend domain verified —', 'a test email arrives, not in spam, with the logo showing.'],
    ['Spam protection on —', 'Turnstile keys set; the contact/booking forms still submit normally.'],
  ] },
  { h2: 'Automatic jobs' },
  { ul: [
    ['Daily automations running —', 'in Vercel → Settings → Cron Jobs, the daily job is enabled (birthday, follow-up, win-back, review nudges, reminders).'],
  ] },
  { h2: 'Final content pass' },
  { ul: [
    ['Opening hours, prices & durations —', 'correct (these drive the booking availability).'],
    ['Name, address, phone, email —', 'correct everywhere (used in search listings and emails).'],
    ['Practitioner names & credentials —', 'added, for trust and search ranking.'],
  ] },
  { tip: 'Do the Stripe live-test and the Resend email-test last, together — they prove the two things clients touch first: paying and being emailed. If both work, launch with confidence.', label: 'Important' },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 17 — MASTER PASTE LIST
// ══════════════════════════════════════════════════════════════════════════════
section('Master list — every setting at a glance', 'One table of every value that goes into Vercel’s Environment Variables, what it’s for, and which step produces it. Print this page and tick each as you add it.');
render([
  { table: [['Setting name (in Vercel)', 'What it’s for', 'Step'], [
    ['NEXT_PUBLIC_CRM_ENABLED = true', 'Turns the CRM/portal on', '5'],
    ['CRM_ENABLED = true', 'Turns the CRM/portal on', '5'],
    ['NEXT_PUBLIC_SITE_URL', 'Your live address', '5'],
    ['DATABASE_URL', 'The database', '7'],
    ['ADMIN_JWT_SECRET', 'Staff logins', '6'],
    ['CLIENT_JWT_SECRET', 'Client logins', '6'],
    ['CRON_SECRET', 'Daily jobs', '6'],
    ['HEALTH_ENCRYPTION_KEY', 'Encrypts clinical data', '6'],
    ['HEALTH_HMAC_KEY', 'Clinical data integrity', '6'],
    ['STRIPE_SECRET_KEY', 'Payments (secret)', '8'],
    ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'Payments (public)', '8'],
    ['STRIPE_WEBHOOK_SECRET', 'Payment notifications', '8'],
    ['RESEND_API_KEY', 'Sends email', '9'],
    ['EMAIL_FROM / EMAIL_REPLY_TO', 'From / reply address', '9'],
    ['CLINIC_NOTIFY_EMAIL', 'Internal alerts inbox', '9'],
    ['RESEND_WEBHOOK_SECRET', 'Email stats + list hygiene', '9'],
    ['TURNSTILE_SECRET_KEY', 'Spam protection', '10'],
    ['NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'Spam protection', '10'],
    ['XERO_CLIENT_ID / _SECRET', 'Accounting', '11'],
    ['TRUELAYER_CLIENT_ID / _SECRET', 'Bank feed', '12'],
    ['YAY_WEBHOOK_SECRET', 'Call logging', '13'],
    ['GOOGLE_CLIENT_ID / _SECRET / _REDIRECT_URI', 'Calendar availability', '14'],
    ['GOOGLE_INTEGRATION_ENABLED = true', 'Switches calendar sync on', '14'],
    ['GOOGLE_PLACE_ID', 'Google reviews', '14'],
    ['GOOGLE_SITE_VERIFICATION', 'Search Console', '14'],
    ['TWILIO_ACCOUNT_SID / _AUTH_TOKEN / _FROM', 'SMS (optional)', '15'],
  ], [46, 36, 18]] },
]);

// ══════════════════════════════════════════════════════════════════════════════
// 18 — HELP & WHAT TO SEND YOUR DEVELOPER
// ══════════════════════════════════════════════════════════════════════════════
section('Help & what to send your developer', 'If you’d rather hand the keys over than paste them yourself, here’s exactly what to share — and how to share it safely.');
render([
  { h2: 'The short list to hand over (securely)' },
  { ul: [
    ['Stripe —', 'the live Publishable key (pk_live_…), the live Secret key (sk_live_…) and the Webhook signing secret (whsec_…).'],
    ['Resend —', 'the API key (re_…) and confirmation the domain shows “Verified”.'],
    ['Google —', 'your Calendar ID, and (if doing sync) the OAuth Client ID + Secret.'],
    ['Xero / TrueLayer —', 'each Client ID + Client Secret (if you want these on).'],
    ['Turnstile —', 'the Site Key + Secret Key.'],
    ['Database —', 'confirmation it’s on a paid plan (no key needed if already connected).'],
  ] },
  { h2: 'How to share it' },
  { p: 'Use a one-time secret link (onetimesecret.com) or your password manager’s secure share — one message per service. Never paste a secret key into plain email, chat or a document. If in doubt, paste it into Vercel yourself using Step 5 and tell your developer “it’s in” — that’s the safest route of all.' },
  { link: ['One-Time Secret', 'https://onetimesecret.com/'] },
  { h2: 'When you’re stuck' },
  { p: 'Each step links to the provider’s own official help article — those are kept current and include live screenshots. For anything platform-specific (where a key goes, why a feature is dormant), send your developer the step number from this guide and a short note of what you’re seeing.' },
  { tip: 'Keep this guide. As the clinic grows you’ll revisit it to add SMS, switch on click-to-dial, or onboard a new clinician’s calendar — each is just one more key in the same drawer.', label: 'Tip' },
]);

// ── FILL CONTENTS ──
doc.switchToPage(TOC_PAGE);
doc.y = TOC_START_Y;
const rowH = toc.length > 24 ? 17 : 19;
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
