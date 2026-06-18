import { chromium } from 'playwright';
import path from 'path';
const times = process.argv.slice(2).map(Number);
const b = await chromium.launch({ headless:true, args:['--no-sandbox','--force-color-profile=srgb','--hide-scrollbars'] });
const ctx = await b.newContext({ viewport:{width:1080,height:1920}, deviceScaleFactor:1, ignoreHTTPSErrors:true, bypassCSP:true });
const p = await ctx.newPage();
await p.goto('file://'+path.resolve('story-build/scene.html'), { waitUntil:'load' });
await p.waitForFunction('window.__ready===true',{timeout:30000}).catch(()=>{});
for (const t of times){ await p.evaluate(tt=>window.render(tt), t); await p.waitForTimeout(40); await p.screenshot({ path:`story-build/recon/frame-${String(t).replace('.','_')}.png` }); console.log('frame', t); }
await b.close();
