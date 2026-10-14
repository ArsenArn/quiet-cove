import {legacyLayout} from './helpers-v07d-protection';
import {it,expect} from 'vitest';
import fs from 'node:fs';
import type {Balance} from '../src/config/types';
import {Engine} from '../src/game/engine';
import {workerCost,goldenReward,spawnCoins,collectCoins} from '../src/game/systems/economy';
import {loadGame,saveGame,saveKey} from '../src/game/systems/save';
import {pay,offers,updateConstruction} from '../src/game/systems/construction';
import {makeBoat} from '../src/game/state';
import {validateConfig} from '../src/config/load';
import {activateQuest,updateQuests} from '../src/game/systems/quests';
import {simulate} from '../scripts/balance-model-v04a';
const c=(p='fast')=>JSON.parse(fs.readFileSync(`public/balance/balance_${p}.json`,'utf8')) as Balance;
const baseline=JSON.parse(fs.readFileSync('tests/fixtures/balance-v032-baseline.json','utf8'));
const storage=()=>{const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};};
it('1.0.2 reference hire prices use float32 and stepped rounding, including band boundaries',()=>{
 const b=c('reference');expect(Array.from({length:10},(_,i)=>workerCost(b,i))).toEqual([100,175,300,550,950,1650,2900,5000,8800,15000]);
 b.workers.cost_growth=1;for(const [raw,expected] of [[112.5,125],[499,500],[500,500],[1999,2000],[2000,2000],[9999,10000],[10000,10000],[10500,11000]]){b.workers.base_cost=raw;expect(workerCost(b,0)).toBe(expected);}
 const fast=c();expect(workerCost(fast,2)).toBe(192);
});
it('reference source servings use one HP per received crate, separate restock clocks and Golden minimum 250',()=>{
 const b=c('reference'),e=new Engine(b);expect(b.resources.sardine).toMatchObject({value:1,stock:8,portion_hp:30,damage_per_catch:1,restock_s:360});expect(b.resources.crab).toMatchObject({value:3,stock:6,restock_s:180});expect(b.resources.snapper.restock_s).toBe(1440);expect(b.resources.wreck).toMatchObject({cost:27500,stock:3,portion_hp:600,restock_s:3000});expect(goldenReward(b,e.state)).toBeGreaterThanOrEqual(250);
});
it.each(['fast','reference'])('%s keeps v0.3.2 pending payments, completed-unclaimed reward and physical payout exactly across changed prices',profile=>{
 const old=baseline[profile] as Balance,e=new Engine(old),s=e.state,store=storage();
 s.questIndex=15;s.area=2;activateQuest(old,s);s.coins=1234;pay(old,s,'defender',1);const order=structuredClone(s.orders.defender);
 s.questStatus='completed_unclaimed';s.metal=17;spawnCoins(old,s,83,'fish_sale',s.boats[0],{},s.boats[0]);saveGame(store,s,1000);
 const loaded=loadGame(store,c(profile),1000)!.state;expect(loaded.orders.defender).toEqual(order);expect(loaded.questStatus).toBe('completed_unclaimed');expect(loaded.coins).toBe(s.coins);expect(loaded.metal).toBe(17);expect(loaded.coinStacks).toEqual(s.coinStacks);expect(loaded.nodes).toEqual(s.nodes);
 const next=new Engine(c(profile),loaded),priorWallet=loaded.coins;loaded.time=1;collectCoins(next.config,loaded,.05);expect(loaded.coins).toBe(priorWallet+83);collectCoins(next.config,loaded,1);expect(loaded.coins).toBe(priorWallet+83);
 loaded.coins=order.cost-order.paid;pay(next.config,loaded,'defender');expect(loaded.orders.defender.cost).toBe(order.cost);expect(loaded.orders.defender.duration).toBe(order.duration);expect(loaded.coins).toBe(0);
 expect(next.claimQuest(16)).toBe(true);expect(next.claimQuest(16)).toBe(false);expect(loaded.rewarded).toEqual([16]);
 saveGame(store,loaded,1000);expect(store.getItem(saveKey(profile as 'fast'|'reference'))).not.toBeNull();
});
it.each(['fast','reference'])('%s building orders keep deadline and saved price despite new config; source recovery uses new stock only after restock',profile=>{
 const old=baseline[profile] as Balance,e=new Engine(old),s=e.state,store=storage();s.area=2;s.questIndex=22;s.flags.storage=true;s.flags.cutter=true;s.coins=old.resources.wreck.cost;pay(old,s,'resource:wreck');const order=structuredClone(s.orders['resource:wreck']);
 s.nodes.sardine.phase='restock';s.nodes.sardine.hp=0;s.nodes.sardine.stock=0;s.nodes.sardine.readyAt=90;saveGame(store,s,1000);
 const next=new Engine(c(profile),loadGame(store,c(profile),1000)!.state);expect(next.state.orders['resource:wreck']).toEqual(order);next.settleOffline(89);expect(next.state.nodes.sardine.stock).toBe(0);next.settleOffline(1);expect(next.state.nodes.sardine.stock).toBe(next.config.resources.sardine.stock);next.settleOffline(order.duration);expect(next.state.nodes.wreck.unlocked).toBe(true);expect(next.state.orders['resource:wreck'].cost).toBe(order.cost);
});
it.each(['fast','reference'])('%s geometry, inputs, combat, schema and all 34 quest requirements are unchanged',profile=>{
 const current=c(profile),old=baseline[profile];for(const key of ['world','units','interaction','docks','combat','presentation','save','ai'])expect(legacyLayout(current)[key as keyof Balance]).toEqual(old[key]);
 const {traffic:_,...geometry}=legacyLayout(current).navigation;expect(geometry).toEqual(old.navigation);
 expect(current.quests.map(({reward_coins,...q})=>q)).toEqual(old.quests.map(({reward_coins,...q}:Balance['quests'][number])=>q));
 if(profile==='reference')expect(current.quests).toEqual(old.quests);
 else expect(current.quests.slice(0,15)).toEqual(old.quests.slice(0,15));expect(current.schema_version).toBe(old.schema_version);
});
it.each([41,97,211])('FAST seed %s completes 34 unfunded goals; first 15 within the original 10 min plus outer-pickup travel budget and defender within the original 2 min plus pickup travel',async seed=>{
 await new Promise<void>(resolve=>setImmediate(resolve));
 const r=simulate(c(),'A',seed);expect(r.completed,JSON.stringify(r.terminal)).toBe(true);expect(r.early15_s).toBeGreaterThan(300);// The requested outer payouts add movement; prices/rewards/timers stay fixed.
 const b=c(),minFishValue=Math.min(...Object.values(b.resources).filter(resource=>resource.kind==='fish').map(resource=>resource.value));
 const payoutsUpperBound=r.rows.slice(0,15).reduce((sum,row)=>sum+row.fish_collected/minFishValue,0);
 const addedTravelBudget=payoutsUpperBound*2*Math.max(0,b.world.deposit_radius+26-b.interaction.coin_scatter_radius)/b.units.player.speed;
 expect(r.early15_s).toBeLessThanOrEqual(600+addedTravelBudget);const defenderPayoutBudget=r.rows[15].fish_collected/minFishValue*2*Math.max(0,b.world.deposit_radius+26-b.interaction.coin_scatter_radius)/b.units.player.speed;expect(r.gate_to_defender_s).toBeLessThanOrEqual(120+defenderPayoutBudget);expect(r.debug_income).toBe(0);expect(r.free_skips+r.rewarded_skips).toBe(0);expect(r.rows[15].worker_sales_collected).toBeGreaterThan(0);expect(r.rows.some(row=>row.crates_expired>0)).toBe(true);
},90000);
it('REFERENCE metal spending cannot cap-lock the required 150 metal for den after storage upgrade',()=>{
 const b=c('reference');expect(b.expansion.den.metal_cost).toBeLessThanOrEqual(b.salvage.upgrade.capacity);expect(b.expansion.route.metal_cost).toBeLessThanOrEqual(b.salvage.upgrade.capacity);expect(b.quests.findIndex(q=>q.type==='wreck_ready')).toBeLessThan(b.quests.findIndex(q=>q.type==='metal_deposited'));expect(b.salvage.storage.metal_cost??0).toBe(0);expect(b.salvage.cutter.metal_cost??0).toBe(0);expect(b.resources.wreck.metal_cost??0).toBe(0);
});
it('reference salvage hires use 120/300s and repeat last; FAST keeps its scalar timer; invalid sequences reject',()=>{
 for(const profile of ['fast','reference']){const b=c(profile),e=new Engine(b),s=e.state;s.area=2;s.questIndex=33;s.nodes.wreck.unlocked=true;
 for(let count=0;count<3;count++){expect(offers(b,s).find(o=>o.id===`salvage:${count}`)!.build_s).toBe(profile==='fast'?30:count===0?120:300);s.boats.push(makeBoat(`salvage:${count}`,'salvage',b.world.storage));}}
 const b=c('reference');b.salvage.worker.timers_s=[];expect(()=>validateConfig(b)).toThrow();b.salvage.worker.timers_s=[-1];expect(()=>validateConfig(b)).toThrow();
});
it('existing reference Golden snapshot stays 75 after raising fresh minimum to 250, collected only once',()=>{
 const old=baseline.reference as Balance,e=new Engine(old),s=e.state,store=storage();s.golden.expires=45;s.golden.offerId=s.nextId++;const offer=e.openGoldenOffer()!;expect(offer.reward).toBe(75);saveGame(store,s,1000);
 const next=new Engine(c('reference'),loadGame(store,c('reference'),1000)!.state);expect(next.openGoldenOffer()!.reward).toBe(75);expect(next.beginGoldenReward(offer.id)).toBe(true);expect(next.claimGolden(true,offer.id)).toBe(true);expect(next.state.coins).toBe(0);
 next.state.time+=1;while(next.state.coinStacks.length){Object.assign(next.state.boats[0],next.state.coinStacks[0]);collectCoins(next.config,next.state,.02);}expect(next.state.coins).toBe(75);expect(next.claimGolden(true,offer.id)).toBe(false);
});
