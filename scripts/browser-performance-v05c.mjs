import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import fs from 'node:fs';
const out='test-results/v05c',samples=[];
const fixture=await build({stdin:{contents:`export {fleetFixture} from './scripts/traffic-scenarios-v04b';`,resolveDir:process.cwd()},bundle:true,platform:'browser',format:'iife',globalName:'PerformanceFixtures',write:false});
const browser=await chromium.launch({headless:true,...process.platform==='win32'?{channel:'msedge'}:{}});
try{
 for(const profile of ['fast','reference'])for(const workers of [0,5,10])for(const version of ['v05b','v05c']){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  await page.goto(`http://127.0.0.1:${version==='v05b'?4194:4193}/?debug=1&balance=${profile}`);await page.waitForFunction(()=>window.__fishing?.ui);await page.addScriptTag({content:fixture.outputFiles[0].text});if(await page.locator('#debug').isVisible())await page.locator('#debug [data-action="debug"]').click();
  await page.evaluate(workers=>{const f=window.__fishing,s=PerformanceFixtures.fleetFixture(f.engine.config,workers,{combat:true});f.engine.state=s;s.cargoLevel=f.engine.config.units.player.capacity.length-1;Object.assign(s.boats[0],{x:2470,y:1260});
    for(const b of s.boats)b.cargo=Array.from({length:b.kind==='player'?12:b.kind==='salvage'?5:b.kind==='worker'?3:2},()=>({id:s.nextId++,resource:b.kind==='salvage'?'wreck':'sardine',kind:b.kind==='salvage'?'metal':'fish',value:5}));
    s.crates=Array.from({length:150},(_,i)=>({id:s.nextId++,x:2170+i%15*39,y:1570+Math.floor(i/15)*30,resource:'sardine',kind:'fish',value:5,reservedBy:null,expiresAt:60}));
    s.coinStacks=Array.from({length:240},(_,i)=>({id:s.nextId++,x:2100+i%24*26,y:1090+Math.floor(i/24)*22,value:5,source:'fish_sale',availableAt:0,attracting:false}));f.engine.paused=false;f.engine.speed=1;
  },workers);await page.waitForTimeout(600);
  const result=await page.evaluate(()=>new Promise(resolve=>{const f=window.__fishing,intervals=[];let start=performance.now(),last=start;function frame(now){intervals.push(now-last);last=now;if(now-start<2500)return requestAnimationFrame(frame);const values=intervals.slice(5).sort((a,b)=>a-b);resolve({fps:1000/(values.reduce((a,b)=>a+b,0)/values.length),p95:values[Math.floor(values.length*.95)],objects:f.scene.children.length,crates:f.engine.state.crates.length,pending:f.engine.state.coinStacks.length,boats:f.engine.state.boats.length,particles:f.scene.effects?.peak.particles??null,flights:f.scene.effects?.peak.flights??null});}requestAnimationFrame(frame);}));
  samples.push({version,profile,workers,...result});await context.close();
 }
 const comparison=samples.filter(x=>x.version==='v05c').map(current=>{const baseline=samples.find(x=>x.version==='v05b'&&x.profile===current.profile&&x.workers===current.workers);return {profile:current.profile,workers:current.workers,baselineFps:baseline.fps,currentFps:current.fps,changePercent:(current.fps/baseline.fps-1)*100,baselineP95:baseline.p95,currentP95:current.p95};});
 fs.writeFileSync(`${out}/performance.json`,JSON.stringify({samples,comparison,method:'Sequential production WebGL Edge runs at 1440x1000, 150 crates + 240 payouts + full cargo, live fleet/combat. 600ms warmup and 2.5s RAF sample. Scheduling-sensitive desktop estimate, not mobile FPS.'},null,2));console.log(JSON.stringify(comparison,null,2));
}finally{await browser.close();}
