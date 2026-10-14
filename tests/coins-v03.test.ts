import {collectAvailablePayouts} from './helpers-coin-pickup';
import {it,expect} from 'vitest';
import fs from 'node:fs';
import type {Balance} from '../src/config/types';
import {newState,makeBoat} from '../src/game/state';
import {deposit,collectCoins,spawnCoins} from '../src/game/systems/economy';
import {saveGame,loadGame,saveKey} from '../src/game/systems/save';
import {onLand} from '../src/game/systems/movement';
const config=()=>JSON.parse(fs.readFileSync('public/balance/balance_fast.json','utf8')) as Balance;
it('three delivered crates [5,5,1] create exactly three unique payouts, credit once after pickup',()=>{
 const c=config(),s=newState(c),p=s.boats[0];Object.assign(p,c.world.port);p.cargo=[5,5,1].map(value=>({id:s.nextId++,resource:'crab',kind:'fish',value}));deposit(c,s,p,1);
 expect(s.coinStacks.map(p=>p.value)).toEqual([5,5,1]);expect(new Set(s.coinStacks.map(p=>p.id)).size).toBe(3);expect(s.coins).toBe(0);collectCoins(c,s,1);expect(s.coins).toBe(0);
 s.time=1;collectAvailablePayouts(c,s);expect(s.coins).toBe(11);expect(s.stats.fish_sales_earned).toBe(11);expect(s.coinStacks).toHaveLength(0);
 expect(s.events.filter(e=>e.type==='coin_spawn').map(e=>e.data.crate)).toEqual([1,2,3]);
});
it('1000 worker deliveries remain individual and conserve every reward through save/reload',()=>{
 const c=config(),s=newState(c),w=makeBoat('worker','worker',c.world.port);s.boats.push(w);Object.assign(s.boats[0],{x:1500,y:2100});
 for(let i=0;i<1000;i++){w.cargo=[{id:s.nextId++,resource:'sardine',kind:'fish',value:2}];deposit(c,s,w,1);}
 expect(s.coinStacks).toHaveLength(1000);expect(s.coinStacks.reduce((n,p)=>n+p.value,0)).toBe(2000);expect(s.coinStacks.every(p=>!onLand(c,p))).toBe(true);expect(s.coins).toBe(0);
 let raw='';const store={getItem:()=>raw||null,setItem:(_k:string,v:string)=>{raw=v;},removeItem:()=>{}};saveGame(store,s,1000);const restored=loadGame(store,c,1000)!.state;
 expect(restored.coinStacks).toHaveLength(1000);expect(new Set(restored.coinStacks.map(p=>p.id)).size).toBe(1000);restored.time=1;Object.assign(restored.boats[0],c.world.port);collectAvailablePayouts(c,restored);expect(restored.coins).toBe(2000);collectAvailablePayouts(c,restored);expect(restored.coins).toBe(2000);
});
it('coins remain uncollected outside a compact radius and follow only after entering it',()=>{
 const c=config(),s=newState(c),p=s.boats[0];spawnCoins(c,s,5);s.time=1;const coin=s.coinStacks[0];Object.assign(p,{x:coin.x+c.interaction.coin_radius+1,y:coin.y});collectCoins(c,s,.01);expect(coin.attracting).toBe(false);expect(s.coins).toBe(0);
 p.x-=2;collectCoins(c,s,.01);expect(coin.attracting).toBe(true);collectCoins(c,s,1);expect(s.coins).toBe(5);
});
it('v2 migration keeps aggregate coin value, creates exact backup, loads idempotently and preserves all purchased categories',()=>{
 const c=config(),s:any=newState(c);s.version=2;delete s.revealedPurchases;s.coins=91;s.coinStacks=[{id:44,value:11,x:c.world.port.x,y:c.world.port.y,attracting:false,availableAt:0}];s.nextId=45;
 s.questStatus='completed_unclaimed';s.orders.speedboat={id:'speedboat',paid:12,metalPaid:0,cost:c.special.speedboat.cost,metalCost:0,duration:1,readyAt:null,complete:false};
 const data=new Map<string,string>(),store={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>data.delete(k)};saveGame(store,s,1000);const raw=store.getItem(saveKey('fast'));
 const a=loadGame(store,c,1000)!.state,b=loadGame(store,c,1000)!.state;expect(a).toEqual(b);expect(a.version).toBe(3);expect(a.coins).toBe(91);expect(a.coinStacks[0]).toMatchObject({id:44,value:11,source:'fish_sale'});expect(a.questStatus).toBe('completed_unclaimed');expect(a.revealedPurchases.speedboat).toBe(true);
 expect(store.getItem(saveKey('fast')+'_backup_before_v03')).toBe(raw);saveGame(store,a,1000);expect(loadGame(store,c,1000)!.state).toEqual(a);expect(store.getItem(saveKey('fast')+'_backup_before_v03')).toBe(raw);
});
