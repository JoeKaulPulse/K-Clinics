// Branded PDF report generator for K-Clinics audits.
//   node scripts/make-report-pdf.mjs <data.json> <out.pdf>
// Renders a data-driven, brand-compliant HTML report and prints it to PDF via
// Chromium. Brand rule: the logo is the supplied K monogram + CLINICS wordmark
// (rendered as inline SVG below) — never the brand name typeset as plain text.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const [, , dataPath, outPath = 'qa-output/report.pdf'] = process.argv;
const D = JSON.parse(readFileSync(dataPath, 'utf8'));

const K_PATH = 'M128.115 113.115C125.458 111.125 125.24 111.219 95.9687 125.833C47.875 149.844 33.4896 155.943 26.1823 155.391C18.5521 154.812 19.7552 142.432 28.9375 126.969C33.0573 120.031 41.0677 108.969 66.7552 74.7187C92.7291 40.1041 105.505 20.802 105.901 15.6093C106.047 13.5885 105.818 13.0416 104.615 12.6406C101.948 11.7447 100.547 12.5156 99.1666 15.6354C96.4479 21.7604 83.7291 39.5572 57.6562 73.7083C28.3125 112.151 21.2239 122.458 16.5521 133.526L14.0521 139.443L14.375 129.479C14.8541 114.875 17.4323 82.3177 18.9843 71.4531C22.2031 48.7812 25.4375 33.2916 30.8698 14.3697C34.2864 2.47912 34.3229 2.27079 33.1771 1.276C31.7916 0.0780791 27.1927 -0.416713 25.4218 0.442662C21.1823 2.48433 12.901 30.552 8.0781 59.2083C7.40101 63.2291 5.78122 69.401 4.40101 73.1822C-0.140655 85.6458 -0.21357 86.4322 3.05205 86.6718C4.4531 86.7812 4.46872 87.0416 4.05205 98.3697C2.6406 136.875 2.88018 186.24 4.60935 210.562C5.78643 227.266 6.74476 230.797 10.4791 232.339C13.151 233.437 15.6823 233.203 16.3281 231.802C16.5677 231.276 16.4271 228.135 16.0052 224.755C15.0833 217.286 14.4375 206.182 14.1458 192.568C13.8906 180.995 13.7968 157.656 13.9896 155.062L14.1198 153.302L15.8125 155.271C21.0364 161.333 32.7552 160.469 51.3385 152.651C60.0156 149.005 125.911 116.344 128 114.656C128.911 113.927 128.927 113.713 128.115 113.115Z';
const WORDMARK = '<path d="M0.875977 25.8821C0.875977 39.8949 13.026 50.8986 27.1821 50.8986H90.1532V43.113H27.1821C16.8829 43.113 9.09142 34.814 9.09142 25.8821C9.16306 24.8134 9.23471 24.0253 9.45562 23.2372L9.66459 22.2401C11.4557 14.4485 18.8831 8.80043 26.6746 8.80043C26.8179 8.80043 26.9672 8.80043 27.1105 8.80043H90.0816V0.937256H27.1105C13.1693 0.937256 0.875977 11.8693 0.875977 25.8821Z"/><path d="M111.468 43.1847V0.937256H103.312V50.9762H176.087V43.1847H111.468Z"/><path d="M189.252 50.9762H197.467V0.937256H189.252V50.9762Z"/><path d="M213.498 50.6181H221.713V13.0933C289.831 44.8326 300.626 50.1225 302.411 50.827L302.704 50.9763V0.937353H294.548V38.4621L213.498 0.656738V50.6181Z"/><path d="M318.723 50.9762H326.938V0.937256H318.723V50.9762Z"/><path d="M340.82 25.8821C340.82 39.8949 352.97 50.8986 367.126 50.8986H430.103V43.113H367.126C356.838 43.113 349.047 34.814 349.047 25.8821C349.113 24.8134 349.184 24.0253 349.399 23.2372L349.608 22.2401C351.399 14.4485 358.839 8.80043 366.63 8.80043C366.767 8.80043 366.911 8.80043 367.054 8.80043H430.025V0.937256H367.054C353.113 0.937256 340.82 11.8693 340.82 25.8821Z"/><path d="M441.118 50.8269H515.033C523.392 50.8269 530.181 44.2534 530.181 36.3186C530.181 28.3181 522.753 21.8878 515.099 21.8878H456.2C452.343 21.8878 449.274 18.8787 449.274 15.2367C449.274 11.4454 452.486 8.80043 455.848 8.80043C455.985 8.80043 456.128 8.80043 456.278 8.80043H530.181V0.937256H456.278C448.343 0.937256 441.19 7.23019 441.19 15.2367V15.5173C441.19 23.7447 448.701 29.8167 456.128 29.8167H515.171C518.89 29.8167 521.965 32.6766 521.965 36.3902C521.965 40.0382 518.89 43.0414 515.033 43.0414H441.118V50.8269Z"/>';
const kmark = (color, h = 56) => `<svg viewBox="0 0 130 234" height="${h}" style="color:${color}"><path fill="currentColor" d="${K_PATH}"/></svg>`;
const wordmark = (color, h = 22) => `<svg viewBox="0 0 531 51" height="${h}" style="color:${color}"><g fill="currentColor">${WORDMARK}</g></svg>`;
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');

