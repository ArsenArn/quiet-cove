import {legacyLayout} from './helpers-v07d-protection';
import {it,expect} from 'vitest';
import fs from 'node:fs';
import type {Balance} from '../src/config/types';
import {Engine} from '../src/game/engine';
import {makeBoat,newState} from '../src/game/state';
import {pay,purchasePoint,updatePurchases,updateConstruction,skipTimer} from '../src/game/systems/construction';
import {collectCoins,creditIncome,spawnCoins} from '../src/game/systems/economy';
import {activateQuest,questProgress,updateQuests,claimQuest,questValue} from '../src/game/systems/quests';
import {harvest,pickup,updateResources} from '../src/game/systems/resources';
import {updateWorker} from '../src/game/systems/workers';
import {syncBuildingObstacles,onLand,distance,routeTo,clearSegment} from '../src/game/systems/movement';
import {CameraGuidance,questFocusTarget} from '../src/game/systems/guidance';
import {saveGame,loadGame,saveKey} from '../src/game/systems/save';
import {joystickVector} from '../src/ui/Joystick';
import {validateConfig} from '../src/config/load';
const config=(profile='fast')=>JSON.parse(fs.readFileSync(`public/balance/balance_${profile}.json`,'utf8')) as Balance;
const store=()=>{const data=new Map<string,string>();return {data,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)};};
it.each(['cargo','worker','salvage'])('%s station never purchases next object while remaining inside, including reload',category=>{
 const c=config(),e=new Engine(c),s=e.state;s.questIndex=33;s.area=2;s.flags.storage=true;s.flags.cutter=true;s.flags.den=true;s.nodes.wreck.unlocked=true;s.coins=100000;
 const id=category+':'+(category==='cargo'?1:0),next=category+':'+(category==='cargo'?2:1),point=purchasePoint(c,id);Object.assign(s.boats[0],point);
 expect(pay(c,s,id)).toBe(true);expect(skipTimer(c,s,id,true)).toBe(true);const wallet=s.coins;
 e.update(6);expect(s.orders[next]).toBeUndefined();expect(s.coins).toBe(wallet);
 const storage=store();saveGame(storage,s,1000);const restored=new Engine(c,loadGame(storage,c,1000)!.state);restored.update(6);expect(restored.state.orders[next]).toBeUndefined();
 Object.assign(restored.state.boats[0],{x:point.x+c.interaction.purchase_radius+5,y:point.y});restored.update(.1);Object.assign(restored.state.boats[0],point);restored.update(1);expect(restored.state.orders[next]).toBeUndefined();
 Object.assign(restored.state.boats[0],{x:point.x+c.interaction.purchase_radius+c.interaction.purchase_exit_hysteresis+1,y:point.y});restored.update(.1);Object.assign(restored.state.boats[0],point);restored.update(.24);expect(restored.state.orders[next]).toBeUndefined();restored.update(.3);expect(restored.state.orders[next].paid).toBeGreaterThan(0);
});
it('early exit/re-entry cannot bypass five-second cooldown; natural completion resets protection',()=>{
 const c=config(),s=newState(c);s.questIndex=5;s.coins=1000;Object.assign(s.boats[0],purchasePoint(c,'cargo:1'));pay(c,s,'cargo:1');s.time=1;updateConstruction(c,s);
 const point=purchasePoint(c,'cargo:1');Object.assign(s.boats[0],{x:point.x+100,y:point.y});updatePurchases(c,s,.1,0);Object.assign(s.boats[0],point);updatePurchases(c,s,3,0);expect(s.orders['cargo:2']).toBeUndefined();s.time=6;updatePurchases(c,s,.24,0);expect(s.orders['cargo:2']).toBeUndefined();updatePurchases(c,s,.4,0);expect(s.orders['cargo:2'].paid).toBeGreaterThan(0);
});
it.each([100,12000,97500])('price %s completes in 1-3 seconds with exact integer accelerated payments',cost=>{
 const c=config(),s=newState(c);s.questIndex=15;s.area=2;c.special.combat.cost=cost;s.coins=cost;let elapsed=0;const deltas=[.007,.041,.013,.029];
 while(s.orders.defender?.readyAt==null && elapsed<3.1){const dt=deltas[Math.floor(elapsed*100)%4];pay(c,s,'defender',dt);elapsed+=dt;expect(Number.isInteger(s.coins)).toBe(true);expect(Number.isInteger(s.orders.defender.paid)).toBe(true);expect(s.coins+s.orders.defender.paid).toBe(cost);}
 expect(elapsed).toBeGreaterThanOrEqual(1);expect(elapsed).toBeLessThanOrEqual(3.06);expect(s.coins).toBe(0);expect(s.orders.defender.paid).toBe(cost);expect(s.events.filter(e=>e.type==='purchase_payment').reduce((sum,e)=>sum+Number(e.data.coins),0)).toBe(cost);
});
it('partial payment pauses without loss, restarts after reload, and preserves both currency totals',()=>{
 const c=config(),s=newState(c);s.questIndex=29;s.area=2;s.flags.storage=true;s.coins=123;s.metal=2;pay(c,s,'storageUpgrade',3);expect(s.coins).toBe(0);expect(s.metal).toBe(0);expect(s.orders.storageUpgrade.paid).toBe(123);expect(s.orders.storageUpgrade.readyAt).toBeNull();
 const storage=store();saveGame(storage,s,1000);const r=loadGame(storage,c,1000)!.state;r.coins=c.salvage.upgrade.cost-123;r.metal=c.salvage.upgrade.metal_cost!-2;pay(c,r,'storageUpgrade',.02);expect(r.orders.storageUpgrade.paid).toBeLessThan(c.salvage.upgrade.cost);pay(c,r,'storageUpgrade',3);expect(r.coins+r.metal).toBe(0);expect(r.orders.storageUpgrade.paid).toBe(c.salvage.upgrade.cost);expect(r.orders.storageUpgrade.metalPaid).toBe(c.salvage.upgrade.metal_cost);
});
it('pour accelerates across equal intervals and moving immediately stops payment',()=>{
 const c=config(),s=newState(c);s.questIndex=15;s.area=2;s.coins=12000;pay(c,s,'defender',.5);const a=s.orders.defender.paid;pay(c,s,'defender',.5);expect(s.orders.defender.paid-a).toBeGreaterThan(a);
 Object.assign(s.boats[0],purchasePoint(c,'defender'));const paid=s.orders.defender.paid;updatePurchases(c,s,.5,20);expect(s.orders.defender.paid).toBe(paid);
});
it('physical golden 100 plus fish 100 complete earn 200, excluding quest/debug and pending coins',()=>{
 const c=config(),e=new Engine(c),s=e.state;s.questIndex=7;activateQuest(c,s);creditIncome(s,1500,'debug_grant');s.questStatus='completed_unclaimed';claimQuest(c,s,8);s.questIndex=7;s.questStatus='active';activateQuest(c,s);const p=s.boats[0];
 spawnCoins(c,s,100,'golden_reward',p,{},p);expect(questProgress(c.quests[7],s)).toBe(0);s.time=1;collectCoins(c,s,.02);expect(questProgress(c.quests[7],s)).toBe(100);expect(s.stats.fish_sales_earned??0).toBe(0);
 spawnCoins(c,s,100,'fish_sale',p,{},p);s.time=2;collectCoins(c,s,.02);updateQuests(c,s);expect(questProgress(c.quests[7],s)).toBe(200);expect(s.questStatus).toBe('completed_unclaimed');const earned=s.stats.earn_coins;claimQuest(c,s,8);expect(s.stats.earn_coins).toBe(earned);expect(s.stats.golden_bonus_income).toBe(100);expect(s.stats.debug_income).toBe(1500);
 const onlyFish={...c.quests[7],type:'fish_sales_earned'};expect(questValue(onlyFish,s)).toBe(100);
 const storage=store();saveGame(storage,s,1000);const r=loadGame(storage,c,1000)!.state;collectCoins(c,r,1);expect(r.stats.earn_coins).toBe(200);expect(r.coins).toBe(s.coins);
});
it.each(['fast','reference'])('%s depletion bursts 8/15 reachable distinct crates, expires without cash, reload preserves deadline',profile=>{
 const c=config(profile),s=newState(c),r=c.resources.sardine,p=s.boats[0];Object.assign(p,{x:r.x,y:r.y});s.nodes.sardine.hp=r.damage_per_catch;harvest(c,s,p,'sardine',r.gather_s);expect(s.crates).toHaveLength(profile==='fast'?8:15);
 const ids=s.crates.map(p=>p.id);expect(new Set(ids).size).toBe(ids.length);for(const crate of s.crates){expect(onLand(c,crate)).toBe(false);expect(routeTo(c,r,crate,1).length).toBeGreaterThan(0);expect(crate.value).toBe(r.value);expect(crate.expiresAt).toBe(60);}
 expect(new Set(s.crates.map(p=>`${p.x},${p.y}`)).size).toBe(ids.length);
 const storage=store();saveGame(storage,s,1000);const e=new Engine(c,loadGame(storage,c,1000)!.state);e.settleOffline(61);expect(e.state.crates).toHaveLength(0);expect(e.state.coins).toBe(0);
});
it('global cap omits excess new drops, preserves old IDs/reservations and resumes after expiry',()=>{
 const c=config(),s=newState(c),r=c.resources.sardine;Object.assign(s.boats[0],{x:r.x,y:r.y});s.crates=Array.from({length:148},(_,i)=>({id:1000+i,resource:'sardine',kind:'fish',value:2,x:1300+i,y:1000,reservedBy:null,expiresAt:60}));s.nextId=2000;s.nodes.sardine.hp=10;harvest(c,s,s.boats[0],'sardine',1.5);expect(s.crates).toHaveLength(150);expect(new Set(s.crates.map(p=>p.id)).size).toBe(150);expect(s.events.find(e=>e.type==='crate_spawn_limited')?.data.spawned).toBe(2);
 s.time=61;updateResources(c,s);expect(s.crates).toHaveLength(0);s.boats[0].cargo=[];s.nodes.sardine.hp=10;harvest(c,s,s.boats[0],'sardine',1.5);expect(s.crates).toHaveLength(8);
});
it('workers preempt moving/gathering for new burst crates with exclusive ownership, player cannot steal reservation',()=>{
 const c=config(),s=newState(c),r=c.resources.sardine,p=s.boats[0];Object.assign(p,{x:r.x,y:r.y});s.nodes.sardine.hp=10;harvest(c,s,p,'sardine',1.5);const a=makeBoat('a','worker',{x:r.x-140,y:r.y}),b=makeBoat('b','speedboat',{x:r.x-140,y:r.y});s.boats.push(a,b);a.target='sardine';a.state='GATHER';a.gather=.6;b.target='sardine';b.state='TO_PICKUP';updateWorker(c,s,a,.01);updateWorker(c,s,b,.01);expect(typeof a.target).toBe('number');expect(typeof b.target).toBe('number');expect(a.target).not.toBe(b.target);
 const crate=s.crates.find(p=>p.id===a.target)!;Object.assign(p,{x:crate.x,y:crate.y});p.cargo=[];pickup(c,s,p);expect(s.crates.some(p=>p.id===crate.id)).toBe(true);Object.assign(a,{x:crate.x,y:crate.y});pickup(c,s,a);expect(a.cargo.some(p=>p.id===crate.id)).toBe(true);expect(s.crates.some(p=>p.id===crate.id)).toBe(false);
});
it('camera completes focus while simulation/movement continue and replacement cancels old return',()=>{
 const c=config(),e=new Engine(c),s=e.state,camera=new CameraGuidance(),p=s.boats[0],start={x:p.x,y:p.y},target={x:1600,y:900};camera.begin(start,target);camera.step(.4,p,c.presentation);e.input={x:1,y:0};e.update(.1);expect(p.x).toBeGreaterThan(start.x);expect(e.controlsLocked).toBe(false);expect(camera.mode).toBe('FOCUS_TARGET');camera.step(c.presentation.camera_move_duration_s+c.presentation.camera_focus_duration_s-.4,p,c.presentation);expect(camera.mode).toBe('RETURN_TO_PLAYER');expect(camera.step(c.presentation.camera_return_duration_s,p,c.presentation)).toMatchObject({x:p.x,y:p.y});expect(camera.mode).toBe('FOLLOW_PLAYER');camera.begin(p,{x:100,y:100});expect(camera.target).toEqual({x:100,y:100});
});
it('pirate kill quest resolves actual den centre, defender quest resolves dock, including reload',()=>{
 const c=config(),s=newState(c);s.area=2;s.questIndex=c.quests.findIndex(q=>q.type==='pirates_killed');expect(questFocusTarget(c,s)).toEqual(c.combat.spawner);const storage=store();saveGame(storage,s,1000);expect(questFocusTarget(c,loadGame(storage,c,1000)!.state)).toEqual(c.combat.spawner);s.questIndex=c.quests.findIndex(q=>q.type==='defender_ready');expect(questFocusTarget(c,s)).toEqual(c.interaction.purchase_points.defender);
});
it.each([[0,0],[2,0],[-2,1],[10,0],[100,100],[-100,-100],[100,-100]])('joystick (%s,%s) respects deadzone and normalizes any diagonal', (x,y)=>{
 const vector=joystickVector(x,y,35,.12);expect(Math.hypot(vector.x,vector.y)).toBeLessThanOrEqual(1.00000001);if(Math.hypot(x,y)<=4.2)expect(vector).toEqual({x:0,y:0});else expect(Math.atan2(vector.y,vector.x)).toBeCloseTo(Math.atan2(y,x));
});
it.each(['fast','reference'])('%s docks connect island to water without overlapping zones; quest order stays unchanged',profile=>{
 const c=config(profile),old=JSON.parse(fs.readFileSync('tests/fixtures/balance-v03-protected.json','utf8'))[profile];expect(()=>validateConfig(c)).not.toThrow();
 for(const key of ['units','combat'])expect(legacyLayout(c)[key as keyof Balance]).toEqual(old[key]);
 for(let i=0;i<c.quests.length;i++){const {type,reward_coins,...q}=c.quests[i];const {type:prior,reward_coins:previousReward,...previous}=old.quests[i];expect(q).toEqual(previous);if(profile==='reference'||i<15)expect(reward_coins).toBe(previousReward);expect(type).toBe(prior==='fish_sales_earned'?'earn_coins':prior);}
 const navigationState=newState(c);navigationState.area=2;syncBuildingObstacles(c,navigationState);
 for(const dock of c.docks){const p=c.interaction.purchase_points[dock.id];expect(onLand(c,p)).toBe(false);expect(distance(p,dock.end)).toBeGreaterThan(c.interaction.purchase_radius+dock.width/2);expect(onLand(c,dock)).toBe(true);const route=routeTo(c,c.world.port,p,dock.zone);expect(route.length).toBeGreaterThan(0);let a=c.world.port;for(const next of route){expect(clearSegment(c,a,next)).toBe(true);a=next;}}
 const hub=c.navigation.obstacles[0];expect(c.interaction.purchase_points.worker.x).toBeLessThan(hub.x);expect(c.interaction.purchase_points.cargo.y).toBeGreaterThan(hub.y);expect(c.interaction.purchase_points.speedboat.y).toBeLessThan(hub.y);
});
it('v03 feature migration preserves pending income, fractional partial funds and raw backup without duplicate migration',()=>{
 const c=config(),s=newState(c);delete s.purchaseGuards;delete s.stats.income_sources_v031;s.questIndex=7;s.stats.fish_sales_earned=150;s.stats.golden_collected=80;s.questBaseline=100;s.cargoLevel=1;s.coins=99.5;s.orders['cargo:2']={id:'cargo:2',paid:20.5,cost:98,metalPaid:0,metalCost:0,duration:1,readyAt:null,complete:false};Object.assign(s.boats[0],purchasePoint(c,'cargo:2'));spawnCoins(c,s,40,'golden_reward',s.boats[0],{},s.boats[0]);
 const storage=store();saveGame(storage,s,1000);const raw=storage.getItem(saveKey(c.profile))!;const r=loadGame(storage,c,1000)!.state;expect(r.questBaseline).toBe(180);expect(questProgress(c.quests[7],r)).toBe(50);expect(r.coins+r.orders['cargo:2'].paid).toBe(120);expect(Number.isInteger(r.orders['cargo:2'].paid)).toBe(true);expect(r.purchaseGuards!.cargo.needsExit).toBe(true);expect(storage.getItem(saveKey(c.profile)+'_backup_before_v031')).toBe(raw);
 r.time=1;collectCoins(c,r,.02);expect(questProgress(c.quests[7],r)).toBe(90);saveGame(storage,r,1000);const rr=loadGame(storage,c,1000)!.state;collectCoins(c,rr,1);expect(rr.coins).toBe(r.coins);expect(rr.questBaseline).toBe(180);
});
it.each(['fast','reference'])('%s repeated/special purchases preserve one-time rewarded completion and saved cooldown',profile=>{
 const c=config(profile),s=newState(c);s.questIndex=13;s.coins=10000;Object.assign(s.boats[0],purchasePoint(c,'speedboat'));pay(c,s,'speedboat');s.orders.speedboat.readyAt=s.time+60;expect(skipTimer(c,s,'speedboat')).toBe(false);expect(skipTimer(c,s,'speedboat',true)).toBe(true);expect(skipTimer(c,s,'speedboat',true)).toBe(false);const wallet=s.coins;updatePurchases(c,s,20,0);expect(s.coins).toBe(wallet);expect(s.boats.filter(b=>b.kind==='speedboat')).toHaveLength(1);
 const storage=store();saveGame(storage,s,1000);const r=loadGame(storage,c,1000)!.state;expect(r.purchaseGuards!.speedboat).toEqual(s.purchaseGuards!.speedboat);
});
it('expired reserved crate releases worker target and resumes original gather without double pickup',()=>{
 const c=config(),s=newState(c),w=makeBoat('w','worker',{x:1400,y:1180});s.boats.push(w);s.crates.push({id:s.nextId++,resource:'sardine',kind:'fish',value:2,x:1450,y:1180,reservedBy:w.id,expiresAt:1});w.target=s.crates[0].id;w.state='TO_PICKUP';w.resume={target:'sardine',gather:.6};s.time=1;updateResources(c,s);updateWorker(c,s,w,.01);updateWorker(c,s,w,.01);expect(s.crates).toHaveLength(0);expect(w.target).toBe('sardine');expect(w.gather).toBeGreaterThanOrEqual(.6);expect(s.coins).toBe(0);
});
it.each(['purchase_pour_min_seconds','joystick_radius','joystick_opacity'])('invalid %s configuration is rejected',key=>{
 const c=config();(c.interaction as unknown as Record<string,number>)[key]=0;expect(()=>validateConfig(c)).toThrow();
});
it('corrupt persisted guards and crate expiry reject load and preserve raw data',()=>{
 const c=config(),s=newState(c),storage=store();s.purchaseGuards!.cargo={cooldownUntil:-1,needsExit:true};saveGame(storage,s,1000);const raw=storage.getItem(saveKey(c.profile));expect(()=>loadGame(storage,c,1000)).toThrow();expect(storage.getItem(saveKey(c.profile))).toBe(raw);
 s.purchaseGuards={};s.crates.push({id:300,resource:'sardine',kind:'fish',value:2,x:1400,y:1180,reservedBy:null,expiresAt:-1});saveGame(storage,s,1000);expect(()=>loadGame(storage,c,1000)).toThrow();
});
it('half of ten golden piles counts only collected half; reload credits only remaining unique piles',()=>{
 const c=config(),e=new Engine(c),s=e.state;s.questIndex=7;activateQuest(c,s);s.golden.expires=50;const offer=e.openGoldenOffer()!;offer.reward=100;e.beginGoldenReward(offer.id);e.claimGolden(true,offer.id);s.time=1;
 for(let i=0;i<5;i++){const coin=s.coinStacks[0];Object.assign(s.boats[0],{x:coin.x,y:coin.y});collectCoins(c,s,.01);}
 expect(s.coinStacks).toHaveLength(5);expect(questProgress(c.quests[7],s)).toBe(50);expect(s.coins).toBe(50);
 const storage=store();saveGame(storage,s,1000);const r=loadGame(storage,c,1000)!.state;
 while(r.coinStacks.length){const coin=r.coinStacks[0];Object.assign(r.boats[0],{x:coin.x,y:coin.y});collectCoins(c,r,.01);}
 expect(questProgress(c.quests[7],r)).toBe(100);expect(r.coins).toBe(100);expect(new Engine(c,r).claimGolden(true)).toBe(false);
});
