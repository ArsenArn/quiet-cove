import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const output='test-results/v05b/browser',url=process.env.SMOKE_URL??'http://127.0.0.1:4191';fs.mkdirSync(output,{recursive:true});
const fixture=await build({stdin:{contents:`export {newState,makeBoat} from './src/game/state';export {directionFrame} from './src/game/art/registry';export {fleetFixture} from './scripts/traffic-scenarios-v04b';export {harvest,updateResources} from './src/game/systems/resources';`,resolveDir:process.cwd()},bundle:true,platform:'browser',format:'iife',globalName:'ArtFixtures',write:false});
const browser=await chromium.launch({headless:true,...process.platform==='win32'?{channel:'msedge'}:{}}),errors=[],checks=[],samples=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const shot=async(name)=>{await page.waitForTimeout(180);await page.screenshot({path:`${output}/${name}.png`});};
 const ready=async()=>{await page.waitForFunction(()=>window.__fishing?.ui);await page.addScriptTag({content:fixture.outputFiles[0].text});if(await page.locator('#debug').isVisible())await page.locator('#debug [data-action="debug"]').click();};
 for(const profile of ['fast','reference']){
  await page.goto(`${url}/?debug=1&balance=${profile}`);await ready();assert.equal(await page.evaluate(()=>window.__fishing.game.renderer.type),2);
  assert.equal(await page.evaluate(()=>{const f=window.__fishing,w=f.scene.water;return w.type==='TileSprite'&&w.tileScaleX===.65&&w.tileScaleY===.65&&w.width===f.engine.config.world.width&&w.height===f.engine.config.world.height;}),true);
  await page.evaluate(()=>{const f=window.__fishing,s=ArtFixtures.newState(f.engine.config);f.engine.paused=true;f.engine.state=s;s.area=2;s.cargoLevel=3;s.flags.storage=true;s.flags.cutter=true;s.flags.den=true;s.questIndex=33;s.golden.nextAt=1e9;
    Object.assign(s.boats[0],{x:1110,y:1770});
    for(const [i,kind] of ['worker','speedboat','salvage'].entries())s.boats.push(ArtFixtures.makeBoat(kind,kind,{x:690+i*140,y:1770},f.engine.config.units.player.hp));
    s.defender=ArtFixtures.makeBoat('defender','player',{x:1270,y:1770},f.engine.config.combat.defender_hp);
    s.enemies=[{id:'pirate-test',x:1420,y:1770,angle:0,hp:100,attackAt:0,home:{x:1420,y:1770},state:'PATROL',target:null}];
    Object.assign(s.golden,{x:1580,y:1770,origin:{x:1580,y:1770},expires:s.time+300,offerId:s.nextId++});
    for(const b of s.boats)b.cargo=Array.from({length:b.kind==='speedboat'?2:b.kind==='worker'?3:5},(_,i)=>{const resource=b.kind==='salvage'?'wreck':['sardine','crab','mussel','snapper','tuna'][i%5];return {id:s.nextId++,resource,kind:resource==='wreck'?'metal':'fish',value:f.engine.config.resources[resource].value};});
  });
  for(let frame=0;frame<8;frame++){
    await page.evaluate(frame=>{const s=window.__fishing.engine.state,a=-Math.PI/2+frame*Math.PI/4;for(const b of [...s.boats,s.defender,...s.enemies])b.angle=a;s.golden.angle=a;},frame);await shot(`${profile}-boats-${['N','NE','E','SE','S','SW','W','NW'][frame]}`);
    assert.equal(await page.evaluate(frame=>{const f=window.__fishing;return [...f.scene.boatViews.values()].every(v=>Number(v.hull.frame.name)===frame&&v.hull.rotation===0)&&Number(f.scene.merchant.frame.name)===frame;},frame),true);
  }
  checks.push(`${profile}: seven actual boat types, eight normalized frames, crate deck attachments and corrected Golden/Salvage/Guard compass`);
  // Live Golden movement: compare the renderer against actual frame-to-frame displacement, not its reported angle.
  await page.evaluate(()=>{const f=window.__fishing,s=ArtFixtures.newState(f.engine.config);f.scene.cancelControl();f.engine.state=s;Object.assign(s.boats[0],{x:1400,y:1700});s.golden.nextAt=0;f.engine.paused=false;f.engine.speed=5;});
  await page.waitForFunction(()=>window.__fishing.engine.state.golden.expires!==null);
  const motion=await page.evaluate(()=>new Promise(resolve=>{let previous=null,checked=0,mismatches=0;const f=window.__fishing,start=performance.now();const listener=()=>{const g=f.engine.state.golden;if(previous){const dx=g.x-previous.x,dy=g.y-previous.y;if(Math.hypot(dx,dy)>.001){checked++;if(Number(f.scene.merchant.frame.name)!==ArtFixtures.directionFrame(Math.atan2(dy,dx)))mismatches++;}}previous={x:g.x,y:g.y};if(performance.now()-start>2200){f.scene.events.off('postupdate',listener);resolve({checked,mismatches});}};f.scene.events.on('postupdate',listener);}));
  assert.ok(motion.checked>10);assert.equal(motion.mismatches,0);await page.evaluate(()=>{window.__fishing.engine.speed=1;window.__fishing.engine.paused=true;});await shot(`${profile}-golden-moving`);checks.push(`${profile}: live Golden displacement agrees with sprite on ${motion.checked} moving frames`);
  // The same crisp fixed-origin tiles cover both zones at different camera locations.
  for(const [name,x,y,area] of [['bay',1150,1350,1],['reef',1450,650,1],['south',680,2100,1],['dangerous-sea',2740,1410,2],['scrap-island',2470,1530,2]]){
    await page.evaluate(({x,y,area})=>{const f=window.__fishing,s=ArtFixtures.newState(f.engine.config);f.engine.state=s;s.area=area;s.flags.storage=true;s.flags.cutter=true;s.questIndex=33;s.flags.den=false;for(const n of Object.values(s.nodes))n.unlocked=true;Object.assign(s.boats[0],{x,y});}, {x,y,area});await shot(`${profile}-${name}`);
    assert.equal(await page.evaluate(()=>{const w=window.__fishing.scene.water;return w.tilePositionX===0&&w.tilePositionY===0;}),true);
  }
  assert.equal(await page.evaluate(()=>{const f=window.__fishing;return f.scene.environment.zone2.every(v=>v.visible)&&f.scene.resourceViews.get('wreck').visible;}),true);
  checks.push(`${profile}: TileSprite fixed UV, five camera positions, both zones assembled, shipwreck and supporting scene visible`);
  // Full deck and larger dropped crates at normal zoom, including metal cargo.
  await page.evaluate(()=>{const f=window.__fishing,s=ArtFixtures.newState(f.engine.config),r=f.engine.config.resources.sardine;f.engine.state=s;s.cargoLevel=f.engine.config.units.player.capacity.length-1;Object.assign(s.boats[0],{x:1450,y:1270,angle:Math.PI/4});
    s.boats[0].cargo=Array.from({length:f.engine.config.units.player.capacity[s.cargoLevel]},(_,i)=>{const resource=['sardine','crab','mussel','snapper','tuna'][i%5];return {id:s.nextId++,resource,kind:'fish',value:f.engine.config.resources[resource].value};});
    s.crates=Array.from({length:5},(_,i)=>({id:s.nextId++,resource:['sardine','crab','mussel','snapper','tuna'][i],kind:'fish',value:2,x:r.x-110+i*55,y:r.y+180,reservedBy:null,expiresAt:60}));
  });await shot(`${profile}-readable-cargo`);
  assert.equal(await page.evaluate(()=>{const f=window.__fishing;return [...f.scene.crateViews.values()].every(v=>v.displayWidth===40)&&f.scene.boatViews.get('player').cargo.every(v=>v.image.displayWidth===28);}),true);
  // Zone 2 source and depletion stages use the same unchanged stock projection.
  await page.evaluate(()=>{const f=window.__fishing,s=ArtFixtures.newState(f.engine.config);f.engine.state=s;s.area=2;s.flags.storage=true;s.flags.cutter=true;s.flags.den=true;for(const n of Object.values(s.nodes))n.unlocked=true;Object.assign(s.boats[0],{x:2540,y:1830});});
  await shot(`${profile}-salvage-full`);
  await page.evaluate(()=>{const f=window.__fishing,n=f.engine.state.nodes.wreck,r=f.engine.config.resources.wreck,remaining=r.stock*.15;n.stock=Math.ceil(remaining);n.hp=(remaining-n.stock+1)*r.portion_hp;});await shot(`${profile}-salvage-last`);
  assert.equal(await page.evaluate(()=>Number(window.__fishing.scene.resourceViews.get('wreck').frame.name)),3);
  // Active maximum fleet gives a production renderer performance sample.
  await page.evaluate(()=>{const f=window.__fishing;f.engine.state=ArtFixtures.fleetFixture(f.engine.config,10,{combat:true});f.engine.paused=false;Object.assign(f.engine.state.boats[0],{x:2460,y:1320});});await page.waitForTimeout(500);
  const sample=await page.evaluate(()=>new Promise(resolve=>{let last=performance.now(),start=last;const values=[];function frame(now){values.push(now-last);last=now;if(now-start<3000)return requestAnimationFrame(frame);const sorted=values.slice(5).sort((a,b)=>a-b);resolve({fps:1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length),p95FrameMs:sorted[Math.floor(sorted.length*.95)],boats:window.__fishing.engine.state.boats.length});}requestAnimationFrame(frame);}));samples.push({profile,...sample});await shot(`${profile}-zone2-fleet`);
  // Every service remains reachable with the unmodified navigation graph.
  await page.evaluate(()=>{const f=window.__fishing;f.engine.state=ArtFixtures.newState(f.engine.config);f.engine.state.area=2;f.engine.state.golden.nextAt=1e9;f.scene.cancelControl();f.engine.speed=5;});
  for(const service of ['port','cargo','worker','speedboat','defender','storage','cutter','salvage','den']){
    await page.evaluate(service=>{const f=window.__fishing,p=service==='port'?f.engine.config.world.port:f.engine.config.interaction.purchase_points[service];f.scene.navigate(p.x,p.y);},service);
    await page.waitForFunction(service=>{const f=window.__fishing,b=f.engine.state.boats[0],p=service==='port'?f.engine.config.world.port:f.engine.config.interaction.purchase_points[service];return Math.hypot(b.x-p.x,b.y-p.y)<13;},service,{timeout:15000});
  }
  await page.evaluate(()=>{const f=window.__fishing;f.engine.speed=1;f.engine.paused=true;});checks.push(`${profile}: nine original port/purchase service points reachable with production navigation`);
 }
 await context.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await mobile.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(`${url}/?debug=1`);await p.waitForFunction(()=>window.__fishing?.ui);await p.addScriptTag({content:fixture.outputFiles[0].text});if(await p.locator('#debug').isVisible())await p.locator('#debug [data-action="debug"]').click();
 for(const [name,x,y,area] of [['mobile-bay',1080,1460,1],['mobile-resource',1450,1290,1],['mobile-zone2',2690,1160,2]]){
  await p.evaluate(({x,y,area})=>{const f=window.__fishing;f.engine.paused=true;f.engine.state=ArtFixtures.fleetFixture(f.engine.config,3,{single:true});f.engine.state.area=area;Object.assign(f.engine.state.boats[0],{x,y});},{x,y,area});await p.waitForTimeout(180);await p.screenshot({path:`${output}/${name}.png`});
 }
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mobile.close();checks.push('390×844 mobile portrait: tiled bay, resources and pirate zone; no horizontal overflow');
 assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/smoke.json`,JSON.stringify({result:'passed',checks,errors,samples,limitations:'Headless Edge WebGL; fixture scenes cover art; native gameplay/input suites run separately; physical phones not measured.'},null,2));console.log(JSON.stringify({result:'passed',checks,samples},null,2));
}catch(error){console.error(error);throw error;}finally{await browser.close();}
