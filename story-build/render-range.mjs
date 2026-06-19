import { chromium } from 'playwright';
import path from 'path';
const A = Number(process.argv[2]), B = Number(process.argv[3]), FPS = 30;
const b = await chromium.launch({ headless:true, args:['--no-sandbox','--force-color-profile=srgb','--hide-scrollbars'] });
const ctx = await b.newContext({ viewport:{width:1080,height:1920}, deviceScaleFactor:1, ignoreHTTPSErrors:true, bypassCSP:true });
const p = await ctx.newPage();
await p.goto('file://'+path.resolve('story-build/scene.html'), { waitUntil:'load' });
await p.waitForFunction('window.__ready===true',{timeout:30000}).catch(()=>{});
for (let f=A; f<=B; f++){ await p.evaluate(t=>window.render(t), f/FPS); await p.screenshot({ path:'story-build/frames/'+String(f).padStart(4,'0')+'.png' }); }
console.log('RANGE_DONE', A, '-', B);
await b.close();
