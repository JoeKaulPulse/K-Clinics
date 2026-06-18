import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'https://kclinics.co.uk';
const routes = [
  ['home', '/'],
  ['book', '/book'],
  ['ai-consultation', '/ai-consultation'],
  ['consultation', '/consultation'],
  ['account', '/account'],
  ['account-login', '/account/login'],
  ['account-appointments', '/account/appointments'],
  ['account-invoices', '/account/invoices'],
];
const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
const p = await ctx.newPage();
for (const [name, path] of routes) {
  try {
    const res = await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForTimeout(1500);
    const finalUrl = p.url();
    const title = await p.title();
    const h1 = await p.locator('h1').first().innerText().catch(() => '(no h1)');
    await p.screenshot({ path: `story-build/recon/${name}.png` });
    const scrollH = await p.evaluate(() => document.body.scrollHeight);
    console.log(`${name.padEnd(22)} ${String(res?.status()).padEnd(4)} h=${String(scrollH).padEnd(6)} → ${finalUrl}`);
    console.log(`   title: ${title}`);
    console.log(`   h1   : ${h1.replace(/\n/g,' / ').slice(0,90)}`);
  } catch (e) {
    console.log(`${name.padEnd(22)} ERROR ${e.message.slice(0,80)}`);
  }
}
await b.close();
console.log('RECON_DONE');
