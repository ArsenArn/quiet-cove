import fs from 'node:fs';
import type {Balance,Profile} from '../src/config/types';
export const loadConfig=(profile:Profile)=>JSON.parse(fs.readFileSync(`public/balance/balance_${profile}.json`,'utf8')) as Balance;
