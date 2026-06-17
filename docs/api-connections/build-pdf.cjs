// Builds the "API Connections — Setup & Fix Guide" PDF.
// Run from repo root: node docs/api-connections/build-pdf.cjs
// Requires Playwright Chromium. Brand chrome mirrors the staff manual.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'KClinics-API-Connections-Guide.pdf');
const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const K_PATH = 'M128.115 113.115C125.458 111.125 125.24 111.219 95.9687 125.833C47.875 149.844 33.4896 155.943 26.1823 155.391C18.5521 154.812 19.7552 142.432 28.9375 126.969C33.0573 120.031 41.0677 108.969 66.7552 74.7187C92.7291 40.1041 105.505 20.802 105.901 15.6093C106.047 13.5885 105.818 13.0416 104.615 12.6406C101.948 11.7447 100.547 12.5156 99.1666 15.6354C96.4479 21.7604 83.7291 39.5572 57.6562 73.7083C28.3125 112.151 21.2239 122.458 16.5521 133.526L14.0521 139.443L14.375 129.479C14.8541 114.875 17.4323 82.3177 18.9843 71.4531C22.2031 48.7812 25.4375 33.2916 30.8698 14.3697C34.2864 2.47912 34.3229 2.27079 33.1771 1.276C31.7916 0.0780791 27.1927 -0.416713 25.4218 0.442662C21.1823 2.48433 12.901 30.552 8.0781 59.2083C7.40101 63.2291 5.78122 69.401 4.40101 73.1822C-0.140655 85.6458 -0.21357 86.4322 3.05205 86.6718C4.4531 86.7812 4.46872 87.0416 4.05205 98.3697C2.6406 136.875 2.88018 186.24 4.60935 210.562C5.78643 227.266 6.74476 230.797 10.4791 232.339C13.151 233.437 15.6823 233.203 16.3281 231.802C16.5677 231.276 16.4271 228.135 16.0052 224.755C15.0833 217.286 14.4375 206.182 14.1458 192.568C13.8906 180.995 13.7968 157.656 13.9896 155.062L14.1198 153.302L15.8125 155.271C21.0364 161.333 32.7552 160.469 51.3385 152.651C60.0156 149.005 125.911 116.344 128 114.656C128.911 113.927 128.927 113.713 128.115 113.115Z';
const CLINICS = `<svg viewBox="0 0 531 51" fill="currentColor"><path d="M0.875977 25.8821C0.875977 39.8949 13.026 50.8986 27.1821 50.8986H90.1532V43.113H27.1821C16.8829 43.113 9.09142 34.814 9.09142 25.8821C9.16306 24.8134 9.23471 24.0253 9.45562 23.2372L9.66459 22.2401C11.4557 14.4485 18.8831 8.80043 26.6746 8.80043C26.8179 8.80043 26.9672 8.80043 27.1105 8.80043H90.0816V0.937256H27.1105C13.1693 0.937256 0.875977 11.8693 0.875977 25.8821Z"/><path d="M111.468 43.1847V0.937256H103.312V50.9762H176.087V43.1847H111.468Z"/><path d="M189.252 50.9762H197.467V0.937256H189.252V50.9762Z"/><path d="M213.498 50.6181H221.713V13.0933C289.831 44.8326 300.626 50.1225 302.411 50.827L302.704 50.9763V0.937353H294.548V38.4621L213.498 0.656738V50.6181Z"/><path d="M318.723 50.9762H326.938V0.937256H318.723V50.9762Z"/><path d="M340.82 25.8821C340.82 39.8949 352.97 50.8986 367.126 50.8986H430.103V43.113H367.126C356.838 43.113 349.047 34.814 349.047 25.8821C349.113 24.8134 349.184 24.0253 349.399 23.2372L349.608 22.2401C351.399 14.4485 358.839 8.80043 366.63 8.80043C366.767 8.80043 366.911 8.80043 367.054 8.80043H430.025V0.937256H367.054C353.113 0.937256 340.82 11.8693 340.82 25.8821Z"/><path d="M441.118 50.8269H515.033C523.392 50.8269 530.181 44.2534 530.181 36.3186C530.181 28.3181 522.753 21.8878 515.099 21.8878H456.2C452.343 21.8878 449.274 18.8787 449.274 15.2367C449.274 11.4454 452.486 8.80043 455.848 8.80043C455.985 8.80043 456.128 8.80043 456.278 8.80043H530.181V0.937256H456.278C448.343 0.937256 441.19 7.23019 441.19 15.2367V15.5173C441.19 23.7447 448.701 29.8167 456.128 29.8167H515.171C518.89 29.8167 521.965 32.6766 521.965 36.3902C521.965 40.0382 518.89 43.0414 515.033 43.0414H441.118V50.8269Z"/></svg>`;
const K_SVG = `<svg viewBox="0 0 130 234"><path fill="currentColor" d="${K_PATH}"/></svg>`;
const centre = (() => { try { return 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, 'shots', 'centre.jpg')).toString('base64'); } catch { return ''; } })();

