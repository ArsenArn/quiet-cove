import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const root='test-results/ground-ui-step2';fs.mkdirSync(root,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[],checks=[];
try{for(const profile of ['fast','reference'])for(const language of ['en','ru']){
 const context=await browser.newContext({viewport:{width:1600,height:1200}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(lang=>{localStorage.setItem('quiet_cove_language',lang);localStorage.setItem('quiet_cove_music_enabled','false');},language);
 await page.goto(`http://127.0.0.1:4199/?debug=1&balance=${profile}`);await page.waitForFunction(()=>window.__fishing?.scene?.portLabel);await page.keyboard.press('F2');
 await page.evaluate(async()=>{
  const f=window.__fishing,e=f.engine,s=e.state,c=e.config,{makeBoat}=await import('/src/game/state.ts');e.paused=true;s.area=2;s.questIndex=30;s.rewarded=Array.from({length:30},(_,i)=>i+1);
  Object.assign(s.flags,{secondPort:true,storage:true,storageUpgrade:true,cutter:true});s.golden.expires=null;s.coins=0;s.nextPirateAt=s.time+c.combat.spawn_s*.55;
  for(const n of Object.values(s.nodes))n.unlocked=true;
  Object.assign(s.boats[0],{x:2700,y:1540});s.boats=s.boats.slice(0,1);for(let i=0;i<7;i++)s.boats.push(makeBoat(`worker:${i}`,'worker',{x:2500+i*70,y:1630+i*17}));s.defender=makeBoat('defender','player',c.combat.defender_spawn,c.combat.defender_hp);
  s.enemies=[{id:'pirate:test',x:c.combat.spawner.x+110,y:c.combat.spawner.y,home:{x:c.combat.spawner.x+110,y:c.combat.spawner.y},hp:100,angle:0,attackAt:0,state:'PATROL',target:null}];
  f.scene.guidance.cancel();f.scene.cancelControl();f.scene.sys.sceneUpdate=()=>{f.scene.visualDt=1/60;f.scene.drawWorld();f.scene.cameras.main.setZoom(.65);f.scene.cameras.main.centerOn(2530,1560);};f.ui.render();f.scene.drawWorld();
 });await page.waitForTimeout(200);
 const inspect=()=>{
  const f=window.__fishing,sc=f.scene,c=f.engine.config,state=f.engine.state;
  const box=(key,v)=>({key,x:v.x,y:v.y,width:v.displayWidth,height:v.displayHeight,visible:v.visible});
  const overlap=(a,b)=>Math.abs(a.x-b.x)<(a.width+b.width)/2+2&&Math.abs(a.y-b.y)<(a.height+b.height)/2+2;
  const objects=[{key:'mainHarbor',x:884.125,y:1347.0234375,width:340.45,height:203.515625,visible:true},box('secondPort',sc.environment.gateBuilding),box('storage',sc.environment.storage),box('defender',sc.environment.defender),box('den',sc.environment.lair),...Object.entries(c.resources).filter(([,r])=>r.zone===2).map(([id])=>box('resource:'+id,sc.resourceViews.get(id)))].filter(v=>v.visible);
  const labels=[box('port',sc.zone2PortLabel),box('storage',sc.storageLabel),box('spawner',sc.spawnerLabel),...[...sc.labels].filter(([,l])=>l.visible).map(([id,l])=>box('resource:'+id,l)),...[...sc.purchaseLabels].map(([id,l])=>box(id,l)),...[...sc.skipButtons].map(([id,l])=>box('skip:'+id,l))].filter(v=>v.visible);
  const circles=[...state.flags.secondPort?[{key:'port',...c.second_port.unload,r:c.world.deposit_radius}]:[],...state.flags.storage?[{key:'storageUnload',...c.world.storage,r:c.world.deposit_radius}]:[],...Object.entries(c.resources).filter(([id,r])=>r.zone===2&&state.nodes[id].unlocked).map(([id,r])=>({key:'resource:'+id,x:r.x,y:r.y,r:c.world.resource_radius})),...[...sc.purchaseLabels.keys()].map(id=>({key:id,...(id.startsWith('resource:')?c.resources[id.split(':')[1]]:c.interaction.purchase_points[id.split(':')[0]]),r:c.interaction.purchase_radius}))];
  const pairs=(list,test)=>list.flatMap((a,i)=>list.slice(i+1).filter(b=>test(a,b)).map(b=>[a.key,b.key]));
  const rectCircle=(a,b)=>Math.hypot(Math.max(0,Math.abs(a.x-b.x)-a.width/2),Math.max(0,Math.abs(a.y-b.y)-a.height/2))<b.r+2;
  const captionGaps=Object.entries(c.resources).filter(([id])=>sc.labels.get(id).visible).map(([id,r])=>{
   const texture=sc.textures.get('resource-'+id),image=texture.getSourceImage(),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;let bottom=0;
   for(let i=0;i<4;i++){const frame=texture.get(i);for(let y=0;y<frame.cutHeight;y++)for(let x=0;x<frame.cutWidth;x++)if(pixels[((frame.cutY+y)*canvas.width+frame.cutX+x)*4+3]>24)bottom=Math.max(bottom,y+1);}
   const art=sc.resourceViews.get(id),label=sc.labels.get(id),visibleBottom=art.y+(bottom-96)*art.displayHeight/192;return {id,gap:label.y-label.height/2-visibleBottom};
  });
  return {captionGaps,objects,labels,circles,objectOverlap:pairs(objects,overlap),labelOverlap:pairs(labels,overlap),labelObjectOverlap:labels.flatMap(a=>objects.filter(b=>!(a.key===b.key&&a.key.startsWith('resource:'))&&overlap(a,b)).map(b=>[a.key,b.key])),zoneOverlap:pairs(circles,(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r+6),zoneObjectOverlap:circles.flatMap(a=>objects.filter(b=>a.key!==b.key&&rectCircle(b,a)).map(b=>[a.key,b.key])),panelZoneOverlap:labels.filter(l=>sc.purchaseLabels.has(l.key)||l.key.startsWith('skip:')).flatMap(a=>circles.filter(b=>rectCircle(a,b)).map(b=>[a.key,b.key])),namesHidden:[...sc.boatViews.values()].every(v=>!v.name.visible)};
 };
 const geometry=await page.evaluate(inspect);
 fs.writeFileSync(`${root}/geometry-${profile}-${language}.json`,JSON.stringify(geometry,null,2));
 for(const key of ['objectOverlap','labelOverlap','labelObjectOverlap','zoneOverlap','zoneObjectOverlap','panelZoneOverlap'])assert.deepEqual(geometry[key],[],key);assert.equal(geometry.namesHidden,true);assert.ok(geometry.captionGaps.every(v=>v.gap>=8),JSON.stringify(geometry.captionGaps));
 await page.screenshot({path:root+'/zone2-'+profile+'-'+language+'.png'});
 for(const [name,x,y,zoom] of [['lair',2990,1110,1.15],['storage-port',2520,1550,1],['resources',1350,1080,1]]){
  await page.evaluate(p=>{const sc=window.__fishing.scene;sc.sys.sceneUpdate=()=>{sc.drawWorld();sc.cameras.main.setZoom(p.zoom);sc.cameras.main.centerOn(p.x,p.y);};},{x,y,zoom});await page.waitForTimeout(80);await page.screenshot({path:root+'/'+name+'-'+profile+'-'+language+'.png'});
 }
 await page.evaluate(()=>{const sc=window.__fishing.scene;sc.sys.sceneUpdate=()=>{sc.drawWorld();sc.cameras.main.setZoom(.65);sc.cameras.main.centerOn(2530,1560);};});await page.waitForTimeout(80);
 const stable=await page.evaluate(()=>{
  const f=window.__fishing,sc=f.scene,s=f.engine.state,c=f.engine.config;
  const snapshot=()=>JSON.stringify([sc.portLabel,sc.zone2PortLabel,sc.storageLabel,sc.spawnerLabel,...sc.labels.values(),...sc.purchaseLabels.values()].filter(l=>l.visible).map(l=>({text:l.text,x:l.x,y:l.y})));
  const initial=snapshot();for(let frame=0;frame<120;frame++){for(const [i,b] of [...s.boats,s.defender,...s.enemies].entries()){b.x=c.second_port.hut.x+Math.sin(frame*.13+i)*220;b.y=c.second_port.hut.y+Math.cos(frame*.17+i)*180;}sc.drawWorld();if(snapshot()!==initial)return false;}return true;
 });assert.equal(stable,true);

 // Check the same fixed plan with every late purchase revealed, then all timers.
 for(const stage of ['offers','building']){
  await page.evaluate(async stage=>{
   const f=window.__fishing,s=f.engine.state,c=f.engine.config,{offers}=await import('/src/game/systems/construction.ts');
   Object.assign(s.flags,{secondPort:false,storage:false,storageUpgrade:false,cutter:false,den:false,route:false});s.defender=undefined;s.questIndex=33;s.rewarded=Array.from({length:33},(_,i)=>i+1);
   for(const [id,node] of Object.entries(s.nodes))node.unlocked=c.resources[id].zone===1;
   for(const id of Object.keys(c.interaction.reveal_at_quest))s.revealedPurchases[id]=true;s.orders={};
   if(stage==='building')for(const o of offers(c,s))s.orders[o.id]={id:o.id,paid:o.cost,metalPaid:o.metal_cost??0,cost:o.cost,metalCost:o.metal_cost??0,duration:o.build_s,readyAt:s.time+50,complete:false};
   f.scene.drawWorld();f.ui.render();
  },stage);
  const g=await page.evaluate(inspect);fs.writeFileSync(root+'/geometry-'+profile+'-'+language+'-'+stage+'.json',JSON.stringify(g,null,2));
  for(const key of ['objectOverlap','labelOverlap','labelObjectOverlap','zoneOverlap','zoneObjectOverlap','panelZoneOverlap'])assert.deepEqual(g[key],[],stage+': '+key);
  await page.screenshot({path:root+'/zone2-'+profile+'-'+language+'-'+stage+'.png'});
  if(stage==='offers'){
   const target=await page.evaluate(()=>{const f=window.__fishing,l=f.scene.purchaseLabels.get('secondPort'),cam=f.scene.cameras.main;f.scene.navigate=(x,y)=>window.__groundTarget={x,y};return {x:(l.x-cam.worldView.x)*cam.zoom,y:(l.y-cam.worldView.y)*cam.zoom};});
   await page.mouse.click(target.x,target.y);
   const click=await page.evaluate(()=>({actual:window.__groundTarget,expected:window.__fishing.engine.config.interaction.purchase_points.secondPort}));assert.deepEqual(click.actual,click.expected);
  }
 }
 await page.locator('[data-action="settings"]').click();await page.locator('#boat-names').check();assert.equal(await page.evaluate(()=>[...window.__fishing.scene.boatViews.values()].every(v=>v.name.visible)),true);await page.locator('[data-action="settings-close"]').click();
 await page.reload();await page.waitForFunction(()=>window.__fishing?.ui);assert.equal(await page.evaluate(()=>window.__fishing.scene.showBoatNames),true);
 await page.locator('[data-action="settings"]').click();await page.locator('#boat-names').uncheck();await page.locator('[data-action="settings-close"]').click();await page.reload();await page.waitForFunction(()=>window.__fishing?.ui);assert.equal(await page.evaluate(()=>window.__fishing.scene.showBoatNames),false);
 await page.keyboard.press('F2');await page.locator('[data-action="settings"]').click();await page.screenshot({path:root+'/settings-'+profile+'-'+language+'.png'});await page.locator('[data-action="settings-close"]').click();
 await page.evaluate(()=>{const f=window.__fishing,s=f.engine.state,c=f.engine.config;f.engine.paused=true;s.area=1;s.questIndex=10;s.golden.expires=null;for(const [id,n] of Object.entries(s.nodes))n.unlocked=c.resources[id].zone===1;f.scene.guidance.cancel();f.scene.sys.sceneUpdate=()=>{f.scene.drawWorld();f.scene.cameras.main.setZoom(.85);f.scene.cameras.main.centerOn(1000,1400);};});await page.waitForTimeout(150);await page.screenshot({path:root+'/zone1-'+profile+'-'+language+'.png'});
 checks.push({profile,language,geometry:true,stableFrames:120,namesPreference:true,purchaseClick:true,stages:['built','offers','building']});await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(`${root}/browser.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
