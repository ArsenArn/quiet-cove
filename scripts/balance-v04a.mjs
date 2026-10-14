import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const args=process.argv.slice(2),baseline=args.includes('--baseline'),label=args.find(a=>a.startsWith('--label='))?.slice(8)??(baseline?'before':'after');
fs.mkdirSync('.local/v04a',{recursive:true});
const output=`.local/v04a/model-${baseline?'before':'after'}.mjs`;
await build({entryPoints:['scripts/balance-model-v04a.ts'],outfile:output,bundle:true,platform:'node',format:'esm',plugins:baseline?[{name:'immutable-baseline-engine',setup(b){b.onResolve({filter:/^\.\.\/src\//},args=>({path:path.resolve('.local/v04a-baseline/src',args.path.slice(7)+'.ts')}));}}]:[]});
const {simulate}=await import(pathToFileURL(path.resolve(output)));
const seeds=(args.find(a=>a.startsWith('--seeds='))?.slice(8)??'41,97,211').split(',').map(Number);
const scenarios=(args.find(a=>a.startsWith('--scenarios='))?.slice(12)??'A,B,C,D').split(',');
const limit=Number(args.find(a=>a.startsWith('--limit='))?.slice(8)??34),results=[];
fs.mkdirSync('test-results/v04a',{recursive:true});
for(const scenario of scenarios)for(const seed of seeds){
 const profile=scenario==='D'?'reference':'fast',root=baseline?'.local/v04a-baseline':'public/balance';
 const c=JSON.parse(fs.readFileSync(`${root}/balance_${profile}.json`,'utf8'));
 const start=Date.now(),result=simulate(c,scenario,seed,86400,limit);results.push(result);
 fs.writeFileSync(`test-results/v04a/${label}-${scenario}-${seed}.json`,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({label,scenario,seed,completed:result.completed,quests:result.quests_completed,minutes:result.total_s/60,early15:result.early15_s/60,defenderGap:result.gate_to_defender_s,elapsed_s:(Date.now()-start)/1000}));
}
fs.writeFileSync(`test-results/v04a/${label}-summary.json`,JSON.stringify(results.map(({terminal,rows,payments,samples,gateCheckpoint,...r})=>r),null,2)+'\n');
if(results.some(r=>!r.completed))process.exitCode=1;
