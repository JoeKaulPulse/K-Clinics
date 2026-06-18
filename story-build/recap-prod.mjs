import { chromium } from 'playwright';
import sharp from 'sharp';
const BASE = process.env.BASE_URL || 'https://kclinics.co.uk';
const HIDE = `a[href*="wa.me"],a[aria-label*="WhatsApp" i],[class*="livechat" i],[id*="livechat" i]{display:none!important}`;
const b = await chromium.launch({ headless:true, args:['--no-sandbox','--force-color-profile=srgb','--hide-scrollbars'] });
async function open(route, vh=932, dsf=3){
  const ctx = await b.newContext({ viewport:{width:430,height:vh}, deviceScaleFactor:dsf, ignoreHTTPSErrors:true, bypassCSP:true });
  const p = await ctx.newPage();
  await p.goto(BASE+route, { waitUntil:'networkidle', timeout:60000 });
  await p.waitForTimeout(800);
  for (const n of [/Accept all/i,/Accept/i]){ const bt=p.getByRole('button',{name:n}).first(); if(await bt.count().catch(()=>0)){ await bt.click().catch(()=>{}); break; } }
  await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(500);
  return { ctx, p };
}
// ai + portal viewport stills
for (const [route,out] of [['/ai-consultation','ai-hero'],['/account/login','portal-login']]){
  const { ctx, p } = await open(route);
  await p.screenshot({ path:`story-build/capture/${out}.png` });
  console.log('recap', out); await ctx.close();
}
// home fullPage -> crop
{
  const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, ignoreHTTPSErrors:true, bypassCSP:true });
  const p = await ctx.newPage();
  await p.goto(BASE+'/', { waitUntil:'networkidle', timeout:60000 });
  await p.waitForTimeout(800);
  for (const n of [/Accept all/i,/Accept/i]){ const bt=p.getByRole('button',{name:n}).first(); if(await bt.count().catch(()=>0)){ await bt.click().catch(()=>{}); break; } }
  await p.addStyleTag({ content: HIDE });
  for (const y of [600,1500,2400,3300,0]) { await p.evaluate(yy=>scrollTo(0,yy), y); await p.waitForTimeout(420); }
  await p.waitForTimeout(400);
  const full = await p.screenshot({ fullPage:true });
  const m = await sharp(full).metadata();
  await sharp(full).extract({ left:0, top:0, width:m.width, height:Math.min(m.height,9600) }).png().toFile('story-build/capture/home-scroll.png');
  console.log('recap home-scroll', (await sharp('story-build/capture/home-scroll.png').metadata()).width);
  await ctx.close();
}
await b.close(); console.log('RECAP_DONE');
