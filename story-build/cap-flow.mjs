import { chromium } from 'playwright';
import fs from 'fs';
const URL='http://127.0.0.1:3000/story-demo/booking';
const b = await chromium.launch({ headless:true, args:['--no-sandbox','--force-color-profile=srgb','--hide-scrollbars'] });
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:3, ignoreHTTPSErrors:true, bypassCSP:true });
const p = await ctx.newPage();
const taps=[];
const settle=(ms=700)=>p.waitForTimeout(ms);
async function rec(loc,label){ const el=loc.first(); await el.scrollIntoViewIfNeeded().catch(()=>{}); const bb=await el.boundingBox(); if(bb) taps.push({label,x:Math.round(bb.x+bb.width/2),y:Math.round(bb.y+bb.height/2)}); return el; }
async function tap(loc,label){ const el=await rec(loc,label); await el.click(); }
await p.goto(URL,{waitUntil:'networkidle',timeout:60000});
await settle(900);
await p.screenshot({path:'story-build/capture/flow-1-service.png'});
await tap(p.getByRole('button',{name:/HydraGlow Facial/i}),'service'); await settle(800);
await p.screenshot({path:'story-build/capture/flow-2-variant.png'});
await tap(p.getByRole('button',{name:/Signature/i}),'variant'); await settle(450);
await p.screenshot({path:'story-build/capture/flow-3-variant-picked.png'});
await tap(p.getByRole('button',{name:/^Continue/i}),'continue1'); await settle(900);
await p.screenshot({path:'story-build/capture/flow-4-time.png'});
// time step: fill native date input with a near-future weekday (Thu 2026-06-25, 09-20)
const dateInput = p.locator('input[type="date"]');
await rec(dateInput,'date');
await dateInput.fill('2026-06-25'); await settle(1100);
await p.screenshot({path:'story-build/capture/flow-5-slots.png'});
const slots = await p.locator('button').filter({hasText:/\b\d{1,2}:\d{2}\b/}).all();
console.log('slots:', slots.length);
if(slots.length){ const el=slots[Math.min(3,slots.length-1)]; const bb=await el.boundingBox(); if(bb) taps.push({label:'slot',x:Math.round(bb.x+bb.width/2),y:Math.round(bb.y+bb.height/2)}); await el.click(); await settle(600); }
await p.screenshot({path:'story-build/capture/flow-6-slotpicked.png'});
const cont2 = p.getByRole('button',{name:/^Continue/i});
if(await cont2.count()){ await tap(cont2,'continue2'); await settle(900); await p.screenshot({path:'story-build/capture/flow-7-confirm.png'}); }
fs.writeFileSync('story-build/capture/taps.json', JSON.stringify(taps,null,2));
console.log('TAPS:', JSON.stringify(taps));
await b.close(); console.log('FLOW_CAP_DONE');
