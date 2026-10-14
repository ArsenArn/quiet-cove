import {it,expect} from 'vitest';import fs from 'node:fs';
import type {Balance} from '../src/config/types';import {Engine} from '../src/game/engine';
import {defenderStation} from '../src/config/mapLayout';
import {syncBuildingObstacles,onLand,routeTo,distance,clearSegment} from '../src/game/systems/movement';
const before=JSON.parse(fs.readFileSync('tests/fixtures/ground-ui-before.json','utf8'));
const config=(p:string)=>JSON.parse(fs.readFileSync(`public/balance/balance_${p}.json`,'utf8')) as Balance;
const layoutPaths=['world.storage','second_port.hut','second_port.unload','combat.spawner','combat.defender_spawn','combat.defender_home','presentation.defender_patrol.0','presentation.defender_patrol.1','presentation.defender_patrol.2','navigation.obstacles.6.x','navigation.obstacles.6.y','resources.lobster.y','resources.wreck.x','resources.wreck.y','resources.squid.x','resources.squid.y','docks.3.x','docks.3.y','docks.3.end','zone2_layout.fish_unload','zone2_layout.purchase_label_positions',...['worker','speedboat','defender','storage','storageUpgrade','cutter','salvage','den','route','secondPort'].map(id=>'interaction.purchase_points.'+id)];
function withoutLayout(c:Balance){const copy=structuredClone(c);for(const path of layoutPaths){const keys=path.split('.');let value:any=copy;for(const k of keys.slice(0,-1))value=value?.[k];if(value)delete value[keys.at(-1)!];}return copy;}
it.each(['fast','reference'])('%s changes only the authorized layout fields, preserving all economy, quests and controls',profile=>{
 expect(withoutLayout(config(profile))).toEqual(withoutLayout(before[profile]));
});
it.each(['fast','reference'])('%s relocated circles remain separate, entirely navigable, and match building colliders',profile=>{
 const c=config(profile),s=new Engine(c).state;s.area=2;s.flags.secondPort=true;syncBuildingObstacles(c,s);
 const circles=[...['defender','storage','storageUpgrade','cutter','salvage','den','route','secondPort'].map(id=>({id,...c.interaction.purchase_points[id],radius:c.interaction.purchase_radius})),{id:'fishUnload',...c.second_port!.unload,radius:c.world.deposit_radius},{id:'metalUnload',...c.world.storage,radius:c.world.deposit_radius},...Object.entries(c.resources).filter(([,r])=>r.zone===2).map(([id,r])=>({id,...r,radius:c.world.resource_radius}))];
 for(const [i,a] of circles.entries()){
  for(const b of circles.slice(i+1))expect(distance(a,b),a.id+' / '+b.id).toBeGreaterThan(a.radius+b.radius+6);
  expect(onLand(c,a),a.id).toBe(false);for(let j=0;j<32;j++){const angle=j*Math.PI/16;expect(onLand(c,{x:a.x+Math.cos(angle)*a.radius,y:a.y+Math.sin(angle)*a.radius}),a.id).toBe(false);}
  const path=routeTo(c,c.world.spawn,a,2);expect(path.length,a.id).toBeGreaterThan(0);expect(distance(path.at(-1)!,a)).toBeLessThan(.01);let previous=c.world.spawn;for(const p of path){expect(clearSegment(c,previous,p),a.id).toBe(true);previous=p;}
 }
 const dock=defenderStation(c);expect(onLand(c,{x:dock.x,y:dock.y+30})).toBe(true);expect(onLand(c,{x:c.second_port!.hut.x,y:c.second_port!.hut.y+28})).toBe(true);expect(onLand(c,c.combat.defender_spawn)).toBe(false);
 for(const point of c.presentation.defender_patrol)expect(onLand(c,point)).toBe(false);
 const home=c.combat.defender_home!;
 expect(distance(home,c.combat.defender_spawn)).toBeLessThan(c.combat.chase_radius);
 // Both native spawn slots must stay inside the relocated guarded territory.
 for(let i=0;i<c.combat.max_enemies;i++)expect(distance(home,{x:c.combat.spawner.x+110+i*(c.navigation.traffic!.radii.pirate*2+c.navigation.traffic!.arrival_spacing),y:c.combat.spawner.y})).toBeLessThan(c.combat.chase_radius);
});
