import {describe,it,expect} from 'vitest';
import {directionFrame,resourceFrame,cargoPosition,coinArt} from '../src/game/art/registry';
import {loadConfig} from './helpers-art-v05a';
import {newState,makeBoat} from '../src/game/state';
import {harvest,updateResources} from '../src/game/systems/resources';

describe('v0.5a visual projection of existing state',()=>{
  it('maps screen-space movement across wrap and all eight compass sectors',()=>{
    for(let i=0;i<8;i++)for(const turn of [-2,0,2]){
      const angle=-Math.PI/2+i*Math.PI/4+turn*Math.PI*2;
      expect(directionFrame(angle)).toBe(i);
      expect(directionFrame(angle+.38)).toBe(i);expect(directionFrame(angle-.38)).toBe(i);
    }
  });
  for(const profile of ['fast','reference'] as const)it(`${profile}: stage never resets during portion regrow; only full restock restores FULL`,()=>{
    const c=loadConfig(profile),s=newState(c),r=c.resources.sardine,n=s.nodes.sardine;
    const b=makeBoat('test','player',r,c.units.player.hp);
    let previous=0,seen=new Set<number>();
    while(n.stock>0){
      n.phase='ready';b.cargo=[];harvest(c,s,b,'sardine',r.gather_s);
      const frame=resourceFrame(r,n);if(frame!==null){expect(frame).toBeGreaterThanOrEqual(previous);previous=frame;seen.add(frame);}
      if(n.phase!=='ready' && n.stock>0){expect(resourceFrame(r,n)).toBeNull();s.time=n.readyAt;updateResources(c,s);expect(resourceFrame(r,n)!).toBeGreaterThanOrEqual(previous);}
    }
    expect([...seen].sort()).toEqual([0,1,2,3]);expect(resourceFrame(r,n)).toBeNull();
    s.time=n.readyAt;updateResources(c,s);expect(resourceFrame(r,n)).toBe(0);
  });
  it('preserves the exact quarter boundaries and hides empty/locked sources',()=>{
    const c=loadConfig('fast'),r=c.resources.tuna,n=newState(c).nodes.tuna;n.unlocked=true;
    for(const [fraction,frame] of [[1,0],[.75,1],[.5,2],[.25,3],[.01,3]]){
      const portions=r.stock*fraction;n.stock=Math.ceil(portions);n.hp=(portions-(n.stock-1))*r.portion_hp;expect(resourceFrame(r,n)).toBe(frame);
    }
    n.stock=0;expect(resourceFrame(r,n)).toBeNull();n.stock=5;n.unlocked=false;expect(resourceFrame(r,n)).toBeNull();
  });
  it('keeps every cargo visual on a bounded deck stack at maximum capacity',()=>{
    for(const kind of ['player','worker','speedboat'])for(let frame=0;frame<8;frame++)for(const count of [1,10,30,100]){
      const points=Array.from({length:count},(_,i)=>cargoPosition(frame,i,count,kind));
      expect(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))).toBeLessThanOrEqual(42.001);
      expect(points.every(p=>Math.abs(p.x)<=36&&Math.abs(p.y)<=61)).toBe(true);
    }
  });
  it('selects coin artwork without modifying payouts',()=>{
    expect(coinArt(2,'fish_sale')).toBe('single');expect(coinArt(14,'fish_sale')).toBe('small_stack');expect(coinArt(100,'fish_sale')).toBe('large_pile');expect(coinArt(3,'golden_reward')).toBe('large_pile');
  });
});
