import {it,expect} from 'vitest';
import fs from 'node:fs';
import type {Balance} from '../src/config/types';
import {Engine} from '../src/game/engine';
import {collectCoins,actualEarnRate} from '../src/game/systems/economy';
import {distance,onLand,routeTo} from '../src/game/systems/movement';
import {saveGame,loadGame} from '../src/game/systems/save';
const config=()=>JSON.parse(fs.readFileSync('public/balance/balance_fast.json','utf8')) as Balance;
function merchant(){const e=new Engine(config());e.state.golden.nextAt=0;e.update(.01);return e;}
function storage(){const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>data.delete(k)};}
it('proximity never prepares a reward; explicit offer snapshot and cancelled claim pay nothing',()=>{
 const e=merchant(),s=e.state;Object.assign(s.boats[0],s.golden);e.update(.2);expect(s.golden.transaction).toBeNull();expect(e.claimGolden(true)).toBe(false);
 const offer=e.openGoldenOffer()!,value=offer.reward;s.nodes.tuna.unlocked=true;s.cargoLevel=6;expect(e.openGoldenOffer()!.reward).toBe(value);expect(e.beginGoldenReward(offer.id)).toBe(true);expect(e.claimGolden(false,offer.id)).toBe(false);expect(e.cancelGoldenReward(offer.id)).toBe(true);expect(e.claimGolden(true,offer.id)).toBe(false);expect(s.coins).toBe(0);expect(s.coinStacks).toEqual([]);expect(s.golden.expires).not.toBeNull();
});
it.each([40,75,107])('reward %s spawns exactly ten integer piles, preserves sum, sources and one-time claims after reload',total=>{
 const e=merchant(),c=e.config,s=e.state,offer=e.openGoldenOffer()!;offer.reward=total;expect(e.beginGoldenReward(offer.id)).toBe(true);expect(e.claimGolden(true,offer.id)).toBe(true);
 expect(s.coinStacks).toHaveLength(10);expect(s.coinStacks.every(p=>Number.isInteger(p.value)&&p.source==='golden_reward')).toBe(true);expect(s.coinStacks.reduce((n,p)=>n+p.value,0)).toBe(total);expect(s.coins).toBe(0);expect(s.golden.expires).toBeNull();expect(e.claimGolden(true,offer.id)).toBe(false);
 s.time+=1;collectCoins(c,s,1);expect(s.coins).toBe(0);expect(s.coinStacks.every(p=>distance(p,s.boats[0])>c.interaction.coin_radius)).toBe(true);
 for(let i=0;i<4;i++){const p=s.coinStacks[0];Object.assign(s.boats[0],{x:p.x,y:p.y});collectCoins(c,s,.01);}expect(s.coinStacks).toHaveLength(6);
 const store=storage();saveGame(store,s,1000);const restored=new Engine(c,loadGame(store,c,1000)!.state);expect(restored.claimGolden(true,offer.id)).toBe(false);expect(restored.state.coinStacks).toHaveLength(6);
 for(let i=0;i<6;i++){const p=restored.state.coinStacks[0];Object.assign(restored.state.boats[0],{x:p.x,y:p.y});collectCoins(c,restored.state,.01);}
 expect(restored.state.coins).toBe(total);expect(restored.state.stats.fish_sales_earned??0).toBe(0);expect(restored.state.stats.golden_collected).toBe(total);expect(actualEarnRate(restored.state)).toBe(0);
});
it('accepted ad survives normal expiry; cancelled and interrupted ads cannot issue rewards on reload',()=>{
 const e=merchant(),s=e.state,offer=e.openGoldenOffer()!;s.golden.expires=s.time+.01;expect(e.beginGoldenReward(offer.id)).toBe(true);e.update(3);expect(s.golden.expires).not.toBeNull();
 const store=storage();saveGame(store,s,1000);const loaded=new Engine(e.config,loadGame(store,e.config,1000)!.state);expect(loaded.state.golden.transaction?.status).toBe('offered');expect(loaded.claimGolden(true,offer.id)).toBe(false);expect(loaded.state.coinStacks).toHaveLength(0);
 expect(e.claimGolden(true,offer.id)).toBe(true);expect(s.coinStacks).toHaveLength(10);
});
it.each([{x:30,y:30},{x:1040,y:1340},{x:1820,y:2380},{x:3270,y:30},{x:2470,y:1570}])('scatter remains reachable water and outside pickup radius at %j',point=>{
 const e=merchant(),s=e.state,c=e.config;s.area=point.x>=c.world.gate_x?2:1;Object.assign(s.boats[0],point);const offer=e.openGoldenOffer()!;e.beginGoldenReward(offer.id);e.claimGolden(true,offer.id);
 expect(s.coinStacks).toHaveLength(10);for(const p of s.coinStacks){expect(onLand(c,p)).toBe(false);expect(distance(p,point)).toBeGreaterThan(c.interaction.coin_radius);expect(routeTo(c,point,p,s.area).length).toBeGreaterThan(0);expect(p.x).toBeLessThanOrEqual(s.area===1?c.world.gate_x-c.world.edge_margin:c.world.width-c.world.edge_margin);}
});
