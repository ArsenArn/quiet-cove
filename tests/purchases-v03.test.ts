import {it,expect} from 'vitest';
import fs from 'node:fs';
import type {Balance} from '../src/config/types';
import {Engine} from '../src/game/engine';
import {newState} from '../src/game/state';
import {offers,purchasePoint,visibility,updatePurchases} from '../src/game/systems/construction';
import {saveGame,loadGame} from '../src/game/systems/save';
const config=()=>JSON.parse(fs.readFileSync('public/balance/balance_fast.json','utf8')) as Balance;
it('moving through a funded zone does not pay; actual stop waits, resumes and stops immediately',()=>{
 const c=config(),e=new Engine(c),s=e.state,p=s.boats[0],point=purchasePoint(c,'worker:0');s.questIndex=5;s.coins=1000;
 Object.assign(p,{x:point.x-90,y:point.y});e.input={x:1,y:0};e.update(.9);expect(s.orders['worker:0']).toBeUndefined();
 Object.assign(p,point);e.input={x:0,y:0};e.update(.24);expect(s.orders['worker:0']).toBeUndefined();
 e.update(.11);expect(s.orders['worker:0'].paid).toBeGreaterThan(0);expect(s.orders['worker:0'].paid).toBeLessThan(75);
 const paid=s.orders['worker:0'].paid;e.input={x:1,y:0};e.update(.03);expect(s.orders['worker:0'].paid).toBe(paid);
 e.input={x:0,y:0};e.update(.2);expect(s.orders['worker:0'].paid).toBe(paid);e.update(.1);expect(s.orders['worker:0'].paid).toBeGreaterThan(paid);
});
it('small actual drift tolerates joystick noise, cumulative drift resets the delay',()=>{
 const c=config(),e=new Engine(c),s=e.state;s.questIndex=5;s.coins=1000;Object.assign(s.boats[0],purchasePoint(c,'worker:0'));
 e.input={x:.01,y:0};e.update(.5);expect(s.orders['worker:0'].paid).toBeGreaterThan(0);expect(Number.isInteger(s.orders['worker:0'].paid)).toBe(true);
 const paid=s.orders['worker:0'].paid;e.input={x:.1,y:0};e.update(.1);expect(s.orders['worker:0'].paid).toBe(paid);
});
it('partial dual-currency payment reloads and waits again, never overpays',()=>{
 const c=config(),s=newState(c);s.questIndex=29;s.area=2;s.flags.storage=true;s.coins=20;s.metal=2;Object.assign(s.boats[0],purchasePoint(c,'storageUpgrade'));
 updatePurchases(c,s,1,0);expect(s.orders.storageUpgrade.paid).toBe(20);expect(s.orders.storageUpgrade.metalPaid).toBe(2);
 let raw='';const store={getItem:()=>raw||null,setItem:(_k:string,v:string)=>{raw=v;},removeItem:()=>{}};saveGame(store,s,1000);const restored=loadGame(store,c,1000)!.state;
 restored.coins=c.salvage.upgrade.cost;restored.metal=30;updatePurchases(c,restored,.24,0);expect(restored.orders.storageUpgrade.paid).toBe(20);
 updatePurchases(c,restored,100,0);expect(restored.orders.storageUpgrade.paid).toBe(c.salvage.upgrade.cost);expect(restored.orders.storageUpgrade.metalPaid).toBe(c.salvage.upgrade.metal_cost);
 expect(restored.coins).toBe(20);expect(restored.metal).toBe(2);
});
it('reveals categories in sequence and preserves old purchases and partial payments',()=>{
 const c=config(),s=newState(c);expect(offers(c,s)).toEqual([]);expect(visibility(c,s,'worker:0')).toBe('HIDDEN');
 s.questIndex=3;expect(offers(c,s).map(o=>o.id)).toEqual(['cargo:1']);s.questIndex=5;expect(offers(c,s).some(o=>o.id==='worker:0')).toBe(true);
 s.questIndex=13;expect(offers(c,s).some(o=>o.id==='worker:0')).toBe(true);
 s.orders['resource:squid']={id:'resource:squid',paid:1,metalPaid:0,cost:c.resources.squid.cost,metalCost:0,duration:1,readyAt:null,complete:false};s.questIndex=0;s.area=2;
 expect(visibility(c,s,'resource:squid')).toBe('PARTIALLY_PAID');expect(offers(c,s).some(o=>o.id==='resource:squid')).toBe(true);
 s.nodes.tuna.unlocked=true;expect(visibility(c,s,'resource:tuna')).toBe('READY');
});
