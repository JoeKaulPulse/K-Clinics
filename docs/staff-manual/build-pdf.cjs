// Regenerates the branded "Staff Operating Manual" PDF for the clinic team.
// Run from the repo root:  node docs/staff-manual/build-pdf.cjs
// Requires Playwright Chromium (installed by .claude/hooks/session-start.sh).
// Brand tokens mirror app/globals.css; the logo uses the supplied marks from
// components/brand/marks.tsx (K monogram + CLINICS wordmark) — never typeset.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'KClinics-Staff-Manual.pdf');
const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// Supplied brand marks (inline SVG, fill = currentColor) — from components/brand/marks.tsx
const K_PATH = 'M128.115 113.115C125.458 111.125 125.24 111.219 95.9687 125.833C47.875 149.844 33.4896 155.943 26.1823 155.391C18.5521 154.812 19.7552 142.432 28.9375 126.969C33.0573 120.031 41.0677 108.969 66.7552 74.7187C92.7291 40.1041 105.505 20.802 105.901 15.6093C106.047 13.5885 105.818 13.0416 104.615 12.6406C101.948 11.7447 100.547 12.5156 99.1666 15.6354C96.4479 21.7604 83.7291 39.5572 57.6562 73.7083C28.3125 112.151 21.2239 122.458 16.5521 133.526L14.0521 139.443L14.375 129.479C14.8541 114.875 17.4323 82.3177 18.9843 71.4531C22.2031 48.7812 25.4375 33.2916 30.8698 14.3697C34.2864 2.47912 34.3229 2.27079 33.1771 1.276C31.7916 0.0780791 27.1927 -0.416713 25.4218 0.442662C21.1823 2.48433 12.901 30.552 8.0781 59.2083C7.40101 63.2291 5.78122 69.401 4.40101 73.1822C-0.140655 85.6458 -0.21357 86.4322 3.05205 86.6718C4.4531 86.7812 4.46872 87.0416 4.05205 98.3697C2.6406 136.875 2.88018 186.24 4.60935 210.562C5.78643 227.266 6.74476 230.797 10.4791 232.339C13.151 233.437 15.6823 233.203 16.3281 231.802C16.5677 231.276 16.4271 228.135 16.0052 224.755C15.0833 217.286 14.4375 206.182 14.1458 192.568C13.8906 180.995 13.7968 157.656 13.9896 155.062L14.1198 153.302L15.8125 155.271C21.0364 161.333 32.7552 160.469 51.3385 152.651C60.0156 149.005 125.911 116.344 128 114.656C128.911 113.927 128.927 113.713 128.115 113.115Z';
const CLINICS_SVG = `<svg viewBox="0 0 531 51" preserveAspectRatio="xMidYMid meet" fill="currentColor" aria-label="CLINICS"><path d="M0.875977 25.8821C0.875977 39.8949 13.026 50.8986 27.1821 50.8986H90.1532V43.113H27.1821C16.8829 43.113 9.09142 34.814 9.09142 25.8821C9.16306 24.8134 9.23471 24.0253 9.45562 23.2372L9.66459 22.2401C11.4557 14.4485 18.8831 8.80043 26.6746 8.80043C26.8179 8.80043 26.9672 8.80043 27.1105 8.80043H90.0816V0.937256H27.1105C13.1693 0.937256 0.875977 11.8693 0.875977 25.8821Z"/><path d="M111.468 43.1847V0.937256H103.312V50.9762H176.087V43.1847H111.468Z"/><path d="M189.252 50.9762H197.467V0.937256H189.252V50.9762Z"/><path d="M213.498 50.6181H221.713V13.0933C289.831 44.8326 300.626 50.1225 302.411 50.827L302.704 50.9763V0.937353H294.548V38.4621L213.498 0.656738V50.6181Z"/><path d="M318.723 50.9762H326.938V0.937256H318.723V50.9762Z"/><path d="M340.82 25.8821C340.82 39.8949 352.97 50.8986 367.126 50.8986H430.103V43.113H367.126C356.838 43.113 349.047 34.814 349.047 25.8821C349.113 24.8134 349.184 24.0253 349.399 23.2372L349.608 22.2401C351.399 14.4485 358.839 8.80043 366.63 8.80043C366.767 8.80043 366.911 8.80043 367.054 8.80043H430.025V0.937256H367.054C353.113 0.937256 340.82 11.8693 340.82 25.8821Z"/><path d="M441.118 50.8269H515.033C523.392 50.8269 530.181 44.2534 530.181 36.3186C530.181 28.3181 522.753 21.8878 515.099 21.8878H456.2C452.343 21.8878 449.274 18.8787 449.274 15.2367C449.274 11.4454 452.486 8.80043 455.848 8.80043C455.985 8.80043 456.128 8.80043 456.278 8.80043H530.181V0.937256H456.278C448.343 0.937256 441.19 7.23019 441.19 15.2367V15.5173C441.19 23.7447 448.701 29.8167 456.128 29.8167H515.171C518.89 29.8167 521.965 32.6766 521.965 36.3902C521.965 40.0382 518.89 43.0414 515.033 43.0414H441.118V50.8269Z"/></svg>`;
const K_SVG = `<svg viewBox="0 0 130 234" preserveAspectRatio="xMidYMid meet" aria-label="K"><path fill="currentColor" d="${K_PATH}"/></svg>`;

