import { chromium } from 'playwright';
import sharp from 'sharp';
const BASE = process.env.BASE_URL || 'https://kclinics.co.uk';
const b = await chromium.launch({ headless:true, args:['--no-sandbox','--force-color-profile=srgb','--hide-scrollbars'] });
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, ignoreHTTPSErrors:true, bypassCSP:true });
const p = await ctx.newPage();
await p.goto(BASE+'/', { waitUntil:'networkidle', timeout:60000 });
await p.waitForTimeout(900);
for (const n of [/Accept all/i,/Accept/i]){ const bt=p.getByRole('button',{name:n}).first(); if(await bt.count().catch(()=>0)){ await bt.click().catch(()=>{}); break; } }
await p.waitForTimeout(500);
// scroll through to trigger reveal animations, then back to top
for (const y of [600,1400,2200,3000,3800,0]) { await p.evaluate(yy=>window.scrollTo(0,yy), y); await p.waitForTimeout(450); }
await p.waitForTimeout(500);
const full = await p.screenshot({ fullPage:true });
const meta = await sharp(full).metadata();
console.log('fullpage', meta.width+'x'+meta.height);
// crop the top region for scrolling (top 4800 css px => 9600 at dsf2)
const cropH = Math.min(meta.height, 9600);
await sharp(full).extract({ left:0, top:0, width:meta.width, height:cropH }).png().toFile('story-build/capture/home-scroll.png');
const m2 = await sharp('story-build/capture/home-scroll.png').metadata();
console.log('home-scroll', m2.width+'x'+m2.height);
await b.close(); console.log('HOME_CAP_DONE');
