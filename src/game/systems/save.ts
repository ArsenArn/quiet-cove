import type { Balance, Profile } from '../../config/types';
import type { GameState } from '../state';
import {revealPurchases} from './construction';
import {clampToWorld,resolveLand,syncBuildingObstacles} from './movement';
export interface StorageLike { getItem(key: string): string | null; setItem(key: string,value: string): void; removeItem(key: string): void }
export const saveKey=(profile: Profile)=>`quiet_cove_${profile}_v1`;
export function saveGame(storage: StorageLike,state: GameState,now=Date.now()) { storage.setItem(saveKey(state.profile),JSON.stringify({savedAt:now,state})); }
export function loadGame(storage: StorageLike,c: Balance,now=Date.now()): { state: GameState; offline: number } | null {
  const raw=storage.getItem(saveKey(c.profile)); if(!raw) return null;
  const parsed=JSON.parse(raw),s=parsed.state as GameState;
  const legacy=(s as unknown as {version:number})?.version===1;
  const needsV031=!s?.purchaseGuards || s?.stats?.income_sources_v031!==1;
  const previousVersion=(s as unknown as {version:number})?.version;
  const migrate=previousVersion===1 || previousVersion===2;
  if(legacy) {
    // The original cash and rewarded IDs stay authoritative. Old catches included pickups:
    // retain them as the historical baseline, separate sources only from this migration on.
    s.questStatus='active'; s.coinStacks=[];
    s.stats.fish_received=s.stats.catch_total??0;
    s.stats.legacy_catch_total=s.stats.catch_total??0;
    Object.assign(s.golden,{x:s.boats[0].x,y:s.boats[0].y,angle:0,origin:s.golden.expires!==null?{x:s.boats[0].x,y:s.boats[0].y}:null});
  }
  if(migrate){s.version=3;s.revealedPurchases={};if(Array.isArray(s.coinStacks))for(const p of s.coinStacks)p.source='fish_sale';if(s.golden)Object.assign(s.golden,{offerId:s.golden.expires===null?null:s.nextId++,transaction:null});}
  if(!s || s.version!==3 || s.profile!==c.profile || !s.revealedPurchases || typeof s.revealedPurchases!=='object' || Object.values(s.revealedPurchases).some(v=>typeof v!=='boolean') || !Array.isArray(s.coinStacks) || !['active','completed_unclaimed'].includes(s.questStatus) || !Array.isArray(s.boats) || s.boats[0]?.id!=='player' || !Array.isArray(s.rewarded) || !Array.isArray(s.events) || !Array.isArray(s.crates) || !s.nodes || !s.orders || !s.stats || !s.flags || !s.golden || !Array.isArray(s.enemies) || !Array.isArray(s.projectiles)) throw Error('Несовместимое сохранение');
  const finite=(n: unknown)=>typeof n==='number' && Number.isFinite(n) && n>=0;
  if(s.pirateSpawnBlocked!==undefined && typeof s.pirateSpawnBlocked!=='boolean')throw Error('Повреждено состояние спавна');
  for(const key of ['time','coins','metal','questIndex','cargoLevel','nextId','questBaseline','eventSeq','rng','nextPirateAt'] as const) if(!finite(s[key])) throw Error(`Повреждено сохранение: ${key}`);
  if(!Number.isInteger(s.questIndex) || s.questIndex>c.quests.length || !Number.isInteger(s.cargoLevel) || !c.units.player.capacity[s.cargoLevel] || !finite(parsed.savedAt)) throw Error('Поврежден индекс прогресса');
  if(!Number.isInteger(s.nextId) || s.nextId<1 || !finite(s.golden.nextAt) || (s.golden.expires!==null && !finite(s.golden.expires)) || Object.values(s.stats).some(n=>!finite(n)) || Object.values(s.flags).some(v=>typeof v!=='boolean')) throw Error('Повреждены счётчики');
  const crateIds=new Set<number>(),boatIds=new Set<string>();
  const checkCargo=(item: GameState['crates'][number] | GameState['boats'][number]['cargo'][number])=>{ if(!c.resources[item.resource] || !Number.isInteger(item.id) || item.id<1 || !finite(item.value) || c.resources[item.resource].kind!==item.kind || crateIds.has(item.id)) throw Error('Повреждён или дублируется груз'); crateIds.add(item.id); };
  for(const b of [...s.boats,...s.defender?[s.defender]:[]]) { if(typeof b.id!=='string' || boatIds.has(b.id) || !['player','worker','speedboat','salvage'].includes(b.kind) || !finite(b.x) || !finite(b.y) || !Array.isArray(b.cargo) || !['SELECT','TO_PICKUP','GATHER','RETURN','UNLOAD','WAIT'].includes(b.state) || !finite(b.hp) || !finite(b.gather) || !finite(b.unload) || !finite(b.attackAt) || !finite(b.respawnAt) || !Number.isFinite(b.angle)) throw Error('Повреждена лодка'); boatIds.add(b.id); for(const item of b.cargo) checkCargo(item); }
  for(const crate of s.crates) { checkCargo(crate); if(!finite(crate.x) || !finite(crate.y)) throw Error('Повреждена позиция ящика'); if(crate.expiresAt!==undefined && !finite(crate.expiresAt))throw Error('Повреждён срок ящика'); if(crate.reservedBy && !s.boats.some(b=>b.id===crate.reservedBy)) crate.reservedBy=null; }
  for(const id of Object.keys(c.resources)) { const n=s.nodes[id];if(!n || !Number.isInteger(n.stock) || !finite(n.stock) || !finite(n.hp) || !finite(n.readyAt) || typeof n.unlocked!=='boolean' || !['ready','regrow','restock'].includes(n.phase) || (n.phase==='ready' && (!n.stock || !n.hp))) throw Error(`Поврежден ресурс ${id}`); }
  for(const [id,o] of Object.entries(s.orders)) {if(!o || o.id!==id || !finite(o.paid) || !finite(o.cost) || !finite(o.metalPaid) || !finite(o.metalCost) || !finite(o.duration) || o.paid>o.cost || o.metalPaid>o.metalCost || typeof o.complete!=='boolean' || (o.readyAt!==null && !finite(o.readyAt)) || (o.readyAt!==null && (o.paid!==o.cost || o.metalPaid!==o.metalCost)) || (o.complete && o.readyAt===null)) throw Error(`Поврежден заказ ${id}`);}
  for(const e of s.enemies) if(!finite(e.x) || !finite(e.y) || !finite(e.hp) || !finite(e.home?.x) || !finite(e.home?.y) || !finite(e.attackAt) || !['PATROL','CHASE','RETURN'].includes(e.state)) throw Error('Поврежден пират');
  for(const p of s.projectiles) if(!finite(p.x) || !finite(p.y) || !finite(p.damage) || !finite(p.expires) || !['friendly','pirate'].includes(p.faction)) throw Error('Поврежден гарпун');
  if(new Set(s.rewarded).size!==s.rewarded.length || s.rewarded.some(n=>!Number.isInteger(n) || n<1 || n>c.quests.length)) throw Error('Повреждены награды');
  const coinIds=new Set<number>();
  if(!finite(s.golden.x)||!finite(s.golden.y)||!Number.isFinite(s.golden.angle)||(s.golden.origin!==null&&(!finite(s.golden.origin.x)||!finite(s.golden.origin.y)))) throw Error('Поврежден торговый катер');
  if(s.golden.offerId!==null && (!Number.isInteger(s.golden.offerId)||s.golden.offerId<1))throw Error('Поврежден ID торгового катера');
  const transaction=s.golden.transaction;
  if(transaction!==null){
    if(!transaction || !Number.isInteger(transaction.id) || transaction.id<1 || transaction.offerId!==s.golden.offerId || !Number.isInteger(transaction.reward) || transaction.reward<c.presentation.golden_pile_count || !['offered','watching','spawned','cancelled'].includes(transaction.status) || !Array.isArray(transaction.pileIds) || new Set(transaction.pileIds).size!==transaction.pileIds.length || transaction.pileIds.some(id=>!Number.isInteger(id)||id<1) || (transaction.status==='spawned'?transaction.pileIds.length!==c.presentation.golden_pile_count:transaction.pileIds.length!==0))throw Error('Повреждена золотая транзакция');
    // Reload cannot certify an interrupted fake ad: retry while the merchant is still alive.
    if(transaction.status==='watching')transaction.status='offered';
  }
  for(const p of s.coinStacks) { if(!Number.isInteger(p.id) || p.id<1 || coinIds.has(p.id) || crateIds.has(p.id) || !finite(p.value) || p.value<=0 || !finite(p.x) || !finite(p.y) || !finite(p.availableAt) || typeof p.attracting!=='boolean' || !['fish_sale','golden_reward','quest_reward','debug_grant'].includes(p.source)) throw Error('Повреждены монеты'); coinIds.add(p.id);if(migrate){clampToWorld(p,c,s.area);resolveLand(c,p);} }
  if(legacy && !storage.getItem(`${saveKey(c.profile)}_backup_before_v02`)) storage.setItem(`${saveKey(c.profile)}_backup_before_v02`,raw);
  if(migrate && !storage.getItem(`${saveKey(c.profile)}_backup_before_v03`))storage.setItem(`${saveKey(c.profile)}_backup_before_v03`,raw);
  if(s.purchaseGuards!==undefined && (!s.purchaseGuards || typeof s.purchaseGuards!=='object' || Array.isArray(s.purchaseGuards) || Object.entries(s.purchaseGuards).some(([id,g])=>!g || !finite(g.cooldownUntil) || typeof g.needsExit!=='boolean' || !(id in c.interaction.purchase_points || id.startsWith('resource:') && id.split(':')[1] in c.resources))))throw Error('Повреждена защита покупки');
  if(needsV031){
    if(!storage.getItem(`${saveKey(c.profile)}_backup_before_v031`))storage.setItem(`${saveKey(c.profile)}_backup_before_v031`,raw);
    if(!s.purchaseGuards){
      s.purchaseGuards={};
      for(const o of Object.values(s.orders))if(o.readyAt!==null){const category=o.id.startsWith('resource:')?o.id:o.id.split(':')[0];s.purchaseGuards[category]={cooldownUntil:s.time+c.interaction.purchase_cooldown_s,needsExit:true};}
      // Some early legacy saves only contain owned boats/levels, without completed orders.
      for(const category of ['cargo','worker','salvage'])if(category==='cargo'?s.cargoLevel>0:s.boats.some(b=>b.kind===category))s.purchaseGuards[category]??={cooldownUntil:s.time+c.interaction.purchase_cooldown_s,needsExit:true};
    }
    if(s.stats.income_sources_v031!==1){
      const gold=s.stats.golden_collected??0,fish=s.stats.fish_sales_earned??0;
      s.stats.golden_bonus_income=gold;s.stats.earn_coins=fish+gold;
      s.stats.quest_reward_income=s.rewarded.reduce((sum,id)=>sum+c.quests[id-1].reward_coins,0);
      s.stats.debug_income??=0;s.stats.total_earned_coins=fish+gold+s.stats.quest_reward_income+s.stats.debug_income;
      // Old income quests had a fish-only baseline. Preserve their current earned progress,
      // excluding already collected historical golden coins; pending coins still count on pickup.
      const q=c.quests[s.questIndex];if(q?.type==='earn_coins' && q.progress_mode==='since_activation')s.questBaseline+=gold;
      s.stats.income_sources_v031=1;
    }
    // Old fixed per-frame payments were fractional. Refund only their fractional paid tails
    // to the same wallet, preserving wallet + paid before switching to integer targets.
    for(const o of Object.values(s.orders))if(o.readyAt===null){s.coins+=o.paid-Math.floor(o.paid);s.metal+=o.metalPaid-Math.floor(o.metalPaid);o.paid=Math.floor(o.paid);o.metalPaid=Math.floor(o.metalPaid);}
    for(const key of ['coins','metal'] as const)if(Math.abs(s[key]-Math.round(s[key]))<1e-7)s[key]=Math.round(s[key]);
  }
  for(const crate of s.crates){crate.expiresAt??=s.time+c.world.floating_crate_lifetime_s;clampToWorld(crate,c,s.area);resolveLand(c,crate);}
  if(s.portRules===undefined){
    if(!storage.getItem(`${saveKey(c.profile)}_backup_before_v07f`))storage.setItem(`${saveKey(c.profile)}_backup_before_v07f`,raw);
    // v0.7e FAST saves already had a free second dock after expansion.
    if(s.area===2 && c.profile==='fast')s.flags.secondPort=true;
    s.portRules=1;
  }
  if(s.portRules!==1)throw Error('Повреждены правила порта');
  s.playerLastDamageAt??=s.time;
  if(!finite(s.playerLastDamageAt) || s.playerLastDamageAt>s.time)throw Error('Повреждено время урона');
  syncBuildingObstacles(c,s);
  for(const b of [...s.boats,...s.defender?[s.defender]:[],...s.enemies])resolveLand(c,b);
  revealPurchases(c,s);
  for(const id of [...coinIds,...crateIds,s.golden.offerId??0,transaction?.id??0,...transaction?.pileIds??[]])s.nextId=Math.max(s.nextId,id+1);
  return {state:s,offline:Math.max(0,(now-parsed.savedAt)/1000)};
}
