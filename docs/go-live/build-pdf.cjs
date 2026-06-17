// Regenerates the branded "Go-Live Action List & Final Configuration" PDF for
// the owner. Run from the repo root:  node docs/go-live/build-pdf.cjs
// Requires Playwright Chromium (installed by .claude/hooks/session-start.sh).
// Brand tokens mirror app/globals.css; the K badge is public/brand/k-badge.png.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'KClinics-Go-Live-Tasks.pdf');
const badge = fs.readFileSync(path.join(ROOT, 'public/brand/k-badge.png')).toString('base64');
const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap');
  :root{
    --ink:#2a2420; --ink-soft:#3d352f; --porcelain:#f6ece3; --bone:#efe3d7;
    --stone:#7d6259; --stone-soft:#b7a294; --gold:#a98a6d; --gold-soft:#c2a589;
    --gold-bright:#dcc4a8; --gold-deep:#816748; --jade:#2f7152; --blush:#cdb4a3;
    --line:rgba(42,36,32,.14);
  }
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  html,body{margin:0;padding:0;}
  body{font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:var(--ink);font-size:10.2px;line-height:1.5;background:#fff;}
  .disp{font-family:'Fraunces',Georgia,serif;}
  h1,h2,h3{font-family:'Fraunces',Georgia,serif;font-weight:500;margin:0;}
  a{color:var(--gold-deep);text-decoration:none;word-break:break-word;}
  code{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:9px;background:var(--bone);padding:1px 5px;border-radius:4px;color:var(--ink);white-space:nowrap;}
  .page{padding:0 46px 64px;}
  .hero{background:var(--ink);color:var(--porcelain);padding:40px 46px 34px;position:relative;overflow:hidden;}
  .hero::after{content:"";position:absolute;right:-60px;top:-60px;width:240px;height:240px;border-radius:50%;
    background:radial-gradient(circle,rgba(220,196,168,.18),transparent 70%);}
  .hero-top{display:flex;align-items:center;gap:14px;}
  .hero-top img{width:46px;height:46px;border-radius:11px;}
  .wordmark{font-family:'Fraunces',Georgia,serif;font-size:23px;letter-spacing:.16em;text-transform:uppercase;}
  .tag{color:var(--gold-soft);font-size:9px;letter-spacing:.22em;text-transform:uppercase;margin-top:2px;}
  .doc-title{font-family:'Fraunces',Georgia,serif;font-size:30px;line-height:1.1;margin-top:26px;max-width:78%;}
  .doc-meta{margin-top:12px;color:var(--gold-bright);font-size:9.5px;letter-spacing:.04em;display:flex;gap:22px;flex-wrap:wrap;}
  .doc-meta b{color:var(--porcelain);font-weight:600;}
  .callout{margin:24px 0 8px;border:1.5px solid var(--gold);background:linear-gradient(180deg,rgba(220,196,168,.22),rgba(220,196,168,.08));
    border-radius:14px;padding:16px 18px;}
  .callout h3{font-size:14px;color:var(--ink);margin-bottom:5px;}
  .callout p{margin:0;color:var(--ink-soft);}
  .callout .pill{display:inline-block;background:var(--ink);color:var(--gold-bright);font-size:8px;letter-spacing:.16em;
    text-transform:uppercase;padding:3px 9px;border-radius:999px;margin-bottom:9px;}
  .sec{margin-top:24px;break-inside:avoid;}
  .sec-h{display:flex;align-items:baseline;gap:10px;border-bottom:1.5px solid var(--gold);padding-bottom:6px;margin-bottom:12px;}
  .sec-h .n{font-family:'Fraunces',Georgia,serif;font-size:18px;color:var(--gold-deep);}
  .sec-h h2{font-size:16px;}
  .lead{color:var(--stone);margin:-4px 0 12px;font-size:9.6px;}
  .task{break-inside:avoid;margin-bottom:13px;padding-left:14px;border-left:2px solid var(--bone);}
  .task .t{font-weight:600;font-size:10.6px;color:var(--ink);margin-bottom:3px;}
  .task ol{margin:4px 0 4px 16px;padding:0;}
  .task li{margin:2px 0;}
  .task .done{margin-top:4px;font-size:9px;color:var(--jade);font-style:italic;}
  .badge{display:inline-block;font-size:7.5px;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:999px;
    margin-left:7px;vertical-align:middle;font-family:-apple-system,sans-serif;}
  .b-now{background:#e7efe6;color:#3f6b46;} .b-rec{background:var(--gold);color:#fff;}
  .b-owner{background:var(--bone);color:var(--stone);}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:9px;}
  th{background:var(--ink);color:var(--porcelain);text-align:left;padding:6px 8px;font-weight:600;font-size:8.4px;letter-spacing:.04em;}
  td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top;}
  tr:nth-child(even) td{background:var(--porcelain);}
  .ep td:first-child{font-weight:600;white-space:nowrap;}
  .foot{position:fixed;bottom:0;left:0;right:0;padding:8px 46px;border-top:1px solid var(--line);
    background:#fff;color:var(--stone);font-size:7.6px;display:flex;justify-content:space-between;align-items:center;}
  .foot .disp{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);}
