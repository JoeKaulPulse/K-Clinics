import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'https://kclinics.co.uk';
const b = await chromium.launch({ headless: true, args: ['--no-sandbox','--force-color-profile=srgb','--hide-scrollbars'] });

async function shot(path, route, { vw=430, vh=932, dsf=3, tall=false, clickCookie=true, prep } = {}) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, ignoreHTTPSErrors: true, bypassCSP: true });
  const p = await ctx.newPage();
  await p.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(900);
  if (clickCookie) { for (const n of [/Accept all/i, /Accept/i]) { const bt=p.getByRole('button',{name:n}).first(); if(await bt.count().catch(()=>0)){ await bt.click().catch(()=>{}); break; } } await p.waitForTimeout(500); }
  if (prep) await prep(p);
  await p.waitForTimeout(500);
  await p.screenshot({ path });
  console.log('shot', path, '←', route, `${vw}x${vh}@${dsf}`);
  await ctx.close();
}

// 1) Home — full-bleed mobile hero (short) + tall scroll capture
await shot('story-build/capture/home-hero.png', '/', { vh: 932 });
await shot('story-build/capture/home-tall.png', '/', { vh: 3400 });
// 2) AI consultation hero
await shot('story-build/capture/ai-hero.png', '/ai-consultation', { vh: 932 });
// 3) Client portal pitch (login)
await shot('story-build/capture/portal-login.png', '/account/login', { vh: 932 });
// 4) Booking hero (dark)
await shot('story-build/capture/book-hero.png', '/book', { vh: 932 });

await b.close(); console.log('PROD_CAP_DONE');
