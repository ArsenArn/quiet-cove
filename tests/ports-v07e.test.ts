import {restoreGroundLayout} from './helpers-ground-ui-protection';
import {legacyLayout} from './helpers-v07d-protection';
import {it,expect} from 'vitest';
import fs from 'node:fs';
import type {Balance} from '../src/config/types';
import {Engine} from '../src/game/engine';
import {makeBoat} from '../src/game/state';
import {fishPorts,fishUnload,fishPortKey} from '../src/game/systems/delivery';
import {deposit,collectCoins} from '../src/game/systems/economy';
import {acquire} from '../src/game/systems/resources';
import {distance,routeTo,onLand} from '../src/game/systems/movement';
import {saveGame,loadGame} from '../src/game/systems/save';
const config=()=>JSON.parse(fs.readFileSync('public/balance/balance_fast.json','utf8')) as Balance;
it('keeps the original port and keeps both docks when second port is built',()=>{
 const c=config(),s=new Engine(c).state,p=s.boats[0];expect(fishPorts(c,s)).toEqual([c.world.port]);
 Object.assign(p,c.second_port!.unload);acquire(c,s,p,'sardine');deposit(c,s,p,1);expect(p.cargo).toHaveLength(1);
 Object.assign(p,c.world.port);deposit(c,s,p,1);expect(p.cargo).toHaveLength(0);
 s.area=2;s.flags.secondPort=true;expect(fishPorts(c,s)).toEqual([c.world.port,c.second_port!.unload]);expect(fishPortKey(c.world.port)).not.toBe(fishPortKey(c.second_port!.unload));
});
it.each([0,1])('player unloads and collects individual physical payouts at dock %s',index=>{
 const c=config(),s=new Engine(c).state;s.area=2;s.flags.secondPort=true;s.cargoLevel=2;const port=fishPorts(c,s)[index],p=s.boats[0];Object.assign(p,port);
 for(let i=0;i<3;i++)acquire(c,s,p,'sardine');deposit(c,s,p,1);expect(p.cargo).toHaveLength(0);expect(s.coinStacks).toHaveLength(3);
 for(const coin of s.coinStacks){expect(distance(coin,port)).toBeGreaterThan(c.world.deposit_radius);expect(onLand(c,coin)).toBe(false);expect(routeTo(c,port,coin,2).length).toBeGreaterThan(0);}
 const coins=structuredClone(s.coinStacks);s.time+=2;for(const coin of coins){Object.assign(p,coin);collectCoins(c,s,1);}
 expect(s.coinStacks).toHaveLength(0);expect(s.stats.fish_sales_earned).toBe(3*c.resources.sardine.value);
});
it.each(['worker','speedboat'] as const)('%s gathers and returns to the local dock in both territories',kind=>{
 for(const [resource,index] of [['sardine',0],['lobster',1]] as const){
  const c=config(),e=new Engine(c),s=e.state;s.area=2;s.flags.secondPort=true;c.ai.choose_best_probability=1;
  for(const [id,n] of Object.entries(s.nodes))n.unlocked=id===resource;
  const b=makeBoat(kind,kind,c.resources[resource]);s.boats.push(b);Object.assign(s.boats[0],{x:200,y:300});
  for(let i=0;i<900;i++)e.update(.2);
  const deliveries=s.events.filter(x=>x.type==='delivery'&&x.data.boat===b.id);expect(deliveries.length).toBeGreaterThan(0);
  for(const d of deliveries)expect(distance({x:Number(d.data.x),y:Number(d.data.y)},fishPorts(c,s)[index])).toBeLessThanOrEqual(c.world.deposit_radius);
 }
},15000);
it('chooses navigation distance rather than straight-line proximity',()=>{
 const c=config();c.world.port={x:1900,y:1400};c.second_port!.unload={x:700,y:1400};c.navigation.obstacles=[{x:1650,y:1400,rx:100,ry:550,kind:'rock'}];
 const s=new Engine(c).state;s.area=2;s.flags.secondPort=true;Object.assign(s.boats[0],{x:1400,y:1400});expect(distance(s.boats[0],c.world.port)).toBeLessThan(distance(s.boats[0],c.second_port!.unload));expect(fishUnload(c,s)).toEqual(c.second_port!.unload);
});
it.each(['land','bounds'])('falls back when the nearer port is unreachable (%s)',reason=>{
 const c=config(),s=new Engine(c).state;s.area=2;s.flags.secondPort=true;
 c.second_port!.unload=reason==='land'?{...c.navigation.obstacles[0]}:{x:c.world.width+50,y:1390};
 Object.assign(s.boats[0],{x:2630,y:1390});expect(fishUnload(c,s)).toEqual(c.world.port);
});
it('loads old saves with both fish destinations and unchanged metal delivery',()=>{
 const c=config(),e=new Engine(c),s=e.state;s.area=2;s.flags.secondPort=true;s.flags.storage=true;s.flags.cutter=true;s.metal=c.salvage.storage.capacity;
 const worker=makeBoat('worker:0','worker',c.world.port);s.boats.push(worker);acquire(c,s,worker,'sardine');worker.state='RETURN';
 const map=new Map<string,string>(),store={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
 saveGame(store,s,1000);const loaded=loadGame(store,c,1000)!.state;const resumed=new Engine(c,loaded);resumed.update(1);expect(loaded.boats[1].cargo).toHaveLength(0);expect(fishPorts(c,loaded)).toHaveLength(2);
 const p=loaded.boats[0];Object.assign(p,c.world.storage);acquire(c,loaded,p,'wreck');deposit(c,loaded,p,1);expect(loaded.metal).toBe(c.salvage.storage.capacity);expect(loaded.stats.metal_discarded).toBe(1);
 expect(loaded.events.filter(x=>x.type==='delivery').at(-1)!.data.accepted_metal).toBe(0);
});
it.each(['fast','reference'])('%s configuration is byte-for-byte unchanged from v07d',profile=>{
 const current=restoreGroundLayout(JSON.parse(fs.readFileSync(`public/balance/balance_${profile}.json`,'utf8'))),old=JSON.parse(fs.readFileSync(`tests/fixtures/release/test-results_v07e_before_balance_balance_${profile}.json`,'utf8'));delete current.second_port;delete current.player_regen;delete current.interaction.purchase_points.secondPort;delete current.interaction.reveal_at_quest.secondPort;expect(current).toEqual(old);
});



it('simultaneous return trips keep independent docks and discard transient caches on reload',()=>{
 const c=config(),e=new Engine(c),s=e.state;s.area=2;s.flags.secondPort=true;
 for(const [index,port] of fishPorts(c,s).entries()){
  for(const kind of ['worker','speedboat'] as const){const b=makeBoat(`${kind}:${index}`,kind,{x:port.x+100,y:port.y});s.boats.push(b);for(let i=0;i<2;i++)acquire(c,s,b,'sardine');b.state='RETURN';expect(fishUnload(c,s,b)).toEqual(port);}
 }
 e.update(10);
 for(const b of s.boats.slice(1)){const port=fishPorts(c,s)[Number(b.id.split(':')[1])],events=s.events.filter(d=>d.type==='delivery'&&d.data.boat===b.id);expect(events.length).toBeGreaterThanOrEqual(2);for(const d of events.slice(0,2))expect(distance({x:Number(d.data.x),y:Number(d.data.y)},port)).toBeLessThanOrEqual(c.world.deposit_radius);}
 const reloaded=new Engine(c,JSON.parse(JSON.stringify(s)));expect(fishPorts(c,reloaded.state)).toHaveLength(2);reloaded.update(1);expect(reloaded.state.boats).toHaveLength(5);
});
