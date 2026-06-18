import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--no-sandbox','--force-color-profile=srgb'] });
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true, bypassCSP: true });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,80)));
await p.goto('http://127.0.0.1:3000/story-demo/booking', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(900);
await p.screenshot({ path: 'story-build/recon/bk1-service.png' });
await p.getByRole('button', { name: /SMAS HIFU Lifting/i }).first().click();
await p.waitForTimeout(800);
await p.screenshot({ path: 'story-build/recon/bk2-variant.png' });
console.log('variant buttons visible:', await p.getByRole('button', { name: /Full face|Lower face|Face & neck/i }).count());
await p.getByRole('button', { name: /Full face/i }).first().click().catch(e=>console.log('var miss',e.message.slice(0,50)));
await p.waitForTimeout(400);
await p.getByRole('button', { name: /^Continue/i }).first().click().catch(e=>console.log('cont miss',e.message.slice(0,50)));
await p.waitForTimeout(900);
await p.screenshot({ path: 'story-build/recon/bk3-time.png' });
const dates = await p.locator('button').filter({ hasText: /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i }).all();
console.log('date pills:', dates.length);
if (dates.length>1){ await dates[1].click(); await p.waitForTimeout(700); }
await p.screenshot({ path: 'story-build/recon/bk4-slots.png' });
const slots = await p.locator('button').filter({ hasText: /\b\d{1,2}:\d{2}\b/ }).all();
console.log('slots:', slots.length);
if (slots.length){ await slots[Math.min(2,slots.length-1)].click(); await p.waitForTimeout(500); }
await p.screenshot({ path: 'story-build/recon/bk5-confirm.png' });
console.log('pageerrors:', errs.slice(0,3));
await b.close(); console.log('CAP_DONE');
