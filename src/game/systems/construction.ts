import type { Balance, Cost, Point } from '../../config/types';
import type { GameState, Order } from '../state';
import { makeBoat } from '../state';
import { workerCost } from './economy';
import { log } from '../../debug/events';
import {fishUnload} from './delivery';
import { distance, syncBuildingObstacles } from './movement';
export type Offer = Cost & { id: string; name: string; blocked?: string };
export function allOffers(c: Balance,s: GameState): Offer[] {
  const count=s.boats.filter(b=>b.kind==='worker').length;
  const salvage=s.boats.filter(b=>b.kind==='salvage').length;
  const list: Offer[]=[];
  // Prices apply after claiming quest 15; saved orders retain their original price.
  const late=c.profile==='fast' && s.area===2 && s.questIndex>=15?c.fast_zone2:undefined;
  const add=(o: Offer,done: boolean) => { if(!done) list.push(o); };
  const upgrade=c.capacity_upgrades.find(u=>u.level===s.cargoLevel+1);
  if(upgrade) add({...upgrade,cost:late?.cargo_costs[upgrade.level]??upgrade.cost,id:`cargo:${upgrade.level}`,name:`Трюм Lv.${upgrade.level} · ${upgrade.capacity} ящиков`},false);
  if(count<c.workers.max_count) add({id:`worker:${count}`,name:`Рыбацкая лодка №${count+1}`,cost:late?.worker_costs[count]??workerCost(c,count),build_s:c.workers.timers_s[count]},false);
  add({...c.special.speedboat,id:'speedboat',name:'Скоростной катер'},s.boats.some(b=>b.kind==='speedboat'));
  for(const [id,r] of Object.entries(c.resources)) if(id!=='wreck') add({...r,id:`resource:${id}`,name:r.name,blocked:r.zone>s.area?'Сначала откройте море':undefined},s.nodes[id].unlocked);
  add({...c.expansion.gate,id:'gate',name:'Проход в открытое море'},s.area===2);
  if(s.area===2) {
    if(c.second_port)add({...c.second_port,id:'secondPort',name:'Второй рыбный порт'},!!s.flags.secondPort);
    add({...c.special.combat,id:'defender',name:'Боевой катер'},!!s.defender);
    add({...c.salvage.storage,id:'storage',name:'Склад металлолома'},s.flags.storage);
    add({...c.salvage.cutter,id:'cutter',name:'Оборудование для резки',blocked:!s.flags.storage?'Сначала постройте склад':undefined},s.flags.cutter);
    add({...c.resources.wreck,id:'resource:wreck',name:'Доставка затонувшего корабля',blocked:!s.flags.cutter?'Сначала купите резак':undefined},s.nodes.wreck.unlocked);
    if(salvage<c.salvage.worker.max_count) {
      const timers=c.salvage.worker.timers_s;
      add({...c.salvage.worker,build_s:timers?.[Math.min(salvage,timers.length-1)]??c.salvage.worker.build_s,cost:Math.round(c.salvage.worker.cost*c.salvage.worker.cost_growth**salvage),id:`salvage:${salvage}`,name:`Судно-разборщик №${salvage+1}`,blocked:!s.nodes.wreck.unlocked?'Сначала доставьте корабль':undefined},false);
    }
    add({...c.salvage.upgrade,id:'storageUpgrade',name:`Склад · ${c.salvage.upgrade.capacity} металла`,blocked:!s.flags.storage?'Сначала постройте склад':undefined},s.flags.storageUpgrade);
    add({...c.expansion.den,id:'den',name:'Ликвидировать пиратское логово',blocked:!s.flags.storage?'Нужен склад металла':undefined},s.flags.den);
    add({...c.expansion.route,id:'route',name:'Дальний морской маршрут',blocked:!s.flags.den?'Сначала закройте логово':undefined},s.flags.route);
  }
  return list;
}
export type Visibility = 'HIDDEN' | 'AVAILABLE' | 'PARTIALLY_PAID' | 'BUILDING' | 'READY';
export const purchaseCategory=(id:string)=>id.startsWith('resource:')?id:id.split(':')[0];
export function revealed(c:Balance,s:GameState,id:string):boolean {
  if(id==='secondPort')return !!s.flags.secondPort || !!s.orders.secondPort || s.rewarded.includes(26);
  const category=purchaseCategory(id), quest=c.quests[s.questIndex]?.id??c.quests.length+1;
  const existing=Object.values(s.orders).some(o=>purchaseCategory(o.id)===category);
  const owned=category==='cargo'?s.cargoLevel>0:category==='worker'?s.boats.some(b=>b.kind==='worker'):category==='salvage'?s.boats.some(b=>b.kind==='salvage'):category==='speedboat'?s.boats.some(b=>b.kind==='speedboat'):category==='defender'?!!s.defender:category==='gate'?s.area===2:category.startsWith('resource:')?!!s.nodes[category.split(':')[1]]?.unlocked:!!s.flags[category];
  return !!s.revealedPurchases[category] || existing || owned || quest >= (c.interaction.reveal_at_quest[category]??Infinity);
}
export function revealPurchases(c:Balance,s:GameState) {for(const id of Object.keys(c.interaction.reveal_at_quest))if(revealed(c,s,id))s.revealedPurchases[id]=true;}
export function visibility(c:Balance,s:GameState,id:string):Visibility {
  const o=s.orders[id];
  if(id.startsWith('resource:') && s.nodes[id.split(':')[1]]?.unlocked)return 'READY';
  if(o?.complete)return 'READY';
  if(o?.readyAt!=null)return 'BUILDING';
  if(o && (o.paid>0 || o.metalPaid>0))return 'PARTIALLY_PAID';
  return revealed(c,s,id)?'AVAILABLE':'HIDDEN';
}
export function offers(c:Balance,s:GameState):Offer[] {return allOffers(c,s).filter(o=>revealed(c,s,o.id));}
export function purchasePoint(c: Balance,id: string): Point {
  if(id.startsWith('resource:')) return c.resources[id.split(':')[1]];
  return c.interaction.purchase_points[id.split(':')[0]];
}
// Guards belong to the station/category, so a new offer at the same dock stays blocked.
export function guardPurchase(c:Balance,s:GameState,id:string) {
  (s.purchaseGuards??={})[purchaseCategory(id)]={cooldownUntil:s.time+c.interaction.purchase_cooldown_s,needsExit:true};
}
// Ephemeral motion history is intentionally excluded from saves.
const motion=new WeakMap<GameState,{point:Point;id:string|null;stationary:number}>();
export function resetPurchaseMotion(s:GameState) {motion.delete(s);}
export function updatePurchases(c: Balance,s: GameState,dt: number,actualSpeed?:number,blocked=false) {
  const p=s.boats[0],history=motion.get(s)??{point:{...p},id:null,stationary:0};
  const speed=actualSpeed??distance(p,history.point)/Math.max(dt,1e-9);history.point={x:p.x,y:p.y};motion.set(s,history);
  for(const [category,guard] of Object.entries(s.purchaseGuards??{})) {
    const point=purchasePoint(c,category);
    if(point && distance(p,point)>c.interaction.purchase_radius+c.interaction.purchase_exit_hysteresis)guard.needsExit=false;
  }
  if(p.hp<=0 || blocked || speed>c.interaction.purchase_max_stationary_speed){history.stationary=0;history.id=null;return;}
  const near=offers(c,s).filter(o=>!o.blocked && !stationBlocked(s,o.id) && distance(s.boats[0],purchasePoint(c,o.id))<=c.interaction.purchase_radius).sort((a,b)=>distance(s.boats[0],purchasePoint(c,a.id))-distance(s.boats[0],purchasePoint(c,b.id)))[0];
  if(!near){history.stationary=0;history.id=null;return;}
  if(history.id!==near.id){history.id=near.id;history.stationary=0;}
  const before=history.stationary;history.stationary+=dt;
  const paymentDt=Math.max(0,history.stationary-Math.max(before,c.interaction.purchase_stationary_delay_s));
  if(paymentDt>0)pay(c,s,near.id,paymentDt);
}
function stationBlocked(s:GameState,id:string) {
  const guard=s.purchaseGuards?.[purchaseCategory(id)];return !!guard && (guard.needsExit || s.time<guard.cooldownUntil);
}
export function pourDuration(c:Balance,cost:number) {
  const i=c.interaction;
  return i.purchase_pour_min_seconds+(i.purchase_pour_max_seconds-i.purchase_pour_min_seconds)*cost/(cost+i.purchase_pour_cost_scale);
}
// Cumulative targets retain sub-coin time across frames, with an independent clock per currency.
// Insufficient funds rewind only that clock to the actual paid fraction; later funds pour smoothly.
const pours=new WeakMap<Order,{coins:number;metal:number}>();
export function pay(c: Balance,s: GameState,id: string,dt=Infinity) {
  const offer=offers(c,s).find(o=>o.id===id); if(!offer || offer.blocked) return false;
  const o=s.orders[id]??{id,paid:0,metalPaid:0,cost:offer.cost,metalCost:offer.metal_cost??0,duration:offer.build_s,readyAt:null,complete:false};
  if(o.complete || o.readyAt!==null) return false;
  const duration=pourDuration(c,Math.max(o.cost,o.metalCost)),ease=c.interaction.purchase_pour_ease;
  const inverse=(paid:number,total:number)=>total?duration*(paid/total)**(1/ease):duration;
  const clocks=pours.get(o)??{coins:inverse(o.paid,o.cost),metal:inverse(o.metalPaid,o.metalCost)};
  const portion=(total:number,paid:number,wallet:number,key:'coins'|'metal')=>{
    if(total===paid || wallet<1)return 0;
    clocks[key]=Math.min(duration,clocks[key]+Math.max(0,dt));
    const target=clocks[key]>=duration-1e-9?total:Math.floor(total*(clocks[key]/duration)**ease+1e-9);
    const requested=Math.max(0,target-paid),amount=Math.min(Math.floor(wallet),requested);
    if(amount<requested)clocks[key]=inverse(paid+amount,total);
    return amount;
  };
  const coins=portion(o.cost,o.paid,s.coins,'coins'),metal=portion(o.metalCost,o.metalPaid,s.metal,'metal');
  pours.set(o,clocks);s.coins-=coins;s.metal-=metal;o.paid+=coins;o.metalPaid+=metal;s.orders[id]=o;
  if(coins || metal) log(s,c.save.max_events,'purchase_payment',{id,coins,metal,paid:o.paid,metalPaid:o.metalPaid});
  if(o.paid===o.cost && o.metalPaid===o.metalCost) { o.readyAt=s.time+o.duration;guardPurchase(c,s,id);log(s,c.save.max_events,'order_paid',{id});log(s,c.save.max_events,'timer_start',{id,readyAt:o.readyAt}); }
  return true;
}
export function updateConstruction(c: Balance,s: GameState) {
  for(const o of Object.values(s.orders)) if(!o.complete && o.readyAt!==null && s.time+1e-9>=o.readyAt) {
    o.complete=true;guardPurchase(c,s,o.id);
    if(o.id.startsWith('cargo:')) s.cargoLevel=Number(o.id.split(':')[1]);
    else if(o.id.startsWith('resource:')) { const id=o.id.split(':')[1]; s.nodes[id].unlocked=true; log(s,c.save.max_events,'resource_open',{id}); }
    else if(o.id.startsWith('worker:') || o.id.startsWith('salvage:') || o.id==='speedboat') { const kind=o.id.startsWith('worker:')?'worker':o.id.startsWith('salvage:')?'salvage':'speedboat'; s.boats.push(makeBoat(o.id,kind,kind==='salvage'?c.world.storage:fishUnload(c,s))); }
    else if(o.id==='defender') s.defender=makeBoat('defender','player',c.combat.defender_spawn,c.combat.defender_hp);
    else if(o.id==='gate') { s.area=2; s.nextPirateAt=s.time+(c.profile==='fast'?c.combat.spawn_s:0); log(s,c.save.max_events,'area_open',{area:2}); }
    else s.flags[o.id]=true;
    syncBuildingObstacles(c,s);
    log(s,c.save.max_events,'timer_finish',{id:o.id});
  }
}
export function skipKind(c: Balance,remaining: number): 'free' | 'rewarded' { return remaining<c.monetization.free_skip_below_s?'free':'rewarded'; }
export function skipTimer(c: Balance,s: GameState,id: string,confirmedRewarded=false) {
  const o=s.orders[id]; if(!o || o.complete || o.readyAt===null) return false;
  const mode=skipKind(c,Math.max(0,o.readyAt-s.time)); if(mode==='rewarded' && !confirmedRewarded) return false;
  o.readyAt=s.time; log(s,c.save.max_events,mode==='free'?'free_skip':'rewarded',{id,source:'timer'}); updateConstruction(c,s); return true;
}
