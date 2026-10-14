import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const label=process.argv[2]??'before',root='test-results/v07f/port-den';fs.mkdirSync(root,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[],results=[];
try{for(const profile of ['fast','reference']){
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>localStorage.setItem('quiet_cove_language','ru'));
 await page.goto(`${process.env.SMOKE_URL??'http://127.0.0.1:4199'}/?debug=1&balance=${profile}`);await page.waitForFunction(()=>window.__fishing?.ui);await page.keyboard.press('F2');
 await page.evaluate(async()=>{const f=window.__fishing,e=f.engine,s=e.state,c=e.config,{makeBoat}=await import('/src/game/state.ts');e.paused=true;s.area=2;s.questIndex=26;s.rewarded=Array.from({length:26},(_,i)=>i+1);s.coins=c.second_port.cost;s.metal=c.second_port.metal_cost;e.purchase('secondPort');e.skip('secondPort',true);
  s.questIndex=30;s.questStatus='active';s.rewarded=Array.from({length:30},(_,i)=>i+1);s.flags.storage=true;s.flags.storageUpgrade=true;s.flags.cutter=true;s.cargoLevel=5;s.coins=0;s.metal=100;s.nextPirateAt=s.time+c.combat.spawn_s;
  for(const [id,n] of Object.entries(s.nodes))n.unlocked=id!=='squid';
  for(let i=0;i<5;i++)s.boats.push(makeBoat(`worker:${i}`,'worker',{x:2780+i*65,y:1570+i*35}));s.boats.push(makeBoat('speedboat','speedboat',{x:2660,y:1650}));s.boats.push(makeBoat('salvage:0','salvage',{x:2480,y:1580}));s.defender=makeBoat('defender','player',c.combat.defender_spawn,c.combat.defender_hp);
  Object.assign(s.boats[0],{x:2780,y:1390});f.scene.guidance.cancel();f.scene.cancelControl();f.scene.sys.sceneUpdate=()=>{f.scene.visualDt=1/60;f.scene.drawWorld();f.scene.cameras.main.setZoom(.95);f.scene.cameras.main.centerOn(2570,1330);};f.ui.render();
 });await page.waitForTimeout(300);
 const geometry=await page.evaluate(async()=>{const f=window.__fishing,c=f.engine.config,s=f.engine.state,{onLand,routeTo,syncBuildingObstacles,distance}=await import('/src/game/systems/movement.ts');syncBuildingObstacles(c,s);
  const box=v=>({x:v.x-v.displayWidth/2,y:v.y-v.displayHeight/2,width:v.displayWidth,height:v.displayHeight});
  const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  const hut=box(f.scene.environment.gateBuilding),den=box(f.scene.purchaseLabels.get('den')),port=box(f.scene.zone2PortLabel),lair=box(f.scene.environment.lair),storage=box(f.scene.environment.storage),p=c.interaction.purchase_points.den,r=c.interaction.purchase_radius;
  const dx=Math.max(hut.x-p.x,0,p.x-hut.x-hut.width),dy=Math.max(hut.y-p.y,0,p.y-hut.y-hut.height);
  return {quest:c.quests[s.questIndex].id,built:s.flags.secondPort,coordinates:{unload:c.second_port.unload,hut:c.second_port.hut,portPurchase:c.interaction.purchase_points.secondPort,den:p},radii:{purchase:r,unload:c.world.deposit_radius,boat:c.navigation.boat_radius},bounds:{hut,denLabel:den,portLabel:port,lair,storage},conflicts:{hutDenCircle:dx*dx+dy*dy<r*r,hutDenLabel:overlaps(hut,den),denPortLabels:overlaps(den,port),hutPortLabel:overlaps(hut,port),hutStorage:overlaps(hut,storage),hutLair:overlaps(hut,lair)},denCenterBlocked:onLand(c,p),unloadBlocked:onLand(c,c.second_port.unload),circleGap:distance(p,c.second_port.unload)-r-c.world.deposit_radius,routes:[c.world.port,c.world.storage,c.second_port.unload,c.interaction.purchase_points.secondPort].map(from=>{const path=routeTo(c,from,p,2);return {from,length:path.length,exact:!!path.length&&distance(path.at(-1),p)<.01};})};
 });results.push({profile,...geometry});await page.screenshot({path:`${root}/q31-${label}-${profile}.png`});if(label==='after'){
  for(const conflict of Object.values(geometry.conflicts))assert.equal(conflict,false);
  assert.equal(geometry.denCenterBlocked,false);assert.equal(geometry.unloadBlocked,false);assert.ok(geometry.routes.every(r=>r.exact));
  const target=await page.evaluate(()=>{const f=window.__fishing,label=f.scene.purchaseLabels.get('den'),camera=f.scene.cameras.main,original=f.scene.navigate.bind(f.scene);f.scene.navigate=(x,y)=>{window.__denGoal={x,y};original(x,y);};return {x:(label.x-camera.scrollX)*camera.zoom+12,y:(label.y-camera.scrollY)*camera.zoom+6};});
  await page.mouse.click(target.x,target.y);assert.deepEqual(await page.evaluate(()=>window.__denGoal),geometry.coordinates.den);
  const interactions=await page.evaluate(async()=>{const f=window.__fishing,e=f.engine,s=e.state,c=e.config,{acquire}=await import('/src/game/systems/resources.ts'),{deposit}=await import('/src/game/systems/economy.ts');
   Object.assign(s.boats[0],c.second_port.unload);acquire(c,s,s.boats[0],'tuna');deposit(c,s,s.boats[0],1);const unloaded=s.boats[0].cargo.length===0,coins=s.coinStacks.filter(p=>p.boat==='player').length;
   Object.assign(s.boats[0],c.interaction.purchase_points.den);s.coins=17;s.metal=0;e.input={x:0,y:0};e.paused=false;e.update(3);e.paused=true;
   return {unloaded,coins,paid:s.orders.den?.paid,price:s.orders.den?.cost,expectedPrice:c.expansion.den.cost,portStillBuilt:s.flags.secondPort};});
  assert.equal(interactions.unloaded,true);assert.equal(interactions.coins,1);assert.equal(interactions.paid,17);assert.equal(interactions.price,interactions.expectedPrice);assert.equal(interactions.portStillBuilt,true);results.at(-1).interactions=interactions;
 }await context.close();
 }
 fs.writeFileSync(`${root}/${label}.json`,JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();}
