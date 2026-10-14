import fs from 'node:fs';
import crypto from 'node:crypto';
import {build} from 'esbuild';
const root='test-results/v07c';
fs.mkdirSync(root,{recursive:true});
const input=process.argv.slice(2).find(x=>!x.startsWith('--'));
if(!input)throw new Error('Pass the path to a FAST playtest recording as the first argument.');
const p=JSON.parse(fs.readFileSync(input,'utf8'));
const baselinePath=root+'/before-fast.json';
if(!fs.existsSync(baselinePath)){
 fs.copyFileSync('public/balance/balance_fast.json',baselinePath);
 fs.copyFileSync('public/balance/balance_reference.json',root+'/before-reference.json');
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(d+'/'+x.name):[d+'/'+x.name]);
 const hashes=Object.fromEntries([...walk('src'),...walk('public')].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
 fs.writeFileSync(root+'/before-hashes.json',JSON.stringify(hashes,null,2));
}
const old=JSON.parse(fs.readFileSync(baselinePath));
if(p.events.length!==705||p.snapshots.length!==174||p.metadata.debug_modified||p.aggregates.income.golden_reward!==0)throw Error('Unexpected playtest');
if(JSON.stringify(old)!==JSON.stringify(p.balance_configuration))throw Error('Loaded configuration differs from baseline');
const rows=p.quests.map(q=>{
 const es=p.events.filter(e=>e.quest_id===q.quest_id),a=es.find(e=>e.event_type==='QUEST_ACTIVATED'),r=es.find(e=>e.event_type==='QUEST_REWARD_CLAIMED');
 const s=p.snapshots.find(s=>s.snapshot_id===a?.payload.economy_snapshot_ref);
 const purchases=es.filter(e=>e.event_type==='PURCHASE_FULLY_PAID').map(e=>({id:e.payload.purchase_id,cost:e.payload.full_price,metal:e.payload.metal_price,time:e.elapsed_active_time_s,build_s:e.payload.construction_duration_s}));
 const end=q.claimed_at_s??p.session.active_duration_s;
 const intervals=p.events.filter(e=>e.event_type==='economy_interval'&&e.elapsed_active_time_s>=q.activated_at_s&&e.elapsed_active_time_s<=end);
 const fish=intervals.reduce((n,e)=>n+(e.payload.income.fish_sale??0),0);
 const completionIntervals=intervals.filter(e=>e.elapsed_active_time_s<=q.completed_at_s);
 const completionFish=completionIntervals.reduce((n,e)=>n+(e.payload.income.fish_sale??0),0);
 const next=p.quests[q.quest_id],ids={18:'resource:lobster',20:'cargo:4',21:'storage',22:'cutter',23:'resource:wreck',25:'salvage:0',27:'resource:swordfish',30:'storageUpgrade',31:'den',32:'resource:squid',33:'salvage:1',34:'route'};
 const price=next?priceFor(old,ids[next.quest_id]):undefined;
 return {...q,wallet_after_claim:r?.payload.wallet_after??null,pending_at_activation:s?.economy.pending_coins_total??null,fleet_at_activation:s?.fleet??null,last60_sales_at_activation:s?.production.last_60s_sales_income??null,purchases,fish_during_completion:completionFish,fish_through_claim:fish,claim_delay:r?.payload.time_between_completion_and_claim??null,skips:es.filter(e=>e.event_type==='CONSTRUCTION_SKIPPED').map(e=>({id:e.payload.purchase_id,type:e.payload.skip_type,wait:e.payload.actual_waiting_active_s})),next_minimum_cost:price??null,next_affordable_wallet:price!==undefined&&r? r.payload.wallet_after>=price:null};
});
function priceFor(c,id){if(!id)return undefined;if(id.startsWith('resource:'))return c.resources[id.slice(9)].cost;if(id.startsWith('cargo:'))return c.capacity_upgrades.find(x=>x.level===+id.slice(6)).cost;if(id.startsWith('salvage:'))return Math.round(c.salvage.worker.cost*c.salvage.worker.cost_growth**(+id.slice(8)));return ({storage:c.salvage.storage,cutter:c.salvage.cutter,storageUpgrade:c.salvage.upgrade,den:c.expansion.den,route:c.expansion.route})[id]?.cost;}
const rec=p.final_snapshot.economy;
if(rec.wallet!==rec.total_earned-rec.total_spent||rec.total_earned!==7525+14518)throw Error('Reconciliation failed');
fs.writeFileSync(root+'/observed.json',JSON.stringify({input,input_sha256:crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),session:p.session,summary:p.summary,reconciliation:rec,rows,skips:p.events.filter(e=>e.event_type==='CONSTRUCTION_SKIPPED').length},null,2));

