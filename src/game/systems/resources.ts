import type { Balance } from '../../config/types';
import type { Boat, GameState } from '../state';
import { random } from '../state';
import { capacity, waterLootPoint } from './economy';
import { distance } from './movement';
import { log } from '../../debug/events';
export function available(c: Balance,s: GameState,id: string) { const n=s.nodes[id],r=c.resources[id]; return !!n && n.unlocked && r.zone<=s.area && n.phase==='ready' && n.hp>0 && n.stock>0 && (r.kind==='fish' || !!(s.flags.storage && s.flags.cutter)); }
export function updateResources(c: Balance,s: GameState) {
  s.crates=s.crates.filter(crate=>{
    if(crate.expiresAt===undefined)crate.expiresAt=s.time+c.world.floating_crate_lifetime_s;
    if(s.time<crate.expiresAt)return true;
    log(s,c.save.max_events,'crate_expired',{id:crate.id});return false;
  });
  for (const [id,n] of Object.entries(s.nodes)) if(n.unlocked && n.phase!=='ready' && s.time>=n.readyAt) { if(n.phase==='restock') n.stock=c.resources[id].stock; n.hp=c.resources[id].portion_hp; n.phase='ready'; log(s,c.save.max_events,'resource_recovered',{id}); }
}
export function gatherDuration(c: Balance,b: Boat,id: string) { return c.resources[id].gather_s*c.units[b.kind].gather_s/c.units.player.gather_s; }
export function acquire(c: Balance,s: GameState,b: Boat,id: string,crateId?: number) {
  if(b.cargo.length>=capacity(c,s,b)) return false;
  const r=c.resources[id]; b.cargo.push({id:crateId??s.nextId++,resource:id,kind:r.kind,value:r.value});
  const source=crateId===undefined?'active_catch':'crate_pickup',actor=b.kind==='player'?'player':'worker';
  if(r.kind==='fish') {
    for(const key of ['fish_received',`fish_received_${actor}`,`${source}_total`,`${source}_${actor}`]) s.stats[key]=(s.stats[key]??0)+1;
    if(source==='active_catch') { s.stats.catch_total=(s.stats.catch_total??0)+1; if(id==='sardine') s.stats.catch_sardine=(s.stats.catch_sardine??0)+1; }
  }
  const origin=crateId===undefined?r:s.crates.find(crate=>crate.id===crateId)??b;
  log(s,c.save.max_events,source==='active_catch'?'harvest':'crate_pickup',{boat:b.id,actor,resource:id,crate:b.cargo.at(-1)!.id,x:origin.x,y:origin.y}); return true;
}
export function harvest(c: Balance,s: GameState,b: Boat,id: string,dt: number) {
  if(!available(c,s,id) || b.cargo.length>=capacity(c,s,b) || distance(b,c.resources[id])>c.world.resource_radius) { b.gather=0; return; }
  b.gather+=dt;
  if(b.gather+1e-9<gatherDuration(c,b,id)) return;
  b.gather=0; acquire(c,s,b,id);
  const n=s.nodes[id],r=c.resources[id]; n.hp=Math.max(0,n.hp-r.damage_per_catch);
  if(n.hp===0) {
    n.stock--; n.phase=n.stock>0?'regrow':'restock'; n.readyAt=s.time+(n.stock>0?r.regrow_s:r.restock_s);
    const count=Math.min(r.drop_crates,Math.max(0,c.world.max_world_resource_crates-s.crates.length)),points: {x:number;y:number}[]=[];
    const phase=random(s)*Math.PI*2;
    for(let i=0;i<count;i++) {
      const point=waterLootPoint(c,s,r,phase+i*Math.PI*2/Math.max(1,count),c.world.crate_scatter_radius,points);points.push(point);
      const crate={id:s.nextId++,resource:id,kind:r.kind,value:r.value,...point,reservedBy:null,expiresAt:s.time+c.world.floating_crate_lifetime_s};s.crates.push(crate);
      log(s,c.save.max_events,'crate_spawn',{id:crate.id,resource:id,x:point.x,y:point.y,fromX:r.x,fromY:r.y});
    }
    if(count<r.drop_crates)log(s,c.save.max_events,'crate_spawn_limited',{resource:id,requested:r.drop_crates,spawned:count,policy:'omit_overflow'});
    log(s,c.save.max_events,'resource_depleted',{id,phase:n.phase,readyAt:n.readyAt});
  }
}
export function pickup(c: Balance,s: GameState,b: Boat) {
  for(let i=s.crates.length-1;i>=0;i--) { const crate=s.crates[i];
    if(crate.expiresAt!==undefined && s.time>=crate.expiresAt)continue;
    if(b.cargo.length>=capacity(c,s,b)) break;
    if(b.kind==='salvage' ? crate.kind!=='metal' : (b.kind!=='player' && crate.kind!=='fish')) continue;
    if(crate.kind==='metal' && !(s.flags.cutter && s.flags.storage)) continue;
    if(crate.reservedBy && crate.reservedBy!==b.id) continue;
    if(distance(b,crate)<=c.world.pickup_radius) { if(acquire(c,s,b,crate.resource,crate.id)) s.crates.splice(i,1); }
  }
}
