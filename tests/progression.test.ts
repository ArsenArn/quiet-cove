import { it, expect } from 'vitest';
import fs from 'node:fs';
import type { Balance, Point } from '../src/config/types';
import { Engine } from '../src/game/engine';
import { capacity } from '../src/game/systems/economy';
import { distance, navigationTarget } from '../src/game/systems/movement';
import { offers } from '../src/game/systems/construction';
import { saveGame, loadGame, type StorageLike } from '../src/game/systems/save';
it.each(['fast','reference'])('funded integration traverses all 34 %s quests using real movement, AI, combat and salvage',profile=>{
  const c=JSON.parse(fs.readFileSync(`public/balance/balance_${profile}.json`,'utf8')) as Balance;
  let e=new Engine(c);e.state.coins=1e7; // Explicit funded test: proves mechanics, NOT natural pacing/economy.
  const step=(seconds:number)=>e.update(seconds);
  const drive=(point:Point)=>{let tries=0;while(distance(e.state.boats[0],point)>20 && tries++<1000){const b=e.state.boats[0],next=navigationTarget(c,b,point,e.state.area),d=distance(b,next);e.input=d?{x:(next.x-b.x)/d,y:(next.y-b.y)/d}:{x:0,y:0};step(0.1);}e.input={x:0,y:0};expect(tries).toBeLessThan(1000);};
  const metalTrip=()=>{const p=e.state.boats[0];if(p.cargo.some(i=>i.kind==='fish')){drive(c.world.port);step(2);}drive(c.resources.wreck);let wait=0;while(p.cargo.length<capacity(c,e.state,p) && wait++<1000)step(1);drive(c.world.storage);step(2);};
  const build=(id:string)=>{e.purchase(id);const order=e.state.orders[id];expect(order,`order ${id}: ${JSON.stringify({flags:e.state.flags,area:e.state.area,offers:offers(c,e.state).map(o=>[o.id,o.blocked])})}`).toBeTruthy();let trips=0;while(order.readyAt===null && trips++<30){metalTrip();e.purchase(id);}expect(order.readyAt,`fully paid ${id}`).not.toBeNull();e.skip(id,true);step(0.1);};
  const progressSeen:number[]=[];let loops=0;
  while(e.state.questIndex<34 && loops++<200) {
    const q=c.quests[e.state.questIndex],s=e.state;progressSeen.push(q.id);if(s.questStatus==='completed_unclaimed'){e.claimQuest(q.id);continue;}
    switch(q.type) {
      case 'catch_sardine': case 'catch_total': drive(c.resources.sardine);step(2);if(e.state.questIndex===q.id-1){drive(c.world.port);step(2);}break;
      case 'deliver_fish': drive(c.world.port);step(2);break;
      case 'cargo_level': while(e.state.cargoLevel<Number(q.target))build(`cargo:${e.state.cargoLevel+1}`);break;
      case 'normal_workers': while(e.state.boats.filter(b=>b.kind==='worker').length<Number(q.target))build(`worker:${e.state.boats.filter(b=>b.kind==='worker').length}`);break;
      case 'salvage_workers': while(e.state.boats.filter(b=>b.kind==='salvage').length<Number(q.target))build(`salvage:${e.state.boats.filter(b=>b.kind==='salvage').length}`);break;
      case 'resource_ready': build(`resource:${q.target}`);break;
      case 'speedboat_ordered': case 'speedboat_ready': build('speedboat');break;
      case 'area_unlocked': build('gate');break;
      case 'defender_ready': build('defender');break;
      case 'metal_storage_ready': build('storage');break;
      case 'metal_cutter_owned': build('cutter');break;
      case 'wreck_ready': build('resource:wreck');break;
      case 'metal_storage_capacity': build('storageUpgrade');break;
      case 'pirate_den_closed': build('den');break;
      case 'expedition_route_ready': build('route');break;
      case 'metal_deposited': metalTrip();break;
      case 'earn_coins': case 'fish_sales_earned': drive({x:c.world.port.x+c.world.deposit_radius+24,y:c.world.port.y});step(60);break;
      case 'pirates_killed': drive(c.world.port);step(30);break;
      default: throw Error(q.type);
    }
    if(q.id===21) { // Mid-run reload proves cargo, workers, timers and progression continue together.
      const store:StorageLike={getItem:()=>raw,setItem:(_k,v)=>{raw=v;},removeItem:()=>{raw='';}};let raw='';saveGame(store,e.state,1000);const loaded=loadGame(store,c,1000)!;e=new Engine(c,loaded.state);
    }
  }
  expect(loops,JSON.stringify({quest:e.state.questIndex+1,stats:e.state.stats,baseline:e.state.questBaseline,metal:e.state.metal,flags:e.state.flags,player:e.state.boats[0],wreck:e.state.nodes.wreck,workers:e.state.boats.filter(b=>b.kind==='salvage')})).toBeLessThan(200);expect(e.state.questIndex).toBe(34);expect(e.state.rewarded).toHaveLength(34);expect(new Set(e.state.rewarded).size).toBe(34);
  expect(e.state.flags.route).toBe(true);expect(e.state.flags.den).toBe(true);expect(e.state.stats.pirates_killed).toBeGreaterThanOrEqual(2);expect(e.state.stats.metal_deposited).toBeGreaterThanOrEqual(60);
  expect(e.state.boats.filter(b=>b.kind==='worker')).toHaveLength(7);expect(e.state.boats.filter(b=>b.kind==='salvage')).toHaveLength(2);expect(offers(c,e.state).some(o=>o.id==='route')).toBe(false);
  expect(progressSeen).toContain(24);expect(e.state.events.some(e=>e.type==='delivery'&&e.data.boat==='salvage:0')).toBe(true);
},30000);
