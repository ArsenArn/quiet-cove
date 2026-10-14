import fs from 'node:fs';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
await build({entryPoints:['scripts/traffic-scenarios-v04b.ts'],outfile:'.local/v04b-stress.mjs',bundle:true,platform:'node',format:'esm'});
await build({entryPoints:['.local/v04b-backup/src/game/engine.ts'],outfile:'.local/v04b-baseline/engine.js',bundle:true,platform:'node',format:'esm'});
const {runFleet,fleetFixture}=await import(pathToFileURL(path.resolve('.local/v04b-stress.mjs')));
const {Engine:BaselineEngine}=await import(pathToFileURL(path.resolve('.local/v04b-baseline/engine.js')));
const results=[];
for(const profile of ['fast','reference']){
 const current=JSON.parse(fs.readFileSync(`public/balance/balance_${profile}.json`,'utf8'));
 const baseline=JSON.parse(fs.readFileSync(`.local/v04b-backup/public/balance/balance_${profile}.json`,'utf8'));
 for(const scenario of [{count:0,name:'one boat'},{count:5,name:'5 workers'},{count:10,name:'10 workers',support:false},{count:current.workers.max_count,name:'max fleet'},{count:current.workers.max_count,name:'single resource + stacked load',single:true,stack:true},{count:current.workers.max_count,name:'fleet + pirates',combat:true}]){
  const state=fleetFixture(current,scenario.count,scenario),before=runFleet(baseline,structuredClone(state),600,BaselineEngine),after=runFleet(current,structuredClone(state),600);
  const result={profile,scenario:scenario.name,before,after,deliveryChangePercent:before.successfulDeliveries?100*(after.successfulDeliveries/before.successfulDeliveries-1):0,issuedIncomeChangePercent:before.issuedFishIncome?100*(after.issuedFishIncome/before.issuedFishIncome-1):0};results.push(result);
  console.log(JSON.stringify({profile,scenario:scenario.name,before:before.successfulDeliveries,after:after.successfulDeliveries,change:result.deliveryChangePercent,stuck:after.stuckBoats,wait:after.maxPortWaitS,ms:after.msPerSimulationStep}));
 }
}
fs.mkdirSync('test-results/v04b',{recursive:true});fs.writeFileSync('test-results/v04b/fleet-stress.json',JSON.stringify({method:'600 game seconds per scenario, same fixture and seed; original v0.4a Engine from pre-edit bundle; gameplay CPU, not browser FPS. Max includes configured normal/speed/salvage fleet. Delivery value is issued income, not wallet.',results},null,2)+'\n');
if(results.some(r=>r.after.illegalPositions||r.after.stuckBoats.length))process.exitCode=1;
