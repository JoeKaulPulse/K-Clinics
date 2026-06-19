import { chromium } from 'playwright';
import fs from 'fs';
const URL = 'http://127.0.0.1:3000/story-demo/portal';
fs.mkdirSync('story-build/recon/vid', { recursive: true });
const b = await chromium.launch({ headless:true, args:['--no-sandbox','--force-color-profile=srgb','--hide-scrollbars'] });
const ctx = await b.newContext({
  viewport:{width:1280,height:800}, deviceScaleFactor:1, ignoreHTTPSErrors:true, bypassCSP:true,
  recordVideo:{ dir:'story-build/recon/vid', size:{width:1280,height:800} },
});
const p = await ctx.newPage();
await p.goto(URL, { waitUntil:'domcontentloaded', timeout:60000 });
await p.waitForTimeout(2200);                  // entrance: page-enter, hero glow, count-ups
// smooth scroll down through the staggered reveals
const H = await p.evaluate(() => document.body.scrollHeight - window.innerHeight);
const steps = 90;
for (let i=0;i<=steps;i++){ const y = Math.round(H * (i/steps)); await p.evaluate(yy=>window.scrollTo(0,yy), y); await p.waitForTimeout(45); }
await p.waitForTimeout(800);
// glide back to top
for (let i=steps;i>=0;i--){ const y = Math.round(H * (i/steps)); await p.evaluate(yy=>window.scrollTo(0,yy), y); await p.waitForTimeout(22); }
await p.waitForTimeout(600);
await ctx.close();   // flushes the video
await b.close();
const f = fs.readdirSync('story-build/recon/vid').find(x=>x.endsWith('.webm'));
console.log('VIDEO', f);
