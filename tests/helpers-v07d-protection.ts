import {restoreGroundLayout} from './helpers-ground-ui-protection';
import type {Balance} from '../src/config/types';
// Normalize only the three explicitly authorized FAST gameplay/layout fields
// when older suites compare against pre-v0.7d fixtures. Economy stays literal.
export function legacyLayout(c:Balance):Balance {
  const copy=restoreGroundLayout(c);
  delete copy.second_port;delete copy.player_regen;
  delete copy.interaction.purchase_points.secondPort;delete copy.interaction.reveal_at_quest.secondPort;
  if(copy.profile==='fast'){
    copy.combat.max_enemies=3;
    copy.interaction.purchase_points.salvage={x:2690,y:1510};
    copy.interaction.purchase_points.storageUpgrade={x:2600,y:1370};
    delete copy.zone2_layout;
  }
  return copy;
}
