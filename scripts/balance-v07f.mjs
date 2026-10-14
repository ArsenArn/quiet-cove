import fs from 'node:fs';import {build} from 'esbuild';import {pathToFileURL} from 'node:url';import path from 'node:path';
const root='test-results/v07f';
let driver=fs.readFileSync('scripts/balance-model-v04a.ts','utf8').replace('let id=action(c,e);',"let id=action(c,e);if(s.rewarded.includes(26) && c.second_port && !s.flags.secondPort)id='secondPort';");fs.writeFileSync('.local/v07f/optional-driver.ts',driver);
await build({entryPoints:['.local/v07f/before/scripts/balance-model-v04a.ts'],outfile:'.local/v07f/before-model.mjs',bundle:true,platform:'node',format:'esm'});
await build({entryPoints:['scripts/balance-model-v04a.ts'],outfile:'.local/v07f/final-model.mjs',bundle:true,platform:'node',format:'esm'});
await build({stdin:{contents:driver,resolveDir:path.resolve('scripts'),loader:'ts'},outfile:'.local/v07f/optional-model.mjs',bundle:true,platform:'node',format:'esm'});
const results=[];
for(const label of ['before','final','optional']){
 const simulate=(await import(pathToFileURL(path.resolve(`.local/v07f/${label==='optional'?'optional':label==='final'?'final':'before'}-model.mjs`)))).simulate;
 for(const seed of [41,97,211]){
  const c=JSON.parse(fs.readFileSync(label==='before'?'.local/v07f/before/public/balance/balance_fast.json':'public/balance/balance_fast.json'));let engine,free=0;
  const r=simulate(c,'A',seed,7200,34,undefined,{onEngine:e=>engine=e,afterStep:()=>{for(const o of Object.values(engine.state.orders))if(!o.complete&&o.readyAt!==null&&engine.state.time>o.readyAt-o.duration+2&&o.readyAt-engine.state.time<c.monetization.free_skip_below_s)if(engine.skip(o.id))free++;}});
  r.label=label;r.free_skips=free;results.push(r);fs.writeFileSync(root+'/pacing.json',JSON.stringify(results,null,2));console.log(JSON.stringify({label,seed,completed:r.completed,total:r.total_s,gate:r.early15_s,free,port:!!engine.state.flags.secondPort,debug:r.debug_income}));
 }
}
