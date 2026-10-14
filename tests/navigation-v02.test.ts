import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import type { Balance } from '../src/config/types';
import { Engine } from '../src/game/engine';
import { onLand, routeTo, clearSegment, navigateTo, distance, resolveLand } from '../src/game/systems/movement';
import { FrameClock, VisibilityLifecycle } from '../src/game/systems/timing';
import { offers, purchasePoint } from '../src/game/systems/construction';
const config=()=>JSON.parse(fs.readFileSync('public/balance/balance_fast.json','utf8')) as Balance;
describe('v0.2 navigation and resume',()=>{
 it('all docks, fish nodes and purchase points are on water and reachable in their territory',()=>{
  const c=config(),e=new Engine(c);e.state.area=2;e.state.flags.storage=true;e.state.flags.cutter=true;e.state.nodes.wreck.unlocked=true;
  const points=[c.world.port,c.world.storage,...Object.values(c.resources),...offers(c,e.state).map(o=>purchasePoint(c,o.id))];
  for(const p of points){expect(onLand(c,p),JSON.stringify(p)).toBe(false);let prev=c.world.spawn;const path=routeTo(c,prev,p,2);expect(path.length,JSON.stringify(p)).toBeGreaterThan(0);for(const next of path){expect(clearSegment(c,prev,next)).toBe(true);prev=next;}expect(distance(prev,p)).toBeLessThan(.1);}
 });
 it('waypoint route crosses around an island and reverse route reaches port without crossing land',()=>{
  const c=config(),boat={x:1130,y:1340,angle:0},goal={x:650,y:1340};let ticks=0;const path=routeTo(c,boat,goal,1);expect(path.length).toBeGreaterThan(1);
  while(distance(boat,goal)>2&&ticks++<2000){navigateTo(c,boat,goal,165,.03,1,1);expect(onLand(c,boat)).toBe(false);}expect(ticks).toBeLessThan(2000);
  while(distance(boat,c.world.port)>2&&ticks++<4000){navigateTo(c,boat,c.world.port,165,.03,1,1);expect(onLand(c,boat)).toBe(false);}expect(ticks).toBeLessThan(4000);
 });
 it('manual movement slides at coast; embedded old save positions escape without a reset',()=>{
  const c=config(),e=new Engine(c),p=e.state.boats[0];Object.assign(p,{x:1040,y:1340});e.input={x:-1,y:.4};e.update(2);expect(onLand(c,p)).toBe(false);expect(p.y).toBeGreaterThan(1340);
  Object.assign(p,{x:880,y:1340});resolveLand(c,p);expect(onLand(c,p)).toBe(false);
 });
 it('confirms installed Phaser smoothing undercounts 30fps during focus cooldown',()=>{
  const source=fs.readFileSync('node_modules/phaser/src/core/TimeStep.js','utf8'),start=source.indexOf('smoothDelta: function (delta)'),bodyStart=source.indexOf('{',start)+1,bodyEnd=source.indexOf('\n    },',bodyStart);
  const smooth=new Function('delta',source.slice(bodyStart,bodyEnd));
  const loop={deltaIndex:0,deltaHistory:Array(10).fill(1000/60),deltaSmoothingMax:10,_coolDown:120,inFocus:true,_target:1000/60,_min:200};
  expect(smooth.call(loop,1000/30)).toBeCloseTo(1000/60); // Exact local Phaser code, not a hypothetical cause.
 });
 it('visibility suspend/resume advances only offline timers, resets frame epoch and restores full 30fps movement',()=>{
  const c=config(),e=new Engine(c),clock=new FrameClock(),life=new VisibilityLifecycle(e,clock),p=e.state.boats[0];
  clock.step(0);e.input={x:1,y:0};e.update(clock.step(1000/30));const first=p.x;
  life.suspend(1000);life.suspend(1001);e.update(5);expect(p.x).toBe(first);const coins=e.state.coins;
  life.resume(11000);life.resume(11001);expect(e.paused).toBe(false);expect(e.state.time).toBeCloseTo(10+1/30);expect(e.state.coins).toBe(coins);expect(clock.step(20000)).toBe(0);
  e.input={x:1,y:0};for(let i=1;i<=30;i++)e.update(clock.step(20000+i*1000/30));expect(p.x-first).toBeCloseTo(c.units.player.speed,5);expect(clock.step(90000)).toBe(.1);
 });
});
