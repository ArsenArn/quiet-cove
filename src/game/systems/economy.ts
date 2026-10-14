import type { Balance, Point } from '../../config/types';
import type { Boat, GameState, CoinStack, IncomeSource } from '../state';
import { distance, clampToWorld, onLand, resolveLand, routeTo } from './movement';
import { log } from '../../debug/events';
import {fishUnload,fishPorts} from './delivery';
export function workerCost(c: Balance, count: number) {
  if(c.profile==='reference') {
    // Shipped 1.0.2 GameConfig.WorkerCost VA 0x244e8a8 uses stepped rounding;
    // the previously reconstructed RoundEven formula belongs to 1.0.1.
    const raw=Math.fround(Math.fround(c.workers.base_cost)*Math.fround(Math.fround(c.workers.cost_growth)**count));
    const step=raw<500?25:raw<2000?50:raw<10000?100:1000;
    return Math.fround(step*Math.floor(Math.fround(Math.fround(raw/step)+.5)));
  }
  return Math.round(c.workers.base_cost * c.workers.cost_growth ** count);
}
export function capacity(c: Balance, s: GameState, b: Boat) { return b.kind === 'player' ? c.units.player.capacity[s.cargoLevel] : c.units[b.kind].capacity; }
export function storageCapacity(c: Balance,s: GameState) { return s.flags.storageUpgrade ? c.salvage.upgrade.capacity : c.salvage.storage.capacity; }
export function deposit(c: Balance,s: GameState,b: Boat,dt: number) {
  if (!b.cargo.length) { b.unload = 0; return; }
  const port=fishPorts(c,s).find(p=>distance(b,p)<=c.world.deposit_radius)??fishUnload(c,s,b),overflowAllowed=c.profile==='fast';
  const item = b.cargo.find(i => distance(b,i.kind === 'fish' ? port : c.world.storage) <= c.world.deposit_radius && (i.kind === 'fish' || s.flags.storage));
  if (!item) { b.unload = 0; return; }
  if (!overflowAllowed && item.kind === 'metal' && s.metal >= storageCapacity(c,s)) return;
  b.state = 'UNLOAD'; b.unload += dt;
  while (b.unload >= c.units.player.deposit_s_per_crate && b.cargo.some(i => i.kind === item.kind)) {
    if (!overflowAllowed && item.kind === 'metal' && s.metal >= storageCapacity(c,s)) break;
    const crate = b.cargo.splice(b.cargo.findIndex(i => i.kind === item.kind),1)[0]; b.unload -= c.units.player.deposit_s_per_crate;
    if (crate.kind === 'fish') { s.stats.deliver_fish = (s.stats.deliver_fish ?? 0)+1; }
    const accepted=crate.kind==='metal'?Number(s.metal<storageCapacity(c,s)):0;
    if(crate.kind==='metal') {
      s.metal+=accepted;
      s.stats.metal_deposited=(s.stats.metal_deposited??0)+1;
      if(!accepted){s.stats.metal_discarded=(s.stats.metal_discarded??0)+1;log(s,c.save.max_events,'metal_overflow',{boat:b.id,crate:crate.id,amount:1,x:b.x,y:b.y});}
    }
    log(s,c.save.max_events,'delivery',{boat:b.id,crate:crate.id,resource:crate.resource,kind:crate.kind,value:crate.value,x:b.x,y:b.y,...crate.kind==='metal'&&overflowAllowed?{accepted_metal:accepted}:{}});
    if(crate.kind==='fish') spawnCoins(c,s,crate.value,'fish_sale',port,{crate:crate.id,boat:b.id});
  }
}
export function waterLootPoint(c:Balance,s:GameState,center:Point,angle:number,radius:number,avoid:Point[]=[]):Point {
  for(let i=0;i<128;i++){
    const a=angle+i*Math.PI/16,r=radius*(1+Math.floor(i/32)*.25),point={x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r};
    const before={...point};clampToWorld(point,c,s.area);
    if(distance(before,point)<.01 && !onLand(c,point) && distance(point,center)>=radius*.9 && avoid.every(p=>distance(p,point)>12) && routeTo(c,center,point,s.area).length)return point;
  }
  const fallback={...center};clampToWorld(fallback,c,s.area);resolveLand(c,fallback);return fallback;
}
export function spawnCoins(c: Balance,s: GameState,value: number,source:CoinStack['source']='fish_sale',center:Point=fishUnload(c,s),meta:Pick<CoinStack,'crate'|'boat'|'transaction'>={},point?:Point) {
  // One payout per delivered crate. A visual limit never changes this data.
  const id=s.nextId++,angle=id*2.399963229728653,radius=c.interaction.coin_scatter_radius*Math.sqrt((id%17+1)/17);
  const position=point??(source==='fish_sale'&&fishPorts(c,s).some(p=>distance(center,p)<.01)?portCoinPoint(c,s,id,center):waterLootPoint(c,s,center,angle,radius));
  const coin:CoinStack={id,value,x:position.x,y:position.y,availableAt:s.time+c.interaction.coin_delay_s,attracting:false,source,...meta};s.coinStacks.push(coin);
  log(s,c.save.max_events,'coin_spawn',{id,value,source,...meta,x:coin.x,y:coin.y,fromX:center.x,fromY:center.y});return coin;
}
// New unload payouts occupy a narrow outer crescent facing the player's arrival side.
// Deterministic IDs choose a position without consuming gameplay RNG or changing payout data.
export function portCoinPoint(c:Balance,s:GameState,id:number,center:Point=fishUnload(c,s)):Point {
  const heading=Math.atan2(c.world.spawn.y-center.y,c.world.spawn.x-center.x);
  const radius=c.world.deposit_radius+22+(id%5),offset=((id*7%17)/16-.5)*.9;
  for(let attempt=0;attempt<128;attempt++){
    const angle=heading+offset+(attempt===0?0:Math.ceil(attempt/2)*Math.PI/16*(attempt%2?1:-1));
    const point={x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius},clamped={...point};clampToWorld(clamped,c,s.area);
    if(distance(point,clamped)<.01&&!onLand(c,point)&&routeTo(c,center,point,s.area).length)return point;
  }
  // Custom/edited maps can require a wider reachable ring. Never fall back inside the zone.
  for(let ring=1;ring<=8;ring++)for(let slot=0;slot<32;slot++){
    const angle=heading+slot*Math.PI/16,r=radius+ring*8,point={x:center.x+Math.cos(angle)*r,y:center.y+Math.sin(angle)*r},clamped={...point};clampToWorld(clamped,c,s.area);
    if(distance(point,clamped)<.01&&!onLand(c,point)&&routeTo(c,center,point,s.area).length)return point;
  }
  throw new Error('No reachable water outside the port drop-off circle');
}
// The sole income classification path. Quest/debug payouts remain immediate, physical sources
// call this only after the corresponding unique coin object is removed from pending collection.
export function creditIncome(s:GameState,value:number,source:IncomeSource) {
  s.coins+=value;
  s.stats.total_earned_coins=(s.stats.total_earned_coins??0)+value;
  const key={fish_sale:'fish_sales_earned',golden_reward:'golden_bonus_income',quest_reward:'quest_reward_income',debug_grant:'debug_income'}[source];
  s.stats[key]=(s.stats[key]??0)+value;
  if(source==='fish_sale' || source==='golden_reward')s.stats.earn_coins=(s.stats.earn_coins??0)+value;
  if(source==='golden_reward')s.stats.golden_collected=(s.stats.golden_collected??0)+value;
}
export function collectCoins(c: Balance,s: GameState,dt: number) {
  const player=s.boats[0]; if(player.hp<=0) return;
  const remaining:CoinStack[]=[];
  for(const p of s.coinStacks) {
    if(s.time<p.availableAt){remaining.push(p);continue;}
    const d=distance(player,p);
    if(d<=c.interaction.coin_radius) p.attracting=true;
    if(!p.attracting){remaining.push(p);continue;}
    if(d<=c.interaction.coin_speed*dt+8) {
      creditIncome(s,p.value,p.source);
      log(s,c.save.max_events,'coin_collect',{id:p.id,value:p.value,source:p.source,crate:p.crate,boat:p.boat,transaction:p.transaction,x:player.x,y:player.y});
    } else { p.x+=(player.x-p.x)/d*c.interaction.coin_speed*dt; p.y+=(player.y-p.y)/d*c.interaction.coin_speed*dt;resolveLand(c,p);clampToWorld(p,c,s.area);remaining.push(p); }
  }
  s.coinStacks=remaining;
}
export function roundEven(n: number) { const floor = Math.floor(n); return n-floor === 0.5 ? (floor%2 === 0 ? floor : floor+1) : Math.round(n); }
export function estimatedEarnRate(c: Balance,s: GameState) {
  const fish = Object.entries(c.resources).filter(([id,r]) => r.kind === 'fish' && s.nodes[id].unlocked && r.zone <= s.area);
  if (!fish.length) return 0;
  return s.boats.filter(b => b.kind !== 'salvage').reduce((sum,b) => {
    const u = c.units[b.kind]; const cap = capacity(c,s,b);
    const best = Math.max(...fish.map(([,r]) => {
      const travel = 2*distance(r,c.world.port)/u.speed;
      const gather = r.gather_s*u.gather_s/c.units.player.gather_s;
      const productive = r.stock*Math.ceil(r.portion_hp/r.damage_per_catch);
      const availability = productive*gather/(productive*gather + Math.max(0,r.stock-1)*r.regrow_s+r.restock_s);
      return cap*r.value/(travel+cap*(gather+c.units.player.deposit_s_per_crate))*availability;
    }));
    return sum+best*(b.kind === 'player'?1:c.ai.worker_utilization_multiplier);
  },0);
}
export function goldenReward(c: Balance,s: GameState) {
  const estimate=estimatedEarnRate(c,s)*c.monetization.golden_estimate_seconds;
  return Math.max(c.monetization.golden_min_coins,roundEven(c.profile==='reference'?Math.fround(Math.fround(estimatedEarnRate(c,s))*Math.fround(c.monetization.golden_estimate_seconds)):estimate));
}
export function actualEarnRate(s: GameState, window = 60) { const start = Math.max(0,s.time-window); const duration = s.time-start; return duration > 0 ? s.events.filter(e => e.type === 'coin_collect' && (e.data.source==='fish_sale'||!e.data.source) && e.gameTime >= start).reduce((n,e) => n+Number(e.data.value),0)/duration : 0; }
