// Builds the K Clinics-branded "Marketing activation guide" PDF.
//   node scripts/brand/build-activation-guide.mjs [outPath]
// Brand rules: docs/BRAND_GUIDELINES.md — logo from the supplied marks (never typed
// text), no strap-line under the logo, palette + Fraunces/Geist only.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = process.argv[2] || path.resolve(process.cwd(), 'K Clinics — Marketing activation guide.pdf');

// ── Supplied brand marks (inline SVG paths from components/brand/marks.tsx) ──
const K_PATH = 'M128.115 113.115C125.458 111.125 125.24 111.219 95.9687 125.833C47.875 149.844 33.4896 155.943 26.1823 155.391C18.5521 154.812 19.7552 142.432 28.9375 126.969C33.0573 120.031 41.0677 108.969 66.7552 74.7187C92.7291 40.1041 105.505 20.802 105.901 15.6093C106.047 13.5885 105.818 13.0416 104.615 12.6406C101.948 11.7447 100.547 12.5156 99.1666 15.6354C96.4479 21.7604 83.7291 39.5572 57.6562 73.7083C28.3125 112.151 21.2239 122.458 16.5521 133.526L14.0521 139.443L14.375 129.479C14.8541 114.875 17.4323 82.3177 18.9843 71.4531C22.2031 48.7812 25.4375 33.2916 30.8698 14.3697C34.2864 2.47912 34.3229 2.27079 33.1771 1.276C31.7916 0.0780791 27.1927 -0.416713 25.4218 0.442662C21.1823 2.48433 12.901 30.552 8.0781 59.2083C7.40101 63.2291 5.78122 69.401 4.40101 73.1822C-0.140655 85.6458 -0.21357 86.4322 3.05205 86.6718C4.4531 86.7812 4.46872 87.0416 4.05205 98.3697C2.6406 136.875 2.88018 186.24 4.60935 210.562C5.78643 227.266 6.74476 230.797 10.4791 232.339C13.151 233.437 15.6823 233.203 16.3281 231.802C16.5677 231.276 16.4271 228.135 16.0052 224.755C15.0833 217.286 14.4375 206.182 14.1458 192.568C13.8906 180.995 13.7968 157.656 13.9896 155.062L14.1198 153.302L15.8125 155.271C21.0364 161.333 32.7552 160.469 51.3385 152.651C60.0156 149.005 125.911 116.344 128 114.656C128.911 113.927 128.927 113.713 128.115 113.115Z';
const CLINICS_PATHS = [
  'M0.875977 25.8821C0.875977 39.8949 13.026 50.8986 27.1821 50.8986H90.1532V43.113H27.1821C16.8829 43.113 9.09142 34.814 9.09142 25.8821C9.16306 24.8134 9.23471 24.0253 9.45562 23.2372L9.66459 22.2401C11.4557 14.4485 18.8831 8.80043 26.6746 8.80043C26.8179 8.80043 26.9672 8.80043 27.1105 8.80043H90.0816V0.937256H27.1105C13.1693 0.937256 0.875977 11.8693 0.875977 25.8821Z',
  'M111.468 43.1847V0.937256H103.312V50.9762H176.087V43.1847H111.468Z',
  'M189.252 50.9762H197.467V0.937256H189.252V50.9762Z',
  'M213.498 50.6181H221.713V13.0933C289.831 44.8326 300.626 50.1225 302.411 50.827L302.704 50.9763V0.937353H294.548V38.4621L213.498 0.656738V50.6181Z',
  'M318.723 50.9762H326.938V0.937256H318.723V50.9762Z',
  'M340.82 25.8821C340.82 39.8949 352.97 50.8986 367.126 50.8986H430.103V43.113H367.126C356.838 43.113 349.047 34.814 349.047 25.8821C349.113 24.8134 349.184 24.0253 349.399 23.2372L349.608 22.2401C351.399 14.4485 358.839 8.80043 366.63 8.80043C366.767 8.80043 366.911 8.80043 367.054 8.80043H430.025V0.937256H367.054C353.113 0.937256 340.82 11.8693 340.82 25.8821Z',
  'M441.118 50.8269H515.033C523.392 50.8269 530.181 44.2534 530.181 36.3186C530.181 28.3181 522.753 21.8878 515.099 21.8878H456.2C452.343 21.8878 449.274 18.8787 449.274 15.2367C449.274 11.4454 452.486 8.80043 455.848 8.80043C455.985 8.80043 456.128 8.80043 456.278 8.80043H530.181V0.937256H456.278C448.343 0.937256 441.19 7.23019 441.19 15.2367V15.5173C441.19 23.7447 448.701 29.8167 456.128 29.8167H515.171C518.89 29.8167 521.965 32.6766 521.965 36.3902C521.965 40.0382 518.89 43.0414 515.033 43.0414H441.118V50.8269Z',
];
const kMark = (color, h = 64) => `<svg viewBox="0 0 130 234" height="${h}" fill="${color}" xmlns="http://www.w3.org/2000/svg"><path d="${K_PATH}"/></svg>`;
const clinicsMark = (color, w = 220) => `<svg viewBox="0 0 531 51" width="${w}" fill="${color}" xmlns="http://www.w3.org/2000/svg">${CLINICS_PATHS.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
const logoLockup = (color, kH = 64, cW = 150) => `<span class="lockup">${kMark(color, kH)}${clinicsMark(color, cW)}</span>`;

// ── Simple line icons (stroke = currentColor) ──
const icon = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const ICONS = {
  meta: icon('<path d="M4 13c0-4 2-7 5-7 4 0 5 8 9 8 2 0 3-2 3-4s-1-4-3-4"/><path d="M4 13c0 3 1 5 3 5 4 0 5-8 9-8"/>'),
  google: icon('<circle cx="12" cy="12" r="9"/><path d="M21 12h-9"/><path d="M12 3a9 9 0 0 0 0 18"/>'),
  chart: icon('<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>'),
  search: icon('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  target: icon('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>'),
  check: icon('<path d="M20 6 9 17l-5-5"/>'),
};
const miPin = icon('<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>');
const miClock = icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');

// ── Content. Plain instructions only, field by field. No preamble. ──
const COVER_TITLE = 'Marketing activation guide';
const COVER_SUB = 'Turn on analytics, ad tracking and audiences. Step by step.';
const INTRO = [
  'Two places do all the work:',
  '<b>Admin &rarr; Settings &rarr; Credentials &amp; API keys</b> — paste IDs and keys here.',
  '<b>Admin &rarr; Marketing &rarr; Connections</b> — connect Google and Meta.',
  'Keys saved in Credentials take effect straight away. No developer or redeploy.',
];

const TASKS = [
  {
    n: 1, icon: 'meta', accent: 'gold', title: 'Meta audiences', flag: 'Start this first — Meta’s review takes days',
    where: 'developers.facebook.com, then Admin', time: '15 min to submit',
    steps: [
      { t: 'Open <b>developers.facebook.com</b> and sign in.' },
      { t: 'Top-left, open the app switcher and pick your <b>K Clinics</b> app.' },
      { t: 'Left menu: <b>App Review &rarr; Permissions and Features</b>.', box: 'App Review → Permissions and Features' },
      { t: 'Find <b>ads_management</b>. Click <b>Request advanced access</b>.', box: 'ads_management — Request advanced access' },
      { t: 'Complete <b>Business Verification</b> and submit the short screen-recording Meta asks for. Say it is for uploading your own opted-in client list to build a Custom Audience.' },
      { t: 'When approved: Admin &rarr; Marketing &rarr; Connections &rarr; Meta &rarr; <b>Disconnect</b>, then <b>Connect</b> again.' },
      { t: 'Admin &rarr; Marketing &rarr; Audiences &rarr; <b>Sync to Meta</b> on any segment.', box: 'Sync to Meta' },
    ],
    done: 'The Sync to Meta button reports "Uploaded N contacts" instead of a permission error.',
  },
  {
    n: 2, icon: 'google', accent: 'gold', title: 'Connect Google', flag: 'Unlocks tasks 3, 4 and 5',
    where: 'Admin → Marketing → Connections', time: '5 min',
    steps: [
      { t: 'Admin &rarr; <b>Marketing &rarr; Connections</b>.' },
      { t: 'Find the <b>Google</b> card and read its status.', box: 'Google — Connect' },
      { t: 'If it says <b>Connected</b>: done, skip ahead.' },
      { t: 'If it says <b>Ready to connect</b>: click <b>Connect</b>, choose your Google account, allow access.' },
      { t: 'If it says <b>Setup required</b>: click <b>Setup guide</b> and follow it once (you create a free Google OAuth client and paste its ID and secret into Credentials), then <b>Connect</b>.' },
    ],
    done: 'The Google card shows Connected.',
  },
  {
    n: 3, icon: 'chart', accent: 'jade', title: 'GA4 traffic on the dashboard', flag: '',
    where: 'Google Analytics, then Admin', time: '10 min',
    steps: [
      { t: 'Open <b>analytics.google.com</b>.' },
      { t: 'Bottom-left, click <b>Admin</b> (the gear). In the <b>Property</b> column, click <b>Property settings</b>.', box: 'Admin (gear) → Property settings' },
      { t: 'Copy the <b>Property ID</b> at the top. It is a number like 312345678 — not the G-XXXX tag.', box: 'Property ID: 312345678' },
      { t: 'Admin &rarr; <b>Settings &rarr; Credentials &amp; API keys</b>. Find <b>GA4 property ID (numeric)</b>. Paste the number. <b>Save</b>.', box: 'GA4 property ID (numeric)  [ 312345678 ]  Save' },
    ],
    done: 'Admin → Marketing → Performance shows a "Traffic by channel" table with real numbers.',
  },
  {
    n: 4, icon: 'search', accent: 'jade', title: 'Organic search panel', flag: '',
    where: 'Search Console, then Admin', time: '10 min',
    steps: [
      { t: 'Open <b>search.google.com/search-console</b> with the same Google account.' },
      { t: 'Check <b>kclinics.co.uk</b> is listed. If not: <b>Add property &rarr; URL prefix</b>, enter https://kclinics.co.uk, and verify.', box: 'Add property → URL prefix' },
      { t: 'Only if you use a <b>Domain</b> property: Admin &rarr; Credentials &rarr; <b>Search Console property</b> &rarr; enter sc-domain:kclinics.co.uk &rarr; <b>Save</b>.', box: 'Search Console property  [ sc-domain:kclinics.co.uk ]' },
    ],
    done: 'Admin → SEO shows an "Organic search" table with your search terms.',
  },
  {
    n: 5, icon: 'target', accent: 'jade', title: 'Google Ads value bidding', flag: '',
    where: 'Google Ads, then Admin', time: '15 min',
    steps: [
      { t: 'In <b>Google Ads</b>, top-right, note your <b>customer ID</b> (the 10-digit number).' },
      { t: 'In Admin &rarr; Credentials, check <b>Google Ads customer ID</b> and <b>Google Ads developer token</b> are set. The developer token comes from Google Ads &rarr; Tools &rarr; <b>API Center</b>.' },
      { t: 'In Google Ads: <b>Goals &rarr; Conversions &rarr; New conversion action &rarr; Import &rarr; track via API</b>. Name it "Booking". Count: <b>Every</b>. Value: <b>Use different values</b>. Save.', box: 'Goals → Conversions → New → Import' },
      { t: 'Open that conversion action. The page URL contains <b>ctId=123456789</b>. Copy that number.', box: 'URL: …&ctId=123456789' },
      { t: 'Admin &rarr; Credentials &rarr; <b>Google Ads conversion action ID</b> &rarr; paste &rarr; <b>Save</b>.', box: 'Google Ads conversion action ID  [ 123456789 ]' },
    ],
    done: 'A paid booking from a Google-ad click appears in Google Ads → Conversions within a few hours.',
  },
  {
    n: 6, icon: 'check', accent: 'gold', title: 'Confirm the funnel events', flag: 'Already live — just check',
    where: 'Admin → SEO', time: '5 min',
    steps: [
      { t: 'Admin &rarr; <b>SEO</b> &rarr; the <b>Tracking &amp; pixels</b> card.' },
      { t: 'Check <b>GA4 API secret</b> and <b>Meta Conversions API token</b> both show <b>set</b>.', box: 'GA4 API secret  · set ✓' },
      { t: 'If GA4 API secret is blank: GA4 &rarr; Admin &rarr; <b>Data Streams</b> &rarr; your stream &rarr; <b>Measurement Protocol API secrets</b> &rarr; Create. Paste it in. Save.' },
      { t: 'If the Meta token is blank: <b>Meta Events Manager</b> &rarr; your pixel &rarr; <b>Settings &rarr; Conversions API &rarr; Generate access token</b>. Paste it in. Save.' },
    ],
    done: 'Both fields show "set". Enquiries and bookings then report server-side automatically.',
  },
];

const css = `
  :root{
    --ink:#2a2420; --porcelain:#f6ece3; --bone:#efe3d7; --sand:#e3d3c4;
    --stone:#7d6259; --stone-soft:#b7a294; --gold:#a98a6d; --gold-deep:#856a4a;
    --jade:#2f7152; --line:rgba(42,36,32,.12);
  }
  @page{ size:A4; margin:0; }
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:'Geist',-apple-system,'Helvetica Neue',Arial,sans-serif; color:var(--ink); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .page{ width:210mm; min-height:297mm; padding:22mm 20mm; background:var(--porcelain); position:relative; page-break-after:always; overflow:hidden; }
  .page:last-child{ page-break-after:auto; }
  h1,h2,h3{ font-family:'Fraunces',Georgia,'Times New Roman',serif; font-weight:480; letter-spacing:-.01em; margin:0; }
  .lockup{ display:inline-flex; flex-direction:column; align-items:center; gap:11px; line-height:0; }
  /* Cover */
  .cover{ display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; }
  .cover .mark{ color:var(--ink); margin-bottom:64px; }
  .cover .rule{ width:48px; height:3px; background:var(--gold); border-radius:2px; margin:0 auto 26px; }
  .cover h1{ font-size:40pt; line-height:1.05; max-width:15ch; }
  .cover .sub{ margin-top:18px; color:var(--stone); font-size:13pt; max-width:34ch; }
  .cover .foot{ position:absolute; bottom:22mm; left:0; right:0; text-align:center; color:var(--stone-soft); font-size:9pt; letter-spacing:.04em; }
  .cover .intro{ margin-top:54px; text-align:left; background:var(--bone); border:1px solid var(--line); border-radius:14px; padding:22px 26px; max-width:62ch; }
  .cover .intro p{ margin:0 0 7px; font-size:10.5pt; color:var(--ink); }
  .cover .intro p:last-child{ margin-bottom:0; color:var(--stone); }
  /* Header band on task pages */
  .ph{ display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--line); padding-bottom:8px; margin-bottom:26px; }
  .ph .mk{ color:var(--stone); height:20px; display:flex; align-items:center; }
  .ph .pg{ color:var(--stone-soft); font-size:8.5pt; letter-spacing:.08em; text-transform:uppercase; }
  /* Task head */
  .thead{ display:flex; align-items:flex-start; gap:16px; margin-bottom:6px; }
  .badge{ flex:none; width:46px; height:46px; border-radius:50%; display:grid; place-items:center; font-family:'Fraunces',serif; font-size:18pt; color:#fff; }
  .badge.gold{ background:var(--gold-deep); } .badge.jade{ background:var(--jade); }
  .thead .ic{ width:24px; height:24px; color:var(--gold-deep); margin-left:auto; flex:none; }
  .thead.jade .ic{ color:var(--jade); }
  h2{ font-size:23pt; line-height:1.06; }
  .flag{ display:inline-block; margin-top:9px; background:color-mix(in oklab,var(--gold) 18%,transparent); color:var(--ink); font-size:8.5pt; font-weight:600; padding:4px 11px; border-radius:999px; }
  .meta{ margin:13px 0 22px 62px; color:var(--stone); font-size:9.5pt; display:flex; gap:18px; }
  .meta b{ color:var(--ink); font-weight:600; }
  .meta .mi{ display:inline-flex; align-items:center; gap:6px; } .meta svg{ width:13px; height:13px; color:var(--gold-deep); }
  /* Steps */
  ol.steps{ list-style:none; counter-reset:s; margin:0 0 0 62px; padding:0; }
  ol.steps>li{ counter-increment:s; position:relative; padding:0 0 18px 40px; }
  ol.steps>li::before{ content:counter(s); position:absolute; left:0; top:-2px; width:26px; height:26px; border-radius:50%; background:var(--ink); color:var(--porcelain); font-size:11pt; font-weight:600; display:grid; place-items:center; font-family:'Geist',sans-serif; }
  ol.steps>li::after{ content:""; position:absolute; left:13px; top:26px; bottom:2px; width:1px; background:var(--sand); }
  ol.steps>li:last-child::after{ display:none; }
  .st{ font-size:11pt; line-height:1.5; } .st b{ font-weight:600; }
  /* Click callout — illustrative, not a screenshot */
  .box{ margin-top:9px; display:inline-flex; align-items:center; gap:8px; background:#fff; border:2px solid var(--gold); border-radius:9px; padding:8px 13px; font-size:9.5pt; color:var(--ink); box-shadow:0 1px 0 rgba(133,106,74,.18); }
  .box::before{ content:""; width:9px; height:9px; border:2px solid var(--gold-deep); border-radius:50%; flex:none; }
  .box .cur{ margin-left:4px; color:var(--gold-deep); }
  /* Done */
  .done{ margin:22px 0 0 62px; background:color-mix(in oklab,var(--jade) 8%,transparent); border:1px solid color-mix(in oklab,var(--jade) 30%,transparent); border-radius:11px; padding:13px 16px; font-size:10pt; }
  .done b{ color:var(--jade); }
`;

const taskPage = (t, i, total) => `
  <section class="page">
    <div class="ph"><span class="mk">${clinicsMark('#7d6259', 92)}</span><span class="pg">Activation · ${t.n} of ${TASKS.length}</span></div>
    <div class="thead ${t.accent}">
      <span class="badge ${t.accent}">${t.n}</span>
      <div style="flex:1">
        <h2>${t.title}</h2>
        ${t.flag ? `<span class="flag">${t.flag}</span>` : ''}
      </div>
      <span class="ic">${ICONS[t.icon]}</span>
    </div>
    <div class="meta"><span class="mi">${miPin}<b>${t.where}</b></span><span class="mi">${miClock}${t.time}</span></div>
    <ol class="steps">
      ${t.steps.map((s) => `<li><div class="st">${s.t}</div>${s.box ? `<div class="box">${s.box}<span class="cur">▸ click</span></div>` : ''}</li>`).join('')}
    </ol>
    <div class="done"><b>Done when:</b> ${t.done}</div>
  </section>`;

const html = `<!doctype html><html><head><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>${css}</style></head><body>
  <section class="page cover">
    <span class="mark">${logoLockup('var(--ink)', 92, 200)}</span>
    <div class="rule"></div>
    <h1>${COVER_TITLE}</h1>
    <p class="sub">${COVER_SUB}</p>
    <div class="intro">${INTRO.map((p) => `<p>${p}</p>`).join('')}</div>
    <div class="foot">Internal guide · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </section>
  ${TASKS.map(taskPage).join('')}
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200); // let web fonts settle
await page.pdf({ path: OUT, format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log('Wrote', OUT);
void fileURLToPath; // keep import used if trimmed
