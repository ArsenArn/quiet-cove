import {collectAvailablePayouts} from './helpers-coin-pickup';
function exposed(c:Balance){c.interaction.reveal_at_quest=Object.fromEntries(Object.keys(c.interaction.reveal_at_quest).map(k=>[k,1]));return c;}
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import type { Balance } from '../src/config/types';
import { Engine } from '../src/game/engine';
import { makeBoat, newState } from '../src/game/state';
import { acquire, pickup } from '../src/game/systems/resources';
import { collectCoins, deposit } from '../src/game/systems/economy';
import { purchasePoint, updatePurchases } from '../src/game/systems/construction';
import { updateQuests } from '../src/game/systems/quests';
import { updateWorker } from '../src/game/systems/workers';
import { loadGame, saveGame, saveKey, type StorageLike } from '../src/game/systems/save';
const config=()=>exposed(JSON.parse(fs.readFileSync('public/balance/balance_fast.json','utf8')) as Balance);
function storage():StorageLike { const data=new Map<string,string>();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);},removeItem:k=>{data.delete(k);}}; }
describe('v0.2 core loop',()=>{
  it('fractional final payments leave a valid zero wallet and conserve both currencies after reload',()=>{
    const c=config(),s=newState(c);s.area=2;s.flags.storage=true;s.coins=c.salvage.upgrade.cost;s.metal=c.salvage.upgrade.metal_cost!;Object.assign(s.boats[0],purchasePoint(c,'storageUpgrade'));
    for(let i=0;i<2500 && s.orders.storageUpgrade?.readyAt==null;i++)updatePurchases(c,s,1/30);
    expect(s.orders.storageUpgrade.readyAt).not.toBeNull();expect(s.coins).toBeGreaterThanOrEqual(0);expect(s.metal).toBeGreaterThanOrEqual(0);expect(s.coins).toBeCloseTo(0,7);expect(s.metal).toBeCloseTo(0,7);
    const store=storage();saveGame(store,s,1000);expect(()=>loadGame(store,c,1000)).not.toThrow();
  });
  it('proximity pours integer payments, stops on departure, reload retains partial payment',()=>{
    const c=config(),s=newState(c);s.coins=100;Object.assign(s.boats[0],purchasePoint(c,'worker:0'));
    updatePurchases(c,s,.45);const paid=s.orders['worker:0'].paid;expect(paid).toBeGreaterThan(0);expect(paid).toBeLessThan(75);expect(s.coins+paid).toBe(100);expect(s.orders['worker:0'].readyAt).toBeNull();
    s.boats[0].x+=c.interaction.purchase_radius+1;updatePurchases(c,s,1);expect(s.orders['worker:0'].paid).toBe(paid);
    const store=storage();saveGame(store,s,1000);const restored=loadGame(store,c,1000)!.state;Object.assign(restored.boats[0],purchasePoint(c,'worker:0'));updatePurchases(c,restored,3.25);expect(restored.orders['worker:0'].readyAt).not.toBeNull();expect(restored.coins).toBe(25);
  });
  it('delivery spawns saved cash without credit; delayed attraction collects once',()=>{
    const c=config(),s=newState(c),p=s.boats[0];Object.assign(p,c.world.port);acquire(c,s,p,'sardine');deposit(c,s,p,1);
    expect(s.coins).toBe(0);expect(s.stats.fish_sales_earned??0).toBe(0);expect(s.coinStacks).toHaveLength(1);collectCoins(c,s,1);expect(s.coins).toBe(0);
    const store=storage();saveGame(store,s,1000);const restored=loadGame(store,c,1000)!.state;restored.time=1;collectAvailablePayouts(c,restored);
    expect(restored.coins).toBe(c.resources.sardine.value);expect(restored.coinStacks).toHaveLength(0);expect(restored.stats.fish_sales_earned).toBe(c.resources.sardine.value);
    expect(restored.events.filter(e=>e.type==='coin_collect')).toHaveLength(1);expect(restored.events.some(e=>e.type==='delivery')).toBe(true);expect(restored.events.some(e=>e.type==='coin_spawn')).toBe(true);
  });
  it('large fleet money stays individual and conserved while player is away',()=>{
    const c=config(),s=newState(c),w=makeBoat('worker','worker',c.world.port);s.boats.push(w);s.boats[0].x=50;
    for(let i=0;i<1000;i++){s.time+=.1;acquire(c,s,w,'sardine');deposit(c,s,w,1);}
    expect(s.coinStacks.length).toBeLessThanOrEqual(s.stats.deliver_fish??0);expect(s.coinStacks.reduce((n,p)=>n+p.value,0)).toBe(1000*c.resources.sardine.value);expect(s.coins).toBe(0);
  });
  it('completed_unclaimed survives reload, duplicate ID cannot reward next satisfied quest',()=>{
    const c=config(),e=new Engine(c);acquire(c,e.state,e.state.boats[0],'sardine');updateQuests(c,e.state);
    expect(e.state.questStatus).toBe('completed_unclaimed');expect(e.state.questIndex).toBe(0);expect(e.state.coins).toBe(0);
    const store=storage();saveGame(store,e.state,1000);const restored=new Engine(c,loadGame(store,c,1000)!.state);restored.state.stats.deliver_fish=1;
    expect(restored.claimQuest(1)).toBe(true);expect(restored.state.questIndex).toBe(1);expect(restored.state.questStatus).toBe('completed_unclaimed');expect(restored.claimQuest(1)).toBe(false);expect(restored.state.coins).toBe(c.quests[0].reward_coins);
    expect(restored.claimQuest(2)).toBe(true);expect(restored.state.rewarded).toEqual([1,2]);
  });
  it('crate pickup is received fish, never an active catch; worker harvest stays attributed',()=>{
    const c=config(),s=newState(c),p=s.boats[0];s.crates.push({id:999,x:p.x,y:p.y,resource:'sardine',kind:'fish',value:c.resources.sardine.value,reservedBy:null});pickup(c,s,p);
    expect(s.stats.catch_total??0).toBe(0);expect(s.stats.catch_sardine??0).toBe(0);expect(s.stats.crate_pickup_player).toBe(1);expect(s.stats.fish_received).toBe(1);
    const w=makeBoat('w','worker',p);acquire(c,s,w,'sardine');expect(s.stats.active_catch_worker).toBe(1);expect(s.stats.catch_sardine).toBe(1);expect(s.stats.fish_received).toBe(2);
  });
  it.each(['TO_PICKUP','GATHER'] as const)('new loose crate interrupts %s, reserves once and restores gather',mode=>{
    const c=config(),s=newState(c),w=makeBoat('w','worker',c.resources.sardine);s.boats.push(w);w.state=mode;w.target='sardine';w.gather=.6;
    s.crates.push({id:999,x:w.x+100,y:w.y,resource:'sardine',kind:'fish',value:1,reservedBy:null});updateWorker(c,s,w,.01);
    expect(w.target).toBe(999);expect(w.resume).toEqual({target:'sardine',gather:.6});expect(s.crates[0].reservedBy).toBe('w');
    s.crates.push({id:1000,x:w.x+80,y:w.y,resource:'sardine',kind:'fish',value:1,reservedBy:'other'});updateWorker(c,s,w,.01);expect(w.target).toBe(999);
    s.crates=s.crates.filter(p=>p.id!==999);updateWorker(c,s,w,.01);updateWorker(c,s,w,.01);expect(w.target).toBe('sardine');expect(w.gather).toBeGreaterThanOrEqual(.6);
  });
  it('v1 migration keeps cash, rewards, partial orders, and exact raw backup isolated by profile',()=>{
    const c=config(),s:any=newState(c);s.version=1;delete s.questStatus;delete s.coinStacks;for(const key of ['x','y','angle','origin'])delete s.golden[key];s.coins=123;s.questIndex=2;s.rewarded=[1,2];s.stats.catch_total=4;
    s.questBaseline=3;s.orders['resource:tuna']={id:'resource:tuna',paid:200,metalPaid:0,cost:2520,metalCost:0,duration:96,readyAt:null,complete:false};s.boats[0].cargo=[{id:999,resource:'sardine',kind:'fish',value:1}];s.nextId=1000;
    const store=storage();saveGame(store,s,1000);const raw=store.getItem(saveKey('fast'));const loaded=loadGame(store,c,1000)!.state;
    expect(loaded.version).toBe(3);expect(loaded.coins).toBe(123);expect(loaded.rewarded).toEqual([1,2]);expect(loaded.stats.legacy_catch_total).toBe(4);expect(loaded.coinStacks).toEqual([]);expect(store.getItem(`${saveKey('fast')}_backup_before_v02`)).toBe(raw);expect(store.getItem(`${saveKey('reference')}_backup_before_v02`)).toBeNull();
    expect(loaded.orders['resource:tuna']).toEqual(s.orders['resource:tuna']);expect(loaded.questBaseline).toBe(3);expect(loaded.boats[0].cargo).toEqual(s.boats[0].cargo);expect(loaded.golden.x).toBe(loaded.boats[0].x);
  });
});
