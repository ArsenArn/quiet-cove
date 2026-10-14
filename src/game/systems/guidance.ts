import type {Balance,Point} from '../../config/types';
import type {GameState} from '../state';
import {onLand,clampToWorld,resolveLand} from './movement';
import {fishUnload} from './delivery';
export function questOfferId(c:Balance,s:GameState):string|null {
 const q=c.quests[s.questIndex];if(!q)return null;
 const mapping:Record<string,string>={resource_ready:`resource:${q.target}`,cargo_level:`cargo:${s.cargoLevel+1}`,normal_workers:`worker:${s.boats.filter(b=>b.kind==='worker').length}`,salvage_workers:`salvage:${s.boats.filter(b=>b.kind==='salvage').length}`,speedboat_ordered:'speedboat',speedboat_ready:'speedboat',area_unlocked:'gate',defender_ready:'defender',metal_storage_ready:'storage',metal_cutter_owned:'cutter',wreck_ready:'resource:wreck',metal_storage_capacity:'storageUpgrade',pirate_den_closed:'den',expedition_route_ready:'route'};
 return mapping[q.type]??null;
}
export function questFocusTarget(c:Balance,s:GameState):Point {
 const q=c.quests[s.questIndex],order=questOfferId(c,s),p=s.boats[0];let target:Point|undefined;
 if(order)target=order.startsWith('resource:')?c.resources[order.split(':')[1]]:c.interaction.purchase_points[order.split(':')[0]];
 else if(q?.type==='pirates_killed')target=c.combat.spawner;
 else if(q?.type==='metal_deposited')target=p.cargo.some(i=>i.kind==='metal')?c.world.storage:c.resources.wreck;
 else if(q?.type==='fish_sales_earned' || q?.type==='earn_coins')target=fishUnload(c,s);
 else if(q?.type==='deliver_fish' && p.cargo.some(i=>i.kind==='fish'))target=fishUnload(c,s);
 else if(q)target=Object.entries(c.resources).filter(([id,r])=>s.nodes[id]?.unlocked&&r.zone<=s.area&&r.kind==='fish').sort((a,b)=>b[1].value-a[1].value)[0]?.[1];
 const result={...(target??fishUnload(c,s))};clampToWorld(result,c,s.area);if(q?.type!=='pirates_killed' && onLand(c,result))resolveLand(c,result);return result;
}
export type CameraMode='FOLLOW_PLAYER'|'FOCUS_TARGET'|'RETURN_TO_PLAYER';
// claimQuest activates and evaluates the next quest before presentation runs.
export function nextQuestHintTarget(c:Balance,s:GameState):Point|null {
 return c.quests[s.questIndex] && s.questStatus==='active'?questFocusTarget(c,s):null;
}
// Wall-clock presentation controller; game timers keep running independently.
export class CameraGuidance {
 mode:CameraMode='FOLLOW_PLAYER';target:Point|null=null;private start:Point={x:0,y:0};private elapsed=0;
 begin(start:Point,target:Point){this.start={...start};this.target={...target};this.elapsed=0;this.mode='FOCUS_TARGET';}
 cancel(){this.mode='FOLLOW_PLAYER';this.target=null;this.elapsed=0;}
 step(dt:number,player:Point,c:Balance['presentation']):Point {
  if(this.mode==='FOLLOW_PLAYER')return {...player};this.elapsed+=Math.max(0,dt);
  const move=c.camera_move_duration_s,focus=c.camera_focus_duration_s,ret=c.camera_return_duration_s;
  const smooth=(n:number)=>{const x=Math.max(0,Math.min(1,n));return x*x*(3-2*x);};
  const lerp=(a:Point,b:Point,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  if(!this.target){if(this.elapsed<ret)return lerp(this.start,player,smooth(this.elapsed/ret));this.cancel();return {...player};}
  if(this.elapsed<move)return lerp(this.start,this.target,smooth(this.elapsed/move));
  if(this.elapsed<move+focus)return {...this.target};
  this.mode='RETURN_TO_PLAYER';
  if(this.elapsed<move+focus+ret)return lerp(this.target,player,smooth((this.elapsed-move-focus)/ret));
  this.cancel();return {...player};
 }
 get highlighting(){return this.mode==='FOCUS_TARGET' && this.target!==null;}
}
