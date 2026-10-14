import {it,expect} from 'vitest';
import fs from 'node:fs';
import type {Balance} from '../src/config/types';
import {distance,onLand,routeTo,clearSegment} from '../src/game/systems/movement';
it.each(['fast','reference'])('%s geometry separates interactions and routes every point over water',profile=>{
 const c=JSON.parse(fs.readFileSync(`public/balance/balance_${profile}.json`,'utf8')) as Balance;
 const purchases=[...Object.values(c.interaction.purchase_points),...Object.entries(c.resources).filter(([id])=>id!=='sardine').map(([,r])=>r)];
 for(let i=0;i<purchases.length;i++)for(let j=i+1;j<purchases.length;j++)expect(distance(purchases[i],purchases[j])).toBeGreaterThan(c.interaction.purchase_radius*2+12);
 for(const r of Object.values(c.resources)){
  expect(distance(r,r.kind==='fish'?c.world.port:c.world.storage)).toBeGreaterThan(c.world.resource_radius+c.world.deposit_radius+60);
 }
 expect(distance(c.resources.sardine,c.world.port)/c.units.player.speed).toBeGreaterThan(2);
 for(const p of [...purchases,c.world.port,c.world.storage,c.resources.sardine]){
  expect(onLand(c,p),JSON.stringify(p)).toBe(false);
  const path=routeTo(c,c.world.spawn,p,p.x<c.world.gate_x?1:2);expect(path.length).toBeGreaterThan(0);
  let prior=c.world.spawn;for(const next of path){expect(clearSegment(c,prior,next)).toBe(true);prior=next;}
  expect(distance(prior,p)).toBeLessThan(.01);
 }
 for(const p of Object.values(c.interaction.purchase_points))for(const dock of [c.world.port,c.world.storage])expect(distance(p,dock)).toBeGreaterThan(c.interaction.purchase_radius+c.world.deposit_radius+12);
 for(const p of [c.interaction.purchase_points.cargo,c.interaction.purchase_points.worker,c.interaction.purchase_points.speedboat]){
  expect(distance(p,c.world.port)).toBeGreaterThan(c.interaction.purchase_radius+c.world.deposit_radius+20);
  for(const r of Object.values(c.resources))expect(distance(p,r)).toBeGreaterThan(c.interaction.purchase_radius+c.world.resource_radius+20);
 }
});
