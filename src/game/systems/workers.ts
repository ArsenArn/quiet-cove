import type { Balance } from '../../config/types';
import type { Boat, GameState } from '../state';
import { random } from '../state';
import { available, harvest, pickup } from './resources';
import { capacity, deposit, storageCapacity } from './economy';
import { distance, moveTo, navigateTo } from './movement';
import { arrivalPosition } from './traffic';
import {fishUnload,fishPortKey} from './delivery';
export function releaseCrates(s: GameState,b: Boat) { for(const crate of s.crates) if(crate.reservedBy===b.id) crate.reservedBy=null; }
function nearestCrate(c: Balance,s: GameState,b: Boat) {
  const kind=b.kind==='salvage'?'metal':'fish';
  return s.crates.filter(p=>(p.expiresAt===undefined || s.time<p.expiresAt) && p.kind===kind && (!p.reservedBy || p.reservedBy===b.id) && c.resources[p.resource].zone<=s.area && (kind==='fish' || (s.flags.cutter && s.flags.storage)) && distance(b,p)<=c.world.worker_pickup_radius).sort((a,z)=>distance(b,a)-distance(b,z))[0];
}
export function selectTarget(c: Balance,s: GameState,b: Boat,rng=()=>random(s)): string | number | null {
  releaseCrates(s,b);
  const kind=b.kind==='salvage'?'metal':'fish';
  const loose=nearestCrate(c,s,b);
  if(loose) { loose.reservedBy=b.id; return loose.id; }
  const nodes=Object.keys(c.resources).filter(id=>c.resources[id].kind===kind && available(c,s,id)).sort((a,z)=>c.resources[z].value-c.resources[a].value);
  if(!nodes.length) return null;
  return rng()<c.ai.choose_best_probability?nodes[0]:nodes[Math.min(nodes.length-1,Math.floor(rng()*nodes.length))];
}
export function updateWorker(c: Balance,s: GameState,b: Boat,dt: number) {
  const full=b.cargo.length>=capacity(c,s,b);
  const storageFull=c.profile!=='fast' && b.kind==='salvage' && s.metal>=storageCapacity(c,s);
  if(full && !['RETURN','UNLOAD'].includes(b.state)) { releaseCrates(s,b); delete b.resume;b.target=null; b.gather=0; b.state='RETURN'; }
  if(['RETURN','UNLOAD'].includes(b.state)) {
    const destination=b.kind==='salvage'?c.world.storage:fishUnload(c,s,b);
    const arrival=arrivalPosition(b,b.kind==='salvage'?'storage':fishPortKey(destination),destination,c.world.deposit_radius);
    if(!c.navigation.traffic || distance(b,destination)>c.world.deposit_radius)navigateTo(c,b,arrival,c.units[b.kind].speed,dt,s.area,arrival===destination?c.world.deposit_radius*0.65:1);
    deposit(c,s,b,dt);
    if(!b.cargo.length) { b.state=storageFull?'WAIT':'SELECT'; b.target=null; }
    return;
  }
  if(storageFull) { releaseCrates(s,b); b.target=null; b.state=b.cargo.length?'RETURN':'WAIT'; return; }
  pickup(c,s,b);
  if(b.cargo.length>=capacity(c,s,b)) { b.state='RETURN'; releaseCrates(s,b); delete b.resume;b.target=null;b.gather=0;return; }
  if(b.target===null && b.resume) {
    const prior=b.resume; delete b.resume;
    if(available(c,s,prior.target)) { b.target=prior.target; b.gather=prior.gather; b.state='TO_PICKUP'; }
  }
  // A reserved crate remains the target until collected or gone. Never switch crate-to-crate.
  if(typeof b.target==='string' && ['TO_PICKUP','GATHER'].includes(b.state)) {
    const loose=nearestCrate(c,s,b);
    if(loose) { b.resume={target:b.target,gather:b.gather}; loose.reservedBy=b.id; b.target=loose.id; b.state='TO_PICKUP'; b.gather=0; }
  }
  if(b.state==='SELECT' || b.state==='WAIT' || b.target===null) { b.target=selectTarget(c,s,b); b.gather=0; b.state=b.target===null?(b.cargo.length?'RETURN':'WAIT'):'TO_PICKUP'; }
  if(b.target===null) return;
  if(typeof b.target==='number') {
    const crate=s.crates.find(p=>p.id===b.target);
    if(!crate || crate.reservedBy!==b.id) { b.target=null; b.state='SELECT'; return; }
    navigateTo(c,b,crate,c.units[b.kind].speed,dt,s.area,c.world.pickup_radius*0.5); pickup(c,s,b);
    if(!s.crates.some(p=>p.id===b.target)) { b.target=null; b.state='SELECT'; }
  } else {
    if(!available(c,s,b.target)) { b.target=null; b.gather=0; b.state=b.cargo.length?'RETURN':'SELECT'; return; }
    const node=c.resources[b.target],arrival=arrivalPosition(b,`resource:${b.target}`,node,c.world.resource_radius);
    const inPosition=c.navigation.traffic && distance(b,node)<=c.world.resource_radius && (b.state==='GATHER'||distance(b,arrival)<=c.world.arrival_radius);
    if((inPosition || navigateTo(c,b,arrival,c.units[b.kind].speed,dt,s.area,arrival===node?c.world.resource_radius*0.7:1)) && distance(b,node)<=c.world.resource_radius) { b.state='GATHER'; harvest(c,s,b,b.target,dt); }
  }
}