// helpers
const steps = (arr) => `<ol>${arr.map((s) => `<li>${s}</li>`).join('')}</ol>`;
const tip = (t) => `<div class="ktip"><div class="kface"><span class="kring"></span>${K_SVG}</div><div class="ktiptext"><span class="klabel">K’s tip</span>${t}</div></div>`;
const note = (label, body) => `<div class="callout"><span class="pill">${label}</span><p>${body}</p></div>`;
const table = (head, rows, widths) => `<table><thead><tr>${head.map((h, i) => `<th${widths && widths[i] ? ` style="width:${widths[i]}"` : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const task = (title, body) => `<div class="task"><div class="t">${title}</div>${body}</div>`;

const GOOD = '<span class="ok">●</span>';
const BAD = '<span class="bad">●</span>';

const body = `
<section class="sec"><div class="sec-h"><span class="n">01</span><h2>Start here — the urgent one: Resend is red</h2></div>
<p class="lead">Short version: <b>your Resend DNS is correct. The red light is a key problem, not a DNS problem.</b> I checked every record live.</p>

<h3>What I checked, and what I found</h3>
<p>The platform sends from <code>mail.kclinics.co.uk</code>. Resend needs three DNS records on that subdomain. All three are present and correct:</p>
${table(['Record', 'Where', 'Found live', 'OK?'], [
  ['SPF (TXT)', '<code>send.mail.kclinics.co.uk</code>', '<code>v=spf1 include:amazonses.com ~all</code>', GOOD],
  ['Return-path (MX)', '<code>send.mail.kclinics.co.uk</code>', '<code>feedback-smtp.eu-west-1.amazonses.com</code>', GOOD],
  ['DKIM (TXT)', '<code>resend._domainkey.mail.kclinics.co.uk</code>', '<code>p=MIGfMA0…</code> (present)', GOOD],
  ['DMARC (TXT)', '<code>_dmarc.kclinics.co.uk</code>', '<code>v=DMARC1; p=none</code>', GOOD],
], ['16%', '34%', '40%', '10%'])}
<p>So sending is fully set up in DNS. (You also have the apex domain <code>kclinics.co.uk</code> set up in Resend — its records are correct too.)</p>

<h3>Why it’s red, then</h3>
<p>The health check only shows <b>red</b> in two cases: the API key is <b>missing</b>, or the key is <b>rejected (401)</b>. A missing or unverified domain would show <b>amber</b>, not red. So the cause is the key itself.</p>

<h3>Fix it — five steps</h3>
${task('Fix the Resend key', `${steps([
  'Open the admin → <b>Connection Centre</b> → the <b>Email — Resend</b> card.',
  'In a new tab go to <a href="https://resend.com/api-keys">resend.com/api-keys</a>. Check a key exists and that it’s in the <b>same account</b> where <code>mail.kclinics.co.uk</code> is verified. If unsure, click <b>Create API Key</b>, name it <code>kclinics-prod</code>, permission <b>Full access</b>, and <b>Copy</b> it (starts <code>re_</code>; shown once).',
  'Back in the Connection Centre, paste it into <b>Resend API key</b> and press <b>Save</b>. No spaces before or after.',
  'Set <b>From address</b> to <code>KClinics &lt;hello@mail.kclinics.co.uk&gt;</code> (or your verified sender).',
  'Press <b>Re-check now</b>. Green means fixed.',
])}`)}
${note('If it’s still red with a fresh key', 'The key is being rejected — it’s from a different Resend account/team than the one holding the domain, or it was revoked. Create the key in the account that owns <code>mail.kclinics.co.uk</code>. If the check turns <b>amber</b> instead (“no verified domain”), open Resend → Domains → <code>mail.kclinics.co.uk</code> → <b>Verify</b> (the DNS is already there, so it passes immediately).')}
${tip('Red almost always means “bad key”, amber means “key fine, domain/step missing”, green means “go”. Read the colour first — it tells you which half of the problem you have.')}

<h3>One smaller thing I spotted (not the red)</h3>
<p>Replies are meant to land on <code>reply.mail.kclinics.co.uk</code>, but that subdomain has no MX record (your inbound mail is set on <code>mail.kclinics.co.uk</code> instead). Sending isn’t affected, but client replies to automated emails may not thread back in. Optional fix: set <b>Reply-to address</b> in the Resend card to a real monitored mailbox (e.g. <code>hello@kclinics.co.uk</code>), or add Resend Inbound’s MX record for <code>reply.mail</code>.</p>
</section>

<section class="sec"><div class="sec-h"><span class="n">02</span><h2>Your new control centre — one page for everything</h2></div>
<p class="lead">API keys and connections used to be spread across four pages (Integrations, Credentials, API health, Marketing connections), and some providers — Google especially — were managed in several places at once. I’ve centralised it all into one screen: <b>Admin → Administration → Connection Centre</b> (<code>/admin/connections</code>).</p>
${centre ? `<figure class="shotfig"><div class="frame"><div class="chrome"><span class="dots"><i></i><i></i><i></i></span><span class="url">kclinics.co.uk/admin/connections</span></div><div class="shotwrap"><img src="${centre}" alt="Connection Centre"></div></div><figcaption><div class="cap">The Connection Centre. One card per service: live status, the keys it needs, the Connect button, and the URLs to copy.</div></figcaption></figure>` : ''}
<h3>What each card gives you</h3>
${table(['On the card', 'What it does'], [
  ['<b>Status light + line</b>', 'Live result from a real test call. Green = working, amber = one step left, red = broken, grey = not tested yet.'],
  ['<b>Key boxes</b>', 'Paste a key and press Save — it’s encrypted and live immediately, no developer or redeploy. “Set in app” means it’s saved here; “From hosting” means it’s in Vercel.'],
  ['<b>Connect button</b>', 'For accounts like Xero, TrueLayer and Google — does the one-time sign-in after the keys are saved.'],
  ['<b>Copy buttons</b>', 'The exact webhook / redirect URL to paste into that provider’s dashboard.'],
  ['<b>Re-check now</b> (top)', 'Re-runs every live test and refreshes all the lights. Takes a few seconds.'],
], ['24%', '76%'])}
${tip('Work top to bottom and fix red first, then amber. After each change press Re-check now and watch the light. You never need to leave this page except to paste a URL into a provider.')}
</section>

<section class="sec"><div class="sec-h"><span class="n">03</span><h2>Close each gap — provider by provider</h2></div>
<p class="lead">Do these in any order from the Connection Centre. Each is: paste the key(s), then the one extra step if it has one.</p>

${task('Stripe (payments) — hosting + webhook', `<p class="ti">Stripe keys are build-time, so they live in hosting, not the in-app box.</p>${steps([
  'In Vercel → k-clinics → Settings → Environment Variables, set <code>STRIPE_SECRET_KEY</code> and <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> (from <a href="https://dashboard.stripe.com/apikeys">dashboard.stripe.com/apikeys</a>), then Redeploy.',
  'In Stripe → Developers → Webhooks → Add endpoint, paste the <b>Payment webhook</b> URL from the Stripe card (Copy button).',
  'Copy the signing secret Stripe shows and set it in Vercel as <code>STRIPE_WEBHOOK_SECRET</code>; redeploy.',
])}`)}

${task('Anthropic (all AI) — one key', `${steps([
  'Open <a href="https://console.anthropic.com">console.anthropic.com</a> → Billing, add a small credit.',
  'Settings → API Keys → Create Key, copy it (starts <code>sk-ant-</code>).',
  'Paste into the <b>AI — Anthropic</b> card → Save → Re-check. This one key powers the kiosk, live chat, Get-My-Plan, marketing copy and SEO help.',
])}`)}

${task('Twilio (SMS) — three values', `${steps([
  'From <a href="https://console.twilio.com">console.twilio.com</a> copy the Account SID and Auth Token.',
  'Buy a phone number in Twilio for the “from” number.',
  'Paste all three into the <b>SMS — Twilio</b> card → Save → Re-check.',
])}`)}

${task('Xero (accounting) — keys, redirect, Connect', `${steps([
  'At <a href="https://developer.xero.com/app/manage">developer.xero.com</a> open your app (or create a Web app).',
  'Copy the <b>OAuth redirect URI</b> from the Xero card and paste it into Xero → Redirect URIs.',
  'Copy the Client id and a new Client secret from Xero into the card → Save.',
  'Press <b>Connect Xero</b> and authorise. The light goes green when the cash position is live.',
])}`)}

${task('TrueLayer (live bank balance) — keys, redirect, Connect', `${steps([
  'At <a href="https://console.truelayer.com">console.truelayer.com</a> copy the Client id and secret into the <b>Bank feed</b> card.',
  'Copy the redirect URI from the card into TrueLayer → Redirect URIs.',
  'Press <b>Connect bank</b> and choose your bank.',
])}`)}

${task('Google — one client powers reviews, Ads, Analytics & Search', `<p class="ti">The same Google client ID/secret is used by several features. Set it once in the Connection Centre and it flows to all of them.</p>${steps([
  'At <a href="https://console.cloud.google.com/apis/credentials">console.cloud.google.com</a> → Credentials, create (or open) an OAuth client.',
  'Copy the <b>redirect URI</b> from the <b>Google reviews</b> card into Google → Authorised redirect URIs. (Also add the marketing redirect if you use Ads — shown on Marketing → Connections.)',
  'Paste the Client ID + secret into the card → Save.',
  'Press <b>Connect Google</b> for reviews. For Ads/Analytics, add the IDs on the Google Ads / GA4 cards and connect the account on Marketing → Connections.',
])}`)}

${task('Deepgram (voice notes) & Translation — optional', `${steps([
  'Deepgram: key from <a href="https://console.deepgram.com">console.deepgram.com</a> into the Voice notes card (needs the Anthropic key too).',
  'Translation: a DeepL <i>or</i> Google Translate key into the Translation card — either is enough.',
])}`)}
</section>

<section class="sec"><div class="sec-h"><span class="n">04</span><h2>Reference — every URL to register</h2></div>
<p class="lead">These live URLs go into each provider’s dashboard. The Connection Centre has a Copy button for each, but here they are in one place.</p>
${table(['Provider · purpose', 'URL to paste', 'Where in the provider'], [
  ['Stripe · payment webhook', '<code>https://kclinics.co.uk/api/stripe/webhook</code>', 'Developers → Webhooks'],
  ['Resend · delivery events', '<code>https://kclinics.co.uk/api/webhooks/resend</code>', 'Webhooks'],
  ['Resend · inbound replies', '<code>https://kclinics.co.uk/api/webhooks/chat-inbound</code>', 'Inbound'],
  ['Xero · OAuth redirect', '<code>https://kclinics.co.uk/api/admin/integrations/xero/callback</code>', 'App → Redirect URIs'],
  ['TrueLayer · OAuth redirect', '<code>https://kclinics.co.uk/api/admin/integrations/truelayer/callback</code>', 'App → Redirect URIs'],
  ['Google Business · OAuth redirect', '<code>https://kclinics.co.uk/api/admin/integrations/google-business/callback</code>', 'Credentials → Redirect URIs'],
  ['yay.com · call + voicemail', '<code>https://kclinics.co.uk/api/integrations/yay</code>', 'Web Hooks'],
], ['30%', '52%', '18%'])}
${note('How to know you’re done', 'Open the Connection Centre and press <b>Re-check now</b>. Every service you use should read green. Anything amber has one step left (usually a Connect click or a webhook); the card tells you which. Red means a key is missing or wrong.')}
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
.ct h1{font-size:48px;line-height:1.06;margin-top:16px;max-width:92%;font-weight:600;}
.ct .sub{color:var(--gold-bright);font-size:12.5px;margin-top:18px;max-width:70%;line-height:1.5;}
.cb{margin-top:auto;}.cmeta{display:flex;gap:30px;color:var(--gold-bright);font-size:10px;}.cmeta b{color:var(--porcelain);display:block;margin-top:2px;}
.cover-shot{margin-top:22px;border-radius:12px;overflow:hidden;border:1px solid rgba(220,196,168,.24);box-shadow:0 14px 54px rgba(0,0,0,.5);max-height:250px;}
.cover-shot img{width:100%;display:block;}
.page{padding:14px 60px 70px;}
.sec{margin-top:26px;}.sec:first-child{margin-top:4px;}
.sec-h{display:flex;align-items:baseline;gap:12px;border-bottom:1.5px solid var(--gold);padding-bottom:7px;margin-bottom:12px;}
.sec-h .n{font-family:'Fraunces',serif;font-size:21px;color:var(--gold-deep);}.sec-h h2{font-size:18px;}
.lead{color:var(--stone);margin:0 0 12px;font-size:10.4px;}
h3{font-size:8.8px;color:var(--gold-deep);text-transform:uppercase;letter-spacing:.12em;margin:15px 0 6px;font-family:'Geist',sans-serif;font-weight:600;}
p{margin:0 0 8px;}ol{margin:4px 0 8px 16px;padding:0;}li{margin:3px 0;}
.task{break-inside:avoid;margin:0 0 12px;padding-left:14px;border-left:2px solid var(--bone);}
.task .t{font-weight:600;font-size:10.8px;margin-bottom:3px;}
.task .ti{margin:2px 0 4px;color:var(--stone);font-size:9.8px;}
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
.ok{color:var(--jade);}.bad{color:#c0392b;}
.shotfig{margin:14px 0 16px;break-inside:avoid;}
.shotfig .frame{border:1px solid var(--sand);border-radius:11px;overflow:hidden;box-shadow:0 8px 28px rgba(42,36,32,.13);background:#fff;}
.shotfig .chrome{height:23px;background:var(--bone);display:flex;align-items:center;padding:0 11px;border-bottom:1px solid var(--sand);}
.shotfig .chrome .dots{display:flex;gap:5px;}.shotfig .chrome .dots i{width:7px;height:7px;border-radius:50%;background:var(--stone-soft);display:block;}
.shotfig .chrome .url{font-size:8px;color:var(--stone);background:#fff;border:1px solid var(--sand);border-radius:6px;padding:2px 11px;margin-left:9px;font-family:'Geist Mono',monospace;}
.shotfig .shotwrap img{width:100%;display:block;}
.shotfig figcaption{margin-top:8px;}.shotfig .cap{font-size:9px;color:var(--stone);font-style:italic;}
.foot{position:fixed;bottom:0;left:0;right:0;padding:7px 60px;border-top:1px solid var(--line);background:#fff;color:var(--stone);font-size:7.4px;display:flex;justify-content:space-between;}
.foot .disp{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);}
</style></head><body>
<div class="cover">
  <div class="lockup"><div class="k">${K_SVG}</div><div class="w">${CLINICS}</div></div>
  <div class="ct"><div class="ey">API Connections</div><h1>Setup &amp; fix guide</h1>
  <div class="sub">Fixing the Resend red light, and connecting every other API — from one new control page in your admin.</div></div>
  <div class="cb"><div class="cmeta"><span>For<b>The owner</b></span><span>Platform<b>kclinics.co.uk</b></span><span>Date<b>${today}</b></span></div>
  ${centre ? `<div class="cover-shot"><img src="${centre}" alt="Connection Centre"></div>` : ''}</div>
</div>
<div class="page">${body}</div>
<div class="foot"><span class="disp">KClinics</span><span>API Connections — Setup &amp; Fix Guide · confidential</span><span>${today}</span></div>
</body></html>`;

const htmlPath = path.join(__dirname, '.guide.html');
fs.writeFileSync(htmlPath, html);
(async () => {
  const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + htmlPath, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1200);
  await p.pdf({ path: OUT, format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  await b.close();
  fs.unlinkSync(htmlPath);
  console.log('PDF →', OUT);
})();
