import {describe,it,expect} from 'vitest';
import {movementHeading,directionFrame} from '../src/game/art/registry';
import {resourceDressing} from '../src/game/art/sceneAssembly';
import {loadConfig} from './helpers-art-v05a';
describe('Pass 2 renderer safeguards',()=>{
  it('Golden uses actual displacement even when the engine angle disagrees, retaining its facing while stationary',()=>{
    const previous=Object.freeze({x:100,y:200,angle:Math.PI/4});
    for(let i=0;i<8;i++){
      const angle=-Math.PI/2+i*Math.PI/4,current=Object.freeze({x:100+Math.cos(angle)*3,y:200+Math.sin(angle)*3});
      expect(directionFrame(movementHeading(previous,current,angle+Math.PI))).toBe(i);
    }
    expect(movementHeading(previous,{x:100,y:200},0)).toBe(previous.angle);
    expect(movementHeading(null,{x:100,y:200},Math.PI)).toBe(Math.PI);
  });
  for(const profile of ['fast','reference'] as const)it(`${profile}: resource dressing stays clear of resource and purchase interaction circles`,()=>{
    const c=loadConfig(profile);
    for(const p of resourceDressing){
      const radius=Math.max(p.width,p.height)/2;
      for(const r of Object.values(c.resources))expect(Math.hypot(p.x-r.x,p.y-r.y)).toBeGreaterThan(c.world.resource_radius+radius);
      for(const point of Object.values(c.interaction.purchase_points))expect(Math.hypot(p.x-point.x,p.y-point.y)).toBeGreaterThan(c.interaction.purchase_radius+radius);
      expect(p.x-radius).toBeGreaterThan(0);expect(p.y+radius).toBeLessThan(c.world.height);
    }
  });
});
