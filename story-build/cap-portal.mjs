import { chromium } from 'playwright';
const tag = process.argv[2] || 'a';
const routes = [['dash',''],['appts','/appointments'],['rewards','/rewards'],['invoices','/invoices'],['assess','/assessments'],['profile','/profile'],['gift','/gift-cards']];
const b = await chromium.launch({ headless:true, args:['--no-sandbox','--force-color-profile=srgb','--hide-scrollbars'] });
async function shot(rname, path, name, vw, vh, dsf){
  const ctx = await b.newContext({ viewport:{width:vw,height:vh}, deviceScaleFactor:dsf, ignoreHTTPSErrors:true, bypassCSP:true });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:3000/story-demo/portal'+path, { waitUntil:'domcontentloaded', timeout:60000 });
  await p.waitForTimeout(700);
  const H = await p.evaluate(() => document.body.scrollHeight);
  for (let y=0; y<=H; y += Math.floor(vh*0.7)) { await p.evaluate(yy=>scrollTo(0,yy), y); await p.waitForTimeout(200); }
  await p.evaluate(()=>scrollTo(0,0)); await p.waitForTimeout(600);
  await p.screenshot({ path:`story-build/recon/pf-${rname}-${name}-${tag}.png`, fullPage:true });
  await ctx.close();
}
for (const [rn, path] of routes){ await shot(rn, path, 'desktop', 1440, 900, 2); await shot(rn, path, 'mobile', 430, 932, 3); console.log('done', rn); }
await b.close(); console.log('PORTAL_MULTI_CAP_DONE');
