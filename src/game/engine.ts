import type { Balance, Point } from '../config/types';
import { newState, type GameState } from './state';
import { activateQuest, updateQuests, claimQuest } from './systems/quests';
import { updateConstruction, updatePurchases, pay, skipTimer, revealPurchases } from './systems/construction';
import { available, harvest, pickup, updateResources } from './systems/resources';
import { deposit, collectCoins, goldenReward, waterLootPoint, spawnCoins } from './systems/economy';
import { updateWorker } from './systems/workers';
import { clampToWorld, resolveLand, distance, moveBoat, syncBuildingObstacles } from './systems/movement';
import { beginTraffic, endTraffic, parkIdleTraffic } from './systems/traffic';
import { updateCombat } from './systems/combat';
import { updateMerchant } from './systems/merchant';
import { log } from '../debug/events';
export class Engine {
  state: GameState;
  input: Point={x:0,y:0}; speed=1; paused=false;
  private controlLocks=new Set<string>();
  get controlsLocked(){return this.controlLocks.size>0;}
  lockControls(reason:string){this.controlLocks.add(reason);this.input={x:0,y:0};}
  unlockControls(reason:string){this.controlLocks.delete(reason);}
  constructor(public config: Balance,state?: GameState) { this.state=state??newState(config); if(!state) activateQuest(config,this.state);revealPurchases(config,this.state);syncBuildingObstacles(config,this.state); }
  update(realDt: number) { if(this.paused) return; let remaining=realDt*this.speed; while(remaining>1e-9) { const dt=Math.min(remaining,this.config.simulation.dt_s,1/30); this.tick(dt); remaining-=dt; } }
  private tick(dt: number) {
    const c=this.config,s=this.state; s.time+=dt;
    updateConstruction(c,s); syncBuildingObstacles(c,s); updateResources(c,s);
    const player=s.boats[0],previous={x:player.x,y:player.y}; const length=Math.hypot(this.input.x,this.input.y);
    beginTraffic(c,s,dt,this.controlsLocked?{x:0,y:0}:this.input);
    if(length>0 && player.hp>0 && !this.controlsLocked) { const scale=Math.min(1,length)/length; moveBoat(c,player,this.input.x*scale*c.units.player.speed*dt,this.input.y*scale*c.units.player.speed*dt,dt,s.area);player.angle=Math.atan2(this.input.y,this.input.x); }
    clampToWorld(player,c,s.area);
    resolveLand(c,player);
    if(player.hp>0) {
      pickup(c,s,player); deposit(c,s,player,dt);
      const id=Object.keys(c.resources).filter(id=>available(c,s,id) && distance(player,c.resources[id])<=c.world.resource_radius).sort((a,b)=>distance(player,c.resources[a])-distance(player,c.resources[b]))[0];
      if(id) { if(player.target!==id) player.gather=0; player.target=id; harvest(c,s,player,id,dt); } else { player.target=null; player.gather=0; }
    }
    for(const b of s.boats.slice(1)) updateWorker(c,s,b,dt);
    parkIdleTraffic(s,dt);
    collectCoins(c,s,dt); updatePurchases(c,s,dt,Math.max(distance(previous,player)/dt,length>0&&c.navigation.traffic?Math.min(1,length)*c.units.player.speed:0),this.controlsLocked);
    updateCombat(c,s,dt);
    updateMerchant(c,s,dt);
    endTraffic(s);
    updateQuests(c,s); revealPurchases(c,s);
  }
  purchase(id: string) { const ok=pay(this.config,this.state,id); updateConstruction(this.config,this.state); updateQuests(this.config,this.state); return ok; }
  claimQuest(id: number) { const claimed=claimQuest(this.config,this.state,id);if(claimed)revealPurchases(this.config,this.state);return claimed; }
  skip(id: string,confirmed=false) { const ok=skipTimer(this.config,this.state,id,confirmed); updateQuests(this.config,this.state); return ok; }
  openGoldenOffer(){
    const c=this.config,s=this.state,g=s.golden;if(g.expires===null || s.time>=g.expires)return null;
    if(g.offerId===null)g.offerId=s.nextId++;
    if(g.transaction?.offerId===g.offerId && ['offered','watching'].includes(g.transaction.status))return g.transaction;
    g.transaction={id:s.nextId++,offerId:g.offerId,reward:goldenReward(c,s),status:'offered',pileIds:[]};
    log(s,c.save.max_events,'golden_offer',{id:g.transaction.id,offerId:g.offerId,coins:g.transaction.reward});return g.transaction;
  }
  beginGoldenReward(id:number){const s=this.state,g=s.golden,t=g.transaction;if(!t || t.id!==id || t.offerId!==g.offerId || t.status!=='offered' || g.expires===null || s.time>=g.expires)return false;t.status='watching';log(s,this.config.save.max_events,'golden_reward_started',{id,offerId:t.offerId,coins:t.reward});return true;}
  cancelGoldenReward(id:number){const t=this.state.golden.transaction;if(!t || t.id!==id || !['offered','watching'].includes(t.status))return false;t.status='cancelled';log(this.state,this.config.save.max_events,'golden_reward_cancelled',{id});return true;}
  claimGolden(confirmed: boolean,id=this.state.golden.transaction?.id) {
    const c=this.config,s=this.state,g=s.golden,t=g.transaction;
    if(!confirmed || !t || t.id!==id || t.status!=='watching' || t.offerId!==g.offerId)return false;
    // A confirmed ad accepted during the lifetime keeps its immutable snapshot through expiry.
    const count=c.presentation.golden_pile_count,base=Math.floor(t.reward/count),remainder=t.reward%count,points:Point[]=[];
    for(let i=0;i<count;i++){const point=waterLootPoint(c,s,s.boats[0],i*Math.PI*2/count,c.presentation.golden_scatter_radius,points);points.push(point);const pile=spawnCoins(c,s,base+(i<remainder?1:0),'golden_reward',s.boats[0],{transaction:t.id},point);t.pileIds.push(pile.id);}
    t.status='spawned';g.expires=null;g.origin=null;g.nextAt=s.time+c.monetization.golden_cooldown_claimed_s;
    log(s,c.save.max_events,'rewarded',{source:'golden',coins:t.reward,transaction:t.id});log(s,c.save.max_events,'reward',{source:'golden',coins:t.reward,transaction:t.id,delivery:'physical'});return true;
  }
  settleOffline(seconds: number) {
    // Only timers progress offline; no fishing, sales, combat or quest-revenue simulation.
    this.state.time+=Math.max(0,seconds); updateConstruction(this.config,this.state); updateResources(this.config,this.state);
    if(this.state.golden.expires!==null && this.state.time>=this.state.golden.expires && this.state.golden.transaction?.status!=='watching') { this.state.golden.expires=null;this.state.golden.origin=null; this.state.golden.nextAt=this.state.time+this.config.monetization.golden_cooldown_missed_s; }
    updateQuests(this.config,this.state); log(this.state,this.config.save.max_events,'loaded',{offlineSeconds:seconds});
  }
}