</style></head>
<body>
  <div class="hero">
    <div class="hero-top">
      <img src="data:image/png;base64,${badge}" alt="K">
      <div><div class="wordmark">KClinics</div><div class="tag">Aesthetics &amp; Aesthetic Dentistry, Reimagined</div></div>
    </div>
    <div class="doc-title">Go-Live Action List &amp; Final Configuration</div>
    <div class="doc-meta">
      <span>Prepared for <b>the Owner</b></span>
      <span>Prepared by <b>Claude (build agent)</b></span>
      <span>Date <b>${today}</b></span>
      <span>Platform <b>kclinics.co.uk</b></span>
    </div>
  </div>
  <div class="page">
    <div class="callout">
      <span class="pill">Action required from you</span>
      <h3>Please send me all credentials for the Vercel environment variables</h3>
      <p>Every integration below is wired and ready in code. To switch each one on I need the matching keys/secrets pasted into <b>Vercel &rarr; k-clinics &rarr; Settings &rarr; Environment Variables</b>. <b>Please obtain each credential from the provider (steps below) and send them all to me</b> &mdash; I will enter them in Vercel, redeploy, and complete the OAuth "Connect" step for you. Treat these as sensitive: send them via our agreed secure channel, never in plain email.</p>
    </div>
    <p class="lead">Two facts that make everything below make sense:
    <br><b>1. Where keys live &mdash;</b> Vercel &rarr; <i>k-clinics</i> &rarr; Settings &rarr; Environment Variables (Production), then Deployments &rarr; Redeploy.
    <br><b>2. Where to check status &mdash;</b> the admin page <code>/admin/integrations</code> shows every service as <b>green / amber / grey</b>. The goal is to turn the ones you use green.</p>

    <div class="sec">
      <div class="sec-h"><span class="n">A</span><h2>Two-minute jobs &mdash; no accounts needed</h2></div>
      <div class="task"><div class="t">A1 &middot; Delete the 3 placeholder board cards <span class="badge b-now">Do now</span></div>
        <ol><li>Open <code>/admin/build</code>.</li>
        <li>Open the card <b>"BLD-244 &middot; Test item"</b> &rarr; click the red <b>Delete</b> button &rarr; confirm.</li>
        <li>Repeat for <b>"BLD-257"</b> and <b>"BLD-258"</b> (both "Routine run complete").</li></ol>
        <div class="done">Done when: those three cards are gone from the TRIAGE column.</div></div>
      <div class="task"><div class="t">A2 &middot; Eyeball the dashboard fix <span class="badge b-now">Do now</span></div>
        <ol><li>Open <code>/admin</code> on desktop, then on your phone.</li>
        <li>Check the clock / weather / clock-in cluster (top-right) sits tidily and the "Needs attention" chips are near the top.</li></ol>
        <div class="done">Done when: it looks right. If not, message me and I'll adjust.</div></div>
      <div class="task"><div class="t">A3 &middot; Send the re-permission email campaign (already built)</div>
        <ol><li>Open <code>/admin/marketing/email</code>.</li>
        <li>Find the <b>"Win back legacy opt-ins"</b> card (shows an "X pending" count).</li>
        <li>Click <b>Send re-permission emails</b> &rarr; <b>Yes, send</b>. Repeat until it reads "All legacy opt-ins have been emailed".</li></ol>
        <div class="done">Done when: the card shows 0 pending.</div></div>
    </div>

    <div class="sec">
      <div class="sec-h"><span class="n">B</span><h2>Integrations &mdash; get the credentials, send them to me</h2></div>
      <p class="lead">For each service: create/sign in to the account, follow the steps, copy the keys, and <b>send them to me</b> to enter in Vercel. Where an OAuth "Connect" is needed afterwards, I'll do it (or walk you through <code>/admin/integrations</code>).</p>
      <div class="task"><div class="t">B1 &middot; Anthropic API key &mdash; unlocks the kiosk AI &amp; appointment voice-notes <span class="badge b-rec">Recommended next</span></div>
        <ol><li>Go to <a href="https://console.anthropic.com">console.anthropic.com</a> and sign in with the clinic account.</li>
        <li><b>Settings &rarr; Billing</b> &rarr; add a card and a small credit (&asymp; &pound;20).</li>
        <li><b>Settings &rarr; API Keys &rarr; Create Key</b>, name it <code>kclinics-prod</code>, and <b>copy it</b> (starts <code>sk-ant-&hellip;</code>; shown once).</li>
        <li>Send me the key. Env var: <code>ANTHROPIC_API_KEY</code>. Docs: <a href="https://docs.anthropic.com/en/api/getting-started">docs.anthropic.com</a>.</li></ol>
        <div class="done">Done when: I've added it &amp; redeployed &mdash; then I can build the BLD-138 voice-note feature.</div></div>
      <div class="task"><div class="t">B2 &middot; Xero &mdash; accounting &amp; cashflow (BLD-58)</div>
        <ol><li>Go to <a href="https://developer.xero.com/app/manage">developer.xero.com/app/manage</a> &rarr; sign in &rarr; <b>New app</b> &rarr; type <b>Web app</b>.</li>
        <li>Company URL <code>https://kclinics.co.uk</code>. OAuth 2.0 redirect URI (paste exactly): <code>https://kclinics.co.uk/api/admin/integrations/xero/callback</code></li>
        <li>Create &rarr; copy the <b>Client id</b>, then <b>Generate a secret</b> and copy it. Send me both.</li>
        <li>Env vars: <code>XERO_CLIENT_ID</code>, <code>XERO_CLIENT_SECRET</code>. Guide: <a href="https://developer.xero.com/documentation/getting-started-guide/">Xero getting-started</a>.</li></ol>
        <div class="done">Done when: I've connected it and the Xero card on <code>/admin/integrations</code> is "connected".</div></div>
      <div class="task"><div class="t">B3 &middot; Storefront kiosk on the NovaStar Taurus (BLD-134 / PRJ-1) <span class="badge b-owner">On-site</span></div>
        <ol><li>Create a NovaStar account at <a href="https://www.vnnox.com">vnnox.com</a> or install <b>ViPlex</b> (manuals: <a href="https://www.novastar.tech/support/">novastar.tech/support</a>).</li>
        <li>Add &amp; bind your Taurus player (pair via its Wi-Fi per ViPlex steps).</li>
        <li>New program &rarr; add a <b>Web page / URL</b> item &rarr; URL: <code>https://kclinics.co.uk/kiosk/display</code> &rarr; full-screen &rarr; <b>Publish</b> to the Taurus. (Find the QR/URL under <code>/admin/qr</code>.)</li></ol>
        <div class="done">Done when: the screen shows the live "Skin &amp; Smile" QR kiosk. Needs the physical player on-site &mdash; no credentials for me.</div></div>
      <div class="task"><div class="t">B4 &middot; Visual-QA token (BLD-39) &mdash; I can set this myself if you confirm</div>
        <ol><li>This is an agent-session variable, not Vercel. It reuses the existing board token value.</li>
        <li>Reply "go" and I'll set <code>QA_TOKEN</code> = the existing <code>BOARD_QUEUE_TOKEN</code> value in the session environment.</li></ol>
        <div class="done">Done when: QA_TOKEN is set so the visual-QA harness cleans up its own test sessions.</div></div>
      <div class="task"><div class="t">B5 &middot; Remaining services &mdash; send credentials for any you want live</div>
        <p style="margin:2px 0 0;color:var(--stone);font-size:9px;">Check the badge on <code>/admin/integrations</code>; for any grey/amber card you use, get the keys below and send them to me.</p>
      </div>
      <table>
        <thead><tr><th style="width:18%">Service</th><th style="width:24%">Credentials to send</th><th style="width:34%">Where to get them (account flow)</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><b>Stripe</b></td><td><code>STRIPE_SECRET_KEY</code>, <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>, <code>STRIPE_WEBHOOK_SECRET</code></td><td>Dashboard &rarr; Developers &rarr; API keys: <a href="https://dashboard.stripe.com/apikeys">dashboard.stripe.com/apikeys</a></td><td>Deposits &amp; treatment payments</td></tr>
          <tr><td><b>Resend</b></td><td><code>RESEND_API_KEY</code>, <code>EMAIL_FROM</code></td><td>Verify domain, create key: <a href="https://resend.com/api-keys">resend.com/api-keys</a></td><td>Confirmations, reminders, campaigns</td></tr>
          <tr><td><b>Twilio</b></td><td><code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>, <code>TWILIO_FROM</code></td><td>Console &rarr; Account Info: <a href="https://console.twilio.com">console.twilio.com</a> (buy a number for FROM)</td><td>SMS appointment reminders</td></tr>
          <tr><td><b>TrueLayer</b></td><td><code>TRUELAYER_CLIENT_ID</code>, <code>TRUELAYER_CLIENT_SECRET</code></td><td>Console: <a href="https://console.truelayer.com">console.truelayer.com</a></td><td>Live bank balance (Open Banking)</td></tr>
          <tr><td><b>Google Business</b></td><td><code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, <code>GOOGLE_BUSINESS_ACCOUNT_ID</code>, <code>GOOGLE_BUSINESS_LOCATION_ID</code></td><td>Credentials: <a href="https://console.cloud.google.com/apis/credentials">console.cloud.google.com</a></td><td>Pull &amp; reply to Google reviews</td></tr>
          <tr><td><b>yay.com</b></td><td><code>YAY_WEBHOOK_SECRET</code> (+ <code>YAY_AUTH_*</code> for click-to-dial)</td><td>Docs: <a href="https://docs.yay.com/">docs.yay.com</a></td><td>Call logging &amp; click-to-dial</td></tr>
          <tr><td><b>Translation</b></td><td><code>DEEPL_API_KEY</code> <i>or</i> <code>GOOGLE_TRANSLATE_KEY</code></td><td>DeepL API: <a href="https://www.deepl.com/pro-api">deepl.com/pro-api</a></td><td>Translate client form answers</td></tr>
        </tbody>
      </table>
    </div>

    <div class="sec">
      <div class="sec-h"><span class="n">C</span><h2>API endpoints needing final configuration</h2></div>
      <p class="lead">These URLs are already live on our side. They must be <b>registered in each provider's dashboard</b> as the redirect/webhook target (I'll do this once you've created the apps; listed so you can confirm them).</p>
      <table class="ep">
        <thead><tr><th style="width:26%">Provider &middot; purpose</th><th style="width:48%">Endpoint to register</th><th>Where to enter it</th></tr></thead>
        <tbody>
          <tr><td>Xero &middot; OAuth redirect</td><td><code>https://kclinics.co.uk/api/admin/integrations/xero/callback</code></td><td>Xero app &rarr; Redirect URIs</td></tr>
          <tr><td>TrueLayer &middot; OAuth redirect</td><td><code>https://kclinics.co.uk/api/admin/integrations/truelayer/callback</code></td><td>TrueLayer console &rarr; Redirect URIs</td></tr>
          <tr><td>Google Business &middot; OAuth redirect</td><td><code>https://kclinics.co.uk/api/admin/integrations/google-business/callback</code></td><td>Google Cloud &rarr; Credentials &rarr; Authorised redirect URIs</td></tr>
          <tr><td>Google Calendar &middot; OAuth redirect</td><td><code>https://kclinics.co.uk/api/admin/gcal/callback</code></td><td>Google Cloud &rarr; Credentials (+ set <code>GOOGLE_INTEGRATION_ENABLED=true</code>)</td></tr>
          <tr><td>Stripe &middot; payment webhook</td><td><code>https://kclinics.co.uk/api/stripe/webhook</code></td><td>Stripe &rarr; Developers &rarr; Webhooks (signing secret &rarr; <code>STRIPE_WEBHOOK_SECRET</code>)</td></tr>
          <tr><td>Resend &middot; email events webhook</td><td><code>https://kclinics.co.uk/api/webhooks/resend</code></td><td>Resend &rarr; Webhooks (secret &rarr; <code>RESEND_WEBHOOK_SECRET</code>)</td></tr>
          <tr><td>yay.com &middot; Call-Ended &amp; Voicemail</td><td><code>https://kclinics.co.uk/api/integrations/yay</code></td><td>yay.com &rarr; Webhooks (shared secret &rarr; <code>YAY_WEBHOOK_SECRET</code>)</td></tr>
        </tbody>
      </table>
    </div>

    <div class="sec">
      <div class="sec-h"><span class="n">D</span><h2>Decisions for me to build next</h2></div>
      <div class="task"><div class="t">D1 &middot; BLD-138 "exceptional appointment" &mdash; choose the next slice</div>
        <ol><li><b>Per-clinician timing breakdown</b> (extends the new Session insights report).</li>
        <li><b>Explicit front-desk check-in step</b> in the session sequence.</li>
        <li><b>Voice-note capture + transcription</b> &mdash; needs B1 (Anthropic key) first.</li></ol>
        <div class="done">Done when: you reply with 1, 2 or 3.</div></div>
      <div class="task"><div class="t">D2 &middot; BLD-145 &middot; shared live-stream (SSE) refactor</div>
        <ol><li>I'll do this in a session where I can verify the kiosk / appointment / client-live streams against a preview, to avoid any risk to live realtime features. No action needed from you.</li></ol></div>
    </div>
  </div>
  <div class="foot">
    <span class="disp">KClinics</span>
    <span>4 Charterhouse Buildings, Goswell Road, Clerkenwell, London EC1M 7AN &nbsp;&middot;&nbsp; kclinics.co.uk &nbsp;&middot;&nbsp; support@kclinics.co.uk</span>
    <span>Confidential &mdash; Go-Live Tasks</span>
  </div>
</body></html>`;

const htmlPath = path.join(__dirname, '.golive.html');
fs.writeFileSync(htmlPath, html);

(async () => {
  const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.pdf({ path: OUT, format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  await browser.close();
  fs.unlinkSync(htmlPath);
  console.log('PDF written →', OUT);
})();
