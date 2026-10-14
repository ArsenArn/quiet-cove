import fs from 'node:fs';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
fs.mkdirSync('.local/v04a',{recursive:true});
await build({entryPoints:['src/game/systems/economy.ts'],outfile:'.local/v04a/costs.mjs',bundle:true,platform:'node',format:'esm'});
const {workerCost}=await import(pathToFileURL(path.resolve('.local/v04a/costs.mjs')));
fs.mkdirSync('docs',{recursive:true});
const records=[];
for(const profile of ['fast','reference']) {
 const c=JSON.parse(fs.readFileSync(`public/balance/balance_${profile}.json`,'utf8'));
 const modelPath=`test-results/v04a/final-${profile==='fast'?'A':'D'}-41.json`,model=fs.existsSync(modelPath)?JSON.parse(fs.readFileSync(modelPath,'utf8')):null;
 let cargo=0,workers=0,salvage=0;
 for(const q of c.quests) {
  let cost=0,metal=0,timers=[];
  const item=p=>{cost=p.cost;metal=p.metal_cost??0;timers=[p.build_s];};
  switch(q.type) {
   case 'cargo_level': {const u=c.capacity_upgrades.filter(u=>u.level>cargo&&u.level<=q.target);cost=u.reduce((n,u)=>n+(q.zone===2?c.fast_zone2?.cargo_costs[u.level]??u.cost:u.cost),0);timers=u.map(u=>u.build_s);cargo=q.target;break;}
   case 'normal_workers': for(let n=workers;n<q.target;n++){cost+=q.zone===2?c.fast_zone2?.worker_costs[n]??workerCost(c,n):workerCost(c,n);timers.push(c.workers.timers_s[n]);}workers=q.target;break;
   case 'salvage_workers': for(let n=salvage;n<q.target;n++){cost+=Math.round(c.salvage.worker.cost*c.salvage.worker.cost_growth**n);metal+=c.salvage.worker.metal_cost??0;const sequence=c.salvage.worker.timers_s;timers.push(sequence?.[Math.min(n,sequence.length-1)]??c.salvage.worker.build_s);}salvage=q.target;break;
   case 'resource_ready': item(c.resources[q.target]);break;
   case 'speedboat_ordered': item(c.special.speedboat);break;
   case 'speedboat_ready': timers=[c.special.speedboat.build_s];break;
   case 'area_unlocked': item(c.expansion.gate);break;
   case 'defender_ready': item(c.special.combat);break;
   case 'metal_storage_ready': item(c.salvage.storage);break;
   case 'metal_cutter_owned': item(c.salvage.cutter);break;
   case 'wreck_ready': item(c.resources.wreck);break;
   case 'metal_storage_capacity': item(c.salvage.upgrade);break;
   case 'pirate_den_closed': item(c.expansion.den);break;
   case 'expedition_route_ready': item(c.expansion.route);break;
  }
  const row=model?.rows.find(r=>r.quest===q.id);
  records.push({profile,id:q.id,zone:q.zone,title:q.label,coin_cost:cost,metal_cost:metal,construction_timers_s:timers.join('+')||'0',reward_coins:q.reward_coins,reward_metal:q.reward_metal,condition:q.type==='resource_ready'?`resource_ready(${q.target}) = unlocked`:`${q.type} >= ${q.target}`,mode:q.progress_mode,complete_when:q.completes_when,reward_when:'manual_claim',model_active_seconds:row?.duration_s??'',playtime_estimate:row?'Engine input model A/D seed41; human playtime not measured':'not measured'});
 }
}
const header=Object.keys(records[0]),cell=v=>`"${String(v).replaceAll('"','""')}"`;
fs.writeFileSync('docs/QUESTS.csv','\ufeff'+header.join(',')+'\n'+records.map(r=>header.map(k=>cell(r[k])).join(',')).join('\n')+'\n');
let md='# Таблица квестов из runtime-конфигов v0.4a\n\nГенерация: `npm run quests`. Стоимость — необходимые новые заказы при прохождении по цепочке; можно оплатить раньше. Для квеста 10 катер уже оплачен в квесте 9, указан полный таймер этого же заказа, а не дополнительное строительство. `+` объединяет последовательные заказы. Таймер строительства не равен времени прохождения. Input-driven Engine simulation до/после и все 34 цели: [BALANCE_V04A](BALANCE_V04A.md), [QUEST_AUDIT_V04A.csv](QUEST_AUDIT_V04A.csv). Это расчёт модели, не измеренный человеческий playtime. REFERENCE использует проверенную ступенчатую формулу найма 1.0.2.\n';
for(const profile of ['fast','reference']) {
 md+=`\n## ${profile}\n\n| № | Задание | Монеты / металл | Таймеры, с | Награда ◉ | Условие / режим / момент |\n|---|---|---|---|---|---|\n`;
 for(const r of records.filter(r=>r.profile===profile))md+=`| ${r.id} | ${r.title} | ${r.coin_cost} / ${r.metal_cost} | ${r.construction_timers_s} | ${r.reward_coins} | ${r.condition}; ${r.mode}; ${r.complete_when} |\n`;
}
fs.writeFileSync('docs/QUESTS.md',md);console.log(`Generated ${records.length} quest rows from independent runtime profiles.`);
