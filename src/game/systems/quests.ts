import type { Balance, Quest } from '../../config/types';
import type { GameState } from '../state';
import { creditIncome } from './economy';
import { log } from '../../debug/events';
export function questValue(q: Quest,s: GameState): number {
  switch(q.type) {
    case 'resource_ready': return Number(s.nodes[String(q.target)]?.unlocked);
    case 'cargo_level': return s.cargoLevel;
    case 'normal_workers': return s.boats.filter(b=>b.kind==='worker').length;
    case 'salvage_workers': return s.boats.filter(b=>b.kind==='salvage').length;
    case 'area_unlocked': return s.area;
    case 'speedboat_ordered': return Number(Object.values(s.orders).some(o=>o.id==='speedboat' && o.readyAt!==null));
    case 'speedboat_ready': return Number(s.boats.some(b=>b.kind==='speedboat'));
    case 'defender_ready': return Number(!!s.defender);
    case 'metal_storage_ready': return Number(!!s.flags.storage);
    case 'metal_cutter_owned': return Number(!!s.flags.cutter);
    case 'wreck_ready': return Number(s.nodes.wreck.unlocked);
    case 'metal_storage_capacity': return s.stats.metal_storage_capacity ?? 0;
    case 'pirate_den_closed': return Number(!!s.flags.den);
    case 'expedition_route_ready': return Number(!!s.flags.route);
    default: return s.stats[q.type] ?? 0;
  }
}
export function questProgress(q: Quest,s: GameState) { return Math.max(0,questValue(q,s)-(q.progress_mode==='since_activation'?s.questBaseline:0)); }
export function questTarget(q: Quest) { return typeof q.target === 'number' ? q.target : 1; }
export function activateQuest(c: Balance,s: GameState) { s.questStatus='active'; const q=c.quests[s.questIndex]; if (!q) return; s.questBaseline=q.progress_mode==='since_activation'?questValue(q,s):0; log(s,c.save.max_events,'quest_start',{id:q.id,baseline:s.questBaseline}); }
export function updateQuests(c: Balance,s: GameState) {
  s.stats.metal_storage_capacity = s.flags.storage ? (s.flags.storageUpgrade?c.salvage.upgrade.capacity:c.salvage.storage.capacity):0;
  const q=c.quests[s.questIndex];
  if(!q || s.questStatus==='completed_unclaimed') return;
  const value=questProgress(q,s);
  if(Number.isFinite(value) && value>=questTarget(q)) { s.questStatus='completed_unclaimed'; log(s,c.save.max_events,'quest_complete',{id:q.id}); }
}
export function claimQuest(c: Balance,s: GameState,id: number) {
  const q=c.quests[s.questIndex];
  if(!q || q.id!==id || s.questStatus!=='completed_unclaimed') return false;
  if(!s.rewarded.includes(id)) { s.rewarded.push(id); creditIncome(s,q.reward_coins,'quest_reward'); s.metal+=q.reward_metal; log(s,c.save.max_events,'reward',{source:'quest',id,coins:q.reward_coins,metal:q.reward_metal}); }
  s.questIndex++; activateQuest(c,s); updateQuests(c,s); return true;
}
