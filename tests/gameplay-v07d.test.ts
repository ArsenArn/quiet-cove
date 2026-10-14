import {restoreGroundLayout} from './helpers-ground-ui-protection';
import {legacyLayout} from './helpers-v07d-protection';
import {it,expect} from 'vitest';
import fs from 'node:fs';
import type {Balance} from '../src/config/types';
import {Engine} from '../src/game/engine';
import {makeBoat,type Enemy} from '../src/game/state';
import {deposit,capacity,storageCapacity,goldenReward} from '../src/game/systems/economy';
import {fishUnload} from '../src/game/systems/delivery';
import {acquire,available,harvest,updateResources,gatherDuration} from '../src/game/systems/resources';
import {activateQuest,updateQuests,questProgress} from '../src/game/systems/quests';
import {updateWorker,selectTarget} from '../src/game/systems/workers';
import {updateCombat,spawnerProgress} from '../src/game/systems/combat';
import {saveGame,loadGame} from '../src/game/systems/save';
import {allOffers,pay,purchasePoint} from '../src/game/systems/construction';
import {distance,routeTo,onLand,clearSegment} from '../src/game/systems/movement';
import {questFocusTarget} from '../src/game/systems/guidance';
import {resourceFrame} from '../src/game/art/registry';
import {validateConfig} from '../src/config/load';
import {PlaytestAnalytics} from '../src/analytics/playtest';
const config=(profile='fast')=>JSON.parse(fs.readFileSync('public/balance/balance_'+profile+'.json','utf8')) as Balance;
const before=()=>JSON.parse(fs.readFileSync('tests/fixtures/release/test-results_v07d_before_public_balance_balance_fast.json','utf8')) as Balance;
const store=()=>{const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};};
function fixture(metal=100){
 const c=config(),e=new Engine(c),s=e.state;s.area=2;s.flags.storage=true;s.flags.cutter=true;s.nodes.wreck.unlocked=true;s.cargoLevel=4;s.metal=metal;
 Object.assign(s.boats[0],c.world.storage);return {c,e,s,b:s.boats[0]};
}
function cargo(c:Balance,e:Engine,b=e.state.boats[0],count=capacity(c,e.state,b)){for(let i=0;i<count;i++)expect(acquire(c,e.state,b,'wreck')).toBe(true);}
it.each([100,99])('v07d accepts only available metal at %s/100 and unloads every unit exactly once',metal=>{
 const {c,e,s,b}=fixture(metal);cargo(c,e);const count=b.cargo.length,coins=s.coins;
 deposit(c,s,b,2);expect(s.metal).toBe(100);expect(b.cargo).toHaveLength(0);expect(s.stats.metal_deposited).toBe(count);expect(s.stats.metal_discarded).toBe(count-(100-metal));expect(s.coins).toBe(coins);expect(s.coinStacks).toHaveLength(0);
 const events=s.events.filter(x=>x.type==='delivery');expect(new Set(events.map(x=>x.data.crate)).size).toBe(count);expect(events.reduce((n,x)=>n+Number(x.data.accepted_metal),0)).toBe(100-metal);
 deposit(c,s,b,2);expect(s.stats.metal_deposited).toBe(count);expect(s.metal).toBe(100);
});
it('v07d empty and absent storage do not produce deliveries or metal',()=>{
 const {c,e,s,b}=fixture();deposit(c,s,b,2);expect(s.stats.metal_deposited).toBeUndefined();
 s.flags.storage=false;cargo(c,e);deposit(c,s,b,2);expect(b.cargo).toHaveLength(6);expect(s.metal).toBe(100);
});
it('v07d salvage unloads at full storage and starts gathering again',()=>{
 const {c,e,s}=fixture(),worker=makeBoat('salvage:0','salvage',c.world.storage);s.boats.push(worker);cargo(c,e,worker);worker.state='RETURN';
 updateWorker(c,s,worker,2);expect(worker.cargo).toHaveLength(0);expect(worker.state).toBe('SELECT');updateWorker(c,s,worker,.2);expect(worker.target).toBe('wreck');expect(worker.state).not.toBe('WAIT');expect(s.metal).toBe(100);
 e.update(60);expect(s.stats.metal_deposited).toBeGreaterThan(5);expect(s.metal).toBe(100);
});
it.each([24,26])('v07d quest %s counts only fresh genuine deliveries at a full storage',id=>{
 const {c,e,s,b}=fixture();s.questIndex=id-1;s.stats.metal_deposited=123;activateQuest(c,s);
 expect(questProgress(c.quests[id-1],s)).toBe(0);
 const target=Number(c.quests[id-1].target);
 for(let n=0;n<target;n++){cargo(c,e,b,1);deposit(c,s,b,1);updateQuests(c,s);if(n<target-1)expect(s.questStatus).toBe('active');}
 expect(s.questStatus).toBe('completed_unclaimed');expect(s.stats.metal_deposited).toBe(123+target);expect(s.stats.metal_discarded).toBe(target);expect(s.metal).toBe(100);expect(s.stats.debug_income??0).toBe(0);
 const snapshot=s.stats.metal_deposited;deposit(c,s,b,1);expect(s.stats.metal_deposited).toBe(snapshot);
});
it('v07d full metal/cargo reload keeps unique units and resumes unloading',()=>{
 const {c,e,s,b}=fixture();cargo(c,e);s.pirateSpawnBlocked=true;const st=store();saveGame(st,s,1000);const loaded=loadGame(st,c,1000)!.state;
 expect(loaded.boats[0].cargo).toEqual(b.cargo);expect(loaded.pirateSpawnBlocked).toBe(true);const n=new Engine(c,loaded);n.update(1);
 expect(loaded.boats[0].cargo).toHaveLength(0);expect(loaded.metal).toBe(100);expect(loaded.stats.metal_deposited).toBe(6);
 saveGame(st,loaded,1000);const again=loadGame(st,c,1000)!.state;deposit(c,again,again.boats[0],1);expect(again.stats.metal_deposited).toBe(6);
});
it('v07d metal spending frees capacity and unchanged upgrade raises it to 150',()=>{
 const {c,e,s,b}=fixture();s.questIndex=29;s.coins=c.salvage.upgrade.cost;expect(pay(c,s,'storageUpgrade')).toBe(true);
 expect(s.metal).toBe(70);expect(storageCapacity(c,s)).toBe(100);cargo(c,e,b,3);deposit(c,s,b,1);expect(s.metal).toBe(73);expect(s.stats.metal_discarded??0).toBe(0);
 expect(e.skip('storageUpgrade')).toBe(true);expect(storageCapacity(c,s)).toBe(150);
 for(let i=0;i<80;i++){cargo(c,e,b,1);deposit(c,s,b,1);}expect(s.metal).toBe(150);expect(s.stats.metal_discarded).toBe(3);
 expect(c.salvage.upgrade).toEqual(before().salvage.upgrade);
});
it('v07d mixed cargo sends overflow metal to storage and fish to the relocated fish dock',()=>{
 const {c,e,s,b}=fixture();acquire(c,s,b,'sardine');acquire(c,s,b,'wreck');deposit(c,s,b,1);expect(b.cargo).toHaveLength(1);expect(b.cargo[0].kind).toBe('fish');
 Object.assign(b,fishUnload(c,s));deposit(c,s,b,1);expect(b.cargo).toHaveLength(0);expect(s.metal).toBe(100);expect(s.coinStacks.reduce((n,p)=>n+p.value,0)).toBe(c.resources.sardine.value);
 expect(s.coinStacks.every(p=>distance(p,fishUnload(c,s))<100)).toBe(true);
});
it('v07d overflow analytics counts all delivered units but only stored metal income',()=>{
 const {c,e,s,b}=fixture(99),st=store();let now=1000;const analytics=new PlaytestAnalytics(e,st,()=>now,()=> 'en');analytics.start();
 cargo(c,e);now+=1000;deposit(c,s,b,2);analytics.sample();const raw=analytics.exportJSON()!;
 const data=JSON.parse(raw);expect(data.aggregates.resources.wreck.units_delivered).toBe(6);expect(data.aggregates.metal_earned).toBe(1);expect(data.summary.metal_reconciliation.residual).toBe(0);
 expect(data.aggregates.income.debug_grant).toBe(0);expect(data.final_snapshot.economy.metal).toBe(100);
});
const pirate=(id:string,c:Balance,hp=100):Enemy=>({id,x:c.combat.spawner.x+110,y:c.combat.spawner.y,home:{x:c.combat.spawner.x+110,y:c.combat.spawner.y},hp,angle:0,attackAt:0,state:'PATROL',target:null});
it('v07d cap freezes at zero; a real projectile kill starts a complete fresh countdown',()=>{
 const c=config(),e=new Engine(c),s=e.state;s.area=2;s.enemies=[pirate('a',c),pirate('b',c)];s.time=100;s.nextPirateAt=1;updateCombat(c,s,.2);
 expect(s.enemies).toHaveLength(2);expect(spawnerProgress(c,s)).toMatchObject({status:'waiting_slot',fraction:0});
 s.time=500;updateCombat(c,s,.2);expect(s.enemies).toHaveLength(2);expect(spawnerProgress(c,s).fraction).toBe(0);
 s.projectiles.push({id:s.nextId++,x:s.enemies[0].x,y:s.enemies[0].y,target:'a',faction:'friendly',damage:100,expires:1000});updateCombat(c,s,.2);
 expect(s.enemies).toHaveLength(1);expect(s.stats.pirates_killed).toBe(1);expect(s.nextPirateAt).toBe(518);expect(spawnerProgress(c,s).fraction).toBe(0);
 s.time=517.99;updateCombat(c,s,.2);expect(s.enemies).toHaveLength(1);s.time=518;updateCombat(c,s,.2);expect(s.enemies).toHaveLength(2);expect(spawnerProgress(c,s).fraction).toBe(0);
});
it('v07d dead entities do not consume slots, huge ticks spawn at most one, old third pirate retires without rewards',()=>{
 const c=config(),s=new Engine(c).state;s.area=2;s.enemies=[pirate('dead',c,0)];s.nextPirateAt=0;s.time=9999;updateCombat(c,s,1000);expect(s.enemies).toHaveLength(1);expect(s.enemies[0].hp).toBeGreaterThan(0);
 s.enemies=[pirate('a',c),pirate('b',c),pirate('legacy-third',c)];updateCombat(c,s,.2);expect(s.enemies).toHaveLength(2);expect(s.stats.pirates_killed??0).toBe(0);
 const st=store();saveGame(st,s,1000);const loaded=loadGame(st,c,1000)!.state;loaded.enemies.pop();loaded.time+=100;updateCombat(c,loaded,.2);
 expect(loaded.enemies).toHaveLength(1);expect(loaded.nextPirateAt).toBe(loaded.time+18);expect(spawnerProgress(c,loaded).fraction).toBe(0);
 loaded.flags.den=true;loaded.time+=1000;updateCombat(c,loaded,.2);expect(loaded.enemies).toHaveLength(1);expect(spawnerProgress(c,loaded).status).toBe('closed');
});
it('v07d wreck progressively depletes, disappears, restores full stock without repurchase and workers resume',()=>{
 const {c,e,s,b}=fixture(0);Object.assign(b,{x:c.resources.wreck.x,y:c.resources.wreck.y});const node=s.nodes.wreck,frames=new Set<number>();
 for(let i=0;i<60;i++){
  if(b.cargo.length===capacity(c,s,b)){Object.assign(b,c.world.storage);deposit(c,s,b,2);Object.assign(b,{x:c.resources.wreck.x,y:c.resources.wreck.y});}
  if(node.phase==='regrow'){s.time=node.readyAt;updateResources(c,s);}
  frames.add(resourceFrame(c.resources.wreck,node)!);harvest(c,s,b,'wreck',gatherDuration(c,b,'wreck'));
 }
 expect(frames).toEqual(new Set([0,1,2,3]));expect(node).toMatchObject({unlocked:true,stock:0,hp:0,phase:'restock'});expect(available(c,s,'wreck')).toBe(false);expect(resourceFrame(c.resources.wreck,node)).toBeNull();
 s.time=node.readyAt-.01;updateResources(c,s);expect(available(c,s,'wreck')).toBe(false);s.time=node.readyAt;updateResources(c,s);
 expect(node).toMatchObject({unlocked:true,stock:12,hp:50,phase:'ready'});expect(resourceFrame(c.resources.wreck,node)).toBe(0);
 const worker=makeBoat('salvage:0','salvage',c.world.storage);s.crates=[];expect(selectTarget(c,s,worker,()=>0)).toBe('wreck');expect(restoreGroundLayout(c).resources.wreck).toEqual(before().resources.wreck);
});
it('v07d layout separates docks/purchase circles and has navigable entry and exit routes',()=>{
 const c=config(),s=new Engine(c).state;s.area=2;validateConfig(c);const points=Object.values(c.interaction.purchase_points);
 for(const id of ['salvage','storageUpgrade']){const p=purchasePoint(c,id);expect(onLand(c,p)).toBe(false);for(const other of points)if(other!==p)expect(distance(p,other)).toBeGreaterThan(108);expect(distance(p,c.world.storage)).toBeGreaterThan(98);}
 for(const goal of [fishUnload(c,s),purchasePoint(c,'salvage'),purchasePoint(c,'storageUpgrade'),c.zone2_layout!.entrance_dock]){
  expect(onLand(c,goal)).toBe(false);for(const [a,z] of [[c.world.spawn,goal],[goal,c.world.storage]]){const route=routeTo(c,a,z,2);expect(route.length).toBeGreaterThan(0);let prev=a;for(const step of route){expect(clearSegment(c,prev,step)).toBe(true);prev=step;}expect(distance(prev,z)).toBeLessThan(.01);}
 }
 s.questIndex=7;expect(questFocusTarget(c,s)).toEqual(c.world.port);s.area=1;expect(fishUnload(c,s)).toEqual(c.world.port);
});
it('v07e original docking cache remains functional after Zone 2 opens',()=>{
 const c=config(),e=new Engine(c),s=e.state;const worker=makeBoat('worker:0','worker',c.world.port);s.boats.push(worker);
 for(let i=0;i<3;i++)acquire(c,s,worker,'tuna');worker.state='RETURN';e.update(1);expect(worker.cargo).toHaveLength(0);
 s.area=2;s.nodes.tuna.unlocked=true;for(let i=0;i<3;i++)acquire(c,s,worker,'tuna');worker.state='RETURN';const seq=s.eventSeq;
 e.update(60);expect(s.events.some(x=>x.seq>seq&&x.type==='delivery'&&x.data.boat===worker.id&&distance({x:Number(x.data.x),y:Number(x.data.y)},fishUnload(c,s))<=c.world.deposit_radius)).toBe(true);
});
it.each(['salvage:0','storageUpgrade'])('v07d moved %s keeps partial payment, load, free SKIP and category exit guard',id=>{
 const {c,e,s,b}=fixture();s.questIndex=29;s.coins=50;s.metal=14;Object.assign(b,purchasePoint(c,id));
 const offer=allOffers(c,s).find(x=>x.id===id)!;expect(offer).toBeDefined();
 // Engine executes stationary payment at the moved circle.
 e.update(3);const order=s.orders[id];expect(order.paid).toBe(50);expect(order.cost).toBe(offer.cost);expect(order.metalPaid).toBe(id==='storageUpgrade'?14:0);
 const st=store();saveGame(st,s,1000);const next=new Engine(c,loadGame(st,c,1000)!.state);expect(next.state.orders[id]).toEqual(order);
 next.state.coins=order.cost-order.paid;next.state.metal=order.metalCost-order.metalPaid;expect(next.purchase(id)).toBe(true);expect(next.skip(id)).toBe(true);
 const category=id.split(':')[0];expect(next.state.purchaseGuards![category].needsExit).toBe(true);expect(next.state.purchaseGuards![category].cooldownUntil).toBeGreaterThan(next.state.time);
 next.state.coins=100000;next.update(1);if(id==='salvage:0')expect(next.state.orders['salvage:1']).toBeUndefined();
});
it('v07d all economy parameters and REFERENCE bytes are unchanged',()=>{
 const a=restoreGroundLayout(config()),b=before();expect(a.quests).toEqual(b.quests);expect(a.resources).toEqual(b.resources);
 for(const k of ['units','workers','capacity_upgrades','fast_zone2','special','expansion','salvage','monetization','world','ai','save','simulation','navigation','docks'] as const)expect(a[k]).toEqual(b[k]);
 const {max_enemies:_,...combat}=a.combat,{max_enemies:__,...oldCombat}=b.combat;expect(combat).toEqual(oldCombat);expect(a.combat.max_enemies).toBe(2);
 expect(legacyLayout(JSON.parse(fs.readFileSync('public/balance/balance_reference.json','utf8')))).toEqual(JSON.parse(fs.readFileSync('tests/fixtures/release/test-results_v07d_before_public_balance_balance_reference.json','utf8')));
 const ref=config('reference'),s=new Engine(ref).state;s.area=2;expect(fishUnload(ref,s)).toEqual(ref.world.port);
 const state=new Engine(a).state;state.area=2;for(const id of ['tuna','lobster','swordfish','squid'])state.nodes[id].unlocked=true;expect(goldenReward(a,state)).toBe(goldenReward(b,state));
});


