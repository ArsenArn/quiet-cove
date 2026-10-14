import type {Balance} from './types';
// One anchor for the station artwork and its solid body.
export function defenderStation(c:Balance){
  const p=c.interaction.purchase_points.defender;
  return {x:p.x+40,y:p.y-180};
}