const scoreColor = (v) => v >= 8 ? '#2f7152' : v >= 6 ? '#816748' : v >= 4 ? '#b8863b' : '#b23b3b';
const bar = (v, who) => `<div class="bar"><div class="bar-fill" style="width:${v * 10}%;background:${who === 'after' ? scoreColor(v) : '#b7a294'}"></div><span class="bar-val">${v.toFixed(1)}</span></div>`;

const ratingsRows = (D.ratings || []).map((r) => {
  const delta = (r.after - r.before);
  return `<tr><td class="dim">${esc(r.dimension)}</td><td>${bar(r.before, 'before')}</td><td>${bar(r.after, 'after')}</td><td class="delta">${delta > 0 ? '+' : ''}${delta.toFixed(1)}</td><td class="note">${md(r.note || '')}</td></tr>`;
}).join('');

const avg = (k) => (D.ratings || []).length ? ((D.ratings.reduce((a, r) => a + r[k], 0) / D.ratings.length)) : 0;
const beforeAvg = avg('before'), afterAvg = avg('after');

const dimSections = (D.dimensions || []).map((d) => `
  <section class="dim-block avoid-break">
    <h3>${esc(d.name)} <span class="scorechip" style="background:${scoreColor(d.before)}">${d.before.toFixed(1)}</span><span class="arrow">→</span><span class="scorechip" style="background:${scoreColor(d.after)}">${d.after.toFixed(1)}</span></h3>
    ${d.summary ? `<p>${md(d.summary)}</p>` : ''}
    ${d.findings?.length ? `<p class="lbl">What's holding the score down</p><ul>${d.findings.map((f) => `<li>${md(f)}</li>`).join('')}</ul>` : ''}
    ${d.corrections?.length ? `<p class="lbl">Corrections that move the score</p><ul class="fix">${d.corrections.map((f) => `<li>${md(f)}</li>`).join('')}</ul>` : ''}
  </section>`).join('');

const planSections = (D.implementationPlan || []).map((p) => `
  <section class="avoid-break"><h3>${esc(p.phase)}</h3><ul>${p.items.map((i) => `<li>${md(i)}</li>`).join('')}</ul></section>`).join('');

const listBlock = (arr) => `<ul>${(arr || []).map((x) => `<li>${md(x)}</li>`).join('')}</ul>`;

const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Geist:wght@400;500;600&display=swap'); /* PRJ-1032.34: brand body font is Geist, not Inter */
:root{--ink:#2a2420;--stone:#7d6259;--porcelain:#f6ece3;--bone:#efe3d7;--sand:#e3d3c4;--gold:#a98a6d;--gold-deep:#816748;--jade:#2f7152;--line:rgba(42,36,32,.12)}
*{box-sizing:border-box}
@page{size:A4;margin:18mm 16mm}
@page:first{margin:0}
body{font-family:Geist,system-ui,sans-serif;color:var(--ink);font-size:10.5pt;line-height:1.55;margin:0}
h1,h2,h3{font-family:Fraunces,Georgia,serif;font-weight:500;line-height:1.15}
h2{font-size:19pt;margin:0 0 4pt;border-bottom:2px solid var(--gold-deep);padding-bottom:6pt}
h3{font-size:13pt;margin:14pt 0 4pt}
p{margin:0 0 7pt}
code{background:var(--bone);padding:.5pt 3pt;border-radius:3px;font-size:9pt}
ul{margin:0 0 8pt;padding-left:16pt}li{margin:0 0 3pt}
.lbl{font-size:8pt;text-transform:uppercase;letter-spacing:.12em;color:var(--gold-deep);font-weight:600;margin:8pt 0 3pt}
.fix li::marker{content:'✓  ';color:var(--jade)}
.cover{height:297mm;background:var(--ink);color:var(--porcelain);display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 30mm}
.cover .lock{display:flex;flex-direction:column;align-items:center;gap:10mm;margin-bottom:16mm}
.cover h1{font-size:30pt;color:var(--porcelain);margin:0 0 6pt}
.cover .sub{color:var(--gold);font-size:12pt;letter-spacing:.04em;max-width:150mm}
.cover .eyebrow{text-transform:uppercase;letter-spacing:.28em;font-size:9pt;color:var(--gold);margin-bottom:8mm}
.cover .meta{margin-top:14mm;font-size:9.5pt;color:#bcae9f}
.section{padding-top:2mm}
.headline{display:flex;gap:8mm;margin:6pt 0 12pt}
.bignum{flex:1;background:var(--bone);border:1px solid var(--line);border-radius:8px;padding:9pt 11pt;text-align:center}
.bignum .n{font-family:Fraunces,serif;font-size:26pt;line-height:1}
.bignum .l{font-size:8pt;text-transform:uppercase;letter-spacing:.1em;color:var(--stone);margin-top:3pt}
table{width:100%;border-collapse:collapse;font-size:9.5pt;margin:6pt 0 10pt}
th{text-align:left;font-size:7.5pt;text-transform:uppercase;letter-spacing:.1em;color:var(--stone);border-bottom:1px solid var(--line);padding:4pt 6pt}
td{border-bottom:1px solid var(--line);padding:5pt 6pt;vertical-align:middle}
td.dim{font-weight:600;width:24%}
td.note{font-size:8.5pt;color:#5b5048;width:34%}
td.delta{font-weight:600;color:var(--jade);text-align:center}
.bar{position:relative;background:var(--bone);border-radius:5px;height:13pt;width:120pt;overflow:hidden}
.bar-fill{height:100%;border-radius:5px}
.bar-val{position:absolute;right:5pt;top:0;line-height:13pt;font-size:8pt;font-weight:600}
.scorechip{display:inline-block;color:#fff;font-family:Geist;font-size:9pt;font-weight:600;padding:1pt 6pt;border-radius:20px;vertical-align:middle}
.arrow{color:var(--stone);margin:0 4pt}
.avoid-break{break-inside:avoid}
.callout{background:var(--bone);border-left:3px solid var(--gold-deep);padding:8pt 11pt;border-radius:0 6px 6px 0;margin:8pt 0}
.footer{position:fixed;bottom:6mm;left:16mm;right:16mm;display:flex;justify-content:space-between;font-size:7.5pt;color:var(--stone);border-top:1px solid var(--line);padding-top:3pt}
.page-break{break-before:page}
.tag{display:inline-block;font-size:7.5pt;background:var(--sand);color:var(--gold-deep);padding:1pt 6pt;border-radius:20px;margin-left:4pt}
</style></head><body>

<div class="cover">
  <div class="lock">${kmark('#f6ece3', 90)}${wordmark('#f6ece3', 26)}</div>
  <div class="eyebrow">${esc(D.meta?.eyebrow || 'Audit & ratings')}</div>
  <h1>${esc(D.meta?.title || '')}</h1>
  <div class="sub">${esc(D.meta?.subtitle || '')}</div>
  <div class="meta">${esc(D.meta?.date || '')} · ${esc(D.meta?.author || '')}<br>${esc(D.meta?.site || '')}</div>
</div>

<div class="footer"><span>${wordmark('#7d6259', 9)}</span><span>${esc(D.meta?.title || '')}</span></div>

<div class="section">
  <h2>Executive summary</h2>
  <div class="headline">
    <div class="bignum"><div class="n" style="color:${scoreColor(beforeAvg)}">${beforeAvg.toFixed(1)}</div><div class="l">Overall now</div></div>
    <div class="bignum"><div class="n" style="color:${scoreColor(afterAvg)}">${afterAvg.toFixed(1)}</div><div class="l">Overall after fixes</div></div>
    <div class="bignum"><div class="n" style="color:var(--jade)">+${(afterAvg - beforeAvg).toFixed(1)}</div><div class="l">Projected uplift</div></div>
  </div>
  ${(D.execSummary || []).map((p) => `<p>${md(p)}</p>`).join('')}
</div>

<div class="page-break"></div>
<div class="section">
  <h2>Ratings — before &amp; after</h2>
  <table><thead><tr><th>Dimension</th><th>Now</th><th>After fixes</th><th>Δ</th><th>Why</th></tr></thead><tbody>${ratingsRows}</tbody></table>
  <p style="font-size:8.5pt;color:var(--stone)">Scores are 0–10. "Now" reflects the live site at audit date; "After fixes" is the projected score once the corrections in this report are implemented. Method below.</p>
</div>

<div class="section">
  <h2>Method &amp; principles</h2>
  <h3>How this was assessed</h3>${listBlock(D.methodology)}
  <h3>Design principles applied</h3>${listBlock(D.principles)}
</div>

<div class="page-break"></div>
<div class="section">
  <h2>Dimension-by-dimension analysis</h2>
  ${dimSections}
</div>

<div class="page-break"></div>
<div class="section">
  <h2>Implementation plan</h2>
  ${planSections}
</div>

${D.appendix ? `<div class="page-break"></div><div class="section"><h2>${esc(D.appendix.title || 'Appendix')}</h2>${(D.appendix.body || []).map((p) => `<p>${md(p)}</p>`).join('')}${D.appendix.list ? listBlock(D.appendix.list) : ''}</div>` : ''}

</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);
await page.pdf({ path: outPath, format: 'A4', printBackground: true, displayHeaderFooter: false, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
// Also emit a full-page PNG preview for quick visual verification.
await page.setViewportSize({ width: 1000, height: 1414 });
await page.screenshot({ path: outPath.replace(/\.pdf$/, '-preview.png'), fullPage: true });
await browser.close();
console.log('PDF written →', outPath);
