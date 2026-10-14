import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const output='test-results/v04b/browser',url=process.env.SMOKE_URL??'http://127.0.0.1:4188';fs.mkdirSync(output,{recursive:true});
const fixture=await build({entryPoints:['scripts/traffic-scenarios-v04b.ts'],bundle:true,platform:'browser',format:'iife',globalName:'TrafficFixtures',write:false});
const browser=await chromium.launch({headless:true,...process.platform==='win32'?{channel:process.env.BROWSER_CHANNEL??'msedge'}:{}}),errors=[],checks=[],fps=[];
try{
 for(const profile of ['fast','reference']){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${url}/?debug=1&balance=${profile}`);await page.waitForFunction(()=>window.__fishing?.ui);await page.addScriptTag({content:fixture.outputFiles[0].text});
  if(await page.locator('#debug').isVisible())await page.locator('#debug [data-action="debug"]').click();
  const renderer=await page.evaluate(()=>window.__fishing.game.renderer.type);assert.equal(renderer,2,'real Phaser WebGL');
  for(const scenario of [{count:0,name:'one boat'},{count:5,name:'5 workers'},{count:10,name:'10 workers',support:false},{count:10,name:'max fleet'},{count:10,name:'fleet + pirates',combat:true}]){
   for(const avoidance of [false,true]){
    await page.evaluate(({scenario,avoidance})=>{
     const f=window.__fishing;f.scene.stopGuidance();f.scene.cancelControl();f.engine.paused=false;f.engine.speed=1;
     window.trafficConfig??=structuredClone(f.engine.config.navigation.traffic);
     f.engine.config.navigation.traffic=avoidance?structuredClone(window.trafficConfig):undefined;
     f.engine.state=TrafficFixtures.fleetFixture(f.engine.config,scenario.count,scenario);f.ui.render();
    },{scenario,avoidance});
    await page.waitForTimeout(500);
    const sample=await page.evaluate(()=>new Promise(resolve=>{
     const frames=[],start=performance.now();let last=start;
     function frame(now){frames.push(now-last);last=now;if(now-start<3000){requestAnimationFrame(frame);return;}
      const sorted=frames.slice(3).sort((a,b)=>a-b),mean=sorted.reduce((a,b)=>a+b,0)/sorted.length;
      resolve({fps:1000/mean,p95FrameMs:sorted[Math.floor(sorted.length*.95)],worstFrameMs:sorted.at(-1),frames:sorted.length,boats:window.__fishing.engine.state.boats.length,enemies:window.__fishing.engine.state.enemies.length,renderer:window.__fishing.game.renderer.type});}
     requestAnimationFrame(frame);
    }));fps.push({profile,scenario:scenario.name,avoidance,...sample});console.log(JSON.stringify(fps.at(-1)));
   }
  }
  // Stacked save is loaded by the production save path, then rendered during gradual separation.
  await page.evaluate(()=>{const f=window.__fishing;f.engine.config.navigation.traffic=structuredClone(window.trafficConfig);f.engine.state=TrafficFixtures.fleetFixture(f.engine.config,10,{single:true,stack:true});f.persist();});
  await page.reload();await page.waitForFunction(()=>window.__fishing?.ui);if(await page.locator('#debug').isVisible())await page.locator('#debug [data-action="debug"]').click();await page.waitForTimeout(3000);
  const recovered=await page.evaluate(()=>{const f=window.__fishing,s=f.engine.state;return {version:s.version,boats:s.boats.length,player:{x:s.boats[0].x,y:s.boats[0].y},uniquePositions:new Set(s.boats.map(b=>`${b.x.toFixed(1)},${b.y.toFixed(1)}`)).size,cargo:s.boats.flatMap(b=>b.cargo).length};});
  const fleetSize=await page.evaluate(()=>1+window.__fishing.engine.config.workers.max_count+1+window.__fishing.engine.config.salvage.worker.max_count);
  assert.equal(recovered.version,3);assert.equal(recovered.boats,fleetSize);assert.equal(recovered.uniquePositions,fleetSize);assert.deepEqual(recovered.player,{x:1090,y:1350});await page.screenshot({path:`${output}/${profile}-fleet.png`});checks.push(`${profile}: WebGL, 1/5/10/max/pirate fleet, close-position save recovery, unchanged pinned player`);
  await page.addScriptTag({content:fixture.outputFiles[0].text});
  await page.evaluate(()=>{const f=window.__fishing;f.scene.cancelControl();f.engine.state=TrafficFixtures.fleetFixture(f.engine.config,10,{single:true});Object.assign(f.engine.state.boats[0],{x:f.engine.config.resources.sardine.x+130,y:f.engine.config.resources.sardine.y});f.engine.update(30);f.engine.paused=true;});
  await page.waitForTimeout(200);await page.screenshot({path:`${output}/${profile}-resource-traffic.png`});checks.push(`${profile}: shared resource after 30 game seconds rendered without debug overlay`);
  await context.close();
 }
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),page=await mobile.newPage();
 page.on('pageerror',e=>errors.push(e.message));await page.goto(`${url}/?debug=1`);await page.waitForFunction(()=>window.__fishing?.ui);await page.addScriptTag({content:fixture.outputFiles[0].text});
 if(await page.locator('#debug').isVisible())await page.locator('#debug [data-action="debug"]').click();
 await page.evaluate(()=>{const f=window.__fishing;f.scene.cancelControl();f.engine.state=TrafficFixtures.fleetFixture(f.engine.config,10,{single:true});});await page.waitForTimeout(1200);await page.screenshot({path:`${output}/mobile-fleet.png`});checks.push('390x844 mobile viewport, real WebGL and max fleet rendered');await mobile.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/smoke.json`,JSON.stringify({result:'passed',checks,consoleErrors:errors,fps,limit:'Headless Edge WebGL, 3-second RAF samples; baseline is same renderer with traffic disabled. This is desktop CPU/renderer evidence and mobile viewport emulation, not physical Android/iOS FPS.'},null,2)+'\n');
}finally{await browser.close();}
