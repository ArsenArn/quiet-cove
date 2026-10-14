import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const output='test-results/v05a/browser',url=process.env.SMOKE_URL??'http://127.0.0.1:4190';fs.mkdirSync(output,{recursive:true});
const fixture=await build({stdin:{contents:`export {newState,makeBoat} from './src/game/state';export {harvest,updateResources,acquire} from './src/game/systems/resources';export {deposit,spawnCoins} from './src/game/systems/economy';export {directionFrame} from './src/game/art/registry';export {fleetFixture} from './scripts/traffic-scenarios-v04b';`,resolveDir:process.cwd()},bundle:true,platform:'browser',format:'iife',globalName:'ArtFixtures',write:false});
const browser=await chromium.launch({headless:true,...process.platform==='win32'?{channel:'msedge'}:{}}),errors=[],checks=[],performanceSamples=[];
try{
  const context=await browser.newContext({viewport:{width:1440,height:900},hasTouch:true}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const ready=async()=>{await page.waitForFunction(()=>window.__fishing?.ui);await page.addScriptTag({content:fixture.outputFiles[0].text});if(await page.locator('#debug').isVisible())await page.locator('#debug [data-action="debug"]').click();};
  const shot=async(name)=>{await page.waitForTimeout(150);await page.screenshot({path:`${output}/${name}.png`});};
  for(const profile of ['fast','reference']){
    await page.goto(`${url}/?debug=1&balance=${profile}`);await ready();
    assert.equal(await page.evaluate(()=>window.__fishing.game.renderer.type),2);
    assert.deepEqual(await page.evaluate(()=>{const t=window.__fishing.scene.textures;return ['art-player','art-worker','art-speed','art-golden'].map(k=>t.get(k).frameTotal);}),[9,9,9,9]);
    // Native WASD, including diagonals: renderer frame follows actual engine movement.
    await page.evaluate(()=>{const f=window.__fishing;f.scene.cancelControl();f.engine.state=ArtFixtures.newState(f.engine.config);Object.assign(f.engine.state.boats[0],{x:1300,y:1700});f.engine.state.golden.nextAt=1e9;});
    for(const [frame,keys] of [[0,['w']],[1,['w','d']],[2,['d']],[3,['s','d']],[4,['s']],[5,['s','a']],[6,['a']],[7,['w','a']]]){
      for(const key of keys)await page.keyboard.down(key);await page.waitForTimeout(120);
      const actual=await page.evaluate(()=>{const f=window.__fishing,b=f.engine.state.boats[0],v=f.scene.boatViews.get('player');return {frame:Number(v.hull.frame.name),rotation:v.hull.rotation,angle:b.angle};});
      assert.equal(actual.frame,frame);assert.equal(actual.rotation,0);for(const key of keys)await page.keyboard.up(key);
    }
    checks.push(`${profile}: real WebGL, loaded eight-direction sheets, native WASD in eight directions`);
    // Four skins × eight directions, cargo stays centered on the per-direction deck.
    await page.evaluate(()=>{const f=window.__fishing,s=ArtFixtures.newState(f.engine.config);f.scene.cancelControl();f.engine.paused=true;f.engine.state=s;s.golden.nextAt=1e9;s.boats=[];
      for(const [row,kind] of ['player','worker','speedboat'].entries())for(let dir=0;dir<8;dir++){
        const b=ArtFixtures.makeBoat(`gallery-${row}-${dir}`,kind,{x:430+dir*145,y:1010+row*155},f.engine.config.units.player.hp);b.angle=-Math.PI/2+dir*Math.PI/4;
        b.cargo=Array.from({length:kind==='speedboat'?2:kind==='worker'?3:6},(_,i)=>{const resource=['sardine','crab','mussel','snapper','tuna'][i%5];return {id:s.nextId++,resource,kind:'fish',value:f.engine.config.resources[resource].value};});s.boats.push(b);
      }
      s.boats.unshift(ArtFixtures.makeBoat('player','player',{x:1000,y:1190},f.engine.config.units.player.hp));
      f.scene.cameras.main.setZoom(.9);
    });
    await shot(`${profile}-directions-cargo`);
    assert.equal(await page.evaluate(()=>{const f=window.__fishing;return f.engine.state.boats.filter(b=>b.id.startsWith('gallery')).every(b=>Number(f.scene.boatViews.get(b.id).hull.frame.name)===ArtFixtures.directionFrame(b.angle)&&f.scene.boatViews.get(b.id).cargo.length===b.cargo.length);}),true);
    // Full/low/last states, resource centers are invariant in the live renderer.
    await page.evaluate(()=>{const f=window.__fishing;f.engine.state=ArtFixtures.newState(f.engine.config);Object.assign(f.engine.state.boats[0],{x:1000,y:1240});f.scene.cameras.main.setZoom(.63);for(const n of Object.values(f.engine.state.nodes))n.unlocked=true;});
    await shot(`${profile}-resources-full`);
    for(const [fraction,frame,name] of [[.65,1,'medium'],[.4,2,'low'],[.15,3,'last']]){
      await page.evaluate(fraction=>{const f=window.__fishing;for(const [id,n] of Object.entries(f.engine.state.nodes)){const r=f.engine.config.resources[id],remaining=r.stock*fraction;n.stock=Math.ceil(remaining);n.hp=(remaining-n.stock+1)*r.portion_hp;}},fraction);
      await shot(`${profile}-resources-${name}`);
      assert.equal(await page.evaluate(frame=>{const f=window.__fishing;return [...f.scene.resourceViews].every(([id,v])=>Number(v.frame.name)===frame&&v.x===f.engine.config.resources[id].x&&v.y===f.engine.config.resources[id].y);},frame),true);
    }
    await page.evaluate(()=>{const f=window.__fishing,s=f.engine.state;for(const [id,n] of Object.entries(s.nodes)){n.phase='restock';n.stock=0;n.hp=0;n.readyAt=s.time+2;} });await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>[...window.__fishing.scene.resourceViews.values()].every(v=>!v.visible)),true);
    await page.evaluate(()=>{const f=window.__fishing;f.engine.state.time+=2;ArtFixtures.updateResources(f.engine.config,f.engine.state);});await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>[...window.__fishing.scene.resourceViews.values()].every(v=>v.visible&&Number(v.frame.name)===0)),true);
    checks.push(`${profile}: all five resources FULL/MEDIUM/LOW/LAST; same center; invisible on restock; FULL on actual timer recovery`);
    // Real harvesting produces cargo and individual floating crates; no render-side auto-acquire.
    await page.evaluate(()=>{const f=window.__fishing,s=ArtFixtures.newState(f.engine.config),r=f.engine.config.resources.sardine;f.engine.state=s;s.cargoLevel=3;f.scene.cameras.main.setZoom(1);Object.assign(s.boats[0],{x:r.x,y:r.y});s.nodes.sardine.hp=r.damage_per_catch;s.nodes.sardine.stock=1;ArtFixtures.harvest(f.engine.config,s,s.boats[0],'sardine',r.gather_s);});
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(()=>{const f=window.__fishing;return f.engine.state.crates.length===f.engine.config.resources.sardine.drop_crates&&f.engine.state.boats[0].cargo.length===1&&f.scene.boatViews.get('player').cargo.length===1&&!f.scene.resourceViews.get('sardine').visible;}),true);
    await shot(`${profile}-floating-crates`);
    await page.evaluate(()=>{const f=window.__fishing;f.engine.paused=false;const crate=f.engine.state.crates[0];Object.assign(f.engine.state.boats[0],{x:crate.x,y:crate.y});});
    await page.waitForFunction(()=>window.__fishing.engine.state.boats[0].cargo.length>1);await page.evaluate(()=>{window.__fishing.engine.paused=true;});
    checks.push(`${profile}: depletion drops distinct crate sprites; cargo sprite grows only after physical pickup`);
    // At normal game zoom, full mixed cargo remains bounded and moves with the hull.
    await page.evaluate(()=>{const f=window.__fishing,s=ArtFixtures.newState(f.engine.config),b=s.boats[0];f.engine.state=s;s.cargoLevel=f.engine.config.units.player.capacity.length-1;Object.assign(b,{x:1250,y:1490,angle:Math.PI/4});b.cargo=Array.from({length:f.engine.config.units.player.capacity[s.cargoLevel]},(_,i)=>{const resource=['sardine','crab','mussel','snapper','tuna'][i%5];return {id:s.nextId++,resource,kind:'fish',value:f.engine.config.resources[resource].value};});});
    await shot(`${profile}-full-cargo`);
    await page.evaluate(()=>window.__fishing.scene.cameras.main.setZoom(2));await shot(`${profile}-cargo-detail`);await page.evaluate(()=>window.__fishing.scene.cameras.main.setZoom(1));
    // Existing deposit creates separate payouts. Rendering must keep payout IDs and wallet unchanged.
    await page.evaluate(()=>{const f=window.__fishing,s=f.engine.state,b=s.boats[0];Object.assign(b,f.engine.config.world.port);ArtFixtures.deposit(f.engine.config,s,b,f.engine.config.units.player.deposit_s_per_crate*3);s.time+=f.engine.config.interaction.coin_delay_s;});
    const payouts=await page.evaluate(()=>{const f=window.__fishing,s=f.engine.state;return {count:s.coinStacks.length,ids:s.coinStacks.map(p=>p.id),wallet:s.coins,cargo:s.boats[0].cargo.length};});
    assert.equal(payouts.count,3);await shot(`${profile}-payouts`);
    assert.deepEqual(await page.evaluate(()=>window.__fishing.engine.state.coinStacks.map(p=>p.id)),payouts.ids);assert.equal(await page.evaluate(()=>window.__fishing.engine.state.coins),payouts.wallet);
    assert.equal(await page.evaluate(()=>window.__fishing.scene.coinLabels.size),3);
    checks.push(`${profile}: one image per payout, unloading one crate at a time, wallet unchanged by rendering`);
    // Real Golden path and all eight Golden sprite frames; click opens production popup.
    await page.evaluate(()=>{const f=window.__fishing,s=ArtFixtures.newState(f.engine.config);f.engine.state=s;Object.assign(s.boats[0],{x:1300,y:1650});s.golden.nextAt=0;f.engine.paused=false;});
    await page.waitForFunction(()=>window.__fishing.engine.state.golden.expires!==null);
    const start=await page.evaluate(()=>({...window.__fishing.engine.state.golden}));await page.waitForTimeout(500);
    assert.ok(await page.evaluate(p=>Math.hypot(window.__fishing.engine.state.golden.x-p.x,window.__fishing.engine.state.golden.y-p.y)>1,start));
    await page.evaluate(()=>window.__fishing.engine.paused=true);
    for(let frame=0;frame<8;frame++){
      await page.evaluate(frame=>window.__fishing.engine.state.golden.angle=-Math.PI/2+frame*Math.PI/4,frame);await page.waitForTimeout(50);
      assert.equal(await page.evaluate(()=>Number(window.__fishing.scene.merchant.frame.name)),frame);
    }
    await shot(`${profile}-golden`);
    const hit=await page.evaluate(()=>{const f=window.__fishing,c=f.scene.cameras.main,g=f.engine.state.golden;return {x:(g.x-c.scrollX)*c.zoom,y:(g.y-c.scrollY)*c.zoom};});await page.mouse.click(hit.x,hit.y);await page.locator('#golden-grab').waitFor({state:'visible'});await page.locator('#golden-let-go').click();
    const reward=await page.evaluate(()=>{const f=window.__fishing,s=f.engine.state,t=f.engine.openGoldenOffer();f.engine.beginGoldenReward(t.id);f.engine.claimGolden(true,t.id);s.time+=f.engine.config.interaction.coin_delay_s;return {count:s.coinStacks.length,wallet:s.coins,sum:s.coinStacks.reduce((a,p)=>a+p.value,0),reward:t.reward};});
    assert.equal(reward.count,10);assert.equal(reward.wallet,0);assert.equal(reward.sum,reward.reward);await shot(`${profile}-golden-piles`);
    assert.equal(await page.evaluate(()=>[...window.__fishing.scene.coinLabels.values()].every(v=>v.image.texture.key==='coin-large_pile')),true);
    checks.push(`${profile}: Golden moves; eight frames; hull tap popup; ten physical piles and reward preserved`);
    // Multiple working ships at the illustrated port. Render stress includes 150 crates and 240 payouts.
    await page.evaluate(()=>{const f=window.__fishing;f.engine.paused=false;f.engine.state=ArtFixtures.fleetFixture(f.engine.config,10,{single:true});f.engine.state.area=1;});await page.waitForTimeout(500);await shot(`${profile}-port-workers`);
    await page.evaluate(()=>{const f=window.__fishing,s=f.engine.state,b=s.boats[0];Object.assign(b,{x:1200,y:1450});for(let i=0;i<150;i++)s.crates.push({id:s.nextId++,resource:['sardine','crab','mussel','snapper','tuna'][i%5],kind:'fish',value:2,reservedBy:null,x:1160+i%15*35,y:1620+Math.floor(i/15)*35,expiresAt:s.time+60});for(let i=0;i<240;i++)ArtFixtures.spawnCoins(f.engine.config,s,2+i%30,'fish_sale',{x:1250,y:1430});s.time+=f.engine.config.interaction.coin_delay_s;});
    const sample=await page.evaluate(()=>new Promise(resolve=>{const frames=[],start=performance.now();let last=start;function frame(now){frames.push(now-last);last=now;if(now-start<3000)return requestAnimationFrame(frame);const values=frames.slice(5).sort((a,b)=>a-b),f=window.__fishing;resolve({fps:1000/(values.reduce((a,b)=>a+b,0)/values.length),p95FrameMs:values[Math.floor(values.length*.95)],boats:f.engine.state.boats.length,crates:f.engine.state.crates.length,payouts:f.engine.state.coinStacks.length,images:f.scene.children.list.filter(v=>v.type==='Image').length,textures:f.scene.textures.getTextureKeys().length});}requestAnimationFrame(frame);}));
    performanceSamples.push({profile,...sample});await shot(`${profile}-stress`);checks.push(`${profile}: 10 workers plus speed boat, 150-crate/240-payout render stress`);
    await page.evaluate(()=>window.__fishing.engine.paused=true);await page.waitForTimeout(1200);
    const stable=await page.evaluate(()=>({objects:window.__fishing.scene.children.length,textures:window.__fishing.scene.textures.getTextureKeys().length}));await page.waitForTimeout(600);
    assert.deepEqual(await page.evaluate(()=>({objects:window.__fishing.scene.children.length,textures:window.__fishing.scene.textures.getTextureKeys().length})),stable);
    // Reach all four immutable service points with production navigation.
    await page.evaluate(()=>{const f=window.__fishing;f.scene.cancelControl();f.engine.state=ArtFixtures.newState(f.engine.config);f.engine.state.golden.nextAt=1e9;f.engine.paused=false;f.engine.speed=3;});
    for(const service of ['port','cargo','worker','speedboat']){
      await page.evaluate(service=>{const f=window.__fishing,p=service==='port'?f.engine.config.world.port:f.engine.config.interaction.purchase_points[service];f.scene.navigate(p.x,p.y);},service);
      await page.waitForFunction(service=>{const f=window.__fishing,b=f.engine.state.boats[0],p=service==='port'?f.engine.config.world.port:f.engine.config.interaction.purchase_points[service];return Math.hypot(b.x-p.x,b.y-p.y)<13;},service,{timeout:12000});
    }
    await page.evaluate(()=>{const f=window.__fishing;f.engine.speed=1;f.engine.paused=true;Object.assign(f.engine.state.boats[0],{x:1140,y:1410});});await shot(`${profile}-main-bay`);
    checks.push(`${profile}: port/cargo/worker/speed points reachable; pooled object/texture counts stable while state is stationary`);
  }
  await context.close();
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await mobile.newPage();
  p.on('pageerror',e=>errors.push(e.message));await p.goto(`${url}/?debug=1`);await p.waitForFunction(()=>window.__fishing?.ui);await p.addScriptTag({content:fixture.outputFiles[0].text});if(await p.locator('#debug').isVisible())await p.locator('#debug [data-action="debug"]').click();
  await p.evaluate(()=>{const f=window.__fishing;f.engine.state=ArtFixtures.fleetFixture(f.engine.config,5,{single:true});f.engine.state.area=1;f.engine.paused=true;Object.assign(f.engine.state.boats[0],{x:1050,y:1470});});await p.waitForTimeout(150);await p.screenshot({path:`${output}/mobile-port.png`});
  await p.evaluate(()=>{const f=window.__fishing;Object.assign(f.engine.state.boats[0],{x:1450,y:1350});f.engine.paused=false;});await p.waitForTimeout(150);await p.screenshot({path:`${output}/mobile-game.png`});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await p.evaluate(()=>window.__fishing.game.renderer.type),2);
  checks.push('390×844 mobile portrait, real WebGL, port and gameplay screenshots, no horizontal overflow');await mobile.close();
  assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/smoke.json`,JSON.stringify({result:'passed',checks,errors,performanceSamples,limitations:'Headless Edge desktop GPU/CPU; portrait is mobile emulation, not Android/iOS hardware performance. State fixtures are explicitly used for art coverage and stress. Native input and production gameplay regression run separately.'},null,2));
  console.log(JSON.stringify({result:'passed',checks,performanceSamples},null,2));
}finally{await browser.close();}
