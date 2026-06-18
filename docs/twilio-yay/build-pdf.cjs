// Builds the "Telephony & SMS — Twilio + yay.com setup" PDF.
// Run from repo root: node docs/twilio-yay/build-pdf.cjs
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'KClinics-Twilio-Yay-Setup.pdf');
const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const K_PATH = 'M128.115 113.115C125.458 111.125 125.24 111.219 95.9687 125.833C47.875 149.844 33.4896 155.943 26.1823 155.391C18.5521 154.812 19.7552 142.432 28.9375 126.969C33.0573 120.031 41.0677 108.969 66.7552 74.7187C92.7291 40.1041 105.505 20.802 105.901 15.6093C106.047 13.5885 105.818 13.0416 104.615 12.6406C101.948 11.7447 100.547 12.5156 99.1666 15.6354C96.4479 21.7604 83.7291 39.5572 57.6562 73.7083C28.3125 112.151 21.2239 122.458 16.5521 133.526L14.0521 139.443L14.375 129.479C14.8541 114.875 17.4323 82.3177 18.9843 71.4531C22.2031 48.7812 25.4375 33.2916 30.8698 14.3697C34.2864 2.47912 34.3229 2.27079 33.1771 1.276C31.7916 0.0780791 27.1927 -0.416713 25.4218 0.442662C21.1823 2.48433 12.901 30.552 8.0781 59.2083C7.40101 63.2291 5.78122 69.401 4.40101 73.1822C-0.140655 85.6458 -0.21357 86.4322 3.05205 86.6718C4.4531 86.7812 4.46872 87.0416 4.05205 98.3697C2.6406 136.875 2.88018 186.24 4.60935 210.562C5.78643 227.266 6.74476 230.797 10.4791 232.339C13.151 233.437 15.6823 233.203 16.3281 231.802C16.5677 231.276 16.4271 228.135 16.0052 224.755C15.0833 217.286 14.4375 206.182 14.1458 192.568C13.8906 180.995 13.7968 157.656 13.9896 155.062L14.1198 153.302L15.8125 155.271C21.0364 161.333 32.7552 160.469 51.3385 152.651C60.0156 149.005 125.911 116.344 128 114.656C128.911 113.927 128.927 113.713 128.115 113.115Z';
const CLINICS = `<svg viewBox="0 0 531 51" fill="currentColor"><path d="M0.875977 25.8821C0.875977 39.8949 13.026 50.8986 27.1821 50.8986H90.1532V43.113H27.1821C16.8829 43.113 9.09142 34.814 9.09142 25.8821C9.16306 24.8134 9.23471 24.0253 9.45562 23.2372L9.66459 22.2401C11.4557 14.4485 18.8831 8.80043 26.6746 8.80043C26.8179 8.80043 26.9672 8.80043 27.1105 8.80043H90.0816V0.937256H27.1105C13.1693 0.937256 0.875977 11.8693 0.875977 25.8821Z"/><path d="M111.468 43.1847V0.937256H103.312V50.9762H176.087V43.1847H111.468Z"/><path d="M189.252 50.9762H197.467V0.937256H189.252V50.9762Z"/><path d="M213.498 50.6181H221.713V13.0933C289.831 44.8326 300.626 50.1225 302.411 50.827L302.704 50.9763V0.937353H294.548V38.4621L213.498 0.656738V50.6181Z"/><path d="M318.723 50.9762H326.938V0.937256H318.723V50.9762Z"/><path d="M340.82 25.8821C340.82 39.8949 352.97 50.8986 367.126 50.8986H430.103V43.113H367.126C356.838 43.113 349.047 34.814 349.047 25.8821C349.113 24.8134 349.184 24.0253 349.399 23.2372L349.608 22.2401C351.399 14.4485 358.839 8.80043 366.63 8.80043C366.767 8.80043 366.911 8.80043 367.054 8.80043H430.025V0.937256H367.054C353.113 0.937256 340.82 11.8693 340.82 25.8821Z"/><path d="M441.118 50.8269H515.033C523.392 50.8269 530.181 44.2534 530.181 36.3186C530.181 28.3181 522.753 21.8878 515.099 21.8878H456.2C452.343 21.8878 449.274 18.8787 449.274 15.2367C449.274 11.4454 452.486 8.80043 455.848 8.80043C455.985 8.80043 456.128 8.80043 456.278 8.80043H530.181V0.937256H456.278C448.343 0.937256 441.19 7.23019 441.19 15.2367V15.5173C441.19 23.7447 448.701 29.8167 456.128 29.8167H515.171C518.89 29.8167 521.965 32.6766 521.965 36.3902C521.965 40.0382 518.89 43.0414 515.033 43.0414H441.118V50.8269Z"/></svg>`;
const K_SVG = `<svg viewBox="0 0 130 234"><path fill="currentColor" d="${K_PATH}"/></svg>`;

