import type { Balance } from '../config/types';
import type { Engine } from '../game/engine';
import type { GameEvent, GameState } from '../game/state';
import {IDB_LIMIT_BYTES,type AnalyticsStorage} from './storage';
import { capacity } from '../game/systems/economy';
import { revealed, purchaseCategory } from '../game/systems/construction';
import { questProgress, questTarget } from '../game/systems/quests';
import { observeEvents } from '../debug/events';
import { compactRecording,expandRecording } from './compact';

type Bag = Record<string, number>;
export type Stamp = { event_timestamp:string; elapsed_wall_time_s:number; elapsed_active_time_s:number; elapsed_game_time_s:number };
export type AnalyticsEvent = Stamp & { event_id:string; event_type:string; quest_id:number|null; payload:Record<string,unknown> };
export type QuestTiming = { quest_id:number; quest_number:number; activated_at_s:number|null; completed_at_s:number|null; claimed_at_s:number|null; duration_s:number|null; wallet_at_activation:number|null; wallet_at_completion:number|null; reward:number; status:string; baseline:boolean; completion_predates_recording:boolean };
type ResourceTotals = { units_collected:number; units_delivered:number; coins_earned:number; player_units:number; worker_units:number; floating_crates_collected:number; floating_crates_expired:number; depletions:number; recoveries:number };
type WorkerTotals = { collected_resources:number; deliveries:number; earned_coins:number };
type PurchaseTotals = { coins:number; metal:number; started_at_s:number; construction_started_at_s:number|null; construction_started_game_s:number|null; completed_at_s:number|null; skip_type:string|null };
type Snapshot = Stamp & { reason:string; time:{wall_time:number;active_time:number;game_time:number}; progress:{quest_number:number|null;quest_status:string;unlocked_zone:number;unlocked_resources:string[]}; economy:{wallet:number;pending_coins_total:number;pending_coins_by_source:Bag;metal:number;total_earned:number;total_spent:number;fish_sale_income:number;golden_income:number;quest_reward_income:number;debug_income:number}; fleet:{player_capacity:number;worker_count:number;speedboat_count:number;salvage_worker_count:number;defender_count:number}; production:{resources_collected:number;delivered_resources:number;cumulative_sales:number;last_30s_sales_income:number;last_60s_sales_income:number;cargo_units_by_resource:Bag;floating_crates_count:number;resource_states:GameState['nodes']}; investments:Record<string,unknown>; flags:Record<string,boolean> };
type PauseInterval = { started_at:string; ended_at:string|null; reason:string; wall_duration_s:number };
type Aggregates = { income:Bag; coins_spent:number; metal_earned:number; metal_spent:number; coin_adjustments:number; metal_adjustments:number; resources:Record<string,ResourceTotals>; workers:Record<string,WorkerTotals>; purchases:Record<string,PurchaseTotals>; combat:Bag; golden:Bag; total_workers_hired:number };
type Payment = { coins:number;metal:number;wallet_before:number;wallet_after:number;metal_before:number;metal_after:number;started_at_s:number;ended_at_s:number;paid:number;metal_paid:number };
type Interval = { start:Stamp; income:Bag; metal_income:number; resources:Record<string,ResourceTotals>; workers:Record<string,WorkerTotals>; combat:Bag; payments:Record<string,Payment>;resource_transitions:{id:string;type:string;active_s:number;game_s:number;ready_at_game_s:number|null;phase:string|null}[] };
type Recording = {
  schema_version:1;
  metadata:{game_name:string;game_version:string;build_identifier:string|null;balance_profile:string;balance_fingerprint:string;analytics_schema_version:1;started_at:string;language:string;debug_modified:boolean;recording_started_midgame:boolean;limitations:string[]};
  session:{session_id:string;wall_duration_s:number;active_duration_s:number;game_duration_s:number;pause_intervals:PauseInterval[];recording_status:'RECORDING'|'STOPPED';stop_reason:string|null};
  initial_snapshot:Snapshot;events:AnalyticsEvent[];snapshots:Snapshot[];aggregates:Aggregates;quests:QuestTiming[];balance_configuration:Balance;
  checkpoint:{at_ms:number;game_time:number;last_speed:number;visible:boolean;eligible:boolean;wallet:number;metal:number;next_snapshot_s:number;last_flush_active_s:number;seq:number;visited_zone_2:boolean;reveals:string[];crate_resources:Record<string,string>;coin_origins:Record<string,{resource:string;boat:string}>;sales:{at:number;value:number}[];interval:Interval|null;golden_watching:boolean};
};
export const analyticsKey=(profile:string)=>`quiet_cove_analytics_v1_${profile}`;
export const STORAGE_LIMIT_BYTES=IDB_LIMIT_BYTES;
const EVENT_LIMIT=12000, SNAPSHOT_LIMIT=1000;
const clean=<T>(value:T):T=>JSON.parse(JSON.stringify(value,(_key,v)=>typeof v==='number'&&!Number.isFinite(v)?null:v));
const sum=(bag:Bag)=>Object.values(bag).reduce((a,b)=>a+b,0);
const add=(bag:Bag,key:string,n=1)=>{bag[key]=(bag[key]??0)+n;};
const resources=():ResourceTotals=>({units_collected:0,units_delivered:0,coins_earned:0,player_units:0,worker_units:0,floating_crates_collected:0,floating_crates_expired:0,depletions:0,recoveries:0});
const worker=():WorkerTotals=>({collected_resources:0,deliveries:0,earned_coins:0});
// Stable canonical FNV-1a identifier, not a cryptographic integrity/security hash.
export function balanceFingerprint(balance:Balance) {
  const canonical=(v:unknown):string=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical((v as Record<string,unknown>)[k])}`).join(',')}}`:JSON.stringify(v);
  let hash=2166136261;for(const char of canonical(balance)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return `fnv1a32:${(hash>>>0).toString(16).padStart(8,'0')}`;
}

