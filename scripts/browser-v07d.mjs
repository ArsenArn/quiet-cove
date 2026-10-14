
 const fs=(await import('node:fs')).default,assert=(await import('node:assert/strict')).default;
 const {chromium}=await import('@playwright/test');
 const root='test-results/v07d/browser';fs.mkdirSync(root,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[],checks=[];
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  await page.goto('http://127.0.0.1:5175/?debug=1&balance=fast');await page.waitForFunction(()=>window.__fishing?.ui);await page.keyboard.press('F2');
  await page.evaluate(async()=>{
   const f=window.__fishing,e=f.engine,s=e.state,c=e.config,{makeBoat}=await import('/src/game/state.ts');
   f.scene.cancelControl();s.area=2;s.questIndex=29;s.questStatus='active';s.coins=100000;s.metal=100;s.cargoLevel=4;s.flags.storage=true;s.flags.cutter=true;
   for(const n of Object.values(s.nodes))n.unlocked=true;
   s.defender=makeBoat('defender','player',c.combat.defender_spawn,c.combat.defender_hp);
   s.enemies=Array.from({length:2},(_,i)=>({id:'layout-pirate-'+i,x:c.combat.spawner.x+110+i*70,y:c.combat.spawner.y,home:{x:c.combat.spawner.x+110,y:c.combat.spawner.y},hp:c.combat.pirate_hp,angle:0,attackAt:0,state:'PATROL',target:null}));
   Object.assign(s.boats[0],{x:2440,y:1400});e.update(.001);e.paused=true;f.scene.guidance.cancel();f.scene.cameras.main.setZoom(.55);
  });
  await page.waitForTimeout(200);await page.screenshot({path:root+'/zone2-overview.png'});
  const layout=await page.evaluate(()=>{
   const f=window.__fishing,c=f.engine.config,p=f.scene.portLabel,g=f.scene.environment.gateBuilding;
   const labels=[...f.scene.purchaseLabels].filter(([id])=>id==='storageUpgrade'||id.startsWith('salvage:')).map(([id,l])=>({id,x:l.x,y:l.y,width:l.width,height:l.height}));
   return {port:{x:p.x,y:p.y},entrance:{x:g.x,y:g.y},labels,config:c.zone2_layout,pirates:f.engine.state.enemies.length};
  });
  assert.equal(layout.port.x,2630);assert.deepEqual(layout.entrance,{x:1640,y:1100});assert.equal(layout.pirates,2);
  const labels=layout.labels;assert.equal(labels.length,2);
  for(const l of labels)assert.ok(Math.abs(l.x-layout.config.fish_unload.x)>l.width/2+38 || Math.abs(l.y-layout.config.fish_unload.y)>l.height/2+38,'purchase label obscures fish unload');
  assert.ok(Math.abs(labels[0].y-labels[1].y)>(labels[0].height+labels[1].height)/2);
  await page.evaluate(()=>{const f=window.__fishing;Object.assign(f.engine.state.boats[0],{x:2370,y:1440});f.scene.cameras.main.setZoom(1);});
  await page.waitForTimeout(100);await page.screenshot({path:root+'/storage-purchase-zones.png'});checks.push('moved functional circles, label positions, entrance and central fish unload');
  await page.evaluate(()=>{
   const f=window.__fishing,n=f.engine.state.nodes.wreck,c=f.engine.config;
   Object.assign(f.engine.state.boats[0],{x:c.resources.wreck.x,y:c.resources.wreck.y});f.scene.cameras.main.setZoom(1.15);
   Object.assign(n,{stock:5,hp:25,phase:'ready'});
  });
  await page.waitForTimeout(100);await page.screenshot({path:root+'/wreck-depleted.png'});
  assert.equal(await page.evaluate(()=>window.__fishing.scene.resourceViews.get('wreck').frame.name),2);
  await page.evaluate(()=>{const s=window.__fishing.engine.state;Object.assign(s.nodes.wreck,{stock:0,hp:0,phase:'restock',readyAt:s.time+90});});
  await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__fishing.scene.resourceViews.get('wreck').visible),false);
  assert.match(await page.evaluate(()=>window.__fishing.scene.labels.get('wreck').text),/Restoring/);
  await page.screenshot({path:root+'/wreck-restoring.png'});
  await page.evaluate(()=>{const e=window.__fishing.engine;e.settleOffline(90);});
  await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__fishing.scene.resourceViews.get('wreck').visible),true);assert.equal(await page.evaluate(()=>window.__fishing.engine.state.nodes.wreck.stock),12);
  await page.screenshot({path:root+'/wreck-restored.png'});checks.push('wreck progressive frame, disappearance, countdown, full restoration without repurchase');
  await page.evaluate(async()=>{
   const f=window.__fishing,e=f.engine,s=e.state,c=e.config,{activateQuest}=await import('/src/game/systems/quests.ts'),{acquire}=await import('/src/game/systems/resources.ts');
   s.flags.den=true;s.questIndex=23;s.stats.metal_deposited=123;s.metal=100;s.boats=s.boats.slice(0,1);s.boats[0].cargo=[];
   Object.assign(s.boats[0],c.world.storage);activateQuest(c,s);for(let i=0;i<6;i++)acquire(c,s,s.boats[0],'wreck');f.analytics.start();f.persist();
  });
  await page.reload();await page.waitForFunction(()=>window.__fishing?.ui);await page.keyboard.press('F2');
  await page.waitForFunction(()=>window.__fishing.engine.state.stats.metal_deposited===129);
  const overflow=await page.evaluate(()=>{
   const f=window.__fishing,s=f.engine.state;f.engine.paused=true;const data=JSON.parse(f.analytics.exportJSON());
   return {metal:s.metal,cargo:s.boats[0].cargo.length,progress:s.stats.metal_deposited-s.questBaseline,residual:data.summary.metal_reconciliation.residual,discarded:s.stats.metal_discarded};
  });
  assert.deepEqual(overflow,{metal:100,cargo:0,progress:6,residual:0,discarded:6});
  await page.evaluate(()=>{const f=window.__fishing;f.scene.cameras.main.setZoom(1);f.scene.drawEvents();});
  await page.screenshot({path:root+'/storage-overflow.png'});checks.push('full storage and cargo through reload: cargo released, capped inventory, fresh delivered progress, analytics reconciliation');
  await page.evaluate(async()=>{
   const f=window.__fishing,e=f.engine,s=e.state,c=e.config,{activateQuest}=await import('/src/game/systems/quests.ts'),{makeBoat}=await import('/src/game/state.ts');
   f.analytics.stop();s.questIndex=25;activateQuest(c,s);s.boats.push(makeBoat('salvage:0','salvage',c.world.storage));s.crates=[];
   e.paused=false;e.update(300);e.paused=true;
  });
  const q26=await page.evaluate(()=>{const s=window.__fishing.engine.state;return {status:s.questStatus,metal:s.metal,delivered:s.stats.metal_deposited-s.questBaseline,cargo:s.boats.find(b=>b.kind==='salvage').cargo.length,debug:s.stats.debug_income??0};});
  assert.equal(q26.status,'completed_unclaimed');assert.equal(q26.metal,100);assert.ok(q26.delivered>=50);assert.equal(q26.debug,0);checks.push('Q26 full storage completes from actual salvage gathering and deliveries, without counter grants');
  // Compact-screen layout inspection uses the same map and HUD.
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{const f=window.__fishing;Object.assign(f.engine.state.boats[0],{x:2370,y:1470});f.scene.cameras.main.setZoom(.68);});
  await page.waitForTimeout(150);await page.screenshot({path:root+'/zone2-mobile.png'});
  assert.deepEqual(errors,[]);fs.writeFileSync(root+'/report.json',JSON.stringify({result:'passed',checks,consoleErrors:errors,layout,overflow,q26,scope:'Independent browser context, technical fixtures; not human pacing or real-device proof.'},null,2));
  console.log(JSON.stringify({result:'passed',checks,errors,layout}));
 }finally{await context.close();await browser.close();}

