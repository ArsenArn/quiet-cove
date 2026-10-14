import fs from 'node:fs';
// Reproducible tuning from the immutable v0.3.2 baseline. Never touches research.
const read=p=>JSON.parse(fs.readFileSync(`.local/v04a-baseline/balance_${p}.json`,'utf8'));
const fast=read('fast'),reference=read('reference');
for(const [id,patch] of Object.entries({mussel:{value:8},snapper:{value:14,cost:450,build_s:20},tuna:{value:24,cost:900,build_s:30},lobster:{value:40,cost:2400,build_s:35},swordfish:{value:70,cost:8500,build_s:45},squid:{value:110,cost:16000,build_s:50}}))Object.assign(fast.resources[id],patch);
Object.assign(fast.expansion.gate,{cost:1400,build_s:30});
Object.assign(fast.special.combat,{cost:2200,build_s:20});
// Final mandatory route otherwise remains ~3.3 minutes of accumulating cash
// with no further quest unlocks; keep the metal investment and 60s timer.
fast.expansion.route.cost=14000;
// Food correspondence is an adaptation, numbers come from the 1.0.2 TextAsset.
const map={sardine:'apple',crab:'lolli',mussel:'sand',snapper:'pizza',tuna:'cake',lobster:'donut',swordfish:'cheese',squid:'pie',wreck:'log'};
const foods=fs.readFileSync('../research_102/raw/foods.txt','utf8');
for(const [id,key] of Object.entries(map)){
 const line=foods.split(/\r?\n/).find(line=>line.startsWith(key+' '));
 const fields=line.split('|').map(x=>x.trim()),number=name=>Number(fields.find(x=>x.startsWith(name+' ')).split(' ')[1]);
 Object.assign(reference.resources[id],{value:Number(fields[1]),cost:Number(fields[2]),portion_hp:number('hp'),stock:number('stock'),regrow_s:number('regrow'),restock_s:number('restock'),build_s:number('build')});
 // WorkerSystem.HarvestBite subtracts one HP for each received chunk (Bite=1).
 // Preserving web damage=10 would cut
 // source supply by 10x. This remains an explicit economy field, not combat damage.
 reference.resources[id].damage_per_catch=1;
}
Object.assign(reference.salvage.storage,{cost:14000,build_s:120});
Object.assign(reference.salvage.cutter,{cost:5000,build_s:300});
Object.assign(reference.salvage.worker,{cost:7000,cost_growth:1.35,build_s:120,max_count:6,timers_s:[120,300]});
Object.assign(reference.salvage.upgrade,{cost:20000,metal_cost:40});
Object.assign(reference.expansion.den,{cost:51000,metal_cost:150,build_s:120});
// Our route is within zone 2; it is NOT the original Terrace (third zone).
Object.assign(reference.monetization,{golden_min_coins:250,golden_estimate_seconds:180,golden_lifetime_s:30});
reference.meta.caveat='v0.4a: source numbers from shipped Life of Ants 1.0.2; resource correspondence, geometry, 34 coin-only quest rewards, EarnRate estimator and distant route are adaptations. See docs/REFERENCE_SOURCE_MAP_V04A.md.';
fast.meta.caveat='v0.4a demonstration economy, HYPOTHESIS tuned with real Engine input-driven simulations; human playtime is not yet measured. Golden optional.';
for(const c of [fast,reference])fs.writeFileSync(`public/balance/balance_${c.profile}.json`,JSON.stringify(c,null,2)+'\n');
