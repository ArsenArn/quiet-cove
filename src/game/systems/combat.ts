import type { Balance } from '../../config/types';
import type { Boat, Enemy, GameState } from '../state';
import { distance, moveTo, navigateTo, onLand, clearSegment, clampToWorld } from './movement';
import { log } from '../../debug/events';
function attack(c: Balance,s: GameState,a: Boat | Enemy,target: Boat | Enemy,faction: 'friendly' | 'pirate',damage: number) {
  if(s.time<a.attackAt || distance(a,target)>c.combat.attack_radius) return;
  a.attackAt=s.time+c.combat.attack_s;
  s.projectiles.push({x:a.x,y:a.y,id:s.nextId++,target:target.id,faction,damage,expires:s.time+c.combat.projectile_lifetime_s});
  log(s,c.save.max_events,'combat_attack',{id:s.projectiles.at(-1)!.id,boat:a.id,target:target.id,x:a.x,y:a.y,toX:target.x,toY:target.y});
}
// Shared home stays the chase anchor. Only the water arrival positions are spread.
const homeArrivals=new WeakMap<Enemy,{index:number;point:{x:number;y:number}}>();
function pirateSpawn(c:Balance,s:GameState,home:{x:number;y:number},offset:number){
  const initial={x:home.x+offset,y:home.y};if(!c.navigation.traffic)return initial;
  const settings=c.navigation.traffic,hulls=[...s.boats,...s.defender&&s.defender.hp>0?[s.defender]:[],...s.enemies];
  for(let i=0;i<65;i++){
    const angle=(i-1)*Math.PI/4,radius=i===0?0:Math.ceil(i/8)*(settings.radii.pirate*2+12),point={x:initial.x+Math.cos(angle)*radius,y:initial.y+Math.sin(angle)*radius},clamped={...point};clampToWorld(clamped,c,s.area);
    if(distance(point,clamped)>.01 || onLand(c,point) || !clearSegment(c,home,point) || distance(point,home)>c.combat.chase_radius)continue;
    if(hulls.every(h=>{if('kind' in h && h.kind==='player' && h.hp<=0)return true;const kind=h.id==='defender'?'defender':'kind' in h?h.kind:'pirate';return distance(h,point)>=settings.radii.pirate+settings.radii[kind]+6;}))return point;
  }
  // Extremely crowded imported/debug states use the same bounded separation as saves.
  return initial;
}
function homeArrival(c:Balance,s:GameState,e:Enemy,index:number){
  if(!c.navigation.traffic)return e.home;
  const cached=homeArrivals.get(e);if(cached?.index===index)return cached.point;
  const radius=c.navigation.traffic.radii.pirate*2+c.navigation.traffic.arrival_spacing;
  const angle=index*Math.PI*2/c.combat.max_enemies,point={x:e.home.x+Math.cos(angle)*radius,y:e.home.y+Math.sin(angle)*radius},clamped={...point};clampToWorld(clamped,c,s.area);
  const goal=distance(point,clamped)<.01 && !onLand(c,point) && clearSegment(c,e.home,point)?point:e.home;
  homeArrivals.set(e,{index,point:goal});return goal;
}
export function spawnerProgress(c:Balance,s:GameState) {
  if(s.flags.den)return {status:'closed' as const,fraction:1,remaining:0};
  if((c.profile==='fast'?s.enemies.filter(e=>e.hp>0).length:s.enemies.length)>=c.combat.max_enemies)return {status:'waiting_slot' as const,fraction:c.profile==='fast'?0:1,remaining:null};
  if(c.profile==='fast' && s.pirateSpawnBlocked)return {status:'countdown' as const,fraction:0,remaining:c.combat.spawn_s};
  return {status:'countdown' as const,fraction:Math.max(0,Math.min(1,1-(s.nextPirateAt-s.time)/c.combat.spawn_s)),remaining:Math.max(0,s.nextPirateAt-s.time)};
}
export function updateCombat(c: Balance,s: GameState,dt: number) {
  const p=s.boats[0],regen=c.player_regen??{delay_s:5,hp_per_s:c.units.player.hp*.1};
  if(p.hp>0 && p.hp<c.units.player.hp){const eligible=Math.min(dt,Math.max(0,s.time-(s.playerLastDamageAt??s.time)-regen.delay_s));p.hp=Math.min(c.units.player.hp,p.hp+eligible*regen.hp_per_s);}
  if(s.area<2) return;
  const player=s.boats[0],def=s.defender;
  if(c.profile==='fast') {
    // Retire surplus pirates from old saves without awarding kills or rewards.
    s.enemies=s.enemies.filter(e=>e.hp>0).slice(0,c.combat.max_enemies);
    if(s.enemies.length>=c.combat.max_enemies){s.pirateSpawnBlocked=true;s.nextPirateAt=s.time+c.combat.spawn_s;}
    else if(s.pirateSpawnBlocked){s.pirateSpawnBlocked=false;s.nextPirateAt=s.time+c.combat.spawn_s;}
  }
  if(!s.flags.den && s.time>=s.nextPirateAt && s.enemies.length<c.combat.max_enemies) {
    const home={x:c.combat.spawner.x+110,y:c.combat.spawner.y}; const offset=s.enemies.length*(c.navigation.traffic?c.navigation.traffic.radii.pirate*2+c.navigation.traffic.arrival_spacing:c.world.arrival_radius);
    s.enemies.push({...pirateSpawn(c,s,home,offset),id:`pirate:${s.nextId++}`,home,hp:c.combat.pirate_hp,angle:0,attackAt:0,state:'PATROL',target:null}); s.nextPirateAt=s.time+c.combat.spawn_s; log(s,c.save.max_events,'pirate_spawn');
  }
  const allies=[player,...def?[def]:[]].filter(b=>b.hp>0 && b.x>=c.world.gate_x);
  for(const enemy of s.enemies) {
    const close=allies.filter(b=>distance(enemy,b)<=c.combat.detect_radius).sort((a,b)=>distance(enemy,a)-distance(enemy,b))[0];
    if(distance(enemy,enemy.home)>c.combat.chase_radius) { enemy.state='RETURN'; enemy.target=null; }
    if(enemy.state==='RETURN') { if(navigateTo(c,enemy,homeArrival(c,s,enemy,s.enemies.indexOf(enemy)),c.combat.pirate_speed,dt,s.area,c.world.arrival_radius)) enemy.state='PATROL'; }
    else {
      const prior=allies.find(b=>b.id===enemy.target && distance(b,enemy.home)<=c.combat.chase_radius);
      const target=prior??close;
      if(target) { enemy.state='CHASE'; enemy.target=target.id; navigateTo(c,enemy,target,c.combat.pirate_speed,dt,s.area,c.combat.attack_radius*0.7); attack(c,s,enemy,target,'pirate',c.combat.pirate_damage); }
      else { enemy.state='RETURN'; enemy.target=null; }
    }
  }
  if(def) {
    if(def.hp<=0 && s.time>=def.respawnAt) { def.hp=c.combat.defender_hp; Object.assign(def,c.combat.defender_spawn); log(s,c.save.max_events,'defender_repaired'); }
    if(def.hp>0) {
      const home=c.combat.defender_home??c.combat.defender_spawn;
      const target=s.enemies.filter(e=>e.x>=c.world.gate_x+c.world.edge_margin && distance(e,home)<=c.combat.chase_radius && distance(def,e)<=c.combat.chase_radius).sort((a,b)=>distance(def,a)-distance(def,b))[0];
      if(target) {def.target=target.id;navigateTo(c,def,target,c.combat.defender_speed,dt,s.area,c.combat.attack_radius*0.65); attack(c,s,def,target,'friendly',c.combat.defender_damage);}
      else {def.target=null;def.patrolIndex=(def.patrolIndex??0)%c.presentation.defender_patrol.length;const point=c.presentation.defender_patrol[def.patrolIndex];if(navigateTo(c,def,point,c.combat.defender_speed,dt,s.area,12))def.patrolIndex=(def.patrolIndex+1)%c.presentation.defender_patrol.length;}
      def.x=Math.max(c.world.gate_x+c.world.edge_margin,def.x);
    }
  }
  if(player.hp>0) { const target=s.enemies.filter(e=>distance(player,e)<=c.combat.attack_radius).sort((a,b)=>distance(player,a)-distance(player,b))[0]; if(target) attack(c,s,player,target,'friendly',c.units.player.damage); }
  else if(s.time>=player.respawnAt) { player.hp=c.units.player.hp; Object.assign(player,c.world.spawn); log(s,c.save.max_events,'player_repaired'); }
  for(let i=s.projectiles.length-1;i>=0;i--) {
    const p=s.projectiles[i],target=p.faction==='friendly'?s.enemies.find(e=>e.id===p.target):[player,...def?[def]:[]].find(b=>b.id===p.target);
    if(!target || target.hp<=0 || s.time>=p.expires) { s.projectiles.splice(i,1); continue; }
    const projectile={...p,angle:0}; const hit=moveTo(projectile,target,c.combat.projectile_speed,dt,c.world.pickup_radius*0.25); p.x=projectile.x;p.y=projectile.y;
    if(hit) {
      log(s,c.save.max_events,'combat_hit',{target:target.id,x:target.x,y:target.y,damage:p.damage});
      if(target.id==='player')s.playerLastDamageAt=s.time;
      target.hp=Math.max(0,target.hp-p.damage); s.projectiles.splice(i,1);
      if(target.hp===0) {
        if(p.faction==='friendly') { s.enemies=s.enemies.filter(e=>e.id!==target.id); s.stats.pirates_killed=(s.stats.pirates_killed??0)+1; log(s,c.save.max_events,'pirate_killed',{id:target.id,x:target.x,y:target.y,angle:target.angle}); }
        else { const boat=target as Boat; boat.respawnAt=s.time+c.combat.respawn_s; if(boat.id==='player') Object.assign(boat,c.world.spawn); log(s,c.save.max_events,'boat_disabled',{id:boat.id}); }
      }
    }
  }
  if(c.profile==='fast' && !s.flags.den) {
    if(s.enemies.length>=c.combat.max_enemies){s.pirateSpawnBlocked=true;s.nextPirateAt=s.time+c.combat.spawn_s;}
    else if(s.pirateSpawnBlocked){s.pirateSpawnBlocked=false;s.nextPirateAt=s.time+c.combat.spawn_s;}
  }
}
