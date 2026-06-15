// Captures real screenshots of the live public/client/academy journeys for the
// staff manual. Admin screens require login and are documented as tables instead.
// Run from repo root:  node docs/staff-manual/capture-shots.mjs
// Reuses the visual-qa approach: Playwright Chromium against BASE_URL, tolerating
// the sandbox TLS-intercepting gateway (NODE_EXTRA_CA_CERTS) like visual-qa does.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';

const BASE = (process.env.BASE_URL || 'https://kclinics.co.uk').replace(/\/$/, '');
const OUT = path.resolve('docs/staff-manual/shots');
mkdirSync(OUT, { recursive: true });
const IGNORE_HTTPS_ERRORS = process.env.QA_IGNORE_HTTPS_ERRORS
  ? /^(1|true|yes)$/i.test(process.env.QA_IGNORE_HTTPS_ERRORS)
  : Boolean(process.env.NODE_EXTRA_CA_CERTS);

// what to grab: [file, url, device, fullHeight?]
const SHOTS = [
  ['home',          '/',                                   'desk', 1700],
  ['home-frame',    '/',                                   'desk', 0],
  ['book',          '/book',                               'desk', 0],
  ['finder',        '/treatment-finder',                   'desk', 0],
  ['academy',       '/academy',                            'desk', 0],
  ['course',        '/academy/level-2-foundation-skin-laser','desk', 0],
  ['gift',          '/gift-vouchers',                      'desk', 0],
  ['reviews',       '/reviews',                            'desk', 0],
  ['portal-login',  '/account/login',                      'desk', 0],
  ['admin-login',   '/admin/login',                        'desk', 0],
  ['kiosk',         '/kiosk/display',                      'phone', 0],
  ['academy-portal','/academy/portal',                     'phone', 0],
];

async function dismissCookie(page) {
  for (const label of ['Accept all', 'Accept', 'Allow all', 'I agree', 'Got it']) {
    const b = page.getByRole('button', { name: new RegExp(label, 'i') });
    if (await b.count().catch(() => 0)) { await b.first().click().catch(() => {}); await page.waitForTimeout(400); break; }
  }
}
async function settle(page) {
  await page.waitForTimeout(900);
  const h = await page.evaluate(() => document.body.scrollHeight).catch(() => 0);
  for (let y = 0; y < Math.min(h, 4000); y += 800) { await page.evaluate((to) => scrollTo(0, to), y).catch(() => {}); await page.waitForTimeout(180); }
  await page.evaluate(() => scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(1100);
}

const browser = await chromium.launch();
const desk = await browser.newContext({ viewport: { width: 1320, height: 860 }, deviceScaleFactor: 2, ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS });
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS, isMobile: true });

for (const [name, url, device, fullH] of SHOTS) {
  const ctx = device === 'phone' ? phone : desk;
  const page = await ctx.newPage();
  try {
    const res = await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 40000 }).catch(() => null);
    await dismissCookie(page);
    await settle(page);
    const file = path.join(OUT, name + '.png');
    if (fullH > 0) {
      await page.setViewportSize({ width: 1320, height: fullH });
      await page.waitForTimeout(500);
      await page.screenshot({ path: file });
    } else {
      await page.screenshot({ path: file }); // viewport-only, predictable frame
    }
    console.log(`OK  ${name.padEnd(15)} ${res ? res.status() : '??'}  ${url}`);
  } catch (e) {
    console.log(`ERR ${name.padEnd(15)} ${url}  ${(e?.message || e).toString().slice(0, 80)}`);
  } finally {
    await page.close();
  }
}
await browser.close();
console.log('shots →', OUT);