/** Read-only, opt-in observer of the existing authoritative log stream. */
export class PlaytestAnalytics {
  private recording:Recording|null=null;
  private visible=true;
  private collectedCoins=new Set<number>();
  private lastPersist=0;
  private unsubscribe:()=>void;
  warning='';
  constructor(private engine:Engine,private storage:AnalyticsStorage|null,private now=()=>Date.now(),private language=()=> 'en',visible=true) {
    this.visible=visible;
    this.unsubscribe=observeEvents(engine.state,event=>{if(this.status==='RECORDING')this.safe(()=>this.observe(event));});
    this.restore();
  }
  get status(){return this.recording?.session.recording_status??'OFF';}
  get eventCount(){return this.recording?.events.length??0;}
  get activeSeconds(){return this.recording?.session.active_duration_s??0;}
  get wallSeconds(){return this.recording?.session.wall_duration_s??0;}
  get storageWarning(){return this.storage?.warning??'';}
  private safe(action:()=>void){try{action();}catch(error){this.warning=`Analytics error: ${String(error)}`;}}
  private get s(){return this.engine.state;}
  private get c(){return this.engine.config;}
  private get storageLimit(){return this.storage?.maxBytes??STORAGE_LIMIT_BYTES;}
  private get r(){return this.recording!;}
  start() {
    if(this.recording)return false; // Preserve previous recording until explicit confirmed Clear.
    this.safe(()=>{
      const now=this.now(),s=this.s,c=this.c;
      const initialAggregates:Aggregates={income:{fish_sale:0,golden_reward:0,quest_reward:0,other:0,debug_grant:0},coins_spent:0,metal_earned:0,metal_spent:0,coin_adjustments:0,metal_adjustments:0,resources:{},workers:{},purchases:{},combat:{},golden:{},total_workers_hired:0};
      const checkpoint={at_ms:now,game_time:s.time,last_speed:this.engine.speed,visible:this.visible,eligible:this.visible&&!this.engine.paused&&!this.engine.controlsLocked,wallet:s.coins,metal:s.metal,next_snapshot_s:30,last_flush_active_s:0,seq:0,visited_zone_2:s.boats[0].x>=c.world.gate_x,reveals:Object.keys(c.interaction.reveal_at_quest).filter(id=>revealed(c,s,id)),crate_resources:{} as Record<string,string>,coin_origins:{} as Record<string,{resource:string;boat:string}>,sales:[] as {at:number;value:number}[],interval:null as Interval|null,golden_watching:s.golden.transaction?.status==='watching'};
      for(const crate of [...s.crates,...s.boats.flatMap(b=>b.cargo)])checkpoint.crate_resources[crate.id]=crate.resource;
      for(const coin of s.coinStacks)if(coin.crate!==undefined)checkpoint.coin_origins[coin.id]={resource:checkpoint.crate_resources[coin.crate]??'baseline_unknown',boat:coin.boat??'unknown'};
      this.recording={schema_version:1,metadata:{game_name:'Quiet Cove / Тихая бухта',game_version:'0.7f',build_identifier:null,balance_profile:c.profile,balance_fingerprint:balanceFingerprint(c),analytics_schema_version:1,started_at:new Date(now).toISOString(),language:this.language(),debug_modified:this.engine.speed!==1||s.events.some(e=>e.type.startsWith('debug_')),recording_started_midgame:s.questIndex>0||s.area>1||s.cargoLevel>0||Object.values(s.flags).some(Boolean)||s.questStatus!=='active'||s.coins!==0||s.metal!==0||s.boats.length>1||s.boats[0].cargo.length>0||s.crates.length>0||s.coinStacks.length>0||Object.keys(s.orders).length>0||Object.entries(s.stats).some(([key,n])=>key!=='income_sources_v031'&&n>0)||Object.values(s.nodes).filter(n=>n.unlocked).length>1,limitations:['Worker idle time is not measured.','Pre-recording quest completion times are unknown; baseline completed quests have null timing.','Active eligibility for simulation pause/control locks is sampled at 200ms; visibility boundaries are immediate.','Storage is bounded; recording stops at its limit and remains exportable.','FNV-1a fingerprint identifies configuration; it is not cryptographic.']},session:{session_id:`${now.toString(36)}-${globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2)}`,wall_duration_s:0,active_duration_s:0,game_duration_s:0,pause_intervals:[],recording_status:'RECORDING',stop_reason:null},initial_snapshot:null as unknown as Snapshot,events:[],snapshots:[],aggregates:initialAggregates,quests:c.quests.map((q,i)=>({quest_id:q.id,quest_number:i+1,activated_at_s:null,completed_at_s:null,claimed_at_s:null,duration_s:null,wallet_at_activation:null,wallet_at_completion:null,reward:q.reward_coins,status:i<s.questIndex?'claimed_before_recording':'not_activated',baseline:false,completion_predates_recording:false})),balance_configuration:clean(c),checkpoint};
      this.r.initial_snapshot=this.snapshot('initial');
      this.emit('session_started',{baseline_game_time:s.time,simulation_speed:this.engine.speed});
      if(this.engine.speed!==1)this.emit('DEBUG_ACTION',{action:'preexisting_time_acceleration',speed:this.engine.speed});
      this.activate(s.questIndex,true);
      if(s.questStatus==='completed_unclaimed'){const q=this.r.quests[s.questIndex];if(q){q.status='completed_unclaimed';q.completion_predates_recording=true;this.emit('quest_baseline_completed',{quest_id:q.quest_id,completion_time_unknown:true},q.quest_id);}}
      if(!this.visible)this.pause('hidden_at_start');
      this.persist();
    });return this.status==='RECORDING';
  }
  private stamp():Stamp {return {event_timestamp:new Date(this.r.checkpoint.at_ms).toISOString(),elapsed_wall_time_s:this.r.session.wall_duration_s,elapsed_active_time_s:this.r.session.active_duration_s,elapsed_game_time_s:this.r.session.game_duration_s};}
  private advance() {
    if(this.status!=='RECORDING')return;
    const r=this.r,p=r.checkpoint,now=Math.max(p.at_ms,this.now()),dt=(now-p.at_ms)/1000;
    r.session.wall_duration_s+=dt;if(p.eligible)r.session.active_duration_s+=dt;
    r.session.game_duration_s+=Math.max(0,this.s.time-p.game_time);
    p.at_ms=now;p.game_time=this.s.time;p.eligible=this.visible&&!this.engine.paused&&!this.engine.controlsLocked;
  }
  private emit(type:string,payload:Record<string,unknown>={},questId:number|null=this.c.quests[this.s.questIndex]?.id??null) {
    this.r.events.push({...this.stamp(),event_id:`${this.r.session.session_id}:${++this.r.checkpoint.seq}`,event_type:type,quest_id:questId,payload:clean(payload)});
  }
  private snapshot(reason:string):Snapshot {
    const s=this.s,a=this.r.aggregates,t=this.stamp();
    const pendingBySource:Bag={},cargoByResource:Bag={};
    for(const coin of s.coinStacks)if(!this.collectedCoins.has(coin.id))add(pendingBySource,coin.source,coin.value);
    for(const boat of s.boats)for(const crate of boat.cargo)add(cargoByResource,crate.resource);
    const sold=(seconds:number)=>this.r.checkpoint.sales.filter(x=>x.at>=t.elapsed_active_time_s-seconds).reduce((n,x)=>n+x.value,0);
    return clean({...t,reason,time:{wall_time:t.elapsed_wall_time_s,active_time:t.elapsed_active_time_s,game_time:t.elapsed_game_time_s},progress:{quest_number:this.c.quests[s.questIndex]?s.questIndex+1:null,quest_status:this.c.quests[s.questIndex]?s.questStatus:'all_claimed',unlocked_zone:s.area,unlocked_resources:Object.keys(s.nodes).filter(id=>s.nodes[id].unlocked)},economy:{wallet:s.coins,pending_coins_total:sum(pendingBySource),pending_coins_by_source:pendingBySource,metal:s.metal,total_earned:sum(a.income),total_spent:a.coins_spent,fish_sale_income:a.income.fish_sale,golden_income:a.income.golden_reward,quest_reward_income:a.income.quest_reward,debug_income:a.income.debug_grant},fleet:{player_capacity:capacity(this.c,s,s.boats[0]),worker_count:s.boats.filter(b=>b.kind==='worker').length,speedboat_count:s.boats.filter(b=>b.kind==='speedboat').length,salvage_worker_count:s.boats.filter(b=>b.kind==='salvage').length,defender_count:Number(!!s.defender)},production:{resources_collected:Object.values(a.resources).reduce((n,r)=>n+r.units_collected,0),delivered_resources:Object.values(a.resources).reduce((n,r)=>n+r.units_delivered,0),cumulative_sales:a.income.fish_sale,last_30s_sales_income:sold(30),last_60s_sales_income:sold(60),cargo_units_by_resource:cargoByResource,floating_crates_count:s.crates.length,resource_states:s.nodes},investments:Object.fromEntries(Object.values(s.orders).map(o=>[o.id,{full_price:o.cost,paid:o.paid,remaining:o.cost-o.paid,metal_price:o.metalCost,metal_paid:o.metalPaid,remaining_metal:o.metalCost-o.metalPaid,construction_duration:o.duration,ready_at_game_s:o.readyAt,complete:o.complete}])),flags:{...s.flags}});
  }
  private capture(reason:string) {this.r.snapshots.push(this.snapshot(reason));}
  private activate(index:number,baseline=false) {
    const q=this.c.quests[index],row=this.r.quests[index];if(!q||!row)return;
    if(row.activated_at_s!==null){this.emit('quest_reactivated',{quest_id:q.id,baseline,debug_jump:true},q.id);return;}
    Object.assign(row,{activated_at_s:this.r.session.active_duration_s,wallet_at_activation:this.s.coins,status:'active',baseline});
    this.emit('QUEST_ACTIVATED',{quest_id:q.id,quest_number:index+1,quest_type:q.type,quest_title:q.label,required_target:questTarget(q),target:q.target,current_progress:questProgress(q,this.s),baseline,activation_game_time:this.s.time,economy_snapshot:this.snapshot('quest_activation')},q.id);this.capture('quest_activation');
  }
  private interval() {return this.r.checkpoint.interval??= {start:this.stamp(),income:{},metal_income:0,resources:{},workers:{},combat:{},payments:{},resource_transitions:[]};}
  private resource(id:string,metric:keyof ResourceTotals,n=1) {for(const map of [this.r.aggregates.resources,this.interval().resources]){const r=map[id]??=resources();r[metric]+=n;}}
  private worker(id:string,metric:keyof WorkerTotals,n=1) {for(const map of [this.r.aggregates.workers,this.interval().workers]){const w=map[id]??=worker();w[metric]+=n;}}
  private income(source:string,coins:number,metal=0) {const key=source in this.r.aggregates.income?source:'other';add(this.r.aggregates.income,key,coins);add(this.interval().income,key,coins);this.r.aggregates.metal_earned+=metal;this.interval().metal_income+=metal;}
  private purchase(id:string) {return this.r.aggregates.purchases[id]??={coins:0,metal:0,started_at_s:this.r.session.active_duration_s,construction_started_at_s:null,construction_started_game_s:null,completed_at_s:null,skip_type:null};}
  private purchasePayload(id:string) {const o=this.s.orders[id],p=this.purchase(id);return {purchase_id:id,category:purchaseCategory(id),level_or_tier:id.split(':')[1]??null,full_price:o?.cost??null,paid_amount:o?.paid??0,remaining_amount:o?o.cost-o.paid:null,metal_price:o?.metalCost??null,metal_paid:o?.metalPaid??0,metal_remaining:o?o.metalCost-o.metalPaid:null,construction_duration_s:o?.duration??null,actual_waiting_active_s:p.construction_started_at_s===null?null:Math.max(0,this.r.session.active_duration_s-p.construction_started_at_s),actual_waiting_game_s:p.construction_started_game_s===null?null:Math.max(0,this.s.time-p.construction_started_game_s),skip_type:p.skip_type,fleet:this.snapshot('purchase').fleet,wallet:this.s.coins,metal:this.s.metal};}
  private flushInterval() {
    const i=this.r.checkpoint.interval;if(!i)return;this.r.checkpoint.interval=null;
    this.emit('economy_interval',{started:i.start,ended:this.stamp(),income:i.income,metal_income:i.metal_income,resources:i.resources,workers:i.workers,combat:i.combat,resource_transitions:i.resource_transitions});
    for(const [id,payment] of Object.entries(i.payments))this.emit('PURCHASE_PARTIAL',{...this.purchasePayload(id),...payment,expense_coins:payment.coins,expense_metal:payment.metal});
  }
  private observe(event:GameEvent) {
    if(this.status!=='RECORDING')return;
    this.advance();const d=event.data,s=this.s,a=this.r.aggregates,cp=this.r.checkpoint;
    const id=String(d.id??''),resource=String(d.resource??'unknown'),boat=String(d.boat??'unknown'),n=(key:string)=>Number(d[key]??0);
    if(event.type==='harvest'||event.type==='crate_pickup') {
      cp.crate_resources[String(d.crate)]=resource;this.resource(resource,'units_collected');this.resource(resource,d.actor==='player'?'player_units':'worker_units');this.worker(boat,'collected_resources');if(event.type==='crate_pickup'){this.resource(resource,'floating_crates_collected');delete cp.crate_resources[String(d.crate)];}return;
    }
    if(event.type==='delivery') {this.resource(resource,'units_delivered');this.worker(boat,'deliveries');if(d.kind==='metal'){this.income('other',0,typeof d.accepted_metal==='number'?d.accepted_metal:1);delete cp.crate_resources[String(d.crate)];}else cp.crate_resources[String(d.crate)]=resource;return;}
    if(event.type==='coin_spawn') {if(d.source==='fish_sale')cp.coin_origins[id]={resource:cp.crate_resources[String(d.crate)]??'baseline_unknown',boat};delete cp.crate_resources[String(d.crate)];if(d.source==='golden_reward'){add(a.golden,'coins_spawned',n('value'));}return;}
    if(event.type==='crate_spawn'){cp.crate_resources[id]=resource;return;}
    if(event.type==='crate_expired'){this.resource(cp.crate_resources[id]??'baseline_unknown','floating_crates_expired');delete cp.crate_resources[id];return;}
    if(event.type==='coin_collect') {
      this.collectedCoins.add(Number(d.id));
      const source=String(d.source??'fish_sale'),value=n('value');this.income(source,value);
      if(source==='debug_grant')this.r.metadata.debug_modified=true;
      if(source==='fish_sale'){const origin=cp.coin_origins[id]??{resource:'baseline_unknown',boat};this.resource(origin.resource,'coins_earned',value);this.worker(origin.boat,'earned_coins',value);cp.sales.push({at:this.r.session.active_duration_s,value});}
      delete cp.coin_origins[id];
      if(source==='golden_reward'){this.flushInterval();add(a.golden,'coins_collected',value);this.emit('golden_coins_collected',{...d,wallet_before:s.coins-value,wallet_after:s.coins});}return;
    }
    if(event.type==='purchase_payment') {
      const coins=n('coins'),metal=n('metal'),first=!a.purchases[id];
      if(first){this.flushInterval();this.purchase(id);this.emit('PURCHASE_STARTED',{...this.purchasePayload(id),wallet_before:s.coins+coins,wallet_after:s.coins,metal_before:s.metal+metal,metal_after:s.metal});}
      const p=this.purchase(id);p.coins+=coins;p.metal+=metal;a.coins_spent+=coins;a.metal_spent+=metal;
      const item=this.interval().payments[id]??={coins:0,metal:0,wallet_before:s.coins+coins,wallet_after:s.coins,metal_before:s.metal+metal,metal_after:s.metal,started_at_s:this.r.session.active_duration_s,ended_at_s:0,paid:0,metal_paid:0};
      item.coins+=coins;item.metal+=metal;Object.assign(item,{wallet_after:s.coins,metal_after:s.metal,ended_at_s:this.r.session.active_duration_s,paid:n('paid'),metal_paid:n('metalPaid')});return;
    }
    if(event.type==='combat_hit') {if(d.target==='player'){for(const bag of [a.combat,this.interval().combat]){add(bag,'player_damage',n('damage'));add(bag,'player_damaged_count');}}return;}
    if(event.type==='resource_depleted'||event.type==='resource_recovered'){
      this.resource(id,event.type==='resource_depleted'?'depletions':'recoveries');
      this.interval().resource_transitions.push({id,type:event.type,active_s:this.r.session.active_duration_s,game_s:this.r.session.game_duration_s,ready_at_game_s:event.type==='resource_depleted'?n('readyAt'):null,phase:d.phase?String(d.phase):null});return;
    }
    if(event.type==='combat_attack'||event.type==='pirate_spawn'||event.type==='crate_spawn_limited')return;
    this.flushInterval();
    switch(event.type) {
      case 'quest_start': this.activate(s.questIndex);this.checkReveals();break;
      case 'quest_complete': {const row=this.r.quests.find(q=>q.quest_id===n('id'));if(!row||row.completed_at_s!==null)return;if(row.activated_at_s===null)this.activate(s.questIndex,true);Object.assign(row,{completed_at_s:this.r.session.active_duration_s,duration_s:Math.max(0,this.r.session.active_duration_s-row.activated_at_s!),wallet_at_completion:s.coins,status:'completed_unclaimed'});this.emit('QUEST_COMPLETED',{quest_id:row.quest_id,completion_time:this.r.session.active_duration_s,duration_since_activation:row.duration_s,current_wallet:s.coins,current_fleet:this.snapshot('quest_completion').fleet,economy_snapshot:this.snapshot('quest_completion')},row.quest_id);this.capture('quest_completion');break;}
      case 'reward': if(d.source==='quest'){const row=this.r.quests.find(q=>q.quest_id===n('id'));if(!row||row.claimed_at_s!==null)return;this.income('quest_reward',n('coins'),n('metal'));this.flushInterval();row.claimed_at_s=this.r.session.active_duration_s;row.status='claimed';this.emit('QUEST_REWARD_CLAIMED',{quest_id:row.quest_id,reward_amount:n('coins'),reward_metal:n('metal'),time_between_completion_and_claim:row.completed_at_s===null?null:Math.max(0,row.claimed_at_s-row.completed_at_s),wallet_before:s.coins-n('coins'),wallet_after:s.coins,metal_before:s.metal-n('metal'),metal_after:s.metal},row.quest_id);this.capture('quest_claim');}break;
      case 'order_paid': this.emit('PURCHASE_FULLY_PAID',this.purchasePayload(id));this.capture('purchase_paid');if(id==='defender')this.emit('defender_purchased',this.purchasePayload(id));if(id==='gate')this.emit('territory_paid',this.purchasePayload(id));break;
      case 'timer_start': {const p=this.purchase(id);p.construction_started_at_s=this.r.session.active_duration_s;p.construction_started_game_s=s.time;this.emit('CONSTRUCTION_STARTED',{...this.purchasePayload(id),...d});break;}
      case 'timer_finish': {this.purchase(id).completed_at_s=this.r.session.active_duration_s;this.emit('CONSTRUCTION_COMPLETED',this.purchasePayload(id));if(/^(worker:|salvage:|speedboat)/.test(id)){a.total_workers_hired++;this.emit('worker_created',{...this.purchasePayload(id),boat_type:id.startsWith('worker:')?'worker':id.startsWith('salvage:')?'salvage':'speedboat',fleet_before_count:s.boats.length-2,fleet_after_count:s.boats.length-1,current_income:a.income.fish_sale,current_progression:s.questIndex+1});}if(id==='defender')this.emit('defender_obtained',this.purchasePayload(id));if(id==='storage')this.emit('scrap_storage_built',this.purchasePayload(id));if(id==='cutter')this.emit('scrap_mining_unlocked',this.purchasePayload(id));this.capture('construction_completed');this.checkReveals();break;}
      case 'free_skip': case 'rewarded': if(d.source==='timer'||event.type==='free_skip'){this.purchase(id).skip_type=event.type==='free_skip'?'free':'rewarded';this.emit('CONSTRUCTION_SKIPPED',this.purchasePayload(id));}else if(d.source==='golden'){cp.golden_watching=false;this.emit('golden_coins_spawned',{...d,offered_reward:s.golden.transaction?.reward});}break;
      case 'resource_open': this.emit('resource_zone_built',{object_id:id,economy_snapshot:this.snapshot('resource_open')});if(id==='wreck')this.emit('scrap_resource_unlocked',{object_id:id});this.capture('resource_open');break;
      case 'area_open': this.emit('territory_construction_completed',{...d,economy_snapshot:this.snapshot('area_open')});this.capture('area_open');break;
      case 'golden_arrived': this.emit('golden_boat_available',d);break;
      case 'golden_offer': add(a.golden,'offers_shown');this.emit('golden_offer_shown',d);break;
      case 'golden_reward_started': cp.golden_watching=true;add(a.golden,'offers_accepted');this.emit('golden_offer_accepted',d);break;
      case 'golden_reward_cancelled': this.emit(cp.golden_watching?'golden_reward_cancelled':'golden_offer_declined',d);cp.golden_watching=false;break;
      case 'golden_missed': this.emit('golden_offer_expired',d);break;
      case 'pirate_killed': add(a.combat,'pirates_killed');this.emit('pirate_killed',d);break;
      case 'boat_disabled': this.emit(id==='player'?'player_destroyed':'defender_destroyed',d);break;
      case 'player_repaired': this.emit('player_respawned',d);break;
      case 'defender_repaired': this.emit('defender_respawned',d);break;
      case 'loaded': this.emit('offline_progression',{...d,policy:'timers_only',game_duration_includes_offline:true});break;
      default: if(event.type.startsWith('debug_')) {
        this.r.metadata.debug_modified=true;
        if(event.type==='debug_speed')cp.last_speed=this.engine.speed;
        const before=d.before as {coins?:number;metal?:number}|undefined;
        const coins=event.type==='debug_grant_coins'?Number(d.coins_delta??(before?.coins!==undefined?s.coins-before.coins:10000)):0;
        const metal=event.type==='debug_grant_metal'?Number(d.metal_delta??(before?.metal!==undefined?s.metal-before.metal:0)):0;
        if(coins>=0&&metal>=0)this.income('debug_grant',coins,metal);else {a.coin_adjustments+=coins;a.metal_adjustments+=metal;}
        this.flushInterval();this.emit('DEBUG_ACTION',{action:event.type,...d,effect_on_state:this.snapshot('debug')});
        if(event.type==='debug_config_edit')this.emit('balance_configuration_changed',{fingerprint:balanceFingerprint(this.c),configuration:this.c});
        this.checkReveals();this.capture('debug_action');
      } else if(event.type.startsWith('fake_ad_'))this.emit(event.type,d);
    }
    this.checkLimit();
  }
  private checkReveals() {const cp=this.r.checkpoint;for(const id of Object.keys(this.c.interaction.reveal_at_quest))if(!cp.reveals.includes(id)&&revealed(this.c,this.s,id)){cp.reveals.push(id);const type=id==='defender'?'defender_unlocked':id==='storage'?'scrap_storage_unlocked':id==='salvage'?'salvage_worker_unlocked':id.startsWith('resource:')?'resource_zone_available':id==='worker'||id==='speedboat'?'boat_type_unlocked':'purchase_available';this.emit(type,{object_id:id,economy_snapshot:this.snapshot('unlock')});}}
  sample() {this.safe(()=>{
    if(this.status!=='RECORDING')return;this.advance();this.checkReveals();
    this.checkSpeed();
    const pending=new Set(this.s.coinStacks.map(p=>p.id));for(const id of this.collectedCoins)if(!pending.has(id))this.collectedCoins.delete(id);
    // Purge terminal metal IDs retained by older recordings; live cargo/floaters
    // retain attribution, and fish payouts already hold their own coin origin.
    const liveCrates=new Set([...this.s.crates.map(p=>p.id),...this.s.boats.flatMap(b=>b.cargo.map(p=>p.id))].map(String));
    for(const id of Object.keys(this.r.checkpoint.crate_resources))if(!liveCrates.has(id))delete this.r.checkpoint.crate_resources[id];
    const cp=this.r.checkpoint,active=this.r.session.active_duration_s;
    if(!cp.visited_zone_2&&this.s.area===2&&this.s.boats[0].x>=this.c.world.gate_x){cp.visited_zone_2=true;this.flushInterval();this.emit('zone_2_entered',{economy_snapshot:this.snapshot('zone_2_entered')});this.capture('zone_2_entered');}
    if(active-cp.last_flush_active_s>=5){this.flushInterval();cp.last_flush_active_s=active;}
    if(active>=cp.next_snapshot_s){this.flushInterval();this.capture('periodic');cp.next_snapshot_s=active+30;}
    cp.sales=cp.sales.filter(x=>x.at>=active-60);
    this.checkLimit();if(this.now()-this.lastPersist>=5000)this.persist();
  });}
  private checkSpeed() {const cp=this.r.checkpoint;if(cp.last_speed!==this.engine.speed){this.r.metadata.debug_modified=true;this.flushInterval();this.emit('DEBUG_ACTION',{action:'time_acceleration_changed',before:cp.last_speed,after:this.engine.speed});cp.last_speed=this.engine.speed;}}
  setVisible(visible:boolean,reason='visibility') {this.safe(()=>{if(this.visible===visible)return;this.advance();this.visible=visible;if(this.status!=='RECORDING')return;this.r.checkpoint.visible=visible;this.r.checkpoint.eligible=visible&&!this.engine.paused&&!this.engine.controlsLocked;if(visible)this.resume(reason);else this.pause(reason);this.persist();});}
  private pause(reason:string) {this.flushInterval();if(!this.r.session.pause_intervals.some(p=>p.ended_at===null)){this.r.session.pause_intervals.push({started_at:this.stamp().event_timestamp,ended_at:null,reason,wall_duration_s:0});this.emit('session_pause',{reason});}}
  private resume(reason:string) {const pause=this.r.session.pause_intervals.find(p=>p.ended_at===null);if(pause){pause.ended_at=this.stamp().event_timestamp;pause.wall_duration_s=Math.max(0,(Date.parse(pause.ended_at)-Date.parse(pause.started_at))/1000);}this.emit('session_resume',{reason});}
  stop(reason='user') {this.safe(()=>{if(this.status!=='RECORDING')return;this.advance();this.flushInterval();const pause=this.r.session.pause_intervals.find(p=>p.ended_at===null);if(pause){pause.ended_at=this.stamp().event_timestamp;pause.wall_duration_s=Math.max(0,(this.r.checkpoint.at_ms-Date.parse(pause.started_at))/1000);}this.emit('session_stopped',{reason});this.capture('stop');this.r.session.recording_status='STOPPED';this.r.session.stop_reason=reason;this.persist();});}
  clear(confirmed=false) {if(!confirmed)return false;this.safe(()=>{this.storage?.removeItem(analyticsKey(this.c.profile));this.recording=null;this.warning='';});return this.recording===null;}
  private checkLimit() {if(this.r.events.length>=EVENT_LIMIT||this.r.snapshots.length>=SNAPSHOT_LIMIT){this.warning='Recording limit reached. Export and clear to start another session.';this.stop('storage_limit');}}
  persist() {this.safe(()=>{
    if(!this.recording)return;this.advance();this.flushInterval();const cp=this.r.checkpoint;cp.wallet=this.s.coins;cp.metal=this.s.metal;
    let raw=JSON.stringify(compactRecording(this.r));if(raw.length*2>this.storageLimit&&this.status==='RECORDING'){this.warning='Recording size limit reached. Export this session.';this.stop('storage_limit');return;}
    this.lastPersist=this.now();try{this.storage?.setItem(analyticsKey(this.c.profile),raw);}catch(error){this.warning=`Storage unavailable; recording is in memory. Export before closing. ${String(error)}`;}
  });}
  private restore() {this.safe(()=>{
    const raw=this.storage?.getItem(analyticsKey(this.c.profile));if(!raw)return;
    if(raw.length*2>this.storageLimit+100_000)throw Error('Oversized analytics recording');
    const saved=expandRecording(JSON.parse(raw)) as Recording;
    if(saved.schema_version!==1||saved.metadata?.balance_profile!==this.c.profile||!saved.checkpoint||!Array.isArray(saved.events)||!Array.isArray(saved.quests)||!saved.session||!['RECORDING','STOPPED'].includes(saved.session.recording_status))throw Error('Unsupported analytics recording');
    this.recording=saved;if(this.status!=='RECORDING')return;
    const cp=saved.checkpoint,last=cp.at_ms,now=Math.max(last,this.now()),gameClockDifference=this.s.time-cp.game_time;
    cp.eligible=false;this.pause('page_unloaded');this.advance(); // The entire reload gap is wall-only.
    // Independent game/analytics checkpoints may differ after a crash. Keep explicit
    // adjustments in the export instead of silently replaying or inventing events.
    const coins=this.s.coins-cp.wallet,metal=this.s.metal-cp.metal;
    if(coins||metal){saved.aggregates.coin_adjustments+=coins;saved.aggregates.metal_adjustments+=metal;this.emit('restoration_adjustment',{coins,metal,reason:'independent_save_checkpoints'});}
    if(now>last)this.emit('reload_gap',{wall_seconds:(now-last)/1000,active_seconds:0,game_clock_difference:gameClockDifference});
    const previousConfig=[...saved.events].reverse().find(e=>e.event_type==='balance_configuration_changed')?.payload.fingerprint??saved.metadata.balance_fingerprint;
    if(previousConfig!==balanceFingerprint(this.c)){saved.metadata.debug_modified=true;this.emit('balance_configuration_changed',{reason:'reload_runtime_configuration',fingerprint:balanceFingerprint(this.c),configuration:this.c});}
    this.checkSpeed();
    cp.game_time=this.s.time;cp.visible=this.visible;cp.eligible=this.visible&&!this.engine.paused&&!this.engine.controlsLocked;
    if(this.visible)this.resume('reload');this.persist();
  });}
  exportJSON(format:'compact'|'full'='compact'):string|null {
    if(!this.recording)return null;
    let output:string|null=null;this.safe(()=>{
      if(this.status==='RECORDING'){this.advance();this.flushInterval();this.persist();}
      const r=this.r,a=r.aggregates,final=this.status==='STOPPED'?r.snapshots.at(-1)!:this.snapshot('export');
      const initial=r.initial_snapshot.economy,earned=sum(a.income),spent=a.coins_spent;
      const summary={total_quests_completed:r.quests.filter(q=>q.completed_at_s!==null).length,total_quests_claimed:r.quests.filter(q=>q.claimed_at_s!==null).length,active_playtime:r.session.active_duration_s,wall_playtime:r.session.wall_duration_s,total_coins_earned:earned,total_coins_spent:spent,final_wallet:final.economy.wallet,golden_income:a.income.golden_reward,quest_reward_income:a.income.quest_reward,fish_sales_income:a.income.fish_sale,debug_income:a.income.debug_grant,total_workers_hired:a.total_workers_hired,zone_2_unlock_time:r.events.find(e=>e.event_type==='territory_construction_completed')?.elapsed_active_time_s??null,defender_purchase_time:r.events.find(e=>e.event_type==='defender_purchased')?.elapsed_active_time_s??null,quest_milestone_times:r.quests,coins_reconciliation:{initial:initial.wallet,earned,spent,adjustments:a.coin_adjustments,final:final.economy.wallet,residual:final.economy.wallet-(initial.wallet+earned-spent+a.coin_adjustments)},metal_reconciliation:{initial:initial.metal,earned:a.metal_earned,spent:a.metal_spent,adjustments:a.metal_adjustments,final:final.economy.metal,residual:final.economy.metal-(initial.metal+a.metal_earned-a.metal_spent+a.metal_adjustments)}};
      const {checkpoint:_,...publicRecording}=r;
      const pauses=clean(r.session.pause_intervals);for(const pause of pauses)if(pause.ended_at===null)pause.wall_duration_s=Math.max(0,(r.checkpoint.at_ms-Date.parse(pause.started_at))/1000);
      const recording=clean({...publicRecording,metadata:{...r.metadata,exported_at:new Date(this.now()).toISOString(),export_language:this.language(),storage_backend:this.storage?.backend??'memory',storage_limit_bytes:this.storageLimit,storage_warning:this.storage?.warning||this.warning||null},session:{...r.session,pause_intervals:pauses},final_snapshot:final,summary});
      output=format==='full'?JSON.stringify(recording,null,2):JSON.stringify(compactRecording(recording));
    });return output;
  }
  filename(format:'compact'|'full'='compact') {return `playtest_${this.c.profile.toUpperCase()}_${new Date(this.now()).toISOString().slice(0,10)}_${this.r?.session.session_id??'session'}${format==='full'?'_full':''}.json`;}
  destroy(){this.unsubscribe();}
}



