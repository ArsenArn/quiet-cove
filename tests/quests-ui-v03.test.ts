import {fishUnload} from '../src/game/systems/delivery';
import {it,expect} from 'vitest';
import fs from 'node:fs';
import type {Balance} from '../src/config/types';
import {Engine} from '../src/game/engine';
import {questFocusTarget,CameraGuidance} from '../src/game/systems/guidance';
import {updateQuests} from '../src/game/systems/quests';
const config=()=>JSON.parse(fs.readFileSync('public/balance/balance_fast.json','utf8')) as Balance;
it('completed_unclaimed claims once and next target resolves without moving player',()=>{
 const c=config(),e=new Engine(c),p={...e.state.boats[0]};e.state.stats.catch_sardine=1;updateQuests(c,e.state);expect(e.state.questStatus).toBe('completed_unclaimed');
 expect(e.claimQuest(1)).toBe(true);expect(e.claimQuest(1)).toBe(false);expect(e.state.rewarded).toEqual([1]);expect(e.state.boats[0]).toEqual(p);
 e.state.questIndex=3;expect(questFocusTarget(c,e.state)).toEqual(c.interaction.purchase_points.cargo);
});
it('all 34 targets resolve; metal chooses storage only with loaded metal; invalid targets fall back safely',()=>{
 const c=config(),e=new Engine(c),s=e.state;for(let i=0;i<34;i++){s.questIndex=i;s.area=c.quests[i].zone;const p=questFocusTarget(c,s);expect(Number.isFinite(p.x)&&Number.isFinite(p.y)).toBe(true);expect(p.x).toBeLessThan(c.world.width);}
 s.area=2;s.questIndex=23;expect(questFocusTarget(c,s)).toMatchObject({x:c.resources.wreck.x,y:c.resources.wreck.y});s.boats[0].cargo=[{id:999,resource:'wreck',kind:'metal',value:0}];expect(questFocusTarget(c,s)).toEqual(c.world.storage);
 s.questIndex=4;c.quests[4].target='missing';expect(questFocusTarget(c,s)).toEqual(fishUnload(c,s));
});
it('camera interpolates, returns and cancels safely; repeated hints replace stale targets',()=>{
 const c=config(),camera=new CameraGuidance(),p={x:100,y:100},target={x:800,y:500};camera.begin(p,target);
 const mid=camera.step(c.presentation.camera_move_duration_s/2,p,c.presentation);expect(mid.x).toBeGreaterThan(p.x);expect(mid.x).toBeLessThan(target.x);expect(p).toEqual({x:100,y:100});
 camera.step(c.presentation.camera_move_duration_s/2,p,c.presentation);expect(camera.highlighting).toBe(true);
 camera.step(c.presentation.camera_focus_duration_s+.01,p,c.presentation);expect(camera.mode).toBe('RETURN_TO_PLAYER');camera.step(c.presentation.camera_return_duration_s,p,c.presentation);expect(camera.mode).toBe('FOLLOW_PLAYER');expect(camera.target).toBeNull();
 camera.begin(p,target);camera.begin(p,{x:900,y:200});expect(camera.target).toEqual({x:900,y:200});camera.cancel();expect(camera.step(1,p,c.presentation)).toEqual(p);
});
it('modal control lock blocks movement and purchases while actual construction timers continue',()=>{
 const c=config(),e=new Engine(c),s=e.state;s.questIndex=5;s.coins=1000;Object.assign(s.boats[0],c.interaction.purchase_points.worker);e.lockControls('modal');e.input={x:1,y:0};const p={x:s.boats[0].x,y:s.boats[0].y};e.update(1);expect(s.boats[0]).toMatchObject(p);expect(s.orders['worker:0']).toBeUndefined();expect(s.time).toBeCloseTo(1);
 e.unlockControls('modal');e.input={x:0,y:0};e.update(.24);expect(s.orders['worker:0']).toBeUndefined();e.update(.1);expect(s.orders['worker:0'].paid).toBeGreaterThan(0);
});