// Snapshot production means picked-up money + change in pending physical payouts.
for(let i=0;i<rows.length;i++){
 const row=rows[i],next=rows[i+1];
 const a=p.events.find(e=>e.event_type==='QUEST_ACTIVATED'&&e.quest_id===next?.quest_id);
 const end=p.snapshots.find(s=>s.snapshot_id===a?.payload.economy_snapshot_ref)??p.final_snapshot;
 if(row.claimed_at_s!==null){
  row.pending_after_claim=end.economy.pending_coins_total;
  row.fish_payouts_created=row.fish_through_claim+row.pending_after_claim-row.pending_at_activation;
  row.collected_coins_per_s=row.fish_through_claim/(row.claimed_at_s-row.activated_at_s);
  row.delivered_coins_per_s=row.fish_payouts_created/(row.claimed_at_s-row.activated_at_s);
  const price=next?.purchases.reduce((n,o)=>n+o.cost,0)??0;
  if(price){row.next_minimum_cost=price;row.next_affordable_wallet=row.wallet_after_claim>=price;row.next_affordable_including_pending=row.wallet_after_claim+row.pending_after_claim>=price;}
 }
}
fs.writeFileSync(root+'/observed.json',JSON.stringify({input,input_sha256:crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),session:p.session,summary:p.summary,reconciliation:rec,rows,skips:p.events.filter(e=>e.event_type==='CONSTRUCTION_SKIPPED').length},null,2));
const b=await build({entryPoints:['scripts/balance-model-v04a.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {simulate}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const efficientSource=b.outputFiles[0].text.replace('pending >= Math.max(20, capacity(c, s, p)', 'pending >= Math.max(20, .65 * capacity(c, s, p)');
if(efficientSource===b.outputFiles[0].text)throw Error('Efficient driver hook missing');
const efficient=await import('data:text/javascript;base64,'+Buffer.from(efficientSource).toString('base64'));
const baseline=process.argv.includes('--baseline'),pattern=process.argv.includes('--pattern');
const current=baseline?old:JSON.parse(fs.readFileSync('public/balance/balance_fast.json'));
const scenarios=pattern?['H']:process.argv.includes('--matrix')?['A','C','B','E']:['A'];
const seeds=process.argv.includes('--matrix')||pattern&&!baseline?[41,97,211]:[41],results=[];
for(const scenario of scenarios)for(const seed of seeds){
 let engine,free=0,last=-1,maxMetal=0;const checkpoints=new Map();
 const pending=()=>engine.state.coinStacks.filter(x=>x.source==='fish_sale').reduce((n,x)=>n+x.value,0);
 const capture=()=>{const q=engine.state.questIndex;if(q!==last){if(last>=0)checkpoints.get(last).pending_end=pending();checkpoints.set(q,{pending_start:pending(),wallet_start:engine.state.coins});last=q;}};
 const result=(scenario==='E'?efficient.simulate:simulate)(current,scenario==='B'?'B':scenario==='C'?'C':'A',seed,7200,34,undefined,{
  onEngine:e=>{engine=e;capture();},beforeStep:capture,afterStep:()=>{
   const s=engine.state;maxMetal=Math.max(maxMetal,s.metal);
   if(s.metal>(s.flags.storageUpgrade?current.salvage.upgrade.capacity:current.salvage.storage.capacity))throw Error('Storage cap');
   for(const o of Object.values(s.orders))if(!o.complete&&o.readyAt!==null){
    const observed=rows.flatMap(q=>q.skips).find(x=>x.id===o.id);
    const allowed=scenario!=='H'||observed||s.questIndex>=25;
    const elapsed=s.time-(o.readyAt-o.duration),delay=scenario==='H'&&observed?observed.wait:2;
    if(allowed&&elapsed>delay&&o.readyAt-s.time<current.monetization.free_skip_below_s){if(engine.skip(o.id))free++;}
   }
  }
 });
 checkpoints.get(last).pending_end=pending();
 for(const row of result.rows){Object.assign(row,checkpoints.get(row.quest-1));row.created_fish_payouts=row.fish_collected+row.pending_end-row.pending_start;row.fresh_income_gap=Math.max(0,row.action_cost-row.wallet_start-row.pending_start);}
 result.free_skips=free;result.scenario=scenario;result.max_metal=maxMetal;
 results.push(result);
 console.log(JSON.stringify({baseline,scenario,seed,completed:result.completed,total:result.total_s,gate:result.early15_s,zone2:result.total_s-result.early15_s,quests:result.rows.slice(15).map(r=>[r.quest,r.duration_s])}));
}
fs.writeFileSync(root+'/'+(baseline?'baseline':'engine')+(pattern?'-pattern':'')+'-results.json',JSON.stringify(results,null,2));
if(results.some(r=>!r.completed||r.debug_income))throw Error('Unfunded progression failed');

