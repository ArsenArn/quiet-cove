import type {Balance} from '../src/config/types';
import type {GameState} from '../src/game/state';
import {collectCoins} from '../src/game/systems/economy';
// Unit fixtures explicitly enter pickup range. Real movement is covered in the browser suite.
export function collectAvailablePayouts(c:Balance,s:GameState){
  for(let i=s.coinStacks.length+1;i>0&&s.coinStacks.length;i--){
    const coin=s.coinStacks.find(p=>s.time>=p.availableAt);if(!coin)break;
    Object.assign(s.boats[0],{x:coin.x,y:coin.y});collectCoins(c,s,1);
  }
}
