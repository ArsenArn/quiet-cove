import {restoreGroundLayout} from './helpers-ground-ui-protection';
import {it,expect} from 'vitest';
import fs from 'node:fs';
import type {Balance} from '../src/config/types';
import {Engine} from '../src/game/engine';
import {makeBoat} from '../src/game/state';
import {fishPorts,fishUnload} from '../src/game/systems/delivery';
import {offers,purchasePoint} from '../src/game/systems/construction';
import {deposit,collectCoins} from '../src/game/systems/economy';
import {acquire} from '../src/game/systems/resources';
import {saveGame,loadGame,saveKey} from '../src/game/systems/save';
import {routeTo,clearSegment,onLand,syncBuildingObstacles,navigateTo,distance} from '../src/game/systems/movement';
import {validateConfig} from '../src/config/load';
import {PlaytestAnalytics} from '../src/analytics/playtest';
const config=(p='fast')=>JSON.parse(fs.readFileSync(`public/balance/balance_${p}.json`,'utf8')) as Balance;
const store=()=>{const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};};
it('Analytics releases terminal metal attribution without losing accepted metal, fish or worker accounting',()=>{
 const c=config(),e=new Engine(c),s=e.state;s.area=2;s.flags.storage=true;s.cargoLevel=4;const a=new PlaytestAnalytics(e,null);a.start();
 for(let i=0;i<200;i++){s.metal=0;Object.assign(s.boats[0],c.world.storage);acquire(c,s,s.boats[0],'wreck');deposit(c,s,s.boats[0],1);}
 const recording=(a as any).recording;expect(Object.keys(recording.checkpoint.crate_resources)).toHaveLength(0);expect(recording.aggregates.metal_earned).toBe(200);expect(recording.aggregates.resources.wreck.units_delivered).toBe(200);
 Object.assign(s.boats[0],c.world.port);acquire(c,s,s.boats[0],'tuna');deposit(c,s,s.boats[0],1);expect(Object.keys(recording.checkpoint.coin_origins)).toHaveLength(1);s.time+=2;Object.assign(s.boats[0],s.coinStacks[0]);collectCoins(c,s,1);expect(recording.aggregates.resources.tuna.coins_earned).toBe(c.resources.tuna.value);expect(Object.keys(recording.checkpoint.coin_origins)).toHaveLength(0);a.destroy();
});
it.each(['fast','reference'])('%s hides port until Q26 is claimed and supports batched metal above storage cap',profile=>{
 const c=config(profile),e=new Engine(c),s=e.state;s.area=2;s.flags.storage=true;s.flags.cutter=true;s.questIndex=25;s.questStatus='completed_unclaimed';
 expect(fishPorts(c,s)).toEqual([c.world.port]);expect(offers(c,s).some(o=>o.id==='secondPort')).toBe(false);expect(e.purchase('secondPort')).toBe(false);
 expect(e.claimQuest(26)).toBe(true);expect(offers(c,s).some(o=>o.id==='secondPort')).toBe(true);
 s.coins=500;s.metal=c.salvage.storage.capacity;Object.assign(s.boats[0],purchasePoint(c,'secondPort'));e.update(6);
 const o=s.orders.secondPort;expect(o.paid).toBe(500);expect(o.metalPaid).toBe(Math.min(c.second_port!.metal_cost!,c.salvage.storage.capacity));expect(o.readyAt).toBeNull();expect(fishPorts(c,s)).toHaveLength(1);
 const st=store();saveGame(st,s,1000);const loaded=loadGame(st,c,1000)!.state,next=new Engine(c,loaded);expect(loaded.orders.secondPort).toEqual(o);
 loaded.coins=o.cost-o.paid;loaded.metal=o.metalCost-o.metalPaid;next.update(6);expect(loaded.orders.secondPort.readyAt).not.toBeNull();expect(fishPorts(c,loaded)).toHaveLength(1);
 if(profile==='reference'){expect(next.skip('secondPort')).toBe(false);expect(next.skip('secondPort',true)).toBe(true);}else expect(next.skip('secondPort')).toBe(true);
 expect(fishPorts(c,loaded)).toHaveLength(2);expect(loaded.flags.secondPort).toBe(true);saveGame(st,loaded,1000);expect(loadGame(st,c,1000)!.state.flags.secondPort).toBe(true);
});
it('timer completes naturally and hidden circle cannot accept player/worker/speedboat cargo',()=>{
 const c=config(),e=new Engine(c),s=e.state;s.area=2;s.rewarded=[26];s.coins=c.second_port!.cost;s.metal=60;
 for(const kind of ['player','worker','speedboat'] as const){const b=kind==='player'?s.boats[0]:makeBoat(kind,kind,c.second_port!.unload);Object.assign(b,c.second_port!.unload);acquire(c,s,b,'sardine');deposit(c,s,b,1);expect(b.cargo).toHaveLength(1);expect(fishUnload(c,s,b)).toEqual(c.world.port);}
 e.purchase('secondPort');e.update(44);expect(s.flags.secondPort).toBeUndefined();e.update(1.1);expect(s.flags.secondPort).toBe(true);
});
it('both docks issue separate physical coins and reload does not duplicate cargo or payouts',()=>{
 const c=config(),e=new Engine(c),s=e.state;s.area=2;s.flags.secondPort=true;syncBuildingObstacles(c,s);s.cargoLevel=4;
 for(const port of fishPorts(c,s)){Object.assign(s.boats[0],port);acquire(c,s,s.boats[0],'tuna');deposit(c,s,s.boats[0],1);expect(s.boats[0].cargo).toHaveLength(0);}
 const ids=s.coinStacks.map(p=>p.id),st=store();saveGame(st,s,1000);const loaded=loadGame(st,c,1000)!.state;expect(loaded.coinStacks.map(p=>p.id)).toEqual(ids);loaded.time+=2;
 for(const pile of [...loaded.coinStacks]){Object.assign(loaded.boats[0],pile);collectCoins(c,loaded,1);}expect(loaded.coinStacks).toHaveLength(0);expect(loaded.stats.fish_sales_earned).toBe(2*c.resources.tuna.value);
});
it.each([1,2])('legacy v07e area %s migrates once preserving wallets, fleet, quests and pending income',area=>{
 const c=config(),e=new Engine(c),s=e.state;s.area=area;s.coins=1234;s.metal=77;s.questIndex=24;delete s.portRules;delete s.playerLastDamageAt;s.boats.push(makeBoat('worker:0','worker',c.world.port));
 const original=structuredClone(s),st=store();saveGame(st,s,1000);const raw=st.getItem(saveKey('fast')),next=loadGame(st,c,1000)!.state;
 expect(next.coins).toBe(original.coins);expect(next.metal).toBe(original.metal);expect(next.boats.map(b=>b.id)).toEqual(original.boats.map(b=>b.id));expect(next.questIndex).toBe(original.questIndex);expect(!!next.flags.secondPort).toBe(area===2);expect(st.getItem(saveKey('fast')+'_backup_before_v07f')).toBe(raw);
 saveGame(st,next,1000);expect(loadGame(st,c,1000)!.state).toEqual(next);
});
it('no invisible hut obstacle until built; topology changes invalidate existing routes and restore on load',()=>{
 const c=config(),e=new Engine(c),s=e.state;s.area=2;syncBuildingObstacles(c,s);const hut={x:c.second_port!.hut.x,y:c.second_port!.hut.y+28};expect(onLand(c,hut)).toBe(false);
 s.flags.secondPort=true;syncBuildingObstacles(c,s);expect(onLand(c,hut)).toBe(true);const st=store();saveGame(st,s,1000);const c2=config();loadGame(st,c2,1000);expect(onLand(c2,hut)).toBe(true);
 s.flags.secondPort=false;syncBuildingObstacles(c,s);expect(onLand(c,hut)).toBe(false);
});
it.each(['player','worker','speedboat','salvage','defender'])('%s routes around both compact building bodies, free purchase and unload approaches',kind=>{
 const c=config(),s=new Engine(c).state;s.area=2;s.flags.secondPort=true;syncBuildingObstacles(c,s);
 const defender={x:c.interaction.purchase_points.defender.x+40,y:c.interaction.purchase_points.defender.y-150},port={x:c.second_port!.hut.x,y:c.second_port!.hut.y+28};for(const center of [defender,port]){
  expect(onLand(c,center)).toBe(true);const b=makeBoat(kind,kind==='defender'?'player':kind as any,{x:center.x-140,y:center.y}),goal={x:center.x+140,y:center.y};
  const route=routeTo(c,b,goal,2);expect(route.length).toBeGreaterThan(1);let prev:{x:number;y:number}={...b};for(const p of route){expect(clearSegment(c,prev,p)).toBe(true);prev={...p};}
  for(let i=0;i<1500&&distance(b,goal)>1;i++){navigateTo(c,b,goal,80,1/30,2,0);expect(onLand(c,b)).toBe(false);}expect(distance(b,goal)).toBeLessThan(1);
 }
 for(const goal of [c.world.port,c.world.storage,c.second_port!.unload,...['defender','secondPort','salvage','storageUpgrade'].map(id=>purchasePoint(c,id))]){expect(onLand(c,goal)).toBe(false);expect(routeTo(c,c.world.spawn,goal,2)).not.toHaveLength(0);}
});
it('player damage restarts five-second regen delay; reload preserves it and death cannot regenerate',()=>{
 const c=config(),e=new Engine(c),s=e.state,p=s.boats[0];s.area=2;s.flags.den=true;s.nextPirateAt=1e9;
 const hit=()=>{s.projectiles.push({x:p.x,y:p.y,id:s.nextId++,target:'player',faction:'pirate',damage:8,expires:s.time+3});e.update(.01);};
 hit();expect(p.hp).toBe(72);e.update(4.9);expect(p.hp).toBe(72);e.update(1);expect(p.hp).toBeGreaterThan(72);hit();const damaged=p.hp;e.update(4);expect(p.hp).toBe(damaged);
 const st=store();saveGame(st,s,1000);const next=new Engine(c,loadGame(st,c,1000)!.state);next.update(.9);expect(next.state.boats[0].hp).toBe(damaged);next.update(1);expect(next.state.boats[0].hp).toBeGreaterThan(damaged);
 p.hp=0;p.respawnAt=s.time+100;e.update(10);expect(p.hp).toBe(0);p.hp=79.99;s.playerLastDamageAt=s.time-6;e.update(2);expect(p.hp).toBe(80);
});
it.each(['fast','reference'])('%s protects all old balance values while validating new parameters',profile=>{
 const c=config(profile),old=JSON.parse(fs.readFileSync(`tests/fixtures/release/local_v07f_before_public_balance_balance_${profile}.json`,'utf8'));expect(()=>validateConfig(c)).not.toThrow();
 const normalized=restoreGroundLayout(c);delete normalized.second_port;delete normalized.player_regen;delete normalized.interaction.purchase_points.secondPort;delete normalized.interaction.reveal_at_quest.secondPort;expect(normalized).toEqual(old);
 for(const invalid of [0,-1,NaN]){const copy=structuredClone(c);copy.second_port!.cost=invalid;expect(()=>validateConfig(copy)).toThrow();}
});
