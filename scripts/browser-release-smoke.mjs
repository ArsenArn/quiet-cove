import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const url=process.env.SMOKE_URL??'http://127.0.0.1:4173';
const out='test-results/release';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage(),errors=[],failed=[],checks=[],responses=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()}));
page.on('response',r=>{responses.push({url:r.url(),status:r.status()});if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
const ready=()=>page.waitForFunction(()=>window.__fishing?.ui);
try{
 // New isolated browser storage; first load exercises the public URL without debug.
 await page.goto(url+'/');await page.waitForSelector('#quest-title');
 assert.ok(await page.locator('canvas').count());
 await page.locator('[data-action="settings"]').click();
 await page.waitForFunction(()=>document.querySelector('#music-toggle'));
 await page.screenshot({path:out+'/production-fresh.png'});
 checks.push('Public root boots with fresh isolated storage and renders canvas');
 await page.goto(url+'/?debug=1');await ready();
 assert.equal(await page.evaluate(()=>window.__fishing.engine.config.profile),'fast');
 assert.equal(await page.evaluate(()=>window.__fishing.engine.state.questIndex),0);
 assert.equal(await page.evaluate(()=>window.__fishing.analytics.status),'OFF');
 checks.push('FAST default; fresh Q1');
 await page.locator('[data-action="settings"]').click();
 await page.waitForFunction(()=>{const a=window.__fishing.music.audio;return !a.paused&&a.currentTime>.1&&a.duration>1&&!a.error;});
 const audio=await page.evaluate(()=>{const a=window.__fishing.music.audio;return {src:a.currentSrc,duration:a.duration,time:a.currentTime,loop:a.loop};});
 assert.equal(audio.loop,true);checks.push('Real pointer gesture starts decoded MP3; playback clock advances');
 await page.locator('[data-action="settings-close"]').click();
 await page.evaluate(()=>{const f=window.__fishing,r=f.engine.config.resources.sardine;f.scene.navigate(r.x,r.y);});
 await page.waitForFunction(()=>window.__fishing.engine.state.questStatus==='completed_unclaimed',null,{timeout:20000});
 await page.evaluate(()=>window.__fishing.persist());await page.reload();await ready();
 assert.equal(await page.evaluate(()=>window.__fishing.engine.state.questStatus),'completed_unclaimed');
 await page.locator('#quest-title').click();await page.waitForFunction(()=>window.__fishing.engine.state.questIndex===1);
 checks.push('Catch completes Q1; unclaimed progress survives reload; manual reward advances Q2');
 // Fund and stage the gate milestone only, avoiding a full progression playtest.
 const gate=await page.evaluate(()=>{const f=window.__fishing,s=f.engine.state;s.questIndex=14;s.questStatus='active';s.coins=10000;f.engine.purchase('gate');return {order:s.orders.gate,duration:f.engine.config.expansion.gate.build_s};});
 assert.ok(gate.order?.readyAt);assert.equal(gate.duration,30);
 await page.waitForFunction(()=>window.__fishing.engine.state.area===2,null,{timeout:40000});
 const zone=await page.evaluate(()=>{const f=window.__fishing;f.scene.navigate(f.engine.config.world.gate_x+300,1100);return {gateX:f.engine.config.world.gate_x};});
 await page.waitForFunction(x=>window.__fishing.engine.state.boats[0].x>x,zone.gateX,{timeout:20000});
 await page.screenshot({path:out+'/production-zone2.png'});await page.evaluate(()=>window.__fishing.persist());
 await page.reload();await ready();assert.equal(await page.evaluate(()=>window.__fishing.engine.state.area),2);
 checks.push('Funded gate uses real 30 s construction; boat enters Zone 2; area survives reload');
 // Check every static resource, including assets not requested in this short route.
 const files=fs.readdirSync('public',{recursive:true}).filter(p=>fs.statSync('public/'+p).isFile());
 for(const file of files){const response=await page.request.get(url+'/'+file.replaceAll('\\','/'));assert.ok(response.ok(),file);assert.deepEqual(await response.body(),fs.readFileSync('public/'+file));}
 checks.push(`All ${files.length} public static files return successful responses with exact bytes`);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 fs.writeFileSync(out+'/browser-smoke.json',JSON.stringify({checks,errors,failed,audio,responses},null,2));console.log(JSON.stringify({checks,errors,failed},null,2));
}finally{await context.close();await browser.close();}
