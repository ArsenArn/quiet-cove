import type { Balance } from '../../config/types';
import type { GameState } from '../state';
import { random } from '../state';
import { onLand, clampToWorld, resolveLand } from './movement';
import { log } from '../../debug/events';
export function updateMerchant(c: Balance,s: GameState,dt:number) {
  const g=s.golden;
  if(g.expires!==null && s.time>=g.expires && g.transaction?.status!=='watching'){g.expires=null;g.origin=null;g.nextAt=s.time+c.monetization.golden_cooldown_missed_s;log(s,c.save.max_events,'golden_missed');return;}
  if(g.expires===null && s.time>=g.nextAt){
    const p=s.boats[0],start=random(s)*Math.PI*2;let point={x:p.x+c.presentation.golden_spawn_radius,y:p.y};
    for(let i=0;i<16;i++){const a=start+i*Math.PI/8;point={x:p.x+Math.cos(a)*c.presentation.golden_spawn_radius,y:p.y+Math.sin(a)*c.presentation.golden_spawn_radius};clampToWorld(point,c,s.area);if(!onLand(c,point,50))break;}
    resolveLand(c,point);Object.assign(g,point);g.angle=start;g.origin={...point};g.offerId=s.nextId++;g.transaction=null;g.expires=s.time+c.monetization.golden_lifetime_s;log(s,c.save.max_events,'golden_arrived',{id:g.offerId,x:g.x,y:g.y});
  }
  if(g.expires===null || !g.origin || dt<=0)return;
  const age=s.time-(g.expires-c.monetization.golden_lifetime_s),a=age*c.presentation.golden_speed/60;
  const next={x:g.origin.x+Math.sin(a)*60,y:g.origin.y+(1-Math.cos(a))*40};clampToWorld(next,c,s.area);
  if(!onLand(c,next)){g.angle=Math.atan2(next.y-g.y,next.x-g.x);g.x=next.x;g.y=next.y;}
}
