// Reuse the v0.3.2 native pointer/touch checks while preserving its old artifacts.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
fs.mkdirSync('.local',{recursive:true});fs.mkdirSync('test-results/v04b',{recursive:true});
const source=fs.readFileSync('scripts/browser-v032.mjs','utf8').replaceAll('test-results/v032-','test-results/v04b/ux-');
const target='.local/browser-ux-v04b.mjs';fs.writeFileSync(target,source);
await import(pathToFileURL(path.resolve(target)));
