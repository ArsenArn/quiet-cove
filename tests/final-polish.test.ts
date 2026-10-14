import {it,expect} from 'vitest';
import {loadConfig} from './helpers-art-v05a';
import {newState,makeBoat} from '../src/game/state';
import {deposit,collectCoins,portCoinPoint} from '../src/game/systems/economy';
import {distance,onLand,routeTo} from '../src/game/systems/movement';
import {saveGame,loadGame} from '../src/game/systems/save';
import {animation,ambient,netShape} from '../src/game/art/animation';
import {collectAvailablePayouts} from './helpers-coin-pickup';
it.each(['fast','reference'] as const)('%s: new player/worker payouts are outside drop-off, reachable and conserve exact value across save/load',profile=>{
  const c=loadConfig(profile),s=newState(c),p=s.boats[0],worker=makeBoat('worker:0','worker',c.world.port);s.boats.push(worker);Object.assign(p,c.world.port);
  for(const boat of [p,worker]){boat.cargo=[5,5,1].map(value=>({id:s.nextId++,resource:'sardine',kind:'fish',value}));deposit(c,s,boat,10);}
  expect(s.coinStacks.map(coin=>coin.value)).toEqual([5,5,1,5,5,1]);expect(s.coins).toBe(0);
  for(const coin of s.coinStacks){expect(distance(coin,c.world.port)).toBeGreaterThan(c.world.deposit_radius+20);expect(onLand(c,coin)).toBe(false);expect(routeTo(c,c.world.port,coin,s.area).length).toBeGreaterThan(0);}
  s.time=1;collectCoins(c,s,1);expect(s.coins).toBe(0); // inside the circle is no longer the pickup location
  let raw='';const storage={getItem:()=>raw||null,setItem:(_key:string,value:string)=>{raw=value;},removeItem:()=>{}};saveGame(storage,s,1000);
  const restored=loadGame(storage,c,1000)!.state;expect(restored.coinStacks).toEqual(s.coinStacks);collectAvailablePayouts(c,restored);
  expect(restored.coins).toBe(22);expect(restored.stats.fish_sales_earned).toBe(22);expect(restored.coinStacks).toHaveLength(0);collectCoins(c,restored,1);expect(restored.coins).toBe(22);
  for(let id=1;id<=1000;id++){const point=portCoinPoint(c,s,id);expect(point.x).toBeGreaterThan(c.world.port.x);expect(distance(point,c.world.port)).toBeGreaterThan(c.world.deposit_radius);expect(distance(point,c.world.port)).toBeLessThanOrEqual(c.world.deposit_radius+26+1e-9);expect(onLand(c,point)).toBe(false);}
});
it('resource idle motion is calm, continuous and independent of frame timing; net expands smoothly',()=>{
  for(const id of ['sardine','crab','mussel','snapper','tuna','lobster','swordfish','squid','wreck'])for(let time=0;time<30;time+=.05){
    const a=ambient(id,time),b=ambient(id,time+1/60);expect(Math.abs(a.y)).toBeLessThanOrEqual(1.8);expect(Math.abs(a.x)).toBeLessThanOrEqual(.36);
    expect(Math.abs(b.y-a.y)).toBeLessThan(.025);expect(a.scale).toBe(1);expect(ambient(id,time)).toEqual(a);
  }
  let previous=0;for(let p=0;p<=1;p+=.01){const shape=netShape(p);expect(shape.rx).toBeGreaterThanOrEqual(previous);expect(shape.rx).toBeLessThanOrEqual(43);expect(shape.ry).toBeLessThanOrEqual(28);previous=shape.rx;}
  expect(animation.coins).toEqual({single:32,small_stack:38,large_pile:44});
});
