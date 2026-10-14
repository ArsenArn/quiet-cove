import fs from 'node:fs';import type {Balance} from '../src/config/types';
const before=JSON.parse(fs.readFileSync('tests/fixtures/ground-ui-before.json','utf8'));
const paths=['world.storage','second_port.hut','second_port.unload','combat.spawner','combat.defender_spawn','combat.defender_home','presentation.defender_patrol.0','presentation.defender_patrol.1','presentation.defender_patrol.2','navigation.obstacles.6.x','navigation.obstacles.6.y','resources.lobster.y','resources.wreck.x','resources.wreck.y','resources.squid.x','resources.squid.y','docks.3.x','docks.3.y','docks.3.end','zone2_layout.fish_unload','zone2_layout.purchase_label_positions',...['worker','speedboat','defender','storage','storageUpgrade','cutter','salvage','den','route','secondPort'].map(id=>'interaction.purchase_points.'+id)];
// Old protection suites retain literal economy checks; only the authorized
// coordinates are restored. The new layout has its own geometry and scope suite.
export function restoreGroundLayout(c:Balance):Balance {
 const copy=structuredClone(c),old=before[c.profile];
 for(const path of paths){const keys=path.split('.');let target:any=copy,source:any=old;for(const k of keys.slice(0,-1)){target=target?.[k];source=source?.[k];}if(target){const key=keys.at(-1)!;if(source?.[key]===undefined)delete target[key];else target[key]=structuredClone(source[key]);}}
 return copy;
}
