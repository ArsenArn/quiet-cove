function acceptGolden(e:Engine){const t=e.openGoldenOffer();return !!t && e.beginGoldenReward(t.id) && e.claimGolden(true,t.id);}
function exposed(c:Balance){c.interaction.reveal_at_quest=Object.fromEntries(Object.keys(c.interaction.reveal_at_quest).map(k=>[k,1]));return c;}
import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import type {Balance} from '../src/config/types';
import {Engine} from '../src/game/engine';
import {makeBoat,newState} from '../src/game/state';
import {updateCombat,spawnerProgress} from '../src/game/systems/combat';
import {distance,onLand} from '../src/game/systems/movement';
import {acquire} from '../src/game/systems/resources';
import {deposit,collectCoins} from '../src/game/systems/economy';
import {saveGame,loadGame,type StorageLike} from '../src/game/systems/save';
const config=()=>exposed(JSON.parse(fs.readFileSync('public/balance/balance_fast.json','utf8')) as Balance);
describe('v0.2 supporting systems',()=>{
 it('defender patrol moves through saved waypoints, interrupts for combat then resumes in territory two',()=>{
  const c=config(),s=newState(c);s.area=2;s.flags.den=true;s.defender=makeBoat('defender','player',c.combat.defender_spawn,c.combat.defender_hp);const def=s.defender;
  for(let i=0;i<100;i++){s.time+=.05;updateCombat(c,s,.05);expect(def.x).toBeGreaterThan(c.world.gate_x);expect(onLand(c,def)).toBe(false);}
  expect(distance(def,c.combat.defender_spawn)).toBeGreaterThan(100);expect(def.patrolIndex).toBeGreaterThanOrEqual(1);
  const enemy={id:'pirate',x:def.x+50,y:def.y,home:{x:def.x+50,y:def.y},hp:1,attackAt:0,angle:0,state:'PATROL' as const,target:null};s.enemies.push(enemy);s.time+=.05;updateCombat(c,s,.05);expect(def.target).toBe('pirate');
  for(let i=0;i<30;i++){s.time+=.05;updateCombat(c,s,.05);}expect(s.stats.pirates_killed).toBe(1);expect(def.target).toBeNull();
  const index=def.patrolIndex,pos={x:def.x,y:def.y};for(let i=0;i<30;i++){s.time+=.05;updateCombat(c,s,.05);}expect(distance(def,pos)).toBeGreaterThan(10);expect(def.patrolIndex).toBeGreaterThanOrEqual(index!);
 });
 it('spawner reports true countdown, waits for slot, closes permanently',()=>{
  const c=config(),s=newState(c);s.area=2;s.time=c.combat.spawn_s/2;expect(spawnerProgress(c,s)).toEqual({status:'countdown',fraction:.5,remaining:c.combat.spawn_s/2});
  for(let i=0;i<c.combat.max_enemies;i++){s.time=s.nextPirateAt;updateCombat(c,s,0);}expect(spawnerProgress(c,s).status).toBe('waiting_slot');expect(spawnerProgress(c,s).remaining).toBeNull();
  s.time+=100;s.enemies.pop();updateCombat(c,s,0);expect(s.enemies.length).toBe(c.combat.max_enemies-1);expect(spawnerProgress(c,s).fraction).toBe(0);s.time+=c.combat.spawn_s;updateCombat(c,s,0);expect(s.enemies.length).toBe(c.combat.max_enemies);s.flags.den=true;expect(spawnerProgress(c,s).status).toBe('closed');s.enemies=[];updateCombat(c,s,0);expect(s.enemies).toEqual([]);
 });
 it('merchant spawns near player on water, moves, reloads, awards once, expires without sales revenue',()=>{
  const c=config(),e=new Engine(c);e.state.golden.nextAt=0;e.update(.1);const start={x:e.state.golden.x,y:e.state.golden.y};expect(onLand(c,start)).toBe(false);expect(distance(start,e.state.boats[0])).toBeLessThan(240);e.update(2);expect(distance(start,e.state.golden)).toBeGreaterThan(10);
  let raw='';const store:StorageLike={getItem:()=>raw,setItem:(_k,v)=>{raw=v;},removeItem:()=>{raw='';}};saveGame(store,e.state,1000);const restored=new Engine(c,loadGame(store,c,1000)!.state);expect(restored.state.golden.origin).toEqual(e.state.golden.origin);const sale=restored.state.stats.fish_sales_earned??0;expect(acceptGolden(restored)).toBe(true);const cash=restored.state.coins;expect(acceptGolden(restored)).toBe(false);expect(restored.state.coins).toBe(cash);expect(restored.state.stats.fish_sales_earned??0).toBe(sale);
  const expired=new Engine(c);expired.state.golden.nextAt=0;expired.update(c.monetization.golden_lifetime_s+1);expect(expired.state.golden.expires).toBeNull();expect(acceptGolden(expired)).toBe(false);expect(expired.state.coins).toBe(0);expect(expired.state.events.some(e=>e.type==='golden_missed')).toBe(true);
 });
 it('continuous fleet deliveries cannot postpone all cash forever and total cash remains conserved',()=>{
  const c=config(),s=newState(c),w=makeBoat('worker','worker',c.world.port);Object.assign(s.boats[0],{x:c.world.port.x+c.world.deposit_radius+24,y:c.world.port.y});
  for(let i=0;i<300;i++){s.time+=.03;acquire(c,s,w,'sardine');deposit(c,s,w,1);collectCoins(c,s,.03);}
  expect(s.stats.fish_sales_earned).toBeGreaterThan(100);expect(s.coins+s.coinStacks.reduce((sum,p)=>sum+p.value,0)).toBe(300*c.resources.sardine.value);expect(s.coinStacks.length).toBeLessThanOrEqual(s.stats.deliver_fish??0);
 });
});
