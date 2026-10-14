import fs from 'node:fs';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
await build({entryPoints:['scripts/balance-model-v04a.ts'],outfile:'.local/v04a/stress.mjs',bundle:true,platform:'node',format:'esm'});
const {simulate}=await import(pathToFileURL(path.resolve('.local/v04a/stress.mjs')));
const c=JSON.parse(fs.readFileSync('public/balance/balance_fast.json','utf8'));
const base=simulate(c,'A',41,86400,15),results=[];
for(const depleted of [false,true])for(const golden of [false,true]){
 const s=structuredClone(base.gateCheckpoint);
 if(depleted){Object.assign(s.nodes.tuna,{stock:0,hp:0,phase:'restock',readyAt:s.time+c.resources.tuna.restock_s});s.crates=s.crates.filter(p=>p.resource!=='tuna');}
 if(golden){s.golden.nextAt=s.time;s.golden.expires=null;}
 const r=simulate(c,golden?'B':'A',41,s.time+900,16,s);
 results.push({type:'technical sensitivity from unfunded natural gate checkpoint; injected depletion/merchant timing, not natural playtime',depleted,golden,completed:r.completed,wallet_at_gate:base.gateCheckpoint.coins,defender_gap_s:r.gate_to_defender_s,row:r.rows[0],payment:r.payments[0]});
}
fs.writeFileSync('test-results/v04a/defender-stress.json',JSON.stringify(results,null,2)+'\n');console.log(results.map(({row,payment,...r})=>r));
if(results.some(r=>!r.completed))process.exitCode=1;
