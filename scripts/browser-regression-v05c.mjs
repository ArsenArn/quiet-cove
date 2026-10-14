// Existing gameplay and native-input assertions, isolated output directories.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
fs.mkdirSync('.local',{recursive:true});fs.mkdirSync('test-results/v05c/regression',{recursive:true});
process.env.SMOKE_URL??='http://127.0.0.1:4193';process.env.SMOKE_OUTPUT='test-results/v05c/regression';
const mode=process.argv[2]??'gameplay';let source;
if(mode==='gameplay'){
 source=fs.readFileSync('scripts/browser-smoke.mjs','utf8');
 const overlap="Object.assign(s.boats[0],{x:2300,y:1190});",free='const workerHit=await page.evaluate';
 if(source.split(overlap).length!==2||source.split(free).length!==2)throw new Error('Historical fixtures changed; review v05b adaptation.');
 source=source.replace(overlap,"Object.assign(s.boats[0],{x:2300,y:1100});").replace(free,"await page.evaluate(()=>{const f=window.__fishing;f.engine.speed=1;f.engine.state.orders['worker:1'].readyAt=f.engine.state.time+15;});await page.waitForTimeout(120);const workerHit=await page.evaluate");
}else if(mode==='ux')source=fs.readFileSync('scripts/browser-v032.mjs','utf8').replaceAll('test-results/v032-','test-results/v05c/regression/ux-');
else if(mode==='traffic')source=fs.readFileSync('scripts/browser-v04b.mjs','utf8').replaceAll('test-results/v04b/browser','test-results/v05c/traffic');
else throw new Error(`Unknown mode: ${mode}`);
if(mode==='gameplay')source=source.replace('assert.deepEqual(errors,[]);console.log', "assert.deepEqual(errors,[]);fs.writeFileSync(outputDir+'/gameplay-smoke.json',JSON.stringify({result:'passed',checks,consoleErrors:errors},null,2));console.log");
const target=`.local/browser-regression-v05c-${mode}.mjs`;fs.writeFileSync(target,source);await import(pathToFileURL(path.resolve(target)));
