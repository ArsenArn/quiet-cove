import fs from 'node:fs';import {build} from 'esbuild';import {pathToFileURL} from 'node:url';import path from 'node:path';
const results=[];
for(const label of ['before','final']){
 const base=label==='before'?'.local/v07f/before/':'';
 await build({stdin:{contents:`export {fleetFixture,runFleet} from './${base}scripts/traffic-scenarios-v04b';`,resolveDir:process.cwd()},outfile:`.local/v07f/${label}-fleet.mjs`,bundle:true,format:'esm',platform:'node'});
 const {fleetFixture,runFleet}=await import(pathToFileURL(path.resolve(`.local/v07f/${label}-fleet.mjs`))),c=JSON.parse(fs.readFileSync(base+'public/balance/balance_fast.json')),s=fleetFixture(c,10,{combat:true});s.flags.secondPort=true;
 const result=runFleet(c,s,1200);results.push({label,...result});fs.writeFileSync('test-results/v07f/fleet.json',JSON.stringify(results,null,2));console.log(JSON.stringify({label,deliveries:result.successfulDeliveries,income:result.issuedFishIncome,stuck:result.stuckBoats,illegal:result.illegalPositions,cpu:result.cpuMs}));
}
