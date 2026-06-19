// Team-chat visual audit. Logs into the admin as the QA account, exercises the
// team-chat surfaces (launcher, new-chat modal, docked window with short/long/
// mention messages, the full messages page, automations) and screenshots each,
// capturing console errors. Desktop viewport so the bottom-right dock renders.
//
//   BASE_URL=https://kclinics.co.uk QA_ADMIN_EMAIL=… QA_ADMIN_PASSWORD=… \
//     node scripts/chat-audit.mjs
//
// QA_DM_TO selects who to DM for the message-rendering check (default Info KClinics).
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import path from 'path';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.QA_ADMIN_EMAIL || '';
const PASSWORD = process.env.QA_ADMIN_PASSWORD || '';
const DM_TO = process.env.QA_DM_TO || 'Info KClinics';
const OUT = process.env.QA_OUT || 'qa-output/chat';
const IGNORE_HTTPS = process.env.QA_IGNORE_HTTPS_ERRORS ? /^(1|true|yes)$/i.test(process.env.QA_IGNORE_HTTPS_ERRORS) : Boolean(process.env.NODE_EXTRA_CA_CERTS);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const log = [];
const errors = [];
const note = (m) => { log.push(m); console.log(m); };

async function shoot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) }).catch((e) => note(`  screenshot ${name} failed: ${e.message}`));
  note(`  📸 ${name}`);
}
async function skipTour(page) {
  const skip = page.getByText('Skip', { exact: true });
  if (await skip.count().catch(() => 0)) { await skip.first().click().catch(() => {}); await page.waitForTimeout(300); }
}

const main = async () => {
  if (!EMAIL || !PASSWORD) { note('Missing QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD'); process.exit(1); }
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1320, height: 880 }, ignoreHTTPSErrors: IGNORE_HTTPS });
  // Mark all guided tours as already-seen so they don't auto-open and block clicks.
  await context.addInitScript(() => {
    try { const o = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return (typeof k === 'string' && k.startsWith('kc_tour_')) ? '1' : o.call(this, k); }; } catch { /* noop */ }
  });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); note(`  ⚠ console: ${m.text().slice(0, 160)}`); } });
  page.on('pageerror', (e) => { errors.push(String(e)); note(`  ⚠ pageerror: ${String(e).slice(0, 160)}`); });

  note(`Logging in as ${EMAIL} @ ${BASE}`);
  const res = await context.request.post(`${BASE}/api/admin/login`, { data: { email: EMAIL, password: PASSWORD, code: '', captchaToken: '' } });
  const body = await res.json().catch(() => ({}));
  if (!body.ok) {
    note(`  LOGIN FAILED: ${JSON.stringify(body).slice(0, 200)}`);
    await browser.close(); process.exit(2);
  }
  note('  ✓ logged in');

  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1500);
  await skipTour(page);
  await shoot(page, '01-dashboard');

  // Launcher popover
  const launcher = page.locator('button[aria-label="Team chat"]');
  if (!(await launcher.count())) { note('  ⚠ chat launcher not found'); }
  else {
    await launcher.first().click().catch(() => {});
    await page.waitForTimeout(800);
    await shoot(page, '02-launcher-popover');

    await page.getByRole('button', { name: 'New', exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(700);
    const dialog = page.getByRole('dialog');
    await shoot(page, '03-new-chat-modal');

    const person = dialog.getByText(DM_TO, { exact: false });
    if (await person.count()) await person.first().click().catch(() => {});
    else await dialog.locator('button').nth(2).click().catch(() => {}); // first person row fallback
    await page.waitForTimeout(300);
    await dialog.getByRole('button', { name: /Start chat/i }).click().catch(() => {});
    await page.waitForTimeout(1800);
    await shoot(page, '04-dock-opened');
  }

  // Send messages into the docked window
  const composer = page.locator('textarea[placeholder="Message…"]').last();
  async function send(text) {
    if (!(await composer.count())) { note('  ⚠ composer not found'); return; }
    await composer.click().catch(() => {});
    await composer.fill(text).catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(1500);
  }
  await send('Hi — testing the team chat 👋');
  await send('This is a deliberately long message, written to confirm the bubble wraps across the full width of the window instead of stacking one word per line like before.');
  await send('Short one.');
  await shoot(page, '05-dock-with-messages');
  await page.mouse.move(660, 440); await page.waitForTimeout(500); // hover to reveal toolbar
  await shoot(page, '06-dock-hover');

  // Full messages page (uses the same window in embedded mode)
  await page.goto(`${BASE}/admin/messages`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1800);
  await skipTour(page);
  await shoot(page, '07-messages-page');

  // Automations manager
  await page.goto(`${BASE}/admin/tasks/automations`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1400);
  await skipTour(page);
  await shoot(page, '08-automations');

  writeFileSync(path.join(OUT, 'report.txt'), `${log.join('\n')}\n\nConsole errors (${errors.length}):\n${errors.join('\n')}\n`);
  note(`\nDone. ${errors.length} console error(s). Screenshots in ${OUT}/`);
  await browser.close();
};
main().catch((e) => { console.error(e); process.exit(1); });
