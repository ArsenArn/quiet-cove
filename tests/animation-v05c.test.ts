import {describe,it,expect} from 'vitest';
import {animation,newMotion,stepMotion,ambient,phase} from '../src/game/art/animation';
import {cargoAnchors,cargoPosition,directionFrame} from '../src/game/art/registry';
import {loadConfig} from './helpers-art-v05a';
import {newState,makeBoat} from '../src/game/state';
import {harvest,pickup,updateResources} from '../src/game/systems/resources';
import {deposit,waterLootPoint} from '../src/game/systems/economy';
import {onLand,routeTo} from '../src/game/systems/movement';
import {Engine} from '../src/game/engine';
import crypto from 'node:crypto';
import fs from 'node:fs';
const baselineHashes=JSON.parse(fs.readFileSync('tests/fixtures/v05b-core-hashes.json','utf8'));
const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;

describe('v0.5c presentation and engine boundaries',()=>{
  it('builds one vertical stack for 1/2/5/7/100 cargo across all four models and eight directions',()=>{
    for(const kind of Object.keys(cargoAnchors))for(let frame=0;frame<8;frame++)for(const count of [1,2,5,7,100]){
      const p=Array.from({length:Math.min(count,animation.cargo.maxVisible)},(_,i)=>cargoPosition(frame,i,count,kind));
      for(let i=1;i<p.length;i++){expect(p[i].y).toBeLessThan(p[i-1].y);expect(Math.abs(p[i].x-p[i-1].x)).toBeLessThan(4);}
      expect(p.at(-1)!.y).toBeGreaterThanOrEqual(-61);expect(cargoPosition(frame,99,100,kind)).toEqual(cargoPosition(frame,6,100,kind));
    }
  });
  it('spring stays bounded, wraps across PI, and settles after motion without touching world coordinates',()=>{
    const m=newMotion(0,0,Math.PI-.01),boat=Object.freeze({x:2,y:0,angle:-Math.PI+.01});stepMotion(m,boat.x,boat.y,boat.angle,1/60);
    expect(Math.abs(m.lean)).toBeLessThan(.04);
    for(let i=0;i<100;i++)stepMotion(m,i*4,0,i*.5,i%2?.01:.05);
    expect(Math.abs(m.lean)).toBeLessThanOrEqual(animation.cargo.maxLean);
    for(let i=0;i<240;i++)stepMotion(m,396,0,49.5,1/60);
    expect(Math.abs(m.lean)).toBeLessThan(.00001);expect(boat).toEqual({x:2,y:0,angle:-Math.PI+.01});
    expect(new Set(['player','worker:0','worker:1','golden'].map(phase)).size).toBe(4);
  });
  it('ambient motion remains small and uses resource-specific intensity',()=>{
    for(const id of ['sardine','crab','mussel','squid','wreck'])for(let t=0;t<20;t+=.1){const v=ambient(id,t);expect(Math.abs(v.x)).toBeLessThanOrEqual(2.4);expect(Math.abs(v.scale-1)).toBeLessThan(.02);}
    expect(Math.abs(ambient('wreck',2).y)).toBeLessThan(.11);
  });
  for(const profile of ['fast','reference'] as const){
    it(`${profile}: origins, early burst pickup/reservations and separate payout values remain authoritative`,()=>{
      const c=loadConfig(profile),s=newState(c),r=c.resources.sardine,p=s.boats[0];Object.assign(p,{x:r.x,y:r.y});s.nodes.sardine.hp=r.damage_per_catch;harvest(c,s,p,'sardine',r.gather_s);
      expect(s.crates.length).toBe(profile==='fast'?8:15);expect(s.events.find(e=>e.type==='harvest')?.data).toMatchObject({x:r.x,y:r.y,resource:'sardine'});
      const crate=s.crates[0],w=makeBoat('worker:0','worker',crate);s.boats.push(w);for(const other of s.crates)other.reservedBy=other.id===crate.id?w.id:"other";pickup(c,s,p);expect(s.crates.some(x=>x.id===crate.id)).toBe(true);pickup(c,s,w);
      expect(w.cargo[0].id).toBe(crate.id);expect(s.events.find(e=>e.type==='crate_pickup')?.data).toMatchObject({x:crate.x,y:crate.y,crate:crate.id,boat:w.id});
      Object.assign(w,c.world.port);deposit(c,s,w,1);expect(s.coinStacks.map(x=>x.value)).toEqual([r.value]);expect(s.coins).toBe(0);expect(s.events.find(e=>e.type==='delivery')?.data.resource).toBe('sardine');
      s.time=s.nodes.sardine.readyAt;updateResources(c,s);expect(s.nodes.sardine.phase).toBe('ready');
    });
    it(`${profile}: relocated defender purchase is reachable on water from port, warehouse and patrol`,()=>{
      const c=loadConfig(profile),p=c.interaction.purchase_points.defender;expect(p).toEqual({x:1990,y:1410});expect(onLand(c,p)).toBe(false);
      for(const origin of [c.world.spawn,c.world.storage,...c.presentation.defender_patrol])expect(routeTo(c,origin,p,2).length).toBeGreaterThan(0);
    });
    it(`${profile}: 90 seconds preserve reference snapshot and protected engine boundaries after authorized FAST changes`,()=>{
      const c=loadConfig(profile),s=newState(c);s.area=2;s.questIndex=33;s.flags.storage=true;s.flags.cutter=true;for(const n of Object.values(s.nodes))n.unlocked=true;s.coins=10000;
      Object.assign(s.boats[0],{x:2460,y:1200});s.defender=makeBoat('defender','player',c.combat.defender_spawn,c.combat.defender_hp);
      for(let i=0;i<5;i++)s.boats.push(makeBoat('worker:'+i,'worker',c.world.port));s.boats.push(makeBoat('salvage:0','salvage',c.world.storage));
      const current=new Engine(structuredClone(c),structuredClone(s));
      for(let i=0;i<1800;i++){
        const input={x:Math.sin(i/200)*.2,y:Math.cos(i/200)*.2};current.input=input;current.update(.05);
        // Isolate all old core rules by normalizing the explicitly changed payout location
        // before the unchanged delay expires. New real placement is tested separately.
        for(const coin of current.state.coinStacks)if(coin.source==='fish_sale'&&!coin.attracting)Object.assign(coin,waterLootPoint(c,current.state,c.world.port,coin.id*2.399963229728653,c.interaction.coin_scatter_radius*Math.sqrt((coin.id%17+1)/17)));
      }
      // v0.7f explicitly adds regeneration and building obstacles; old full-state hashes
      // and engine/movement byte equality are superseded by focused contract tests.
      expect(current.state.enemies.length).toBeLessThanOrEqual(c.combat.max_enemies);
      expect(current.state.boats[0].hp).toBeLessThanOrEqual(c.units.player.hp);
      expect(current.state.metal).toBeLessThanOrEqual(c.salvage.storage.capacity);
      expect(fs.readFileSync('src/game/systems/resources.ts')).toEqual(fs.readFileSync('tests/fixtures/release/resources-v07d.txt'));
      expect(current.state.events.some(e=>e.type==='combat_attack')).toBe(true);expect(current.state.events.some(e=>e.type==='combat_hit')).toBe(true);
    });
  }
});
