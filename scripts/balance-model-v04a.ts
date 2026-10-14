import type {Balance,Point} from '../src/config/types';
import {Engine} from '../src/game/engine';
import type {GameState} from '../src/game/state';
import {capacity,storageCapacity} from '../src/game/systems/economy';
import {available,gatherDuration} from '../src/game/systems/resources';
import {distance,navigationTarget,routeTo} from '../src/game/systems/movement';
import {offers,purchasePoint,purchaseCategory} from '../src/game/systems/construction';
import {fishUnload} from '../src/game/systems/delivery';
export {workerCost} from '../src/game/systems/economy';

export type Scenario='A'|'B'|'C'|'D';
export function action(c:Balance,e:Engine):string|undefined {
 const s=e.state,q=c.quests[s.questIndex];
 const map:Record<string,string>={cargo_level:`cargo:${s.cargoLevel+1}`,normal_workers:`worker:${s.boats.filter(b=>b.kind==='worker').length}`,salvage_workers:`salvage:${s.boats.filter(b=>b.kind==='salvage').length}`,resource_ready:`resource:${q.target}`,speedboat_ordered:'speedboat',speedboat_ready:'speedboat',area_unlocked:'gate',defender_ready:'defender',metal_storage_ready:'storage',metal_cutter_owned:'cutter',wreck_ready:'resource:wreck',metal_storage_capacity:'storageUpgrade',pirate_den_closed:'den',expedition_route_ready:'route'};
 return map[q.type];
}
const rounded=(n:number)=>Math.round(n*100)/100;
// This driver controls only input and legitimate claim/ad APIs. All earning, timers,
// routes, drops, payments, AI and combat run in the unmodified gameplay Engine.
export function simulate(config:Balance,scenario:Scenario,seed:number,maxSeconds=86400,questLimit=34,initialState?:GameState,hooks?:{onEngine?:(engine:Engine)=>void;beforeStep?:(dt:number)=>void;afterStep?:()=>void}) {
 const c=structuredClone(config);c.simulation.rng_seed=seed;
 const e=new Engine(c,initialState?structuredClone(initialState):undefined),s=e.state,dt=.2,rows:any[]=[],payments:any[]=[],samples:any[]=[];
 hooks?.onEngine?.(e);
 let start=s.time,sales=s.stats.fish_sales_earned??0,gold=s.stats.golden_bonus_income??0,cashWait=0,buildWait=0,idle=0,largestIdle=0,lastSeq=s.eventSeq;
 let largestNoSale=0,lastSale=0,previousSales=0,lastSample=0,adUntil=0,adId:number|undefined;
 let trip:string|null=null,tripKind:'fish'|'metal'='fish',returning=false,detourUntil=0,detourDone=false;
 let keyCost=0,keyMetal=0,optionalBought=false,workerSales=0,playerSales=0,drops=0,expired=0;
 let stageStartWallet=s.coins,progressAt=s.time+600,gateCheckpoint:GameState|undefined,metalPayment:string|null=null;
 const steer=(goal:Point,stop=5)=>{
  const p=s.boats[0];if(distance(p,goal)<=stop){e.input={x:0,y:0};return;}
  const next=navigationTarget(c,p,goal,s.area),d=distance(p,next),factor=scenario==='C'?.85:1;
  const speed=c.units.player.speed*factor,scale=Math.min(factor,d/(c.units.player.speed*dt));
  e.input=d?{x:(next.x-p.x)/d*scale,y:(next.y-p.y)/d*scale}:{x:0,y:0};
 };
 const pathLength=(a:Point,b:Point)=>{let total=0,p=a;for(const next of routeTo(c,a,b,s.area)){total+=distance(p,next);p=next;}return total;};
 const earn=(kind:'fish'|'metal'='fish')=>{
  const p=s.boats[0],cargoKind=p.cargo[0]?.kind,destination=(cargoKind??kind)==='metal'?c.world.storage:fishUnload(c,s);
  // A full metal warehouse cannot unload mixed cargo, but never prevents
  // visiting the fish port and collecting worker cash while carrying metal.
  if(c.profile!=='fast' && kind==='fish' && cargoKind==='metal' && s.metal>=storageCapacity(c,s)){
   const coin=s.coinStacks.filter(coin=>coin.source==='fish_sale').sort((a,b)=>distance(p,a)-distance(p,b))[0];
   returning=false;trip=null;steer(coin??fishUnload(c,s),coin?1:10);return;
  }
  if(returning || p.cargo.length>=capacity(c,s,p) || cargoKind && cargoKind!==kind){
   returning=true;steer(destination,10);
   if(!p.cargo.length && distance(p,destination)<12){returning=false;trip=null;}
   return;
  }
  // Coins need a physical journey. Collect nearby piles on a trip; make a port
  // visit when a meaningful worker payout is waiting, rather than counting deliveries.
  const pending=s.coinStacks.filter(p=>p.source==='fish_sale').reduce((n,p)=>n+p.value,0);
  const coin=s.coinStacks.filter(coin=>coin.source==='fish_sale'&&(distance(p,coin)<100 || !trip && pending>=Math.max(20,capacity(c,s,p)*Math.max(...Object.values(c.resources).filter(r=>r.kind==='fish'&&s.nodes[Object.keys(c.resources).find(id=>c.resources[id]===r)!]?.unlocked).map(r=>r.value))))).sort((a,b)=>distance(p,a)-distance(p,b))[0];
  if(coin){steer(coin,1);return;}
  if(tripKind!==kind){trip=null;tripKind=kind;}
  const loose=s.crates.filter(crate=>crate.kind===kind&&!crate.reservedBy&&c.resources[crate.resource].zone<=s.area).sort((a,b)=>distance(p,a)-distance(p,b))[0];
  if(loose && distance(p,loose)<150){steer(loose,2);return;}
  if(trip && !available(c,s,trip)) {if(p.cargo.length){returning=true;steer(destination,10);return;}trip=null;}
  if(!trip){
   const candidates=Object.keys(c.resources).filter(id=>c.resources[id].kind===kind&&available(c,s,id));
   candidates.sort((a,b)=>{
    const score=(id:string)=>{const r=c.resources[id],cap=capacity(c,s,p);return Math.max(1,r.value)*cap/(pathLength(p,r)+pathLength(r,destination)+1+c.units.player.speed*cap*(gatherDuration(c,p,id)+c.units.player.deposit_s_per_crate));};
    return score(b)-score(a);
   });
   trip=candidates[scenario==='C'&&candidates.length>1&&Math.floor(s.time/45)%3===0?1:0]??null;
  }
  if(trip)steer(c.resources[trip],12);
  else if(p.cargo.length){returning=true;steer(destination,10);}
  else if(loose)steer(loose,2);
  else steer(destination,10);
 };
 while(s.questIndex<questLimit && s.time<maxSeconds){
  const q=c.quests[s.questIndex];
  if(s.time>=progressAt){if(process.env.BALANCE_PROGRESS==='1')console.log(JSON.stringify({scenario,seed,time_s:rounded(s.time),quest:q.id,wallet:s.coins,metal:s.metal,position:{x:s.boats[0].x,y:s.boats[0].y},trip,returning}));progressAt+=600;}
  if(s.questStatus==='completed_unclaimed'){
   const duration=s.time-start,fish=(s.stats.fish_sales_earned??0)-sales,bonus=(s.stats.golden_bonus_income??0)-gold;
   const before=s.coins;e.claimQuest(q.id);if(q.id===15){gateCheckpoint=structuredClone(s);gateCheckpoint.events=[];}
   rows.push({quest:q.id,condition:`${q.type}:${q.target}`,start_s:rounded(start),end_s:rounded(s.time),duration_s:rounded(duration),action_cost:keyCost,action_metal:keyMetal,reward:q.reward_coins,wallet_start:stageStartWallet,wallet_before_reward:before,wallet_after_reward:s.coins,fish_collected:fish,golden_collected:bonus,worker_sales_collected:workerSales,player_sales_collected:playerSales,drops_spawned:drops,crates_expired:expired,fish_per_min:rounded(duration?fish*60/duration:0),workers:s.boats.filter(b=>b.kind==='worker').length,speedboats:s.boats.filter(b=>b.kind==='speedboat').length,cargo_level:s.cargoLevel,cash_wait_s:rounded(cashWait),build_wait_s:rounded(buildWait),metal:s.metal,nodes:Object.fromEntries(Object.entries(s.nodes).filter(([,n])=>n.unlocked).map(([id,n])=>[id,{stock:n.stock,hp:n.hp,phase:n.phase,recovery_in_s:rounded(Math.max(0,n.readyAt-s.time))}]))});
   start=s.time;sales=s.stats.fish_sales_earned??0;gold=s.stats.golden_bonus_income??0;cashWait=0;buildWait=0;keyCost=0;keyMetal=0;workerSales=0;playerSales=0;drops=0;expired=0;stageStartWallet=s.coins;continue;
  }
  const currentSales=s.stats.fish_sales_earned??0;
  if(currentSales>previousSales){largestNoSale=Math.max(largestNoSale,s.time-lastSale);lastSale=s.time;previousSales=currentSales;}
  if(s.time-lastSample>=60){samples.push({time_s:rounded(s.time),quest:q.id,wallet:s.coins,fish_per_min:currentSales-(samples.at(-1)?.total_fish??0),total_fish:currentSales,workers:s.boats.filter(b=>b.kind==='worker').length,pending:s.coinStacks.reduce((n,p)=>n+p.value,0)});lastSample=s.time;}
  let controlled=false;
  if(adId!==undefined){e.input={x:0,y:0};controlled=true;if(s.time>=adUntil){e.claimGolden(true,adId);e.unlockControls('simulation-ad');adId=undefined;}}
  else if(scenario==='B' && s.golden.expires!==null && s.golden.transaction?.status!=='spawned'){
   // Tap the naturally appearing merchant only after travelling into its interaction radius.
   if(distance(s.boats[0],s.golden)<=c.presentation.golden_interaction_radius){const t=e.openGoldenOffer();if(t&&e.beginGoldenReward(t.id)){adId=t.id;adUntil=s.time+c.monetization.fake_ad_s;e.lockControls('simulation-ad');}}else steer(s.golden,10);
   controlled=true;
  } else {
   const bonus=s.coinStacks.filter(p=>p.source==='golden_reward').sort((a,b)=>distance(s.boats[0],a)-distance(s.boats[0],b))[0];
   if(bonus){steer(bonus,1);controlled=true;}
  }
  if(!controlled && scenario==='C' && s.time>=detourUntil && Math.floor(s.time)%40===0&&!detourDone){detourUntil=s.time+3;detourDone=true;}
  if(Math.floor(s.time)%40>0)detourDone=false;
  if(!controlled && s.time<detourUntil){steer({x:1300,y:1450},10);controlled=true;}
  let id=action(c,e);
  // One optional, prematurely bought cargo level is a documented poor investment in C.
  if(scenario==='C' && q.id===12 && !optionalBought && s.cargoLevel===2)id='cargo:3';
  if(!controlled && id){
   const offer=offers(c,s).find(o=>o.id===id),o=s.orders[id];
   if(o?.complete && id==='cargo:3')optionalBought=true;
   if(o?.readyAt!=null){buildWait+=dt;earn();}
   else if(offer&&!offer.blocked){
    const cost=o?.cost??offer.cost,metalCost=o?.metalCost??offer.metal_cost??0;
    // Pay the required metal in instalments before a full warehouse strands
    // mixed cargo. This is a legitimate map purchase, not a state mutation.
    const remainingMetal=metalCost-(o?.metalPaid??0);
    if(remainingMetal>0 && s.metal>=remainingMetal && (s.metal>=storageCapacity(c,s)||s.boats[0].cargo.some(crate=>crate.kind==='metal')))metalPayment=id;
    if(remainingMetal===0 && metalPayment===id)metalPayment=null;
    if(s.coins>=cost-(o?.paid??0) && s.metal>=remainingMetal || metalPayment===id && s.metal>0){
     const point=purchasePoint(c,id),guard=s.purchaseGuards?.[purchaseCategory(id)];
     if(guard?.needsExit)steer({x:point.x+100,y:point.y},5);
     else if(guard&&s.time<guard.cooldownUntil){earn();}
     else steer(point,8);
    }else {cashWait+=dt;earn(s.metal<metalCost-(o?.metalPaid??0)?'metal':'fish');}
   } else earn();
  }else if(!controlled){
   if(q.type==='catch_sardine'||q.type==='catch_total'){trip='sardine';earn();}
   else if(q.type==='deliver_fish'){returning=true;earn();}
   else if(q.type==='metal_deposited')earn('metal');
   else earn();
  }
  const before={coins:s.coins,fish:s.stats.fish_received??0,metal:s.metal};
  hooks?.beforeStep?.(dt);e.update(dt);hooks?.afterStep?.();
  for(const event of s.events.slice(-(s.eventSeq-lastSeq||0)))if(event.seq>lastSeq){
   if(event.type==='order_paid'){const order=s.orders[String(event.data.id)];payments.push({quest:q.id,id:order.id,time_s:rounded(event.gameTime),wallet:s.coins,cost:order.cost,metal:order.metalCost});keyCost+=order.cost;keyMetal+=order.metalCost;}
   if(event.type==='coin_collect'&&event.data.source==='fish_sale'){if(event.data.boat==='player')playerSales+=Number(event.data.value);else workerSales+=Number(event.data.value);}
   if(event.type==='crate_spawn')drops++;
   if(event.type==='crate_expired')expired++;
  }
  lastSeq=s.eventSeq;
  if(Math.hypot(e.input.x,e.input.y)<.01&&before.fish===(s.stats.fish_received??0)&&before.coins===s.coins&&before.metal===s.metal){idle+=dt;largestIdle=Math.max(largestIdle,idle);}else idle=0;
  if(s.coins<0||s.metal<0)throw Error('negative wallet');
 }
 largestNoSale=Math.max(largestNoSale,s.time-lastSale);
 const gate=rows.find(row=>row.quest===15),defender=rows.find(row=>row.quest===16);
 return {scenario,profile:c.profile,seed,completed:s.questIndex===questLimit,quests_completed:s.questIndex,total_s:rounded(s.time),early15_s:gate?.end_s,defender_s:defender?.end_s,gate_to_defender_s:defender?rounded(defender.duration_s):null,longest_quest:rows.reduce((a,r)=>r.duration_s>(a?.duration_s??0)?r:a,null),longest_no_sale_s:rounded(largestNoSale),longest_stationary_unproductive_s:rounded(largestIdle),rows,payments,samples,gateCheckpoint,debug_income:s.stats.debug_income??0,free_skips:0,rewarded_skips:0,terminal:{quest:s.questIndex+1,wallet:s.coins,metal:s.metal,player:s.boats[0],nodes:s.nodes,orders:s.orders}};
}
