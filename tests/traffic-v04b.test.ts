import {legacyLayout} from './helpers-v07d-protection';
import {it,expect} from 'vitest';
import fs from 'node:fs';
import type {Balance,Point} from '../src/config/types';
import {validateConfig} from '../src/config/load';
import {Engine} from '../src/game/engine';
import {makeBoat,newState} from '../src/game/state';
import {distance,navigateTo,onLand,routeTo,clearSegment} from '../src/game/systems/movement';
import {beginTraffic,endTraffic,trafficMetrics} from '../src/game/systems/traffic';
import {fleetFixture,runFleet} from '../scripts/traffic-scenarios-v04b';
import {loadGame,saveGame} from '../src/game/systems/save';
const config=(p='fast')=>JSON.parse(fs.readFileSync(`public/balance/balance_${p}.json`,'utf8')) as Balance;
it('opposing boats pass without penetration and return to their original destinations',()=>{
 const c=config(),s=newState(c);Object.assign(s.boats[0],{x:1400,y:2000});const a=makeBoat('a','worker',{x:1200,y:1750}),b=makeBoat('b','worker',{x:1500,y:1750});s.boats.push(a,b);
 let minimum=Infinity;for(let i=0;i<600;i++){s.time+=1/30;beginTraffic(c,s,1/30,{x:0,y:0});navigateTo(c,a,{x:1500,y:1750},80,1/30,1,1);navigateTo(c,b,{x:1200,y:1750},80,1/30,1,1);endTraffic(s);minimum=Math.min(minimum,distance(a,b));}
 expect(minimum).toBeGreaterThanOrEqual(c.navigation.traffic!.radii.worker*2-.1);expect(distance(a,{x:1500,y:1750})).toBeLessThan(2);expect(distance(b,{x:1200,y:1750})).toBeLessThan(2);
});
it('idle player stays pinned while overlapping workers from a save separate gradually',()=>{
 const c=config(),s=newState(c);Object.assign(s.boats[0],{x:1300,y:1750});for(let i=0;i<10;i++)s.boats.push(makeBoat(`w:${i}`,'worker',s.boats[0]));
 let largestStep=0;for(let i=0;i<600;i++){const previous=s.boats.map(b=>({x:b.x,y:b.y}));s.time+=1/30;beginTraffic(c,s,1/30,{x:0,y:0});endTraffic(s);for(let j=0;j<s.boats.length;j++)largestStep=Math.max(largestStep,distance(previous[j],s.boats[j]));}
 expect(s.boats[0]).toMatchObject({x:1300,y:1750});expect(largestStep).toBeLessThanOrEqual(c.navigation.traffic!.correction_speed/30+.001);for(let i=0;i<s.boats.length;i++)for(let j=i+1;j<s.boats.length;j++)expect(distance(s.boats[i],s.boats[j]),`${i}/${j}`).toBeGreaterThanOrEqual(c.navigation.traffic!.radii.worker*2-.1);
 const still=s.boats.map(b=>({x:b.x,y:b.y}));for(let i=0;i<60;i++){beginTraffic(c,s,1/30,{x:0,y:0});endTraffic(s);}s.boats.forEach((b,i)=>expect(distance(b,still[i])).toBeLessThan(.02));
});
it('manual player passes a worker, keeps diagonal speed in free water and stops on release',()=>{
 const c=config(),e=new Engine(c);Object.assign(e.state.boats[0],{x:1300,y:1750});const worker=makeBoat('worker','worker',{x:1380,y:1750});e.state.boats.push(worker);
 for(const n of Object.values(e.state.nodes)){n.unlocked=false;}e.input={x:1,y:0};e.update(2);expect(e.state.boats[0].x).toBeGreaterThan(1450);expect(distance(e.state.boats[0],worker)).toBeGreaterThan(33.9);
 e.state.boats.splice(1);Object.assign(e.state.boats[0],{x:1300,y:1750});e.input={x:1,y:1};e.update(1);expect(distance(e.state.boats[0],{x:1300,y:1750})).toBeCloseTo(c.units.player.speed,5);e.input={x:0,y:0};const point={...e.state.boats[0]};e.update(5);expect(distance(e.state.boats[0],point)).toBe(0);
});
it('collision recovery never pushes boats through land, world edges or a closed gate',()=>{
 const c=config(),s=newState(c);Object.assign(s.boats[0],{x:1030,y:1340});s.boats.push(makeBoat('a','worker',{x:1032,y:1340}),makeBoat('b','worker',{x:1040,y:1340}));
 for(let i=0;i<200;i++){s.time+=1/30;beginTraffic(c,s,1/30,{x:0,y:0});endTraffic(s);for(const b of s.boats)expect(onLand(c,b)).toBe(false);}
 Object.assign(s.boats[0],{x:c.world.gate_x-c.world.edge_margin,y:1800});Object.assign(s.boats[1],s.boats[0],{id:'a',kind:'worker'});for(let i=0;i<100;i++){beginTraffic(c,s,1/30,{x:0,y:0});endTraffic(s);for(const b of s.boats)expect(b.x).toBeLessThanOrEqual(c.world.gate_x-c.world.edge_margin);}
});
it.each(['fast','reference'])('%s navigation validates and protected gameplay fields remain v0.4a',profile=>{
 const c=config(profile),old=JSON.parse(fs.readFileSync('tests/fixtures/balance-v04a-baseline.json','utf8'))[profile];expect(()=>validateConfig(c)).not.toThrow();const copy=legacyLayout(c);delete copy.navigation.traffic;if(profile==='reference')expect(copy).toEqual(old);
 else {
  const before=JSON.parse(fs.readFileSync('tests/fixtures/release/test-results_v07c_before-fast.json','utf8'));
  for(const key of ['units','workers','capacity_upgrades','special','world','combat','interaction','save','monetization','ai','simulation','presentation','docks','resource_burst'])expect(copy[key as keyof Balance]).toEqual(before[key]);
  expect(copy.navigation).toEqual(old.navigation);expect(copy.expansion.gate).toEqual(before.expansion.gate);
 }
 for(const key of ['neighbor_radius','correction_speed','arrival_spacing','stuck_s','repath_s'] as const){const broken=structuredClone(c);broken.navigation.traffic![key]=0;expect(()=>validateConfig(broken)).toThrow();}
});
it('visibility graph still reaches every decorative dock and interaction point',()=>{
 const c=config(),points=[c.world.port,c.world.storage,...Object.values(c.interaction.purchase_points),...Object.values(c.resources)];for(const goal of points){let previous:Point=c.world.spawn;for(const point of routeTo(c,previous,goal,2)){expect(clearSegment(c,previous,point)).toBe(true);previous=point;}expect(distance(previous,goal)).toBeLessThan(.01);}
});
it.each([5,10])('%s workers and supporting fleet deliver without persistent jams',count=>{
 const c=config(),s=fleetFixture(c,count),r=runFleet(c,s,300);expect(r.successfulDeliveries).toBeGreaterThan(50);expect(r.stuckBoats).toEqual([]);expect(r.illegalPositions).toBe(0);for(const [id,count] of Object.entries(r.deliveriesByBoat))expect(count,id).toBeGreaterThan(0);
},20000);
it('stacked maximum fleet reaches one shared resource and unloads at the port',()=>{
 const c=config(),s=fleetFixture(c,10,{single:true,stack:true}),r=runFleet(c,s,300);expect(r.successfulDeliveries).toBeGreaterThan(200);expect(r.stuckBoats).toEqual([]);expect(r.illegalPositions).toBe(0);for(const [id,count] of Object.entries(r.deliveriesByBoat))expect(count,id).toBeGreaterThan(0);
},20000);
it('pirates chase and attack player/defender, patrol and attack continue in traffic',()=>{
 const c=config(),s=fleetFixture(c,10,{combat:true}),e=new Engine(c,s);const start={x:s.defender!.x,y:s.defender!.y};e.update(2);expect(distance(start,s.defender!)).toBeGreaterThan(5);e.update(40);expect(s.stats.pirates_killed).toBeGreaterThan(0);expect(s.events.some(v=>v.type==='pirate_spawn')).toBe(true);expect(s.boats.slice(1).every(b=>b.hp===0)).toBe(true);expect(s.enemies.every(e=>e.target===null||e.target==='player'||e.target==='defender')).toBe(true);
});
it('reload of stacked boats conserves cargo, money and reservations; traffic state is transient',()=>{
 const c=config(),e=new Engine(c),s=e.state;Object.assign(s.boats[0],{x:1300,y:1750});s.boats.push(makeBoat('worker','worker',s.boats[0]));s.crates.push({id:s.nextId++,resource:'sardine',kind:'fish',value:2,x:1410,y:1750,reservedBy:'worker',expiresAt:60});s.boats[1].target=s.crates[0].id;s.boats[1].state='TO_PICKUP';s.coins=37;
 let raw='';const store={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;},removeItem:()=>{}};saveGame(store,s,1000);const loaded=loadGame(store,c,1000)!;const next=new Engine(c,loaded.state);expect(next.state.coins).toBe(37);expect(next.state.crates[0].reservedBy).toBe('worker');next.update(.1);expect(next.state.crates[0].reservedBy).toBe('worker');expect(next.state.boats[1].target).toBe(next.state.crates[0].id);next.update(5);expect(next.state.crates).toHaveLength(0);expect(next.state.stats.crate_pickup_worker).toBe(1);expect(next.state.coins).toBe(37);saveGame(store,next.state,1000);expect(raw).not.toMatch(/detour|egress|berths|neighborChecks/);expect(next.state.version).toBe(3);
});
it('same seed, state and inputs produce identical traffic and deliveries',()=>{
 const c=config(),s=fleetFixture(c,5),a=new Engine(c,structuredClone(s)),b=new Engine(c,structuredClone(s));a.update(60);b.update(60);expect(a.state.boats).toEqual(b.state.boats);expect(a.state.rng).toBe(b.state.rng);expect(a.state.stats).toEqual(b.state.stats);expect(trafficMetrics(a.state)).toEqual(trafficMetrics(b.state));
});
it('two separated workers harvest the same node simultaneously without changing gather timing',()=>{
 const c=config(),e=new Engine(c),s=e.state,node=c.resources.sardine;Object.assign(s.boats[0],{x:1300,y:1750});
 for(const sign of [-1,1]){const b=makeBoat(`gather:${sign}`,'worker',{x:node.x+45*sign,y:node.y});b.target='sardine';b.state='GATHER';b.gather=c.units.worker.gather_s-1/30;s.boats.push(b);}
 e.update(1/30);expect(s.stats.catch_sardine).toBe(2);expect(s.boats.slice(1).map(b=>b.cargo.length)).toEqual([1,1]);expect(distance(s.boats[1],s.boats[2])).toBeCloseTo(90);
});
it('several workers unload together inside the unchanged real deposit radius',()=>{
 const c=config(),e=new Engine(c),s=e.state;Object.assign(s.boats[0],{x:1400,y:1750});
 for(let i=0;i<3;i++){const angle=i*Math.PI*2/3,b=makeBoat(`unload:${i}`,'worker',{x:c.world.port.x+Math.cos(angle)*36,y:c.world.port.y+Math.sin(angle)*36});b.state='RETURN';for(let j=0;j<3;j++)b.cargo.push({id:s.nextId++,kind:'fish',resource:'sardine',value:2});s.boats.push(b);}
 e.update(.5);expect(s.stats.deliver_fish).toBe(9);expect(s.coinStacks).toHaveLength(9);expect(s.coinStacks.reduce((n,p)=>n+p.value,0)).toBe(18);expect(s.boats.slice(1).every(b=>b.cargo.length===0)).toBe(true);
});
it('park-to-work transition does not grant a second movement budget in one step',()=>{
 const c=config(),e=new Engine(c),s=e.state;Object.assign(s.boats[0],{x:1400,y:1750});for(const n of Object.values(s.nodes))n.unlocked=false;
 const b=makeBoat('idle','worker',{x:c.world.port.x+70,y:c.world.port.y});b.state='WAIT';s.boats.push(b);const dt=1/30;
 let previous={x:b.x,y:b.y};e.update(dt);expect(distance(previous,b)).toBeLessThanOrEqual(c.units.worker.speed*dt+.001);
 s.nodes.sardine.unlocked=true;previous={x:b.x,y:b.y};e.update(dt);expect(distance(previous,b)).toBeLessThanOrEqual(c.units.worker.speed*dt+.001);expect(b.target).toBe('sardine');expect(b.state).toBe('TO_PICKUP');
});
it('two pirates return to separate home approaches and never target fish workers',()=>{
 const c=config(),e=new Engine(c),s=e.state;s.area=2;s.flags.den=true;
 const home={x:c.combat.spawner.x+110,y:c.combat.spawner.y};for(let i=0;i<2;i++)s.enemies.push({id:`pirate:${i}`,x:home.x+i*37,y:home.y,home:{...home},hp:c.combat.pirate_hp,angle:0,attackAt:0,state:'RETURN',target:null});
 e.update(8);expect(s.enemies).toHaveLength(2);for(let i=0;i<2;i++){expect(onLand(c,s.enemies[i])).toBe(false);expect(s.enemies[i].target).toBeNull();for(let j=i+1;j<2;j++)expect(distance(s.enemies[i],s.enemies[j])).toBeGreaterThan(30);}
});
it('blocked held input does not trigger a purchase; release restores real stationary payment',()=>{
 const c=config();c.interaction.purchase_points.cargo={x:30,y:30};const e=new Engine(c),s=e.state;s.questIndex=3;s.coins=1000;Object.assign(s.boats[0],{x:30,y:30});e.input={x:-1,y:0};e.update(2);
 expect(s.boats[0]).toMatchObject({x:30,y:30});expect(s.orders['cargo:1']?.paid??0).toBe(0);expect(s.coins).toBe(1000);
 e.input={x:0,y:0};e.update(1.5);expect(s.orders['cargo:1'].paid).toBe(s.orders['cargo:1'].cost);expect(s.coins).toBe(1000-s.orders['cargo:1'].cost);
});
it('small analog input uses its real speed when predicting player priority',()=>{
 const c=config(),e=new Engine(c),s=e.state;for(const n of Object.values(s.nodes))n.unlocked=false;Object.assign(s.boats[0],{x:1300,y:1750});const b=makeBoat('idle','worker',{x:1350,y:1750});b.state='WAIT';s.boats.push(b);
 e.input={x:.1,y:0};e.update(.1);expect(b).toMatchObject({x:1350,y:1750});expect(s.boats[0].x-1300).toBeCloseTo(c.units.player.speed*.01,5);
});
it('opposing boats remain safe and finish their routes across variable frame steps',()=>{
 const c=config(),s=newState(c);Object.assign(s.boats[0],{x:1400,y:2000});const a=makeBoat('a','worker',{x:1200,y:1750}),b=makeBoat('b','worker',{x:1500,y:1750});s.boats.push(a,b);const steps=[1/120,1/30,1/60];
 for(let i=0;i<600;i++){const dt=steps[i%steps.length];s.time+=dt;beginTraffic(c,s,dt,{x:0,y:0});navigateTo(c,a,{x:1500,y:1750},80,dt,1,1);navigateTo(c,b,{x:1200,y:1750},80,dt,1,1);endTraffic(s);expect(distance(a,b)).toBeGreaterThanOrEqual(c.navigation.traffic!.radii.worker*1.8-.01);}
 expect(distance(a,{x:1500,y:1750})).toBeLessThan(2);expect(distance(b,{x:1200,y:1750})).toBeLessThan(2);
});
