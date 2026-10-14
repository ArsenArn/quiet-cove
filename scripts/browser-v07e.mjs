import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from '@playwright/test';
const root='test-results/v07e/browser';fs.mkdirSync(root,{recursive:true});const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5175/?debug=1&balance=fast');await page.waitForFunction(()=>window.__fishing?.ui);await page.keyboard.press('F2');
 const before=await page.evaluate(()=>{const f=window.__fishing;f.engine.paused=true;f.engine.state.area=1;f.scene.drawWorld();return {old:f.scene.portLabel.visible,new:f.scene.zone2PortLabel.visible};});assert.deepEqual(before,{old:true,new:false});checks.push('Before expansion only original label active');
 const after=await page.evaluate(async()=>{
  const f=window.__fishing,e=f.engine,s=e.state,c=e.config,{makeBoat}=await import('/src/game/state.ts'),{deposit}=await import('/src/game/systems/economy.ts'),{acquire}=await import('/src/game/systems/resources.ts'),{fishPorts}=await import('/src/game/systems/delivery.ts');
  s.area=2;s.cargoLevel=4;s.flags.storage=true;s.flags.cutter=true;s.metal=100;f.scene.cancelControl();f.scene.guidance.cancel();
  for(const [index,port] of fishPorts(c,s).entries()){
   const b=makeBoat('worker:port:'+index,'worker',port);s.boats.push(b);for(let i=0;i<3;i++)acquire(c,s,b,'sardine');deposit(c,s,b,1);
  }
  Object.assign(s.boats[0],{x:1780,y:1100});f.scene.drawWorld();f.scene.cameras.main.setZoom(.55);f.scene.cameras.main.centerOn(1850,1370);
  return {old:{visible:f.scene.portLabel.visible,x:f.scene.portLabel.x,y:f.scene.portLabel.y},second:{visible:f.scene.zone2PortLabel.visible,x:f.scene.zone2PortLabel.x,y:f.scene.zone2PortLabel.y},coins:s.coinStacks.map(p=>({boat:p.boat,x:p.x,y:p.y})),deliveries:s.events.filter(x=>x.type==='delivery').length};
 });assert.equal(after.old.visible,true);assert.equal(after.second.visible,true);assert.equal(after.old.x,1090);assert.equal(after.second.x,2630);assert.equal(after.coins.filter(x=>x.boat==='worker:port:0').length,3);assert.equal(after.coins.filter(x=>x.boat==='worker:port:1').length,3);checks.push('Both labels, shared unloading and six physical per-crate coins');
 await page.waitForTimeout(300);await page.screenshot({path:root+'/both-ports.png'});
 for(const [position,expected] of [[{x:1200,y:1350},{x:1090,y:1350}],[{x:2700,y:1390},{x:2630,y:1390}]]){
  await page.evaluate(p=>{const f=window.__fishing;Object.assign(f.engine.state.boats[0],p);f.scene.cancelControl();const original=f.scene.navigate.bind(f.scene);f.scene.navigate=(x,y)=>{window.__portGoal={x,y};original(x,y);};},position);
  await page.locator('[data-action="port"]').click();assert.deepEqual(await page.evaluate(()=>window.__portGoal),expected);
 }checks.push('Real HUD To Port clicks choose each nearest reachable destination');
 const metal=await page.evaluate(async()=>{const e=window.__fishing.engine,s=e.state,c=e.config,{acquire}=await import('/src/game/systems/resources.ts'),{deposit}=await import('/src/game/systems/economy.ts');Object.assign(s.boats[0],c.world.storage);acquire(c,s,s.boats[0],'wreck');deposit(c,s,s.boats[0],1);return {metal:s.metal,discarded:s.stats.metal_discarded,accepted:s.events.filter(x=>x.type==='delivery').at(-1).data.accepted_metal};});assert.deepEqual(metal,{metal:100,discarded:1,accepted:0});checks.push('Metal overflow unchanged');assert.deepEqual(errors,[]);
 fs.writeFileSync(root+'/report.json',JSON.stringify({checks,errors,before,after,metal},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}