const steps = (arr) => `<ol>${arr.map((s) => `<li>${s}</li>`).join('')}</ol>`;
const tip = (t) => `<div class="ktip"><div class="kface"><span class="kring"></span>${K_SVG}</div><div class="ktiptext"><span class="klabel">K’s tip</span>${t}</div></div>`;
const note = (label, body) => `<div class="callout"><span class="pill">${label}</span><p>${body}</p></div>`;
const tbl = (head, rows, w) => `<table><thead><tr>${head.map((h, i) => `<th${w && w[i] ? ` style="width:${w[i]}"` : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const task = (title, inner) => `<div class="task"><div class="t">${title}</div>${inner}</div>`;

const body = `
<section class="sec"><div class="sec-h"><span class="n">01</span><h2>Two separate systems — and the mix-up to fix</h2></div>
<p class="lead">The confusion that’s stopping texts: <b>Twilio sends text messages, yay.com handles phone calls. They are different systems with different numbers.</b></p>
${tbl(['What you want', 'Which system', 'The number it uses'], [
  ['Send appointment reminders / confirmations by SMS', '<b>Twilio</b>', 'A number you buy <i>inside Twilio</i>'],
  ['Log incoming/outgoing calls, voicemails, recordings', '<b>yay.com</b>', 'Your existing clinic phone number'],
  ['Click-to-dial a client from the dashboard', '<b>yay.com</b>', 'Your clinic number + staff extensions'],
], ['44%', '24%', '32%'])}
${note('Why SMS isn’t working right now', 'You put the clinic landline in the Twilio “from” field. Twilio can only send texts from a number it owns — a landline it doesn’t control is rejected on every send. The landline is correct for <b>yay.com</b> (calls); Twilio needs its own number (Section 02). They don’t share a number.')}
${tip('Rule of thumb: anything that’s a text message → Twilio. Anything that’s a phone call → yay.com. Keep them in separate boxes in your head and it stays simple.')}
</section>

<section class="sec"><div class="sec-h"><span class="n">02</span><h2>Twilio — set up SMS fully</h2></div>
<p class="lead">Powers today: booking confirmations and appointment reminders by text (to clients who opted in). Planned: two-way SMS conversations — the setup below supports both, so you only do it once.</p>

${task('A · Create the account', steps([
  'Go to <a href="https://www.twilio.com/try-twilio">twilio.com</a> and sign up with the clinic email; verify your email and a mobile.',
  'In the console, note your <b>Account SID</b> and <b>Auth Token</b> (Account → API keys & tokens / the dashboard home).',
]))}

${task('B · Get a sending number (the important bit)', `<p class="ti">UK numbers need a one-time identity/address check (a “Regulatory Bundle”). Pick ONE of these:</p>${steps([
  '<b>UK mobile or local number (recommended for two-way):</b> Phone Numbers → Manage → Buy a number → Country <b>United Kingdom</b> → tick <b>SMS</b> (and Voice if you want calls too) → Buy. Twilio will prompt you to submit a <b>Regulatory Bundle</b> (business name, address, ID) — complete it; approval is usually 1–2 days.',
  '<b>Alphanumeric Sender ID (one-way only, fastest):</b> Messaging → Sender IDs → add <code>KClinics</code>. Texts show “KClinics” as the sender, but clients can’t reply. Good now; switch to a real number later for two-way.',
])}`)}

${task('C · (Recommended) Create a Messaging Service', steps([
  'Messaging → Services → Create. Add your new number (or Sender ID) to its <b>Sender Pool</b>.',
  'Turn on <b>Advanced opt-out</b> so STOP / HELP replies are handled automatically (UK compliance).',
  'This gives you one stable “sender” that scales and stays compliant. Use its <b>Messaging Service SID</b> (starts <code>MG…</code>) as the from value if you create one.',
]))}

${task('D · Put the keys into KClinics', steps([
  'Open Admin → <b>Connection Centre</b> → the <b>SMS — Twilio</b> card.',
  'Paste <b>Account SID</b> and <b>Auth Token</b>.',
  'For <b>Twilio from number</b>, enter your Twilio number in full international form (e.g. <code>+447…</code>) <i>or</i> the Messaging Service SID (<code>MG…</code>). <b>Not</b> the clinic landline.',
  'Save, then press <b>Re-check now</b> — the card turns green.',
]))}
${note('Consent is built in', 'The platform only texts clients who ticked “SMS reminders” — you don’t need to manage opt-in lists by hand. Keep STOP handling on (step C) so anyone who opts out is removed automatically.')}
${tip('Buy a number with BOTH SMS and Voice capability even if you only text today. It costs the same and means two-way SMS (planned) and any future call features just work without re-buying.')}
</section>

<section class="sec"><div class="sec-h"><span class="n">03</span><h2>yay.com — set up calls fully</h2></div>
<p class="lead">Powers: every call logged against the client automatically, voicemail transcripts, call recordings, caller→client/supplier matching, and click-to-dial from the dashboard. The main step is one webhook; the rest are optional extras.</p>

${task('A · Call logging webhook (do this first)', steps([
  'In yay.com open <b>Settings → Web Hooks</b> (or Integrations / API).',
  'Add a hook for <b>Call Ended</b>: URL <code>https://kclinics.co.uk/api/integrations/yay</code>, method <b>POST</b>.',
  'Add a second hook for <b>Voicemail Notify</b> to the <b>same URL</b>.',
  'Set the <b>Auth Token</b> / shared secret to the value held in <code>YAY_WEBHOOK_SECRET</code> (set in hosting). yay sends it as a Bearer header and we verify it.',
  'Make a test call to the clinic, hang up, and check <b>Admin → Calls</b> — it should appear within seconds, matched to the client if their number is on file.',
]))}

${task('B · Recordings & transcripts', steps([
  'Enable <b>call recording</b> in yay (account-wide or per extension/user).',
  'If your yay plan includes voicemail/call transcription, the transcript flows in automatically; otherwise the recording is stored and can be played from the call record.',
  'Recordings and transcripts are encrypted at rest and scrubbed automatically after ~13 months (retention policy).',
]))}

${task('C · Click-to-dial (optional — place calls from the dashboard)', steps([
  'In yay’s <b>API</b> settings get your <b>Reseller</b>, <b>User</b> and <b>Password</b>.',
  'Set <code>YAY_AUTH_RESELLER</code>, <code>YAY_AUTH_USER</code>, <code>YAY_AUTH_PASSWORD</code> in hosting (Vercel env), then redeploy.',
  'In yay, add this server’s egress IP to <b>Allowed IP ranges</b> (ask us for the current IP), or the API will reject the calls.',
  'Make sure each staff member has a <b>SIP extension</b> so the system knows which handset to ring.',
]))}

${task('D · Extensions & attribution', steps([
  'Give each clinician/desk a SIP extension in yay so calls are attributed to the right person.',
  'Keep client phone numbers tidy in the CRM — matching is on the last 9 digits, so it copes with +44 / 0 / spacing, but a wrong number won’t match.',
]))}
${tip('You only need step A for the headline feature (calls logged on the client record). B, C and D are upgrades you can add whenever — nothing else depends on them.')}
</section>

<section class="sec"><div class="sec-h"><span class="n">04</span><h2>Prove it all works</h2></div>
${tbl(['Test', 'How', 'Pass looks like'], [
  ['Twilio key', 'Connection Centre → Re-check', 'SMS — Twilio card is green'],
  ['Send an SMS', 'Book a test appointment with an opted-in mobile, or trigger a reminder', 'The text arrives from your Twilio number/sender'],
  ['Call logging', 'Phone the clinic and hang up', 'The call shows in Admin → Calls within seconds'],
  ['Voicemail', 'Call and leave a message', 'A voicemail call record appears (with transcript if enabled)'],
  ['Click-to-dial', 'Open a client → press call (if configured)', 'Your handset rings, then connects to the client'],
], ['18%', '50%', '32%'])}
${note('Where to look', 'SMS status lives on Connection Centre / API health. Calls live on <b>Admin → Calls</b>. If Twilio stays red after a correct key, the number isn’t SMS-capable or the Regulatory Bundle isn’t approved yet. If calls don’t appear, re-check the webhook URL and that the secret matches <code>YAY_WEBHOOK_SECRET</code>.')}
</section>

<section class="sec"><div class="sec-h"><span class="n">05</span><h2>Reference — what goes where</h2></div>
${tbl(['Setting', 'Value', 'Where it lives'], [
  ['Twilio Account SID / Auth Token', 'From the Twilio console', 'Connection Centre → SMS — Twilio'],
  ['Twilio from', 'Twilio number <code>+44…</code> or Messaging Service <code>MG…</code>', 'Connection Centre → SMS — Twilio'],
  ['yay call + voicemail webhook', '<code>https://kclinics.co.uk/api/integrations/yay</code>', 'yay.com → Web Hooks'],
  ['yay webhook secret', 'Matches <code>YAY_WEBHOOK_SECRET</code>', 'yay webhook “Auth Token” + hosting'],
  ['yay click-to-dial creds', '<code>YAY_AUTH_RESELLER / USER / PASSWORD</code>', 'Hosting (Vercel) — optional'],
  ['Server IP allow-list', 'This server’s egress IP', 'yay → Allowed IP ranges — optional'],
], ['26%', '42%', '32%'])}
</section>
`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Geist:wght@300;400;500;600&display=swap');
:root{--ink:#2a2420;--ink-soft:#3d352f;--porcelain:#f6ece3;--bone:#efe3d7;--sand:#e3d3c4;--stone:#7d6259;--stone-soft:#b7a294;--gold:#a98a6d;--gold-soft:#c2a589;--gold-bright:#dcc4a8;--gold-deep:#816748;--jade:#2f7152;--line:rgba(42,36,32,.14);}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
html,body{margin:0;padding:0;}
body{font-family:'Geist',-apple-system,Helvetica,Arial,sans-serif;color:var(--ink);font-size:10.4px;line-height:1.55;}
h1,h2,h3,.disp{font-family:'Fraunces',Georgia,serif;font-weight:500;margin:0;}
a{color:var(--gold-deep);text-decoration:none;word-break:break-word;}
code{font-family:'Geist Mono',ui-monospace,Menlo,monospace;font-size:8.8px;background:var(--bone);padding:1px 5px;border-radius:4px;white-space:nowrap;}
.cover{height:100vh;background:var(--ink);color:var(--porcelain);padding:64px 60px;display:flex;flex-direction:column;page-break-after:always;position:relative;overflow:hidden;}
.cover::after{content:"";position:absolute;right:-120px;top:-120px;width:460px;height:460px;border-radius:50%;background:radial-gradient(circle,rgba(220,196,168,.16),transparent 70%);}
.lockup .k{width:44px;height:58px;color:var(--porcelain);}.lockup .w{width:168px;color:var(--porcelain);margin-top:10px;}
.ct{margin-top:54px;}.ct .ey{color:var(--gold-soft);font-size:11px;letter-spacing:.26em;text-transform:uppercase;}
.ct h1{font-size:46px;line-height:1.06;margin-top:16px;max-width:92%;font-weight:600;}
.ct .sub{color:var(--gold-bright);font-size:12.5px;margin-top:18px;max-width:72%;line-height:1.5;}
.cb{margin-top:auto;}.cmeta{display:flex;gap:30px;color:var(--gold-bright);font-size:10px;}.cmeta b{color:var(--porcelain);display:block;margin-top:2px;}
.page{padding:14px 60px 70px;}
.sec{margin-top:26px;}.sec:first-child{margin-top:4px;}
.sec-h{display:flex;align-items:baseline;gap:12px;border-bottom:1.5px solid var(--gold);padding-bottom:7px;margin-bottom:12px;}
.sec-h .n{font-family:'Fraunces',serif;font-size:21px;color:var(--gold-deep);}.sec-h h2{font-size:18px;}
.lead{color:var(--stone);margin:0 0 12px;font-size:10.4px;}
h3{font-size:8.8px;color:var(--gold-deep);text-transform:uppercase;letter-spacing:.12em;margin:15px 0 6px;font-family:'Geist',sans-serif;font-weight:600;}
p{margin:0 0 8px;}ol{margin:4px 0 8px 16px;padding:0;}li{margin:3px 0;}
.task{break-inside:avoid;margin:0 0 12px;padding-left:14px;border-left:2px solid var(--bone);}
.task .t{font-weight:600;font-size:10.8px;margin-bottom:3px;}.task .ti{margin:2px 0 4px;color:var(--stone);font-size:9.8px;}
.callout{margin:12px 0;border:1.4px solid var(--gold);background:linear-gradient(180deg,rgba(220,196,168,.20),rgba(220,196,168,.06));border-radius:13px;padding:13px 16px;break-inside:avoid;}
.callout p{margin:0;color:var(--ink-soft);}.callout .pill{display:inline-block;background:var(--ink);color:var(--gold-bright);font-size:8px;letter-spacing:.16em;text-transform:uppercase;padding:3px 9px;border-radius:999px;margin-bottom:8px;}
.ktip{display:flex;gap:13px;align-items:center;margin:13px 0;padding:12px 16px;border-radius:14px;background:linear-gradient(120deg,rgba(169,138,109,.15),rgba(220,196,168,.05));border:1px solid var(--sand);break-inside:avoid;}
.ktip .kface{position:relative;flex:0 0 auto;width:38px;height:38px;border-radius:50%;background:var(--ink);display:grid;place-items:center;color:var(--gold);}
.ktip .kface svg{width:15px;height:27px;}.ktip .kface .kring{position:absolute;inset:-4px;border-radius:50%;border:1.5px solid var(--gold);opacity:.4;}
.ktip .ktiptext{font-size:10px;color:var(--ink-soft);line-height:1.5;}.ktip .klabel{display:block;font-family:'Fraunces',serif;font-size:11px;color:var(--gold-deep);margin-bottom:1px;}
table{width:100%;border-collapse:collapse;margin:8px 0 12px;font-size:9px;}
th{background:var(--ink);color:var(--porcelain);text-align:left;padding:6px 8px;font-weight:600;font-size:8.4px;}
td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top;}
tr:nth-child(even) td{background:var(--porcelain);}tr{break-inside:avoid;}
.foot{position:fixed;bottom:0;left:0;right:0;padding:7px 60px;border-top:1px solid var(--line);background:#fff;color:var(--stone);font-size:7.4px;display:flex;justify-content:space-between;}
.foot .disp{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);}
</style></head><body>
<div class="cover">
  <div class="lockup"><div class="k">${K_SVG}</div><div class="w">${CLINICS}</div></div>
  <div class="ct"><div class="ey">Telephony &amp; SMS</div><h1>Twilio &amp; yay.com setup</h1>
  <div class="sub">Why texts aren’t sending, and how to configure both accounts for everything we’ve built and planned — calls, voicemail, recordings, click-to-dial, and SMS.</div></div>
  <div class="cb"><div class="cmeta"><span>For<b>The owner</b></span><span>Platform<b>kclinics.co.uk</b></span><span>Date<b>${today}</b></span></div></div>
</div>
<div class="page">${body}</div>
<div class="foot"><span class="disp">KClinics</span><span>Telephony &amp; SMS — Twilio + yay.com setup · confidential</span><span>${today}</span></div>
</body></html>`;

const htmlPath = path.join(__dirname, '.ty.html');
fs.writeFileSync(htmlPath, html);
(async () => {
  const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + htmlPath, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1000);
  await p.pdf({ path: OUT, format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  await b.close();
  fs.unlinkSync(htmlPath);
  console.log('PDF →', OUT);
})();
