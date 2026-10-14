import type { Balance } from '../src/config/types';
import type { GameState } from '../src/game/state';
import { Engine } from '../src/game/engine';
import { makeBoat } from '../src/game/state';
import { distance, onLand } from '../src/game/systems/movement';
import { trafficMetrics } from '../src/game/systems/traffic';

export function fleetFixture(c:Balance,count:number,options:{single?:boolean;combat?:boolean;stack?:boolean;support?:boolean}={}) {
  const e=new Engine(c),s=e.state;s.area=2;s.flags.storage=true;s.flags.cutter=true;s.flags.storageUpgrade=true;s.flags.den=!options.combat;s.golden.nextAt=1e9;s.questIndex=33;
  Object.assign(s.boats[0],c.world.port);
  for(const [id,n] of Object.entries(s.nodes))n.unlocked=!options.single||id==='sardine'||id==='wreck';
  for(let i=0;i<count;i++)s.boats.push(makeBoat(`worker:${i}`,'worker',options.stack?c.world.port:{x:1180+(i%4)*42,y:1420+Math.floor(i/4)*42}));
  if(count===c.workers.max_count && options.support!==false){
    s.boats.push(makeBoat('speedboat','speedboat',{x:1380,y:1470}));
    for(let i=0;i<c.salvage.worker.max_count;i++)s.boats.push(makeBoat(`salvage:${i}`,'salvage',{x:2520+i*42,y:1560}));
  }
  if(options.combat){
    s.defender=makeBoat('defender','player',c.combat.defender_spawn,c.combat.defender_hp);Object.assign(s.boats[0],{x:2400,y:1190});s.nextPirateAt=0;
    const home={x:c.combat.spawner.x+110,y:c.combat.spawner.y};
    for(let i=0;i<c.combat.max_enemies;i++)s.enemies.push({id:`pirate:${s.nextId++}`,x:home.x+i*42,y:home.y,home:{...home},hp:c.combat.pirate_hp,angle:0,attackAt:0,state:'PATROL',target:null});
  }
  return s;
}
// Pure engine stress; wall time measures CPU throughput, never hardware mobile FPS.
export function runFleet(c:Balance,s:GameState,seconds:number,EngineType:typeof Engine=Engine) {
  const e=new EngineType(c,s),last=new Map<string,{x:number;y:number;still:number;portWait:number;maxWait:number}>();
  let illegalPositions=0,overlapSamples=0,maxOverlap=0,maxPortWait=0,blockedBoatSeconds=0,engineCpuMs=0,lastSeq=s.eventSeq,issuedFishIncome=0;
  const counts=Object.fromEntries(s.boats.slice(1).map(b=>[b.id,0]));
  const start=performance.now();
  for(let step=0;step<seconds*10;step++){
    // A test-only spending sink isolates warehouse navigation from legitimate full-storage WAIT.
    if(s.metal>=80)s.metal-=80;
    const engineStart=performance.now();e.update(.1);engineCpuMs+=performance.now()-engineStart;
    for(const event of s.events)if(event.seq>lastSeq && event.type==='delivery'){const id=String(event.data.boat);counts[id]=(counts[id]??0)+1;if(event.data.kind==='fish')issuedFishIncome+=Number(event.data.value);}lastSeq=s.eventSeq;
    for(const b of s.boats.slice(1)){
      let p=last.get(b.id);if(!p){p={x:b.x,y:b.y,still:0,portWait:0,maxWait:0};last.set(b.id,p);}
      const moving=['TO_PICKUP','RETURN','UNLOAD'].includes(b.state),moved=Math.hypot(p.x-b.x,p.y-b.y);
      p.still=moving&&moved<.1?p.still+.1:0;
      if(p.still>5)blockedBoatSeconds+=.1;
      const port=b.kind==='salvage'?c.world.storage:c.world.port;
      p.portWait=b.cargo.length>0&&['RETURN','UNLOAD'].includes(b.state)&&distance(b,port)<150?p.portWait+.1:0;
      p.maxWait=Math.max(p.maxWait,p.portWait);maxPortWait=Math.max(maxPortWait,p.portWait);p.x=b.x;p.y=b.y;
      if(onLand(c,b)||b.x<c.world.edge_margin-.01||b.x>c.world.width-c.world.edge_margin+.01||b.y<c.world.edge_margin-.01||b.y>c.world.height-c.world.edge_margin+.01)illegalPositions++;
    }
    if(c.navigation.traffic){const boats=[...s.boats,...s.defender?[s.defender]:[],...s.enemies];
      for(let i=0;i<boats.length;i++)for(let j=i+1;j<boats.length;j++){
        const a=boats[i],b=boats[j],radius=(h:typeof a)=>c.navigation.traffic!.radii[h.id==='defender'?'defender':'kind' in h?h.kind:'pirate'];
        const overlap=radius(a)+radius(b)-distance(a,b);if(overlap>.5){overlapSamples++;maxOverlap=Math.max(maxOverlap,overlap);}
      }
    }
  }
  const elapsed=performance.now()-start;
  return {seconds,fleet:s.boats.length+(s.defender?1:0),successfulDeliveries:s.stats.deliver_fish??0,metalDelivered:s.stats.metal_deposited??0,issuedFishIncome,collectedFishIncome:s.stats.fish_sales_earned??0,deliveriesByBoat:counts,stuckBoats:[...last].filter(([,p])=>p.still>5).map(([id])=>id),blockedBoatSeconds:Math.round(blockedBoatSeconds*10)/10,maxPortWaitS:Math.round(maxPortWait*10)/10,illegalPositions,overlapSamples,maxOverlap,cpuMs:Math.round(elapsed),engineMsPerSimulationStep:engineCpuMs/(seconds*30),msPerSimulationStep:elapsed/(seconds*30),metrics:trafficMetrics(s),piratesKilled:s.stats.pirates_killed??0};
}
