// Renders a faithful mockup of the /admin/connections page to an image for the
// setup guide (the live page is behind admin login). Mirrors the real card
// design. Run: node docs/api-connections/mock-centre.cjs
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

const card = (dot, title, status, statusColor, powers, body, consoleLabel = '') => `
  <div class="card">
    <div class="chead"><span class="dot" style="background:${dot}"></span><span class="ctitle">${title}</span><span class="console">${consoleLabel}</span></div>
    <div class="cstatus" style="color:${statusColor}">${status}</div>
    <div class="cpowers">${powers}</div>
    ${body}
  </div>`;

const keyRow = (label, badge, badgeCls, hint, input = true) => `
  <div class="keyrow">
    <div class="krhead"><span class="krlabel">${label}</span><span class="badge ${badgeCls}">${badge}</span></div>
    ${hint ? `<div class="krhint">${hint}</div>` : ''}
    ${input ? `<div class="krin"><span class="inp">••••••••••••</span><span class="btn-dark">Save</span><span class="btn-light">Clear</span></div>` : `<div class="krmuted">Set in hosting (build-time key)</div>`}
  </div>`;

const urlRow = (label, url, note) => `
  <div class="urlrow"><div class="urhead"><span class="urlabel">${label}</span><span class="btn-light">Copy</span></div><div class="url">${url}</div><div class="urnote">${note}</div></div>`;

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Geist:wght@400;500;600&display=swap');
  :root{--ink:#2a2420;--porcelain:#f6ece3;--bone:#efe3d7;--sand:#e3d3c4;--stone:#7d6259;--stone-soft:#b7a294;--gold:#a98a6d;--gold-deep:#856a4a;--line:rgba(42,36,32,.14);}
  *{box-sizing:border-box;margin:0;-webkit-print-color-adjust:exact;}
  body{font-family:'Geist',sans-serif;background:#faf5ef;color:var(--ink);padding:30px;width:1240px;}
  h1{font-family:'Fraunces',serif;font-weight:600;font-size:30px;}
  .sub{color:var(--stone);font-size:13px;margin-top:5px;max-width:760px;}
  .bar{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);background:var(--porcelain);border-radius:14px;padding:15px 18px;margin-top:18px;}
  .bar .l{display:flex;align-items:center;gap:11px;}
  .bdot{width:13px;height:13px;border-radius:50%;background:#bd8b3c;display:inline-block;}
  .bstat{font-weight:600;color:#9a6b1f;font-size:15px;}
  .bcount{color:var(--stone);font-size:13px;}
  .recheck{background:var(--ink);color:var(--porcelain);border-radius:999px;padding:9px 18px;font-size:13px;font-weight:500;}
  .cat{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--stone);margin:26px 0 12px;font-weight:600;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .card{border:1px solid var(--line);background:#fff;border-radius:14px;padding:18px;}
  .chead{display:flex;align-items:center;gap:9px;}
  .dot{width:10px;height:10px;border-radius:50%;display:inline-block;}
  .ctitle{font-family:'Fraunces',serif;font-size:18px;font-weight:600;flex:1;}
  .console{font-size:11px;color:var(--gold);}
  .cstatus{font-size:13px;font-weight:600;margin-top:6px;}
  .cpowers{font-size:13px;color:var(--stone);margin-top:6px;line-height:1.45;}
  .keyrow{border:1px solid var(--line);background:var(--porcelain);border-radius:11px;padding:11px;margin-top:11px;}
  .krhead{display:flex;align-items:center;justify-content:space-between;}
  .krlabel{font-size:13px;font-weight:500;}
  .badge{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:3px 8px;border-radius:999px;}
  .b-app{background:#dcfce7;color:#166534;}.b-env{background:#fef3c7;color:#92400e;}.b-unset{background:var(--bone);color:var(--stone);}
  .krhint{font-family:monospace;font-size:10px;color:var(--stone);margin-top:3px;}
  .krin{display:flex;align-items:center;gap:8px;margin-top:9px;}
  .inp{flex:1;background:#fff;border:1px solid var(--line);border-radius:7px;padding:7px 11px;font-size:13px;color:var(--stone-soft);letter-spacing:2px;}
  .btn-dark{background:var(--ink);color:var(--porcelain);border-radius:999px;padding:7px 16px;font-size:13px;font-weight:500;}
  .btn-light{border:1px solid var(--line);color:var(--stone);border-radius:999px;padding:6px 13px;font-size:12px;}
  .krmuted{font-size:12px;color:var(--stone-soft);margin-top:8px;}
  .urlrow{border:1px dashed var(--sand);background:var(--porcelain);border-radius:11px;padding:11px;margin-top:11px;}
  .urhead{display:flex;align-items:center;justify-content:space-between;}
  .urlabel{font-size:12px;font-weight:500;}
  .url{font-family:monospace;font-size:10px;color:var(--stone);margin-top:5px;word-break:break-all;}
  .urnote{font-size:10px;color:var(--stone-soft);margin-top:4px;}
  .connect{display:inline-block;background:var(--gold-deep);color:#fff;border-radius:999px;padding:8px 17px;font-size:13px;font-weight:500;margin-top:13px;}
  ol{margin:11px 0 0 16px;padding:0;font-size:11.5px;color:var(--stone);}
  ol li{margin:3px 0;}
</style></head><body>
  <h1>Connection Centre</h1>
  <div class="sub">Every external service in one place — its live status, the keys it needs, the Connect step for accounts like Xero or Google, and the exact webhook and redirect URLs to paste into each provider.</div>
  <div class="bar"><div class="l"><span class="bdot"></span><span class="bstat">Needs a step</span><span class="bcount">3 connected · 2 need a step · 1 broken · 1 unchecked</span></div><span class="recheck">Re-check now</span></div>

  <div class="cat">Communications</div>
  <div class="grid">
    ${card('#c0392b','Email — Resend','API key rejected (401)','#c0392b','Every email the platform sends: confirmations, reminders, resets and marketing.',
      keyRow('Resend API key','Set in app','b-app','resend.com → API Keys') + urlRow('Delivery events webhook', 'https://kclinics.co.uk/api/webhooks/resend','Resend → Webhooks. Powers open/click/bounce tracking.'), 'resend.com ↗')}
    ${card('#2f7152','SMS — Twilio','Configured','#2f7152','Appointment reminders and confirmations by text message.',
      keyRow('Twilio Account SID','Set in app','b-app','console.twilio.com') + keyRow('Twilio from number','Set in app','b-app',''), 'console.twilio.com ↗')}
  </div>

  <div class="cat">Payments &amp; Finance</div>
  <div class="grid">
    ${card('#bd8b3c','Payments — Stripe','Key valid · webhook not verified','#9a6b1f','Card deposits and treatment payments, reconciled against bookings.',
      keyRow('Stripe secret key','From hosting','b-env','Build-time key',false) + urlRow('Payment webhook','https://kclinics.co.uk/api/stripe/webhook','Stripe → Developers → Webhooks.'), 'dashboard.stripe.com ↗')}
    ${card('#bd8b3c','Accounting — Xero','Credentials present — connect via OAuth','#9a6b1f','Live cash position from Xero, feeding the cashflow forecast.',
      keyRow('Xero client ID','Set in app','b-app','developer.xero.com') + '<a class="connect">Connect Xero</a>' + urlRow('OAuth redirect URI','https://kclinics.co.uk/api/admin/integrations/xero/callback','Paste into your Xero app → Redirect URIs.'), 'developer.xero.com ↗')}
  </div>

  <div class="cat">AI</div>
  <div class="grid">
    ${card('#2f7152','AI — Anthropic (Claude)','Key valid · models reachable','#2f7152','Kiosk read-out, live-chat assistant, Get-My-Plan, marketing copy and SEO help.',
      keyRow('Anthropic (Claude) API key','Set in app','b-app','console.anthropic.com'), 'console.anthropic.com ↗')}
    ${card('#b7a294','Voice notes — Deepgram','Not checked yet — press Re-check','#7d6259','Transcribes dictated appointment notes; Claude drafts the clinical note.',
      keyRow('Deepgram API key','Not set','b-unset','console.deepgram.com'), 'console.deepgram.com ↗')}
  </div>
</body></html>`;

const out = path.join(__dirname, '.centre.html');
fs.writeFileSync(out, html);
(async () => {
  const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1240, height: 1180 }, deviceScaleFactor: 2 });
  await p.goto('file://' + out, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(1200);
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  await p.screenshot({ path: path.join(__dirname, 'shots', 'centre.png'), fullPage: true });
  await b.close();
  fs.unlinkSync(out);
  console.log('mock rendered');
})();
