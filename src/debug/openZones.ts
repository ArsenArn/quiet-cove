import type {Balance} from '../config/types';
import type {GameState} from '../game/state';
// Debug-only reveal. Does not buy boats/upgrades, change quest progress, costs or timers.
export function openDebugZones(c:Balance,s:GameState){
  s.area=2;s.flags.storage=true;s.flags.cutter=true;
  for(const node of Object.values(s.nodes))node.unlocked=true;
  for(const category of Object.keys(c.interaction.reveal_at_quest))s.revealedPurchases[category]=true;
}
