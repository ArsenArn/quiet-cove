import {legacyLayout} from './helpers-v07d-protection';
import {it,expect} from 'vitest';
import fs from 'node:fs';
import type {Balance} from '../src/config/types';
import {Engine} from '../src/game/engine';
import {allOffers,pay} from '../src/game/systems/construction';
import {makeBoat} from '../src/game/state';
import {validateConfig} from '../src/config/load';
import {saveGame,loadGame} from '../src/game/systems/save';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8')) as Balance;
const fast=()=>read('public/balance/balance_fast.json');
const old=()=>read('tests/fixtures/release/test-results_v07c_before-fast.json');
const requirements=(b:Balance)=>b.quests.map(({reward_coins,...q})=>q);
it('v07c preserves every FAST Zone 1 field and all 34 conditions',()=>{
 const a=fast(),b=old();expect(a.quests.slice(0,15)).toEqual(b.quests.slice(0,15));expect(requirements(a)).toEqual(requirements(b));
 for(const [id,r] of Object.entries(b.resources))if(r.zone===1)expect(a.resources[id]).toEqual(r);
 for(const k of ['workers','capacity_upgrades','units','world','ai','combat','monetization','interaction','navigation','save','presentation','docks','resource_burst','simulation','schema_version'] as const)expect(legacyLayout(a)[k]).toEqual(b[k]);
 expect(a.special).toEqual(b.special);expect(a.expansion.gate).toEqual(b.expansion.gate);
});
it('v07c REFERENCE file is byte-identical and ignores FAST overrides even if supplied',()=>{
 expect(legacyLayout(JSON.parse(fs.readFileSync('public/balance/balance_reference.json','utf8')))).toEqual(JSON.parse(fs.readFileSync('tests/fixtures/release/test-results_v07c_before-reference.json','utf8')));
 const ref=read('public/balance/balance_reference.json'),e=new Engine(ref);e.state.area=2;e.state.questIndex=19;
 const prior=allOffers(ref,e.state);ref.fast_zone2=fast().fast_zone2;expect(allOffers(ref,e.state)).toEqual(prior);
});
it('v07c late offers use normal prices before claim 15 and scoped prices thereafter',()=>{
 const b=fast(),e=new Engine(b),s=e.state;
 s.cargoLevel=3;for(let n=0;n<3;n++)s.boats.push(makeBoat('worker:'+n,'worker',b.world.port));
 s.questIndex=14;s.area=1;expect(allOffers(b,s).find(o=>o.id==='worker:3')?.cost).toBe(307);expect(allOffers(b,s).find(o=>o.id==='cargo:4')?.cost).toBe(650);
 s.area=2;expect(allOffers(b,s).find(o=>o.id==='worker:3')?.cost).toBe(307);
 s.questIndex=15;expect(allOffers(b,s).find(o=>o.id==='worker:3')?.cost).toBe(700);expect(allOffers(b,s).find(o=>o.id==='cargo:4')?.cost).toBe(1400);
 for(let count=3;count<10;count++){s.boats=s.boats.filter(x=>x.kind!=='worker');for(let n=0;n<count;n++)s.boats.push(makeBoat('worker:'+n,'worker',b.world.port));expect(allOffers(b,s).find(o=>o.id==='worker:'+count)?.cost).toBe(b.fast_zone2!.worker_costs[count]);}
});
it('v07c old late-tier partial payment, deadline and pending currency survive load unchanged',()=>{
 const b=old(),e=new Engine(b),s=e.state;s.area=2;s.questIndex=19;s.cargoLevel=3;s.coins=222;pay(b,s,'cargo:4');const order=structuredClone(s.orders['cargo:4']);
 const map=new Map<string,string>(),store={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
 saveGame(store,s,1000);const n=fast(),loaded=loadGame(store,n,1000)!.state;expect(loaded.orders['cargo:4']).toEqual(order);loaded.coins=650-order.paid;pay(n,loaded,'cargo:4');expect(loaded.coins).toBe(0);expect(loaded.orders['cargo:4'].cost).toBe(650);expect(loaded.orders['cargo:4'].duration).toBe(12);
 saveGame(store,loaded,1000);expect(loadGame(store,n,1000)!.state.orders['cargo:4']).toEqual(loaded.orders['cargo:4']);
});
it('v07c overrides reject malformed keys, zero and early tiers; prerequisites stay possible',()=>{
 const b=fast();validateConfig(b);
 for(const [key,value] of [['2',400],['3',0],['3.5',700],['10',999]]){const c=fast();c.fast_zone2!.worker_costs[key as unknown as number]=value as number;expect(()=>validateConfig(c)).toThrow();}
 const c=fast();c.fast_zone2!.cargo_costs[3]=100;expect(()=>validateConfig(c)).toThrow();
 expect(b.salvage.storage.capacity).toBe(100);expect(b.salvage.upgrade.capacity).toBe(150);
 expect(b.salvage.upgrade.metal_cost).toBeLessThanOrEqual(b.salvage.storage.capacity);expect(b.expansion.den.metal_cost).toBeLessThanOrEqual(b.salvage.upgrade.capacity);expect(b.expansion.route.metal_cost).toBeLessThanOrEqual(b.salvage.upgrade.capacity);
 expect(b.salvage.storage.metal_cost??0).toBe(0);expect(b.salvage.cutter.metal_cost??0).toBe(0);expect(b.resources.wreck.metal_cost??0).toBe(0);
});

