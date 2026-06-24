// Authenticated ADMIN visual QA. Logs in with QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD
// and screenshots the key /admin pages, capturing console errors and first-party
// 5xx / failed requests. Read-only: it navigates and screenshots only — it never
// submits a data-mutating form.
//
// Run (full-network session, fresh env so QA_ADMIN_PASSWORD is current):
//   node scripts/visual-qa-admin.mjs
//
// Output: qa-output/admin/*.png + findings.json (gitignored — admin captures
// contain client PII; do NOT commit them; redact before sharing).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = process.env.BASE_URL || 'https://kclinics.co.uk';
const EMAIL = process.env.QA_ADMIN_EMAIL;
const PASS = process.env.QA_ADMIN_PASSWORD;
const AGENT_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || '';
// On full-network Claude sessions HTTPS_PROXY points at a local agent proxy that
// closes Chromium's TLS to the live site; route the browser direct in that case.
const DIRECT = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/i.test(AGENT_PROXY);
const LAUNCH = DIRECT ? { proxy: { server: 'direct://', bypass: '*' } } : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!EMAIL || !PASS) { console.error('Missing QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD in env.'); process.exit(2); }
mkdirSync('qa-output/admin', { recursive: true });

const PAGES = [
  ['/admin', 'dashboard'],
  ['/admin/my-day', 'my-day'],
  ['/admin/compliance', 'compliance'],
  ['/admin/bookings', 'bookings'],
  ['/admin/calendar', 'calendar'],
  ['/admin/clients', 'clients'],
  ['/admin/academy', 'academy'],
  ['/admin/marketing', 'marketing'],
  ['/admin/inventory', 'inventory'],
  ['/admin/reports', 'reports'],
  ['/admin/inbox', 'inbox'],
  ['/admin/build', 'build'],
  ['/admin/tasks', 'tasks'],
  ['/admin/settings', 'settings'],
];

const findings = [];
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('requestfailed', (r) => { const u = r.url(); if (u.includes(new URL(BASE).host) && !u.includes('_rsc=')) errs.push(`REQFAIL ${u} ${r.failure()?.errorText || ''}`); });
page.on('response', (r) => { const u = r.url(); if (u.includes(new URL(BASE).host) && r.status() >= 500) errs.push(`HTTP ${r.status()} ${u}`); });

// Login — capture the API response so failures are explained precisely.
let loginApi = null;
page.on('response', async (r) => { if (r.url().includes('/api/admin/login')) { try { loginApi = { status: r.status(), body: (await r.text()).slice(0, 200) }; } catch {} } });
await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
await page.fill('#email', EMAIL);
await page.fill('#password', PASS);
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.startsWith('/admin/login'), { timeout: 20000 }).catch(() => {});
await sleep(2500);
const loggedIn = !page.url().includes('/admin/login');
if (!loggedIn) {
  await page.screenshot({ path: 'qa-output/admin/login-failed.png' });
  console.error(`LOGIN FAILED. API: ${loginApi ? `${loginApi.status} ${loginApi.body}` : '(no response seen)'}`);
  const captcha = await page.$('iframe[src*="turnstile"], iframe[src*="challenges.cloudflare"]');
  if (captcha) console.error('A captcha/Turnstile widget is present — too many prior failed attempts. Wait a while, or clear the rate-limit, then retry.');
  await browser.close();
  process.exit(1);
}
console.log(`login OK → ${page.url()}`);

for (const [path, name] of PAGES) {
  errs.length = 0;
  const resp = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => null);
  await sleep(2300);
  const status = resp ? resp.status() : 0;
  await page.screenshot({ path: `qa-output/admin/${name}.png`, fullPage: true }).catch(() => {});
  const pageErrs = [...new Set(errs)].filter((e) => !/favicon|analytics\.|gtag|googletagmanager|hotjar|sentry/i.test(e));
  const redirected = !page.url().includes(path);
  console.log(`📸 ${name} [HTTP ${status}]${redirected ? ` → ${page.url()}` : ''}${pageErrs.length ? `  ⚠ ${pageErrs.length} err` : ''}`);
  if (status >= 400) findings.push(`[${name}] HTTP ${status} at ${path}`);
  pageErrs.slice(0, 4).forEach((e) => findings.push(`[${name}] ${e.slice(0, 170)}`));
}

writeFileSync('qa-output/admin/findings.json', JSON.stringify(findings, null, 2));
console.log(`\nDone. ${findings.length} finding(s). Screenshots in qa-output/admin/ (PII — do not commit).`);
findings.forEach((f) => console.log('  - ' + f));
await browser.close();
