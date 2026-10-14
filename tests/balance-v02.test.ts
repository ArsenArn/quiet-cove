import {it,expect} from 'vitest';
import fs from 'node:fs';
import type {Balance,Point} from '../src/config/types';
import {Engine} from '../src/game/engine';
import {capacity} from '../src/game/systems/economy';
import {available} from '../src/game/systems/resources';
import {distance,navigationTarget} from '../src/game/systems/movement';
import {offers,purchasePoint} from '../src/game/systems/construction';
it.each(['fast','reference'])('unfunded %s first 15 quests with and without optional golden stay reachable',profile=>{
 const runs=[];
 for(const golden of [false,true]) {
  const c=JSON.parse(fs.readFileSync(`public/balance/balance_${profile}.json`,'utf8')) as Balance,e=new Engine(c),rows:any[]=[];
  let previous=0,previousSales=0,previousEarned=0,waitingForCash=false;
  const steer=(goal:Point)=>{const p=e.state.boats[0],next=navigationTarget(c,p,goal,e.state.area),d=distance(p,next);const scale=Math.min(1,d/(c.units.player.speed*.2));e.input=d>0?{x:(next.x-p.x)/d*scale,y:(next.y-p.y)/d*scale}:{x:0,y:0};};
  const earn=()=>{const s=e.state,p=s.boats[0];
   const payout=s.coinStacks.find(coin=>coin.source==='fish_sale');if(!p.cargo.length&&payout){steer(payout);return;}
   if(p.cargo.length>=capacity(c,s,p)||p.cargo.length && distance(p,c.world.port)<=c.world.deposit_radius || s.coinStacks.length && distance(p,c.world.port)<=c.interaction.coin_radius+70){steer(c.world.port);return;}
   const nodes=Object.keys(c.resources).filter(id=>c.resources[id].kind==='fish'&&available(c,s,id)).sort((a,b)=>c.resources[b].value-c.resources[a].value);
   if(nodes.length)steer(c.resources[nodes[0]]);else steer(c.world.port);
  };
  let ticks=0;while(e.state.questIndex<15&&ticks++<150000){
   const s=e.state,q=c.quests[s.questIndex];
   if(golden&&s.golden.expires!==null){const offer=e.openGoldenOffer();if(offer&&e.beginGoldenReward(offer.id))e.claimGolden(true,offer.id);}
   const goldenLoot=s.coinStacks.find(p=>p.source==='golden_reward');if(goldenLoot){steer(goldenLoot);e.update(.2);continue;}
   if(s.questStatus==='completed_unclaimed'){
    rows.push({quest:q.id,simulationSeconds:Number((s.time-previous).toFixed(1)),collectedSales:Number(((s.stats.fish_sales_earned??0)-previousSales).toFixed(1)),earnedCoins:(s.stats.earn_coins??0)-previousEarned,cashBeforeReward:Math.round(s.coins),waitedForNewCash:waitingForCash,reward:q.reward_coins});
    previous=s.time;previousSales=s.stats.fish_sales_earned??0;previousEarned=s.stats.earn_coins??0;waitingForCash=false;e.claimQuest(q.id);continue;
   }
   const mapping:Record<string,string>={cargo_level:`cargo:${s.cargoLevel+1}`,normal_workers:`worker:${s.boats.filter(b=>b.kind==='worker').length}`,resource_ready:`resource:${q.target}`,speedboat_ordered:'speedboat',speedboat_ready:'speedboat',area_unlocked:'gate'};
   const id=mapping[q.type],offer=offers(c,s).find(o=>o.id===id),order=s.orders[id];
   if(id && offer && !offer.blocked && order?.readyAt==null && (s.coins>0 || (order?.paid??0)>=(order?.cost??offer.cost))){const point=purchasePoint(c,id),guard=s.purchaseGuards?.[id.split(':')[0]];steer(guard?.needsExit?{x:point.x-100,y:point.y}:point);}
   else {if(id && order?.readyAt==null && s.coins<1)waitingForCash=true;earn();}
   e.update(.2);
  }
  expect(e.state.questIndex,JSON.stringify({profile,golden,time:e.state.time,quest:e.state.questIndex+1,coins:e.state.coins,p:e.state.boats[0],orders:e.state.orders,stats:e.state.stats})).toBe(15);
  expect(rows).toHaveLength(15);expect(rows.find(r=>r.quest===8).earnedCoins).toBeGreaterThanOrEqual(200);expect(e.state.coins).toBeGreaterThanOrEqual(0);
  // Require new sales in several paid goals: rewards cannot fund an uninterrupted shopping chain.
  expect(rows.filter(r=>r.quest>=5 && r.collectedSales>0).length).toBeGreaterThanOrEqual(4);
  runs.push({profile,golden,totalSimulationSeconds:Number(e.state.time.toFixed(1)),rows});
 }
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync(`test-results/balance-sanity-${profile}.json`,JSON.stringify(runs,null,2)+'\n');
},60000);
