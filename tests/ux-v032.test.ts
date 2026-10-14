import {it,expect,vi,afterEach} from 'vitest';
import fs from 'node:fs';
import type {Balance,Point} from '../src/config/types';
import {Joystick} from '../src/ui/Joystick';
import {Engine} from '../src/game/engine';
import {makeBoat} from '../src/game/state';
import {activateQuest,updateQuests} from '../src/game/systems/quests';
import {CameraGuidance,nextQuestHintTarget,questFocusTarget} from '../src/game/systems/guidance';
import {saveGame,loadGame} from '../src/game/systems/save';
const config=(profile='fast')=>JSON.parse(fs.readFileSync(`public/balance/balance_${profile}.json`,'utf8')) as Balance;
afterEach(()=>vi.unstubAllGlobals());
// Native capture/hit testing is covered by browser-v032; these tests cover ownership/lifecycle.
class Element extends EventTarget {
 hidden=false;style={left:'',top:'',transform:'',setProperty:vi.fn()};captures=new Set<number>();
 setPointerCapture(id:number){this.captures.add(id);}
 hasPointerCapture(id:number){return this.captures.has(id);}
 releasePointerCapture(id:number){this.captures.delete(id);}
}
function fixture(allowed=true){
 const surface=new Element(),pad=new Element(),thumb=new Element(),win=new EventTarget(),doc=Object.assign(new EventTarget(),{hidden:false});
 vi.stubGlobal('window',win);vi.stubGlobal('document',doc);
 let vector:Point={x:0,y:0};const started=vi.fn(),permit=vi.fn(()=>allowed);
 const stick=new Joystick(surface as unknown as HTMLElement,pad as unknown as HTMLElement,thumb as unknown as HTMLElement,()=>config().interaction,p=>vector=p,started,permit);
 const fire=(type:string,id=1,x=200,y=300,button=0)=>{const event=Object.assign(new Event(type,{cancelable:true}),{pointerId:id,clientX:x,clientY:y,button});surface.dispatchEvent(event);};
 return {surface,pad,thumb,win,doc,stick,fire,started,permit,get vector(){return vector;}};
}
it('floating origin is exact, stationary press is zero, thumb clamps and second pointer cannot steal control',()=>{
 const f=fixture();expect(f.pad.hidden).toBe(true);f.fire('pointerdown');expect(f.pad.hidden).toBe(false);expect(f.pad.style).toMatchObject({left:'200px',top:'300px'});expect(f.vector).toEqual({x:0,y:0});expect(f.surface.hasPointerCapture(1)).toBe(true);
 f.fire('pointermove',1,202,300);expect(f.vector).toEqual({x:0,y:0});f.fire('pointermove',1,1200,1300);expect(Math.hypot(f.vector.x,f.vector.y)).toBeCloseTo(1);expect(f.thumb.style.transform).toContain('24.748');
 f.fire('pointerdown',2,600,700);f.fire('pointermove',2,100,100);f.fire('pointerup',2);expect(f.stick.active).toBe(true);expect(f.started).toHaveBeenCalledTimes(1);expect(f.pad.style.left).toBe('200px');f.fire('pointerup');expect(f.vector).toEqual({x:0,y:0});expect(f.pad.hidden).toBe(true);expect(f.surface.captures.size).toBe(0);
});
it.each(['pointercancel','lostpointercapture','blur','hidden','reset','destroy'])('%s releases capture and movement; later input recovers unless destroyed',reason=>{
 const f=fixture();f.fire('pointerdown');f.fire('pointermove',1,250,300);
 if(reason==='blur')f.win.dispatchEvent(new Event('blur'));else if(reason==='hidden'){f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));}else if(reason==='reset')f.stick.reset();else if(reason==='destroy')f.stick.destroy();else f.fire(reason);
 expect(f.stick.active).toBe(false);expect(f.vector).toEqual({x:0,y:0});expect(f.pad.hidden).toBe(true);expect(f.surface.captures.size).toBe(0);f.doc.hidden=false;f.fire('pointerdown',3);expect(f.stick.active).toBe(reason!=='destroy');f.stick.destroy();
});
it('UI/object/land denial and right button do not create joystick or capture',()=>{
 const f=fixture(false);f.fire('pointerdown');expect(f.stick.active).toBe(false);expect(f.started).not.toHaveBeenCalled();expect(f.pad.hidden).toBe(true);const g=fixture();g.fire('pointerdown',1,200,300,2);expect(g.stick.active).toBe(false);expect(g.permit).not.toHaveBeenCalled();
});
it.each(['fast','reference'])('%s skips all 34 pending targets, keeps individual claims and survives save/reload',profile=>{
 const c=config(profile),e=new Engine(c),s=e.state;
 for(let i=0;i<c.quests.length;i++){s.questIndex=i;s.area=c.quests[i].zone;activateQuest(c,s);expect(nextQuestHintTarget(c,s)).toEqual(questFocusTarget(c,s));s.questStatus='completed_unclaimed';const before=structuredClone(s);expect(nextQuestHintTarget(c,s)).toBeNull();expect(s).toEqual(before);}
 s.questIndex=c.quests.findIndex(q=>q.type==='speedboat_ordered');s.questStatus='completed_unclaimed';s.rewarded=[];
 const boatQuest=c.quests[s.questIndex],readyQuest=c.quests[s.questIndex+1];s.orders.speedboat={id:'speedboat',cost:0,metalCost:0,paid:0,metalPaid:0,duration:1,readyAt:1,complete:true};s.boats.push(makeBoat('fast-test','speedboat',c.world.port));
 expect(e.claimQuest(boatQuest.id)).toBe(true);expect(s.questStatus).toBe('completed_unclaimed');expect(nextQuestHintTarget(c,s)).toBeNull();expect(s.rewarded).toEqual([boatQuest.id]);
 const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};saveGame(storage,s,1000);const restored=new Engine(c,loadGame(storage,c,1000)!.state);expect(restored.state.questStatus).toBe('completed_unclaimed');expect(nextQuestHintTarget(c,restored.state)).toBeNull();expect(restored.claimQuest(readyQuest.id)).toBe(true);expect(nextQuestHintTarget(c,restored.state)).toMatchObject({x:c.resources.mussel.x,y:c.resources.mussel.y});expect(restored.state.rewarded).toEqual([boatQuest.id,readyQuest.id]);
 s.nodes.mussel.unlocked=true;expect(e.claimQuest(readyQuest.id)).toBe(true);expect(s.questStatus).toBe('completed_unclaimed');expect(nextQuestHintTarget(c,s)).toBeNull();expect(s.rewarded).toEqual([boatQuest.id,readyQuest.id]);expect(e.claimQuest(readyQuest.id)).toBe(false);
 s.questIndex=c.quests.length;s.questStatus='active';expect(nextQuestHintTarget(c,s)).toBeNull();
});
it('unfinished speedboat shows dock; movement through full camera duration returns to current position',()=>{
 const c=config(),e=new Engine(c),s=e.state;s.questIndex=c.quests.findIndex(q=>q.type==='speedboat_ordered');s.questStatus='completed_unclaimed';s.orders.speedboat={id:'speedboat',cost:0,metalCost:0,paid:0,metalPaid:0,duration:100,readyAt:100,complete:false};expect(e.claimQuest(c.quests[s.questIndex].id)).toBe(true);expect(s.questStatus).toBe('active');expect(nextQuestHintTarget(c,s)).toEqual(c.interaction.purchase_points.speedboat);
 const camera=new CameraGuidance(),p=s.boats[0],target={x:1600,y:900};Object.assign(p,{x:1300,y:1750});camera.begin(p,target);const durations=c.presentation,total=durations.camera_move_duration_s+durations.camera_focus_duration_s+durations.camera_return_duration_s;e.input={x:1,y:0};
 for(let t=0;t<total-.02;t+=.02){e.update(.02);camera.step(.02,p,durations);}expect(camera.mode).not.toBe('FOLLOW_PLAYER');const pos=camera.step(.04,p,durations);expect(camera.mode).toBe('FOLLOW_PLAYER');expect(pos).toMatchObject({x:p.x,y:p.y});expect(p.x).toBeGreaterThan(1300);updateQuests(c,s);expect(s.rewarded).toHaveLength(1);
});
