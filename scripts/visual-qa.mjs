// Visual QA harness — drives a real headless browser through key journeys against
// BASE_URL, screenshots every step, captures console errors + failed requests, and
// writes a report to qa-output/. Test-tagged + auto-cleanup: it records the kiosk
// sessions it creates and deletes them (photos included) at the end via the
// token-authed cleanup endpoint, so running against production leaves no residue.
//
// Run (in a Full-network Visual QA environment):
//   npx playwright install --with-deps chromium   # once, in the env setup script
//   BASE_URL=https://kclinics.co.uk QA_TOKEN=$BOARD_QUEUE_TOKEN node scripts/visual-qa.mjs
//
// Output: qa-output/<step>.png screenshots + qa-output/report.json + report.md.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import path from 'path';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const QA_TOKEN = process.env.QA_TOKEN || process.env.BOARD_QUEUE_TOKEN || '';
const OUT = process.env.QA_OUT || 'qa-output';
const VIEWPORT = { width: 390, height: 844 }; // iPhone-ish; kiosk is phone-first

// A real (tiny) PNG so the upload passes type/size validation.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const findings = [];
const steps = [];
const createdTokens = [];
const note = (severity, area, msg) => { findings.push({ severity, area, msg }); console.log(`  [${severity}] ${area}: ${msg}`); };

async function shoot(page, name, label) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  steps.push({ name, label, file });
  console.log(`  📸 ${name} — ${label}`);
}

// Attach console + network-failure listeners to a page; returns a getter for issues.
function watch(page, area) {
  page.on('console', (m) => { if (m.type() === 'error') note('P2', area, `console error: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => note('P1', area, `page exception: ${(e?.message || e).toString().slice(0, 200)}`));
  page.on('response', (r) => { if (r.status() >= 500) note('P1', area, `${r.status()} on ${r.url().replace(BASE, '')}`); else if (r.status() >= 400 && r.url().startsWith(BASE)) note('P2', area, `${r.status()} on ${r.url().replace(BASE, '')}`); });
}

async function visit(browser, route, name, label) {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  watch(page, name);
  try {
    const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
    if (resp && resp.status() >= 400) note('P1', name, `page ${route} returned ${resp.status()}`);
    await page.waitForTimeout(800);
    await shoot(page, name, label);
  } catch (e) {
    note('P1', name, `failed to load ${route}: ${(e?.message || e).toString().slice(0, 160)}`);
  } finally { await ctx.close(); }
}

async function kioskFlow(browser) {
  const area = 'kiosk-flow';
  // 1) Create a session via the public API (records the token for cleanup).
  let token;
  try {
    const r = await fetch(`${BASE}/api/kiosk/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.token) { note('P1', area, `session create failed (${r.status})`); return; }
    token = j.token; createdTokens.push(token);
  } catch (e) { note('P1', area, `session create threw: ${(e?.message || e).toString().slice(0, 160)}`); return; }

  // 2) Screenshot the mobile entry page.
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  watch(page, area);
  try {
    await page.goto(`${BASE}/kiosk/${token}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    await shoot(page, 'kiosk-2-mobile', 'Mobile session entry');
  } catch (e) { note('P2', area, `mobile page load: ${(e?.message || e).toString().slice(0, 140)}`); }
  await ctx.close();

  // 3) Submit the photo + consent via API, then poll for the result.
  try {
    const fd = new FormData();
    fd.append('consent', 'true');
    fd.append('file', new Blob([PNG], { type: 'image/png' }), 'selfie.png');
    const up = await fetch(`${BASE}/api/kiosk/sessions/${token}/photo`, { method: 'POST', body: fd });
    if (!up.ok) note('P1', area, `photo upload failed (${up.status})`);
  } catch (e) { note('P1', area, `photo upload threw: ${(e?.message || e).toString().slice(0, 140)}`); }

  let resultId = null;
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const s = await fetch(`${BASE}/api/kiosk/sessions/${token}`).then((x) => x.json()).catch(() => ({}));
      if (s.resultId) { resultId = s.resultId; break; }
      if (s.status === 'EXPIRED') { note('P2', area, 'session expired before analysis completed'); break; }
    } catch { /* keep polling */ }
  }
  if (!resultId) {
    note('P1', area, 'analysis never produced a result within ~30s — the fire-and-forget AI likely did not run (serverless function frozen after responding). Core flow is broken.');
    return;
  }

  // 4) Screenshot the shareable result page.
  try {
    const res = await fetch(`${BASE}/api/kiosk/results/${resultId}`).then((x) => x.json()).catch(() => ({}));
    const slug = res?.shareSlug || res?.result?.shareSlug;
    if (slug) {
      const c2 = await browser.newContext({ viewport: VIEWPORT });
      const p2 = await c2.newPage();
      watch(p2, 'kiosk-result');
      await p2.goto(`${BASE}/kiosk/result/${slug}`, { waitUntil: 'networkidle', timeout: 30000 });
      await p2.waitForTimeout(800);
      await shoot(p2, 'kiosk-3-result', 'Shareable result card');
      await c2.close();
    } else { note('P2', area, 'could not resolve result shareSlug for the result page'); }
  } catch (e) { note('P2', area, `result page: ${(e?.message || e).toString().slice(0, 140)}`); }
}

async function cleanup() {
  if (!createdTokens.length) return;
  if (!QA_TOKEN) { note('P2', 'cleanup', `no QA_TOKEN — ${createdTokens.length} test session(s) left for the 30-day retention cron`); return; }
  try {
    const r = await fetch(`${BASE}/api/kiosk/test-cleanup`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${QA_TOKEN}` }, body: JSON.stringify({ tokens: createdTokens }) });
    const j = await r.json().catch(() => ({}));
    console.log(`  🧹 cleanup: deleted ${j.deleted ?? 0} test session(s)`);
  } catch (e) { note('P2', 'cleanup', `cleanup failed: ${(e?.message || e).toString().slice(0, 140)}`); }
}

async function main() {
  console.log(`▶ Visual QA against ${BASE}`);
  const browser = await chromium.launch();
  try {
    // Static page visual checks (extend this list for other journeys).
    await visit(browser, '/kiosk/display', 'kiosk-1-display', 'Storefront display (QR attract screen)');
    await visit(browser, '/', 'home', 'Homepage');
    await visit(browser, '/book', 'book', 'Booking flow');
    await visit(browser, '/gift-vouchers', 'gift', 'Gift vouchers');
    // Interactive kiosk journey (creates + cleans up a test session).
    await kioskFlow(browser);
  } finally {
    await browser.close();
    await cleanup();
  }

  const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
  findings.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), steps, findings }, null, 2));
  const md = [
    `# Visual QA — ${BASE}`,
    `Run: ${new Date().toISOString()}`,
    '', `## Screenshots`, ...steps.map((s) => `- **${s.label}** → \`${s.file}\``),
    '', `## Findings (${findings.length})`, ...(findings.length ? findings.map((f) => `- **[${f.severity}] ${f.area}** — ${f.msg}`) : ['- None 🎉']),
  ].join('\n');
  writeFileSync(path.join(OUT, 'report.md'), md);
  console.log(`\n✅ Done. ${findings.length} finding(s). Screenshots + report in ${OUT}/`);
}

main().catch((e) => { console.error('visual-qa fatal:', e); process.exit(1); });
