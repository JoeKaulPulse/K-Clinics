// Local screenshot harness for the admin UI. Logs in once, then captures each
// target page at desktop + mobile widths and reports console errors per page.
// Complements scripts/visual-qa.mjs (which covers the public site/kiosk) by
// exercising the *authenticated* admin. Credentials come from the environment
// so nothing secret is committed:
//   ADMIN_SHOTS_EMAIL / ADMIN_SHOTS_PASSWORD  — a local dev admin login
//   ADMIN_SHOTS_BASE                          — defaults to http://localhost:3000
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers (web env) so it finds Chromium
// Run: ADMIN_SHOTS_EMAIL=… ADMIN_SHOTS_PASSWORD=… node scripts/admin-shots.mjs [tag]
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = (process.env.ADMIN_SHOTS_BASE || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.ADMIN_SHOTS_EMAIL || '';
const PASSWORD = process.env.ADMIN_SHOTS_PASSWORD || '';
const OUT = process.env.ADMIN_SHOTS_OUT || '/tmp/admin-shots';
if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_SHOTS_EMAIL and ADMIN_SHOTS_PASSWORD (a local dev admin login).');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['overview', '/admin'],
  ['myday', '/admin/my-day'],
  ['clients', '/admin/clients'],
  ['bookings', '/admin/bookings'],
  ['reports', '/admin/reports'],
  ['cashflow', '/admin/cashflow'],
  ['services', '/admin/services'],
  ['settings', '/admin/settings'],
];

const tag = process.argv[2] || 'after';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Log in via the form.
await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' });
await page.fill('#email', EMAIL);
await page.fill('#password', PASSWORD);
await Promise.all([
  page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20000 }).catch(() => {}),
  page.click('button[type=submit]'),
]);
await page.waitForTimeout(1500);
console.log('logged in →', page.url());

async function shoot(label, path, width, height) {
  const c = await browser.newContext({
    viewport: { width, height },
    storageState: await ctx.storageState(),
  });
  const p = await c.newPage();
  // Suppress the auto-running guided tour so captures show the bare UI.
  await p.addInitScript(() => {
    for (const k of ['admin', 'dashboard', 'clients', 'bookings', 'discounts', 'overview']) {
      try { localStorage.setItem(`kc_tour_${k}_seen`, '1'); } catch { /* ignore */ }
    }
  });
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const resp = await p.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => ({ status: () => `ERR ${e.message}` }));
  await p.waitForTimeout(1200);
  const file = `${OUT}/${tag}-${label}-${width === 1440 ? 'desktop' : 'mobile'}.png`;
  await p.screenshot({ path: file, fullPage: false });
  console.log(`${label} ${width}w → HTTP ${resp.status?.() ?? '?'}${errors.length ? `  ⚠ ${errors.length} console errs` : ''}`);
  if (errors.length) errors.slice(0, 3).forEach((e) => console.log('   ', e.slice(0, 120)));
  await c.close();
}

for (const [label, path] of PAGES) {
  await shoot(label, path, 1440, 900);
  await shoot(label, path, 390, 844);
}

// Open the search dropdown on desktop overview for a focused capture.
const sc = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: await ctx.storageState() });
const sp = await sc.newPage();
await sp.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await sp.fill('input[role=combobox]', 'cash');
await sp.waitForTimeout(700);
await sp.screenshot({ path: `${OUT}/${tag}-search-open.png` });
console.log('search dropdown captured');
await sc.close();

await browser.close();
console.log('done →', OUT);
