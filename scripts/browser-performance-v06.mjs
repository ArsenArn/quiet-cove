import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import fs from 'node:fs';
const out='test-results/v06-approved',samples=[];
const fixture=await build({stdin:{contents:`export {fleetFixture} from './scripts/traffic-scenarios-v04b';`,resolveDir:process.cwd()},bundle:true,platform:'browser',format:'iife',globalName:'PerformanceFixtures',write:false});
const browser=await chromium.launch({headless:true,...process.platform==='win32'?{channel:'msedge'}:{}});
try{
 for(const profile of ['fast','reference'])for(const workers of [0,5,10])for(const version of (process.env.UI_BASELINE_URL?['baseline','approved']:['approved'])){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
  await page.goto(`${version==='baseline'?process.env.UI_BASELINE_URL:(process.env.SMOKE_URL??'http://127.0.0.1:4196')}/?debug=1&balance=${profile}`);await page.waitForFunction(()=>window.__fishing?.ui);await page.addScriptTag({content:fixture.outputFiles[0].text});await page.keyboard.press('F2');
  await page.evaluate(workers=>{const f=window.__fishing,s=PerformanceFixtures.fleetFixture(f.engine.config,workers,{combat:true});f.engine.state=s;Object.assign(s.boats[0],{x:2470,y:1260});s.crates=Array.from({length:150},(_,i)=>({id:s.nextId++,x:2170+i%15*39,y:1570+Math.floor(i/15)*30,resource:'sardine',kind:'fish',value:5,reservedBy:null,expiresAt:60}));s.coinStacks=Array.from({length:240},(_,i)=>({id:s.nextId++,x:2100+i%24*26,y:1090+Math.floor(i/24)*22,value:5,source:'fish_sale',availableAt:0,attracting:false}));f.engine.paused=false;f.engine.speed=1;f.ui.render()},workers);
  await page.waitForTimeout(600);
  const result=await page.evaluate(()=>new Promise(resolve=>{const f=window.__fishing,intervals=[];let mutations=0;const observer=new MutationObserver(records=>mutations+=records.length);observer.observe(document.querySelector('.hud'),{subtree:true,childList:true,characterData:true});let start=performance.now(),last=start;function frame(now){intervals.push(now-last);last=now;if(now-start<2500)return requestAnimationFrame(frame);observer.disconnect();const values=intervals.slice(5).sort((a,b)=>a-b);resolve({fps:1000/(values.reduce((a,b)=>a+b,0)/values.length),p95:values[Math.floor(values.length*.95)],frames:values.length,hudTextMutations:mutations,objects:f.scene.children.length,boats:f.engine.state.boats.length,crates:f.engine.state.crates.length,coins:f.engine.state.coinStacks.length});}requestAnimationFrame(frame)}));
  samples.push({version,profile,workers,...result});await context.close();
 }
 const comparison=samples.filter(x=>x.version==='approved').map(current=>{const baseline=samples.find(x=>x.version==='baseline'&&x.profile===current.profile&&x.workers===current.workers);return {profile:current.profile,workers:current.workers,currentFps:current.fps,baselineFps:baseline?.fps??null,changePercent:baseline?(current.fps/baseline.fps-1)*100:null}});
 const report={samples,comparison,method:'Edge WebGL headless, 1440x900, live combat/fleet, 150 crates and 240 payouts, 600 ms warmup and 2.5 s RAF sample. Sequential baseline/approved when UI_BASELINE_URL is provided; scheduling-sensitive desktop estimate, no real-device FPS claim.'};fs.writeFileSync(`${out}/performance.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close()}
