import {it,expect} from 'vitest';import fs from 'node:fs';
import type {Balance,Point} from '../src/config/types';import {Engine} from '../src/game/engine';import {makeBoat} from '../src/game/state';
import {syncBuildingObstacles,onLand,routeTo,distance,navigateTo} from '../src/game/systems/movement';import {offers,purchasePoint} from '../src/game/systems/construction';import {acquire} from '../src/game/systems/resources';import {deposit} from '../src/game/systems/economy';import {saveGame,loadGame} from '../src/game/systems/save';
const config=(profile:string)=>JSON.parse(fs.readFileSync(`public/balance/balance_${profile}.json`,'utf8')) as Balance;
it.each(['fast','reference'])('%s Q31 and built second port have disjoint bodies, exact water routes and independent interactions',profile=>{
 const c=config(profile),e=new Engine(c),s=e.state;s.area=2;s.questIndex=30;s.rewarded=Array.from({length:30},(_,i)=>i+1);s.flags.secondPort=true;s.flags.storage=true;s.flags.storageUpgrade=true;s.flags.cutter=true;s.cargoLevel=4;s.flags.den=false;syncBuildingObstacles(c,s);
 const hut=c.second_port!.hut,den=purchasePoint(c,'den'),port=c.second_port!.unload;
 expect(offers(c,s).some(o=>o.id==='den'&&!o.blocked)).toBe(true);expect(offers(c,s).some(o=>o.id==='secondPort')).toBe(false);
 expect(distance(port,den)).toBeGreaterThan(c.world.deposit_radius+c.interaction.purchase_radius);
 const dx=Math.max(Math.abs(den.x-hut.x)-143/2,0),dy=Math.max(Math.abs(den.y-hut.y)-169/2,0);expect(Math.hypot(dx,dy)).toBeGreaterThan(c.interaction.purchase_radius);
 for(let i=0;i<32;i++){const angle=i*Math.PI/16;expect(onLand(c,{x:den.x+Math.cos(angle)*c.interaction.purchase_radius,y:den.y+Math.sin(angle)*c.interaction.purchase_radius})).toBe(false);}expect(onLand(c,den)).toBe(false);expect(onLand(c,port)).toBe(false);
 const origins=[c.world.port,c.world.storage,port,purchasePoint(c,'secondPort')];for(const origin of origins)for(const goal of [den,port]){const route=routeTo(c,origin,goal,2);expect(route.length).toBeGreaterThan(0);expect(distance(route.at(-1)!,goal)).toBeLessThan(.01);}
 for(const kind of ['player','worker','speedboat','salvage','defender'] as const){const b=makeBoat(kind,kind==='defender'?'player':kind,{x:hut.x-100,y:hut.y+28});for(let i=0;i<1500&&distance(b,den)>1;i++)navigateTo(c,b,den,80,1/30,2);expect(distance(b,den)).toBeLessThan(1);expect(onLand(c,b)).toBe(false);}
 Object.assign(s.boats[0],port);acquire(c,s,s.boats[0],'tuna');deposit(c,s,s.boats[0],1);expect(s.boats[0].cargo).toHaveLength(0);expect(s.coinStacks).toHaveLength(1);expect(s.orders.den).toBeUndefined();
 // Real stationary payment uses the unchanged Q31 circle, not the port.
 s.coins=17;s.metal=0;Object.assign(s.boats[0],den);e.update(3);expect(s.orders.den.paid).toBe(17);expect(s.orders.den.cost).toBe(c.expansion.den.cost);expect(s.flags.secondPort).toBe(true);
 const map=new Map<string,string>(),storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};saveGame(storage,s,1000);const c2=config(profile),loaded=loadGame(storage,c2,1000)!.state;expect(loaded.orders.den).toEqual(s.orders.den);expect(onLand(c2,den)).toBe(false);expect(onLand(c2,{x:hut.x,y:hut.y+28})).toBe(true);
});
