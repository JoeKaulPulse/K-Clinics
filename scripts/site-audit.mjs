// K-Clinics marketing-site audit (BLD-226 follow-on, item 2). For a curated set
// of public pages: desktop+mobile screenshots, technical-SEO signals, structural
// checks, and a real axe-core accessibility scan. Output → qa-output/site-audit/.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'https://kclinics.co.uk';
const OUT = 'qa-output/site-audit';
mkdirSync(`${OUT}/shots`, { recursive: true });
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

const PAGES = [
  ['home', '/'],
  ['treatments', '/treatments'],
  ['treatment-finder', '/treatment-finder'],
  ['academy', '/academy'],
  ['academy-course', '/academy/level-2-foundation-skin-laser'],
  ['pricing', '/pricing'],
  ['membership', '/membership'],
  ['finance', '/finance'],
  ['ai-consultation', '/ai-consultation'],
  ['book', '/book'],
  ['about', '/about'],
  ['contact', '/contact'],
  ['journal', '/journal'],
  ['reviews', '/reviews'],
  ['gallery', '/gallery'],
  ['gift-vouchers', '/gift-vouchers'],
];

const EXTRACT = `(() => {
  const $ = (s) => document.querySelector(s);
  const all = (s) => [...document.querySelectorAll(s)];
  const meta = (n) => (document.querySelector(\`meta[name="\${n}"]\`)?.content || document.querySelector(\`meta[property="\${n}"]\`)?.content || null);
  const headings = all('h1,h2,h3,h4,h5,h6').map(h => h.tagName + ':' + (h.textContent||'').trim().slice(0,60));
  const imgs = all('img');
  const links = all('a[href]');
  const host = location.host;
  const jsonld = all('script[type="application/ld+json"]').map(s => { try { const j = JSON.parse(s.textContent); return Array.isArray(j) ? j.map(x=>x['@type']).join(',') : (j['@type']||'?'); } catch { return 'invalid-json'; } });
  return {
    title: document.title || null,
    titleLen: (document.title||'').length,
    description: meta('description'),
    descLen: (meta('description')||'').length,
    canonical: $('link[rel=canonical]')?.href || null,
    robots: meta('robots'),
    ogTitle: meta('og:title'), ogImage: meta('og:image'), ogType: meta('og:type'),
    twitterCard: meta('twitter:card'),
    lang: document.documentElement.lang || null,
    viewport: $('meta[name=viewport]')?.content || null,
    h1Count: all('h1').length,
    headingCount: headings.length,
    headings: headings.slice(0, 40),
    imgCount: imgs.length,
    imgMissingAlt: imgs.filter(i => !i.hasAttribute('alt') || i.getAttribute('alt')===null).length,
    imgEmptyAlt: imgs.filter(i => i.getAttribute('alt')==='').length,
    linksTotal: links.length,
    linksInternal: links.filter(a => { try { return new URL(a.href).host === host; } catch { return false; } }).length,
    jsonldTypes: jsonld,
    hasSkipLink: !!all('a[href^="#"]').find(a => /skip/i.test(a.textContent||'')),
    landmarks: { header: !!$('header'), nav: !!$('nav'), main: !!$('main'), footer: !!$('footer') },
    wordCount: (document.body.innerText||'').trim().split(/\\s+/).length,
    buttonsNoLabel: all('button').filter(b => !(b.textContent||'').trim() && !b.getAttribute('aria-label')).length,
    inputsNoLabel: all('input,select,textarea').filter(el => {
      if (['hidden','submit','button'].includes(el.type)) return false;
      const id = el.id; const lab = id && document.querySelector(\`label[for="\${CSS.escape(id)}"]\`);
      return !lab && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.closest('label');
    }).length,
  };
})()`;

const results = [];
const browser = await chromium.launch();
const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true, userAgent: 'Mozilla/5.0 (KClinics-Audit) Chrome/148 Safari/537.36' });
const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true, isMobile: true });

for (const [name, path] of PAGES) {
  const rec = { name, path, url: BASE + path };
  // Desktop: signals + axe + screenshot
  const pd = await ctxD.newPage();
  const consoleErrors = [];
  pd.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 180)); });
  try {
    const resp = await pd.goto(BASE + path, { waitUntil: 'load', timeout: 45000 }).catch(() => null);
    rec.status = resp?.status() ?? null;
    await pd.waitForTimeout(1500);
    rec.seo = await pd.evaluate(EXTRACT).catch((e) => ({ error: String(e).slice(0, 120) }));
    await pd.addScriptTag({ content: AXE });
    const axe = await pd.evaluate(async () => {
      // @ts-ignore
      const r = await axe.run(document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } });
      return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help }));
    }).catch((e) => [{ id: 'axe-error', impact: 'n/a', n: 0, help: String(e).slice(0, 120) }]);
    rec.axe = axe;
    rec.axeCounts = axe.reduce((a, v) => { a[v.impact] = (a[v.impact] || 0) + 1; return a; }, {});
    rec.consoleErrors = consoleErrors.slice(0, 6);
    await pd.screenshot({ path: `${OUT}/shots/${name}-desktop.png`, fullPage: true });
  } catch (e) { rec.error = String(e).slice(0, 160); }
  await pd.close();
  // Mobile: screenshot only
  const pm = await ctxM.newPage();
  try {
    await pm.goto(BASE + path, { waitUntil: 'load', timeout: 45000 }).catch(() => null);
    await pm.waitForTimeout(1200);
    await pm.screenshot({ path: `${OUT}/shots/${name}-mobile.png`, fullPage: false });
  } catch {}
  await pm.close();
  results.push(rec);
  console.log(`✓ ${name} — status ${rec.status} · a11y ${JSON.stringify(rec.axeCounts||{})} · h1=${rec.seo?.h1Count} · title=${rec.seo?.titleLen}c · desc=${rec.seo?.descLen}c`);
}

await browser.close();
writeFileSync(`${OUT}/audit.json`, JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
// quick rollups
const totViol = results.reduce((a, r) => a + (r.axe?.length || 0), 0);
console.log(`\nPages: ${results.length} · total axe violation-rules: ${totViol}`);
console.log('Missing meta description:', results.filter(r => !r.seo?.description).map(r => r.name).join(', ') || 'none');
console.log('Multiple/zero H1:', results.filter(r => (r.seo?.h1Count ?? 1) !== 1).map(r => `${r.name}(${r.seo?.h1Count})`).join(', ') || 'all single');
console.log('No JSON-LD:', results.filter(r => !(r.seo?.jsonldTypes?.length)).map(r => r.name).join(', ') || 'all have some');
