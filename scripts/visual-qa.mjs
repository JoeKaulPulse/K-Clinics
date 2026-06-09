// Visual QA harness — drives a real headless browser through key journeys against
// BASE_URL, screenshots every step, captures console errors + failed requests, and
// writes a report to qa-output/. Test-tagged + auto-cleanup: it records the kiosk
// sessions it creates and deletes them (photos included) at the end via the
// token-authed cleanup endpoint, so running against production leaves no residue.
//
// Run (in a Full-network Visual QA environment):
//   npx playwright install --with-deps chromium   # once, in the env setup script
//   BASE_URL=https://kclinics.co.uk QA_TOKEN=$BOARD_QUEUE_TOKEN node scripts/visual-qa.mjs
// Optionally pass QA_SELFIE=/path/to/selfie.jpg to exercise the kiosk happy path
// (analysis -> result card) instead of the unanalysable 1x1px placeholder.
//
// Behind a TLS-intercepting egress gateway (e.g. the standard Claude Code web
// environment), Chromium rejects the re-signed cert with ERR_CERT_AUTHORITY_INVALID
// even though Node's fetch trusts it via NODE_EXTRA_CA_CERTS. Set QA_IGNORE_HTTPS_ERRORS=1
// to let the browser contexts through. Leave it off in full-network runs so a genuinely
// broken production certificate is still caught.
//
// Output: qa-output/<step>.png screenshots + qa-output/report.json + report.md.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import path from 'path';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const QA_TOKEN = process.env.QA_TOKEN || process.env.BOARD_QUEUE_TOKEN || '';
const OUT = process.env.QA_OUT || 'qa-output';
const VIEWPORT = { width: 390, height: 844 }; // iPhone-ish; kiosk is phone-first
const IGNORE_HTTPS_ERRORS = /^(1|true|yes)$/i.test(process.env.QA_IGNORE_HTTPS_ERRORS || '');
const CONTEXT_OPTS = { viewport: VIEWPORT, ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS };

// Kiosk upload payload. Pass a real selfie (QA_SELFIE=/path/to/photo.jpg) to verify
// the happy path end-to-end (analysis -> ANALYZED -> shareable result card). Without
// one we fall back to a 1x1px placeholder: the AI legitimately can't read a blank
// pixel, so it returns ANALYSIS_FAILED — which is expected, NOT a broken flow.
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const SELFIE_PATH = process.env.QA_SELFIE || '';
const HAS_REAL_SELFIE = Boolean(SELFIE_PATH);
const SELFIE_BYTES = HAS_REAL_SELFIE ? readFileSync(SELFIE_PATH) : PLACEHOLDER_PNG;
const SELFIE_NAME = HAS_REAL_SELFIE ? path.basename(SELFIE_PATH) : 'selfie.png';
const SELFIE_TYPE = /\.webp$/i.test(SELFIE_NAME) ? 'image/webp'
  : /\.(heic|heif)$/i.test(SELFIE_NAME) ? 'image/heic'
  : /\.(jpe?g)$/i.test(SELFIE_NAME) ? 'image/jpeg'
  : 'image/png';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const findings = [];
const steps = [];
const createdTokens = [];
const note = (severity, area, msg) => { findings.push({ severity, area, msg }); console.log(`  [${severity}] ${area}: ${msg}`); };

// Let an animation/hydration-heavy page settle before capture: scroll the full
// height in steps to trigger lazy images + motion() scroll-reveals, then return to
// the top. Without this, a fast full-page screenshot catches blank/pre-reveal panels
// (e.g. the booking widget rendering only its loading splash) and reads as "broken".
async function settle(page) {
  await page.waitForTimeout(800);
  const height = await page.evaluate(() => document.body.scrollHeight).catch(() => 0);
  for (let y = 0; y < height; y += 900) {
    await page.evaluate((to) => window.scrollTo(0, to), y).catch(() => {});
    await page.waitForTimeout(220);
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(1200);
}

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
  const ctx = await browser.newContext(CONTEXT_OPTS);
  const page = await ctx.newPage();
  watch(page, name);
  try {
    const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
    if (resp && resp.status() >= 400) note('P1', name, `page ${route} returned ${resp.status()}`);
    await settle(page);
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
  const ctx = await browser.newContext(CONTEXT_OPTS);
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
    fd.append('file', new Blob([SELFIE_BYTES], { type: SELFIE_TYPE }), SELFIE_NAME);
    const up = await fetch(`${BASE}/api/kiosk/sessions/${token}/photo`, { method: 'POST', body: fd });
    if (!up.ok) note('P1', area, `photo upload failed (${up.status})`);
  } catch (e) { note('P1', area, `photo upload threw: ${(e?.message || e).toString().slice(0, 140)}`); }

  // Poll for the result. The server analysis call has a 30s timeout, so give it ~45s.
  // Statuses (see KioskStatus): PHOTO_TAKEN -> ANALYZED (success) | ANALYSIS_FAILED.
  let resultId = null;
  let lastStatus = null;
  let failed = false;
  for (let i = 0; i < 18; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const s = await fetch(`${BASE}/api/kiosk/sessions/${token}`).then((x) => x.json()).catch(() => ({}));
      lastStatus = s.status || lastStatus;
      if (s.resultId) { resultId = s.resultId; break; }
      if (s.status === 'EXPIRED') { note('P2', area, 'session expired before analysis completed'); break; }
      if (/FAIL/i.test(s.status || '')) { failed = true; break; }
    } catch { /* keep polling */ }
  }
  if (!resultId) {
    if (HAS_REAL_SELFIE) {
      // A real photo that fails or hangs points at a genuine AI-pipeline problem.
      note('P1', area, `analysis produced no result for a real selfie (last status: ${lastStatus || 'unknown'}) — kiosk happy path is broken.`);
    } else if (failed) {
      // Expected: the 1x1px placeholder isn't an analysable photo. Not a defect.
      note('P3', area, `analysis returned ${lastStatus} for the 1x1px placeholder image — expected (a blank pixel is not analysable). The pipeline ran and failed gracefully. Set QA_SELFIE=/path/to/selfie.jpg to verify the happy path + result card.`);
    } else {
      note('P2', area, `no result within ~45s (last status: ${lastStatus || 'unknown'}). With the placeholder image this is most likely the failure path rather than a hang; set QA_SELFIE=/path/to/selfie.jpg to verify the happy path.`);
    }
    return;
  }

  // 4) Screenshot the shareable result page.
  try {
    const res = await fetch(`${BASE}/api/kiosk/results/${resultId}`).then((x) => x.json()).catch(() => ({}));
    const slug = res?.shareSlug || res?.result?.shareSlug;
    if (slug) {
      const c2 = await browser.newContext(CONTEXT_OPTS);
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
