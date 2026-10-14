import fs from 'node:fs';import {build} from 'esbuild';import {pathToFileURL} from 'node:url';import path from 'node:path';
await build({entryPoints:['scripts/balance-model-v04a.ts'],outfile:'.local/v07e/after-model.mjs',bundle:true,platform:'node',format:'esm'});
const before=(await import(pathToFileURL(path.resolve('.local/v07e/before-model.mjs')))).simulate,after=(await import(pathToFileURL(path.resolve('.local/v07e/after-model.mjs')))).simulate;
const prior=fs.existsSync('test-results/v07e/pacing.json')?JSON.parse(fs.readFileSync('test-results/v07e/pacing.json')):[];const results=[];
for(const [label,simulate,file] of [['before',before,'test-results/v07e/before/balance/balance_fast.json'],['after',after,'public/balance/balance_fast.json']])for(const seed of [41,97,211]){
 const previous=prior.find(r=>r.label===label&&r.seed===seed);if(label==='before'&&previous){results.push(previous);continue;}
 const c=JSON.parse(fs.readFileSync(file));let engine,free=0;const r=simulate(c,'A',seed,7200,34,undefined,{onEngine:e=>engine=e,afterStep:()=>{for(const o of Object.values(engine.state.orders))if(!o.complete&&o.readyAt!==null&&engine.state.time>o.readyAt-o.duration+2&&o.readyAt-engine.state.time<c.monetization.free_skip_below_s)if(engine.skip(o.id))free++;}});r.label=label;r.free_skips=free;results.push(r);console.log(JSON.stringify({label,seed,completed:r.completed,gate:r.early15_s,zone2:r.total_s-r.early15_s,total:r.total_s,debug:r.debug_income}));
}
fs.writeFileSync('test-results/v07e/pacing.json',JSON.stringify(results,null,2));