// ---- content model is defined in ./content.js (kept separate for editing) ----
const { CONTENT } = require('./content.js');

// ---------- renderers ----------
const esc = (s) => String(s);
function roleTags(roles) {
  if (!roles || !roles.length) return '';
  return `<span class="roles">${roles.map((r) => `<span class="role r-${r.toLowerCase().replace(/[^a-z]/g, '')}">${r}</span>`).join('')}</span>`;
}
function blocks(bs) {
  let out = '';
  for (const b of bs) {
    if (b.h3) out += `<h3>${b.h3}</h3>`;
    else if (b.p) out += `<p>${b.p}</p>`;
    else if (b.ul) out += `<ul>${b.ul.map((li) => `<li>${li}</li>`).join('')}</ul>`;
    else if (b.task) {
      const t = b.task;
      out += `<div class="task"><div class="t">${t.title}${roleTags(t.roles)}</div>`;
      if (t.intro) out += `<p class="ti">${t.intro}</p>`;
      if (t.steps) out += `<ol>${t.steps.map((s) => `<li>${s}</li>`).join('')}</ol>`;
      if (t.done) out += `<div class="done">Done when: ${t.done}</div>`;
      out += `</div>`;
    } else if (b.note) {
      const label = (typeof b.note === 'object' ? b.note.label : b.label) || 'Note';
      const text = typeof b.note === 'object' ? b.note.note : b.note;
      out += `<div class="callout"><span class="pill">${label}</span><p>${text}</p></div>`;
    } else if (b.table) {
      const { head, rows, widths } = b.table;
      out += `<table><thead><tr>${head.map((h, i) => `<th${widths && widths[i] ? ` style="width:${widths[i]}"` : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
  }
  return out;
}
function sectionHtml(s, n) {
  return `<section class="sec"><div class="sec-h"><span class="n">${String(n).padStart(2, '0')}</span><h2>${s.title}</h2></div>${s.lead ? `<p class="lead">${s.lead}</p>` : ''}${blocks(s.blocks)}</section>`;
}

const toc = CONTENT.sections.map((s, i) => `<li><span class="tn">${String(i + 1).padStart(2, '0')}</span><span>${s.title}</span></li>`).join('');
const body = CONTENT.sections.map((s, i) => sectionHtml(s, i + 1)).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Geist:wght@300;400;500;600&display=swap');
  :root{
    --ink:#2a2420; --ink-soft:#3d352f; --espresso:#4a3f37; --porcelain:#f6ece3; --bone:#efe3d7;
    --sand:#e3d3c4; --stone:#7d6259; --stone-soft:#b7a294; --gold:#a98a6d; --gold-soft:#c2a589;
    --gold-bright:#dcc4a8; --gold-deep:#856a4a; --jade:#2f7152; --blush:#cdb4a3;
    --line:rgba(42,36,32,.14);
  }
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  html,body{margin:0;padding:0;}
  body{font-family:'Geist',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:var(--ink);font-size:10.2px;line-height:1.55;background:#fff;}
  h1,h2,h3,.disp{font-family:'Fraunces',Georgia,serif;font-weight:500;margin:0;}
  a{color:var(--gold-deep);text-decoration:none;word-break:break-word;}
  code{font-family:'Geist Mono',ui-monospace,'SF Mono',Menlo,monospace;font-size:9px;background:var(--bone);padding:1px 5px;border-radius:4px;color:var(--ink);white-space:nowrap;}
  /* ---- cover ---- */
  .cover{height:100vh;background:var(--ink);color:var(--porcelain);padding:64px 60px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;}
  .cover::after{content:"";position:absolute;right:-120px;top:-120px;width:460px;height:460px;border-radius:50%;background:radial-gradient(circle,rgba(220,196,168,.16),transparent 70%);}
  .lockup{display:flex;flex-direction:column;align-items:flex-start;gap:12px;color:var(--porcelain);}
  .lockup .k{width:46px;height:60px;}
  .lockup .w{width:172px;height:auto;}
  .cover-title{margin-top:auto;}
  .cover-title .ey{color:var(--gold-soft);font-size:11px;letter-spacing:.26em;text-transform:uppercase;}
  .cover-title h1{font-size:54px;line-height:1.04;margin-top:16px;max-width:84%;font-weight:600;}
  .cover-title .sub{color:var(--gold-bright);font-size:13px;margin-top:18px;max-width:60%;line-height:1.5;}
  .cover-meta{margin-top:28px;display:flex;gap:30px;flex-wrap:wrap;color:var(--gold-bright);font-size:10px;letter-spacing:.04em;}
  .cover-meta b{color:var(--porcelain);font-weight:600;display:block;margin-top:2px;font-size:11px;}
  /* ---- contents ---- */
  .toc{padding:48px 60px;page-break-after:always;}
  .toc h2{font-size:13px;color:var(--gold-deep);letter-spacing:.14em;text-transform:uppercase;margin-bottom:18px;}
  .toc ol{list-style:none;margin:0;padding:0;columns:2;column-gap:40px;}
  .toc li{display:flex;gap:12px;align-items:baseline;margin-bottom:9px;break-inside:avoid;font-size:11px;}
  .toc .tn{font-family:'Fraunces',serif;color:var(--gold);font-size:12px;min-width:22px;}
  /* ---- body ---- */
  .page{padding:0 60px 70px;}
  .sec{margin-top:30px;break-inside:auto;}
  .sec:first-child{margin-top:6px;}
  .sec-h{display:flex;align-items:baseline;gap:12px;border-bottom:1.5px solid var(--gold);padding-bottom:7px;margin-bottom:13px;break-after:avoid;}
  .sec-h .n{font-family:'Fraunces',serif;font-size:21px;color:var(--gold-deep);}
  .sec-h h2{font-size:19px;}
  .lead{color:var(--stone);margin:0 0 14px;font-size:10.4px;max-width:92%;}
  h3{font-size:8.8px;color:var(--gold-deep);text-transform:uppercase;letter-spacing:.12em;margin:16px 0 6px;font-family:'Geist',sans-serif;font-weight:600;break-after:avoid;}
  p{margin:0 0 8px;}
  ul{margin:4px 0 10px 16px;padding:0;}
  li{margin:3px 0;}
  .task{break-inside:avoid;margin:0 0 12px;padding-left:14px;border-left:2px solid var(--bone);}
  .task .t{font-weight:600;font-size:10.8px;color:var(--ink);margin-bottom:3px;font-family:'Geist',sans-serif;}
  .task .ti{margin:2px 0 4px;color:var(--stone);font-size:9.8px;}
  .task ol{margin:4px 0 4px 16px;padding:0;}
  .task li{margin:2.5px 0;}
  .task .done{margin-top:5px;font-size:9px;color:var(--jade);font-style:italic;}
  .callout{margin:12px 0;border:1.4px solid var(--gold);background:linear-gradient(180deg,rgba(220,196,168,.20),rgba(220,196,168,.06));border-radius:13px;padding:13px 16px;break-inside:avoid;}
  .callout p{margin:0;color:var(--ink-soft);}
  .callout .pill{display:inline-block;background:var(--ink);color:var(--gold-bright);font-size:8px;letter-spacing:.16em;text-transform:uppercase;padding:3px 9px;border-radius:999px;margin-bottom:8px;}
  .roles{margin-left:8px;display:inline;vertical-align:middle;}
  .role{display:inline-block;font-size:7px;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:999px;margin-left:4px;font-weight:600;font-family:'Geist',sans-serif;}
  .r-owner{background:var(--ink);color:var(--gold-bright);} .r-admin{background:var(--gold);color:#fff;}
  .r-frontdesk{background:#e7efe6;color:#3f6b46;} .r-clinician{background:var(--bone);color:var(--stone);}
  .r-allstaff{background:var(--sand);color:var(--ink-soft);} .r-soon{background:#efe0d0;color:var(--gold-deep);border:1px dashed var(--gold);}
  table{width:100%;border-collapse:collapse;margin:8px 0 12px;font-size:9px;break-inside:auto;}
  th{background:var(--ink);color:var(--porcelain);text-align:left;padding:6px 8px;font-weight:600;font-size:8.4px;letter-spacing:.03em;}
  td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top;}
  tr:nth-child(even) td{background:var(--porcelain);}
  tr{break-inside:avoid;}
  .foot{position:fixed;bottom:0;left:0;right:0;padding:7px 60px;border-top:1px solid var(--line);background:#fff;color:var(--stone);font-size:7.4px;display:flex;justify-content:space-between;align-items:center;}
  .foot .disp{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);}
</style></head>
<body>
  <div class="cover">
    <div class="lockup">
      <div class="k">${K_SVG}</div>
      <div class="w">${CLINICS_SVG}</div>
    </div>
    <div class="cover-title">
      <div class="ey">Staff Operating Manual</div>
      <h1>How the platform works, and your part in it</h1>
      <div class="sub">${CONTENT.coverSub}</div>
      <div class="cover-meta">
        <span>For<b>All clinic staff &amp; the owner</b></span>
        <span>Platform<b>kclinics.co.uk</b></span>
        <span>Version<b>${today}</b></span>
      </div>
    </div>
  </div>

  <div class="toc">
    <h2>What's inside</h2>
    <ol>${toc}</ol>
  </div>

  <div class="page">
    ${body}
  </div>

  <div class="foot">
    <span class="disp">KClinics</span>
    <span>Staff Operating Manual &middot; kclinics.co.uk &middot; confidential — internal use only</span>
    <span>${today}</span>
  </div>
</body></html>`;

const htmlPath = path.join(__dirname, '.manual.html');
fs.writeFileSync(htmlPath, html);

(async () => {
  const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.pdf({ path: OUT, format: 'A4', printBackground: true, displayHeaderFooter: false, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  await browser.close();
  fs.unlinkSync(htmlPath);
  console.log('PDF written →', OUT);
})();
