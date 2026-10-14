import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root='test-results/final-ui-polish';fs.mkdirSync(root,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'}),checks=[],errors=[];
try{for(const profile of ['fast','reference']){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('quiet_cove_music_enabled','false'));
 await page.goto(`http://127.0.0.1:5173/?debug=1&balance=${profile}`);await page.waitForFunction(()=>window.__fishing?.ui);await page.keyboard.press('F2');
 const result=await page.evaluate(async()=>{
  const f=window.__fishing,e=f.engine,s=e.state,c=e.config,scene=f.scene;
  const {harvest,updateResources}=await import('/src/game/systems/resources.ts');
  const {updateCombat}=await import('/src/game/systems/combat.ts');
  const {makeBoat}=await import('/src/game/state.ts');
  const {onLand,routeTo,syncBuildingObstacles}=await import('/src/game/systems/movement.ts');
  const {saveGame,loadGame}=await import('/src/game/systems/save.ts');
  const require=(v,msg)=>{if(!v)throw Error(msg);};e.paused=true;scene.cancelControl();s.golden.nextAt=1e9;
  const original=scene.drawHealthBar;scene.drawHealthBar=function(g,x,y,w,h){(window.bars??=[]).push({x,y,w,h});return original.call(this,g,x,y,w,h);};
  const draw=()=>{window.bars=[];scene.drawWorld();};
  const p=s.boats[0];let samples=[];
  for(const area of [1,2]){s.area=area;Object.assign(s.flags,{storage:true,cutter:true,den:true});syncBuildingObstacles(c,s);
   for(const id of area===1?['sardine']:['wreck']){const r=c.resources[id],n=s.nodes[id];Object.assign(n,{unlocked:true,hp:r.portion_hp,stock:2,phase:'ready'});Object.assign(p,{x:r.x,y:r.y,cargo:[],gather:0});draw();
    const bar=()=>window.bars.find(b=>b.w===70&&b.x===r.x);require(bar()?.h===1,id+' full');
    harvest(c,s,p,id,r.gather_s);draw();require(bar().h===n.hp/r.portion_hp&&n.hp<r.portion_hp,id+' harvest HP');samples.push({id,hp:n.hp,fraction:bar().h});
    while(n.phase==='ready'){p.cargo=[];harvest(c,s,p,id,r.gather_s);}draw();require(bar().h===0&&s.crates.length>0,id+' depletion');
    for(const phase of ['regrow','restock']){n.phase=phase;n.hp=0;n.stock=phase==='restock'?0:1;n.readyAt=s.time+1;s.time+=1;updateResources(c,s);draw();require(n.hp===r.portion_hp&&bar().h===1,id+' '+phase);}
   }
  }
  Object.assign(p,{x:2600,y:1900,hp:c.units.player.hp,cargo:[]});s.crates=[];s.enemies=[];s.defender=makeBoat('defender','player',c.combat.defender_spawn,c.combat.defender_hp);draw();require(!scene.boatViews.get('player').hp.visible&&!scene.boatViews.get('defender').hp.visible,'full boats hidden');
  const hit=(target,faction,damage)=>{s.projectiles=[{id:s.nextId++,x:target.x,y:target.y,target:target.id,faction,damage,expires:s.time+10}];updateCombat(c,s,.01);draw();};
  hit(p,'pirate',10);require(scene.boatViews.get('player').hp.visible&&p.hp<c.units.player.hp,'player damaged');
  s.time+=100;updateCombat(c,s,100);draw();require(p.hp===c.units.player.hp&&!scene.boatViews.get('player').hp.visible,'player regen');
  hit(s.defender,'pirate',10);require(scene.boatViews.get('defender').hp.visible,'defender damaged');
  hit(s.defender,'pirate',c.combat.defender_hp);s.time=s.defender.respawnAt;updateCombat(c,s,.01);draw();require(!scene.boatViews.get('defender').hp.visible,'defender repair');
  const pirate={id:'pirate:test',x:3100,y:1900,home:{x:3100,y:1900},hp:c.combat.pirate_hp,attackAt:1e9,angle:0,state:'PATROL',target:null};s.enemies=[pirate];draw();require(!scene.boatViews.get(pirate.id).hp.visible,'full pirate hidden');hit(pirate,'friendly',10);require(scene.boatViews.get(pirate.id).hp.visible,'pirate damaged');pirate.hp=c.combat.pirate_hp;draw();require(!scene.boatViews.get(pirate.id).hp.visible,'pirate full display');s.enemies=[];
  for(const kind of ['worker','speedboat','salvage']){const boat=makeBoat(kind,kind,{x:2700,y:1850});s.boats.push(boat);draw();require(!scene.boatViews.get(kind).hp.visible,kind+' noncombat');}
  const point=c.interaction.purchase_points.salvage;require(!onLand(c,point),'purchase water');require(routeTo(c,{x:2050,y:1750},point,2).length>0,'purchase route');
  for(let i=0;i<32;i++){const a=i*Math.PI/16;require(!onLand(c,{x:point.x+Math.cos(a)*c.interaction.purchase_radius,y:point.y+Math.sin(a)*c.interaction.purchase_radius}),'circle water');}
  s.boats=s.boats.slice(0,1);s.defender=null;s.questIndex=24;s.rewarded=Array.from({length:24},(_,i)=>i+1);s.nodes.wreck.unlocked=true;s.coins=100000;s.orders={};s.purchaseGuards={};Object.assign(p,{x:2050,y:1750});scene.drawWorld();scene.cameras.main.setZoom(1);scene.cameras.main.centerOn(2320,1530);f.ui.render();
  const objects=scene.children.length;for(let i=0;i<120;i++)draw();require(scene.children.length===objects,'stable graphics objects');
  const label=scene.storageLabel,circle=scene.purchaseCircles.get('salvage:0');require(circle.x+circle.displayWidth/2<label.x-label.width/2,'storage label clearance');
  const memory=new Map(),storage={setItem:(k,v)=>memory.set(k,v),getItem:k=>memory.get(k)??null,removeItem:k=>memory.delete(k)};saveGame(storage,s);require(loadGame(storage,c)?.state.profile===c.profile,'save roundtrip');
  return {samples,point};
 });
 await page.waitForTimeout(150);await page.screenshot({path:`${root}/${profile}-purchase.png`});
 const click=await page.evaluate(()=>{const f=window.__fishing,p=f.engine.config.interaction.purchase_points.salvage,c=f.scene.cameras.main;return{x:(p.x-c.scrollX)*c.zoom,y:(p.y-c.scrollY)*c.zoom};});
 await page.mouse.click(click.x,click.y);assert.ok(await page.evaluate(()=>!!window.__fishing.scene.waypoint));
 await page.evaluate(()=>{window.__fishing.engine.paused=false;window.__fishing.engine.speed=3;});
 await page.waitForFunction(()=>window.__fishing.engine.state.orders['salvage:0']?.paid>0,{},{timeout:15000});
 await page.evaluate(()=>{const f=window.__fishing;f.engine.paused=true;f.scene.cancelControl();});
 const directions=await page.evaluate(async()=>{const f=window.__fishing,s=f.engine.state,{makeBoat}=await import('/src/game/state.ts');s.boats=s.boats.slice(0,1);Object.assign(s.boats[0],{x:1000,y:1800});s.area=1;const labels=['N','NE','E','SE','S','SW','W','NW'];
  for(let i=0;i<8;i++){const b=makeBoat('dir:'+i,'speedboat',{x:700+(i%4)*170,y:1700+Math.floor(i/4)*200});b.angle=-Math.PI/2+i*Math.PI/4;s.boats.push(b);f.scene.add.text(b.x,b.y+65,labels[i],{fontSize:'24px',color:'#ffffff'}).setOrigin(.5).setDepth(8);}
  f.scene.cameras.main.setZoom(1.3);f.scene.cameras.main.centerOn(955,1795);f.scene.drawWorld();return s.boats.slice(1).map(b=>{const v=f.scene.boatViews.get(b.id);return {frame:Number(v.hull.frame.name),flip:v.hull.flipX};});});
 assert.deepEqual(directions,Array.from({length:8},(_,i)=>({frame:i===7?1:i,flip:i===7})));
 await page.waitForTimeout(150);await page.screenshot({path:`${root}/${profile}-directions.png`});
 await page.evaluate(()=>{const f=window.__fishing,s=f.engine.state;s.boats=s.boats.slice(0,1);for(const [id,n]of Object.entries(s.nodes))n.unlocked=f.engine.config.resources[id].zone===1;f.scene.cameras.main.setZoom(.85);Object.assign(s.boats[0],{x:950,y:1600});f.scene.cameras.main.centerOn(1000,1400);f.scene.drawWorld();});await page.waitForTimeout(150);await page.screenshot({path:`${root}/${profile}-zone1.png`});
 checks.push({profile,...result,directions,purchaseClickAndPayment:true,resourceCycles:true,combatAndRecovery:true,saveRoundtrip:true,stableObjects120Frames:true});await context.close();
 }assert.deepEqual(errors,[]);fs.writeFileSync(`${root}/browser.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
