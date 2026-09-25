// GEO (generative engine optimisation) health check for the live site.
//   node scripts/geo-check.mjs            → checks $BASE_URL (default https://kclinics.co.uk)
//   node scripts/geo-check.mjs --json     → machine-readable output
//
// Verifies the surfaces AI answer engines and search crawlers read:
//   • robots.txt names the AI crawlers and points at the sitemap
//   • /llms.txt and /llms-full.txt exist and carry the academy + clinic facts
//   • sitemap.xml lists the academy policies hub
//   • key pages carry the JSON-LD entities they are meant to (clinic, academy,
//     course list, FAQ, product list) and a canonical + description
// Exit code 1 when any check fails, so it can run as a routine gate.
const BASE = (process.env.BASE_URL || 'https://kclinics.co.uk').replace(/\/$/, '');
const asJson = process.argv.includes('--json');
const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); if (!asJson) console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };

async function get(path) {
  const res = await fetch(BASE + path, { headers: { 'user-agent': 'kclinics-geo-check/1.0' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  return { status: res.status, text: await res.text(), type: res.headers.get('content-type') || '' };
}

function jsonLdTypes(html) {
  const types = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1]);
      for (const node of Array.isArray(data) ? data : [data]) {
        const t = node?.['@type'];
        if (Array.isArray(t)) types.push(...t); else if (t) types.push(t);
      }
    } catch { types.push('INVALID_JSON'); }
  }
  return types;
}

const pick = (html, re) => (html.match(re) || [])[1] || '';

async function checkPage(path, expectTypes, { optional = false } = {}) {
  let r;
  try { r = await get(path); } catch (e) { ok(`${path} fetch`, optional, String(e.message)); return; }
  if (r.status !== 200) { ok(`${path} status`, optional && r.status === 404, `HTTP ${r.status}`); return; }
  const types = jsonLdTypes(r.text);
  ok(`${path} JSON-LD valid`, !types.includes('INVALID_JSON'), types.join(', ') || 'none');
  for (const t of expectTypes) ok(`${path} has ${t}`, types.includes(t));
  const desc = pick(r.text, /<meta name="description" content="([^"]*)"/);
  ok(`${path} meta description 50–170 chars`, desc.length >= 50 && desc.length <= 170, `${desc.length} chars`);
  const canonical = pick(r.text, /<link rel="canonical" href="([^"]*)"/);
  ok(`${path} canonical set`, canonical.startsWith(BASE), canonical || 'missing');
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(r.text);
  ok(`${path} indexable`, !noindex || optional, noindex ? 'noindex present' : '');
}

(async () => {
  if (!asJson) console.log(`GEO check → ${BASE}\n`);

  const robots = await get('/robots.txt');
  ok('robots.txt 200', robots.status === 200);
  ok('robots.txt names GPTBot', /User-Agent:\s*GPTBot/i.test(robots.text));
  ok('robots.txt names ClaudeBot', /User-Agent:\s*ClaudeBot/i.test(robots.text));
  ok('robots.txt names PerplexityBot', /User-Agent:\s*PerplexityBot/i.test(robots.text));
  ok('robots.txt sitemap line', /Sitemap:\s*\S+sitemap\.xml/i.test(robots.text));
  ok('robots.txt still blocks /admin', /Disallow:\s*\/admin/.test(robots.text));

  const llms = await get('/llms.txt');
  ok('llms.txt 200 text/plain', llms.status === 200 && /text\/plain/.test(llms.type), llms.type);
  ok('llms.txt names the academy', /K Academy/.test(llms.text));
  ok('llms.txt lists courses', /## Courses/.test(llms.text));
  ok('llms.txt states the funding position', /not expected before 2028|not available through K Academy/i.test(llms.text));
  ok('llms.txt links the policies hub', /\/academy\/policies/.test(llms.text));
  ok('llms.txt points at llms-full.txt', /llms-full\.txt/.test(llms.text));

  const full = await get('/llms-full.txt');
  ok('llms-full.txt 200', full.status === 200, `${(full.text.length / 1024).toFixed(0)} KB`);
  ok('llms-full.txt carries treatment FAQs', /### /.test(full.text) && /Treatments/.test(full.text));
  ok('llms-full.txt carries centre policies', /Malpractice and Maladministration/.test(full.text));

  const sm = await get('/sitemap.xml');
  ok('sitemap.xml 200', sm.status === 200, `${(sm.text.match(/<url>/g) || []).length} URLs`);
  ok('sitemap lists /academy', sm.text.includes(`${BASE}/academy</loc>`));
  ok('sitemap lists /academy/policies', sm.text.includes(`${BASE}/academy/policies</loc>`));

  await checkPage('/', ['MedicalClinic', 'WebSite']);
  await checkPage('/academy', ['EducationalOrganization', 'ItemList', 'FAQPage', 'BreadcrumbList']);
  await checkPage('/academy/funding', ['FAQPage', 'BreadcrumbList']);
  await checkPage('/academy/policies', ['ItemList', 'BreadcrumbList']);
  await checkPage('/academy/policies/appeals', ['BreadcrumbList']);
  await checkPage('/pricing', ['OfferCatalog']);
  await checkPage('/faq', ['FAQPage']);
  // Shop is noindex/404-free only while products exist; treat as optional.
  await checkPage('/shop', ['ItemList'], { optional: true });

  const failed = results.filter((r) => !r.pass);
  if (asJson) console.log(JSON.stringify({ base: BASE, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  else console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` — ${failed.length} failing` : ''}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('geo-check crashed:', e); process.exit(2); });
