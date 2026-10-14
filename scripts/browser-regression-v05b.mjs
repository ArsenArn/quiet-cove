// Preserve the historical smoke script; isolate its patrol fixture from an overlapping friendly hull.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
fs.mkdirSync('.local',{recursive:true});
const source=fs.readFileSync('scripts/browser-smoke.mjs','utf8');
const overlap="Object.assign(s.boats[0],{x:2300,y:1190});";
if(source.split(overlap).length!==2)throw new Error('Historical patrol fixture changed; inspect before adapting it.');
const workerHit='const workerHit=await page.evaluate';
if(source.split(workerHit).length!==2)throw new Error('Historical Free Skip fixture changed; inspect before adapting it.');
const stableFreeSkip="await page.evaluate(()=>{const f=window.__fishing;f.engine.speed=1;f.engine.state.orders['worker:1'].readyAt=f.engine.state.time+15;});await page.waitForTimeout(120);const workerHit=await page.evaluate";
const target='.local/browser-regression-v05b.mjs';
fs.writeFileSync(target,source.replace(overlap,"Object.assign(s.boats[0],{x:2300,y:1100});").replace(workerHit,stableFreeSkip));
await import(pathToFileURL(path.resolve(target)));
