
 const fs=(await import('node:fs')).default,crypto=(await import('node:crypto')).default;
 const root='test-results/v07c',read=n=>JSON.parse(fs.readFileSync(root+'/'+n+'.json'));
 const o=read('observed'),old=read('before-fast'),c=JSON.parse(fs.readFileSync('public/balance/balance_fast.json'));
 const runs=read('engine-results'),before=read('baseline-results')[0],normal=runs.filter(r=>r.scenario==='A'),hruns=read('engine-pattern-results'),hbefore=read('baseline-pattern-results')[0];
 const mean=a=>a.reduce((s,x)=>s+x,0)/a.length,round=x=>Math.round(x*10)/10,zone=r=>r.total_s-r.early15_s;
 const span=o.rows[24].claimed_at_s-o.rows[15].activated_at_s,k=span/before.rows.slice(15,25).reduce((s,q)=>s+q.duration_s,0),kh=span/hbefore.rows.slice(15,25).reduce((s,q)=>s+q.duration_s,0),anchor=o.rows[15].activated_at_s;
 const fmt=x=>Math.floor(Math.round(x)/60)+':'+String(Math.round(x)%60).padStart(2,'0');
 const range=(a,clock=false)=>clock?fmt(Math.min(...a))+'–'+fmt(Math.max(...a)):round(Math.min(...a))+'–'+round(Math.max(...a));
 const projection=Array.from({length:34},(_,i)=>{
  const id=i+1,obs=o.rows[i];if(id<=15)return {id,source:'OBSERVED protected',duration_s:obs.duration_s,completion_s:obs.completed_at_s};
  const rows=normal.map(r=>r.rows[i]),avg=key=>round(mean(rows.map(r=>r[key])));
  const ends=normal.map(r=>anchor+k*(r.rows[i].end_s-r.early15_s));
  return {id,source:'MODELED calibrated; not human verified',duration_s:round(mean(rows.map(r=>r.duration_s))*k),duration_range:rows.map(r=>round(r.duration_s*k)),completion_s:round(mean(ends)),completion_range:ends,wallet_start:avg('wallet_start'),wallet_after:avg('wallet_after_reward'),pending_start:avg('pending_start'),sales:avg('fish_collected'),fresh_gap:avg('fresh_income_gap'),cash_s:round(mean(rows.map(r=>r.cash_wait_s))*k),build_s:round(mean(rows.map(r=>r.build_wait_s))*k),other_s:round(mean(rows.map(r=>r.duration_s-r.cash_wait_s-r.build_wait_s))*k)};
 });
 const scenarios=['A','E','C','B'].map(s=>{const rr=runs.filter(r=>r.scenario===s);return {scenario:s,raw_full_s:rr.map(r=>r.total_s),raw_zone2_s:rr.map(zone),calibrated_zone2_s:rr.map(r=>k*zone(r)),anchored_full_s:rr.map(r=>anchor+k*zone(r)),free_skips:rr.map(r=>r.free_skips),debug_income:rr.map(r=>r.debug_income)};});
 fs.writeFileSync(root+'/projection.json',JSON.stringify({anchor,k,observed_calibration_span:span,baseline_calibration_span:span/k,kh,projection,scenarios},null,2));
 const hashes=read('before-hashes'),changed=Object.keys(hashes).filter(f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')!==hashes[f]);
 const allowed=['src/config/load.ts','src/config/types.ts','src/game/systems/construction.ts','public/balance/balance_fast.json'];
 if(JSON.stringify([...changed].sort())!==JSON.stringify([...allowed].sort()))throw Error('Unexpected src/public edit');
 const differences=[],diff=(a,b,path='')=>{if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object')for(const key of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[key],b[key],path?path+'.'+key:key);else differences.push({path,before:a??null,after:b??null});};diff(old,c);
 for(const d of differences)if(!/^(meta\.|fast_zone2$|quests\.(1[5-9]|2[0-9]|3[0-3])\.reward_coins$|resources\.(lobster|swordfish)\.(cost|restock_s)$|resources\.(wreck|squid)\.cost$|salvage\.(storage|cutter|upgrade)\.cost$|salvage\.worker\.(cost|cost_growth)$|expansion\.(den|route)\.cost$)/.test(d.path))throw Error('Unapproved field '+d.path);
 const refhash=crypto.createHash('sha256').update(fs.readFileSync('public/balance/balance_reference.json')).digest('hex');
 if(refhash!==hashes['public/balance/balance_reference.json'])throw Error('REFERENCE drift');
 fs.writeFileSync(root+'/scope.json',JSON.stringify({changed,reference_sha256:refhash,unchanged_src_public_files:Object.keys(hashes).length-changed.length,differences},null,2));
 const build=await (await import('esbuild')).build({stdin:{contents:"export {Engine} from './src/game/engine';export {activateQuest,questProgress} from './src/game/systems/quests';export {offers} from './src/game/systems/construction';export {deposit} from './src/game/systems/economy';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
 const {Engine,activateQuest,questProgress,offers,deposit}=await import('data:text/javascript;base64,'+Buffer.from(build.outputFiles[0].text).toString('base64'));
 const audit=[];
 for(const [version,b] of [['before',old],['v07c',c]])for(const index of [23,25]){
  const e=new Engine(b),s=e.state;s.area=2;s.questIndex=index;s.flags.storage=true;s.flags.cutter=true;s.nodes.wreck.unlocked=true;s.metal=100;s.stats.metal_deposited=100;activateQuest(b,s);
  Object.assign(s.boats[0],b.world.storage);s.boats[0].cargo=[{id:s.nextId++,resource:'wreck',kind:'metal',value:0}];deposit(b,s,s.boats[0],1);
  audit.push({version,quest:b.quests[index].id,metal:s.metal,progress:questProgress(b.quests[index],s),remaining_cargo:s.boats[0].cargo.length,visible_metal_sinks:offers(b,s).filter(x=>(x.metal_cost??0)>0&&!x.blocked).map(x=>x.id)});
 }
 fs.writeFileSync(root+'/softlock-audit.json',JSON.stringify({type:'synthetic edge fixtures, not human playtest',audit},null,2));
 const prices=b=>{
  const w=n=>b.fast_zone2?.worker_costs[n-1]??Math.round(b.workers.base_cost*b.workers.cost_growth**(n-1)),cargo=n=>b.fast_zone2?.cargo_costs[n]??b.capacity_upgrades.find(x=>x.level===n).cost;
  return {16:b.special.combat.cost,17:'—',18:b.resources.lobster.cost,19:w(4)+' + '+w(5),20:cargo(4)+' (+325 если Lv.3 нет)',21:b.salvage.storage.cost,22:b.salvage.cutter.cost,23:b.resources.wreck.cost,24:'—',25:b.salvage.worker.cost,26:'—',27:b.resources.swordfish.cost,28:w(6)+' + '+w(7),29:cargo(5)+' + '+cargo(6),30:b.salvage.upgrade.cost+' +30 M',31:b.expansion.den.cost+' +50 M',32:b.resources.squid.cost,33:Math.round(b.salvage.worker.cost*b.salvage.worker.cost_growth),34:b.expansion.route.cost+' +80 M'};
 };
 const bp=prices(old),ap=prices(c),sumRewards=b=>b.quests.slice(15).reduce((n,q)=>n+q.reward_coins,0);
 const reasons={16:'Цена и timer приняты по 117 s; меньший бонус оставляет gap перед lobster.',17:'Естественный бой сохранён; бонус не оплачивает открытие.',18:'Меньше цена, но намного меньше reward surplus; нужен доход.',19:'Два найма становятся инвестициями в доход.',20:'Cargo требует продаж; ранние tiers сохранены.',21:'Инфраструктура соответствует доходу флота из 5 лодок.',22:'Промежуточная инвестиция, без искусственного таймера.',23:'Доход требуется до открытия metal; circular gates нет.',24:'10 новых metal deliveries; естественная длительность.',25:'Значимый salvage hire; небольшой бонус.',26:'50 новых deliveries; фоновая рыба накапливается.',27:'Сниженная цена согласована с новыми rewards и depletion.',28:'Поздние наймы растут в цене; ранние неизменны.',29:'Два cargo upgrades поддерживают логистику.',30:'Цена соответствует swordfish income; 30 M и cap сохранены.',31:'Цена снижена вместе с rewards; 50 M и логика прежние.',32:'Старая цена давала 262 s; новое открытие поддерживает темп.',33:'Второй salvage улучшает снабжение route.',34:'Финал требует нового дохода и 80 M, без windfall.'};
 const L=[
 '# FAST ZONE 2 REBALANCE — v0.7c','',
 '2026-10-13. FAST Zone 2 реализован. **MODELED normal: 33:46–34:14 за всю игру; Zone 2: 22:38–23:06.** Человеческий результат ещё не подтверждён.',
 '',
 '**Ограничение приёмки:** все нормальные модельные маршруты достижимы, но безусловный критерий «нет softlock» не выполнен: воспроизведён существовавший раньше edge заполненного склада перед Q24/Q26. Его исправление требует изменения правил квеста/хранения/доступных metal sinks, которые запрещено менять этим заданием.',
 '',
 '## OBSERVED DATA','',
 'Источник: `playtest_FAST_2026-10-13_mv6ogkj1-4f714505-c404-414e-9707-aac013917896.json`, найден в Downloads. SHA-256: `'+o.input_sha256+'`.',
 '',
 '705 events, 174 snapshots. Полная загруженная FAST-конфигурация совпала с before-конфигурацией проекта. Q15 completion=660.395 s; claim/Q16 activation=667.449 s. Q25 completion=970.493 s; claim=976.708 s. Конец записи 995.502 s, Q26 активен. Q26–34 человеком не завершены.',
 '',
 'Ledger: 7525 sales +14518 rewards=22043 income; 22043−16654 spending=5389 wallet. Pending 1893 — отдельно, не wallet. Metal 23. Golden/debug income=0. Free construction skips=10.',
 '',
 '| Q | Activate s | Complete s | Claim s | Duration s | Wallet start→after reward | Pending start→after claim | Required purchases | Sales to completion / through claim | Reward |',
 '|---|---:|---:|---:|---:|---|---|---|---:|---:|'];
 for(const q of o.rows.slice(15,25))L.push('| '+[q.quest_id,round(q.activated_at_s),round(q.completed_at_s),round(q.claimed_at_s),round(q.duration_s),q.wallet_at_activation+'→'+q.wallet_after_claim,q.pending_at_activation+'→'+q.pending_after_claim,q.purchases.map(x=>x.id+'='+x.cost).join('; ')||'—',q.fish_during_completion+' / '+q.fish_through_claim,q.reward].join(' | ')+' |');
 L.push('',
 'DERIVED payout production=(sales collected +pending_end−pending_start)/active interval. Это стоимость реальных доставок, не теоретическая добыча. Короткие окна шумные. Fleet: N normal, S speedboat, V salvage, D Defender.',
 '',
 '| Q | Construction s / free skip actual wait s | Claim delay s | Collected coins/s | Delivered payout coins/s | Fleet at activation / capacity | Next cost: wallet affordable; +pending affordable |',
 '|---|---|---:|---:|---:|---|---|');
 for(const q of o.rows.slice(15,25)){
  const f=q.fleet_at_activation;
  L.push('| '+[q.quest_id,q.purchases.map(x=>x.id+':'+x.build_s).join('; ')+' / '+(q.skips.map(x=>x.id+':'+round(x.wait)).join('; ')||'без skip'),round(q.claim_delay),round(q.collected_coins_per_s),round(q.delivered_coins_per_s),f.worker_count+'N '+f.speedboat_count+'S '+f.salvage_worker_count+'V '+f.defender_count+'D / '+f.player_capacity,q.next_minimum_cost===null?'—':q.next_minimum_cost+': '+(q.next_affordable_wallet?'да':'нет')+'; '+(q.next_affordable_including_pending?'да':'нет')].join(' | ')+' |');
 }
 L.push('',
 'Q21: wallet 3025, cost 1800. Q22: 2843 vs700. Q23: 3718 vs1400. Q25: 5941 vs2600. Rewards Q19–24 суммарно 9577 при обязательных расходах 5349: именно награды финансируют цепочку. Нулевые продажи в походах за metal означают задержку подбора, а не отсутствие работы флота.',
 '',
 '[Полный рассчитанный ledger](../test-results/v07c/observed.json). Исходный JSON не менялся.',
 '',
 '## До/после','',
 'Zone 2 rewards: '+sumRewards(old)+'→'+sumRewards(c)+'. Это не единый множитель: промежуточные инвестиции становятся дороже, дорогие поздние открытия дешевле. Defender price, fish values, stock/HP/regrow/gathering, combat, metal requirements/caps и все construction timers неизменны.',
 '',
 '| Q | Goal | Old reward | New reward | Old price(s) | New price(s) | Observed duration s | MODELED mean [seed range] s | Reason |',
 '|---|---|---:|---:|---|---|---:|---|---|');
 for(let id=16;id<=34;id++){const p=projection[id-1];L.push('| '+[id,c.quests[id-1].label,old.quests[id-1].reward_coins,c.quests[id-1].reward_coins,bp[id],ap[id],id<=25?round(o.rows[id-1].duration_s):'нет данных',p.duration_s+' ['+range(p.duration_range)+']',reasons[id]].join(' | ')+' |');}
 L.push('',
 '`fast_zone2` содержит цены workers №4–10: **700,900,1300,1700,2400,3200,4200**, cargo Lv.4–6: **1400,1500,2100**. Они действуют только при FAST +area2 +questIndex≥15, после claim Q15. До этого даже опциональные поздние покупки используют прежнюю цену. Исходная worker formula и capacity_upgrades сохранены; REFERENCE не использует overrides.',
 '',
 '| Resource | Value before=after | Restock before→after s | Причина |',
 '|---|---:|---|---|',
 '| Lobster | 40 | 450→180 | Убирает длинную просадку при истощении первой редкой рыбы большим флотом. |',
 '| Swordfish | 70 | 750→300 | Поддерживает доход поздних инвестиций при уменьшенных rewards. |',
 '| Squid | 110 | 1650→1650 | Начального запаса достаточно; менять восстановление не обосновано. |',
 '',
 'Wreck/metal production не менялась. Рост мощности сохраняется: новые fish дают 40→70→110 и normal fleet 3→5→7. Salvage работает на metal, а не coin income.',
 '',
 '## MODELED ESTIMATES и калибровка','',
 'Используется реальный Engine и существующий input-driver `balance-model-v04a.ts`. Он движется, собирает/доставляет, подбирает физические монеты, платит, claims и применяет штатный free skip. Нет debug grants, ускорения Engine, принудительного завершения goals или rewarded timer skips.',
 '',
 'До правок Engine A seed41 завершает Q15 в '+before.early15_s+' s, человек — 660.395 s: Zone 1 модель быстрее в '+round(660.395/before.early15_s)+' раза. Поэтому принятая Zone 1 в проекции закрепляется на реальном anchor=667.449 s, без балансных правок.',
 '',
 'Старый Engine Q16–25: '+round(span/k)+' s. Человек activation16→claim25: '+round(span)+' s. **k='+k.toFixed(6)+'**. Формула milestone=667.449+k×(Engine milestone−Engine Q15). Поздний участок модели уже близок к реальности; механически переносить коэффициент ранней Zone 1 на него неверно.',
 '',
 'Калибровка учитывает claim/navigation overhead в агрегате. До Q25 есть человеческий calibration segment, после Q25 только экстраполяция. Seed ranges — разброс модели, НЕ статистический доверительный интервал человеческой игры. Состояние человека в Q16 имело wallet826/capacity5, а driver checkpoint — wallet435/capacity4; такого агрегатного соответствия недостаточно для гарантии каждого индивидуального времени.',
 '',
 'Tquest определяется реальной доступностью дохода, действиями, неизбежным ожиданием и navigation. Lower-bound gap=max(0,price−wallet−pending); pending ещё нужно физически подобрать. Resources availability, AI, drops, recovery и lifetime counters исполняет Engine. Обязательные новые доставки Q24/26 считают since_activation; заранее построенный lifetime upgrade может сократить следующий quest.',
 '',
 'Доход накапливается и во время construction. Ниже income loop/construction phase/other — взаимоисключающие фазы input-driver, а не независимые таймеры, наивно добавленные друг к другу. Рыбалка и pickup внутри construction уже включены. Worker 75 s нельзя сразу пропустить: free skip только при remaining<60 s.',
 '',
 '| Q | Wallet start | Pending start | Fresh gap lower bound | Collected sales | Wallet after reward | Income loop s | Construction phase s | Other activity/navigation s |',
 '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
 for(const p of projection.slice(15))L.push('| '+[p.id,p.wallet_start,p.pending_start,p.fresh_gap,p.sales,p.wallet_after,p.cash_s,p.build_s,p.other_s].join(' | ')+' |');
 L.push('','Income growth по широким этапам, откалиброванный active clock:','','| Q | Collected coins/s | Delivered payout coins/s | Fleet/content |','|---|---:|---:|---|');
 for(const [start,end,label] of [[16,18,'3 normal +speedboat; lobster появляется в конце'],[19,25,'3→5 normal, lobster, metal infrastructure'],[26,30,'5→7 normal, swordfish, salvage'],[31,34,'7 normal, squid, 1→2 salvage']]){
  const duration=mean(normal.map(r=>r.rows.slice(start-1,end).reduce((n,x)=>n+x.duration_s,0)))*k;
  const sales=mean(normal.map(r=>r.rows.slice(start-1,end).reduce((n,x)=>n+x.fish_collected,0))),created=mean(normal.map(r=>r.rows.slice(start-1,end).reduce((n,x)=>n+x.created_fish_payouts,0)));
  L.push('| '+start+'–'+end+' | '+round(sales/duration)+' | '+round(created/duration)+' | '+label+' |');
 }
 const sales=mean(normal.map(r=>r.rows.slice(15).reduce((n,x)=>n+x.fish_collected,0)));
 L.push('',
 'Zone 2: около '+Math.round(sales)+' coins от collected sales и 9800 от rewards; продажи дают '+round(sales/(sales+9800)*100)+'% поступлений. [Engine ledger: payments, pending, phases, resource states](../test-results/v07c/engine-results.json). Никакие доходы от theoretical production не зачислены прямо в wallet.',
 '',
 'Нормальные bottlenecks: Defender и lobster, hires4/5, storage/cutter/wreck, затем fresh metal deliveries, swordfish/hires6/7, den/squid/route. Пока player занят metal, флот копит cash — один отдельный hire может стать коротким. Серии нескольких economic purchases подряд за quest windfall в normal не наблюдаются.',
 '',
 '## Проекция milestones','',
 '| Q | OBSERVED completion | MODELED normal mean | Seed range |','|---|---|---|---|',
 '| 15 | 11:00 | 11:00, закреплено | Zone 1 неизменна |');
 for(const id of [20,25,30,34]){const p=projection[id-1];L.push('| '+id+' | '+(id<=25?fmt(o.rows[id-1].completed_at_s):'нет данных')+' | '+fmt(p.completion_s)+' | '+range(p.completion_range,true)+' |');}
 L.push('','| Scenario | Raw Engine full | Calibrated Zone 2 | Full with observed Zone 1 anchor |','|---|---|---|---|');
 const labels={A:'NORMAL, free skips available',E:'EFFICIENT, более частый pickup',C:'SLOWER,85% input speed +detours +optional cargo',B:'Optional Golden, штатные offer/watch/claim'};
 for(const s of scenarios)L.push('| '+labels[s.scenario]+' | '+range(s.raw_full_s,true)+' | '+range(s.calibrated_zone2_s,true)+' | '+range(s.anchored_full_s,true)+' |');
 const slow=runs.filter(r=>r.scenario==='C').map(r=>r.early15_s*(660.395/before.early15_s)+7.054+k*zone(r));
 L.push('',
 'C закрепляет принятую Zone 1 для сравнения только Zone 2. При столь же медленной Zone 1 общий прогноз '+range(slow,true)+'. E не гарантированно быстрее на каждом seed: смена маршрутов pickup меняет depletion/AI и накопление pending. Средние близки; нельзя обещать фиксированный выигрыш.',
 '',
 'Golden даёт около 2–3 минут ускорения Zone 2. На отдельных seeds Q27 проходит за 12–26 s после денег, накопленных во время Q26; следующие hires/infrastructure требуют свежих продаж. Значимых подряд reward-financed purchase chains нет. Monetization logic не менялась.',
 '',
 '### Free skips, совпадение с записью','',
 'A использует все доступные free skips: 26 за полную игру. В записи было 10 до Q25, поэтому добавлен отдельный H: ровно те же 10 order IDs и реальные задержки skip до Q25; остальные ранние таймеры ждёт, затем использует обычные free skips. В Defender человек ждал timer; H делает то же. Собственная calibration H: k='+kh.toFixed(6)+'.',
 '',
 '| H seed | Raw Zone 2 | Calibrated Zone 2 | Full anchor |','|---|---|---|---|');
 for(const r of hruns)L.push('| '+r.seed+' | '+fmt(zone(r))+' | '+fmt(kh*zone(r))+' | '+fmt(anchor+kh*zone(r))+' |');
 L.push('',
 'Наблюдавшиеся skip IDs: tuna,cargo3,gate,lobster,workers4/5,cargo4,storage,wreck,salvage1. Free threshold `<60 s`, не `≤60`. H и A поддерживают прогноз около 34 минут. Это моделирование обычных бесплатных пропусков, без rewarded ads.',
 '',
 '### Все 34 quests','',
 '| Q | Источник | Duration s | Cumulative time |','|---|---|---:|---|');
 for(const p of projection)L.push('| '+p.id+' | '+(p.id<=15?'OBSERVED, unchanged':'MODELED')+' | '+round(p.duration_s)+' | '+fmt(p.completion_s)+' |');
 L.push('',
 'Q1–15 duration — фактический activation→completion; claim delays уже есть в cumulative clock. Для Zone 2 duration — агрегатно откалиброванный progression/claim estimate; точное разделение completion/claim без нового человека неизвестно. [Все clocks и projections](../test-results/v07c/projection.json).',
 '',
 '## Metal / softlock boundary','',
 '- Storage100→150, upgrade30 M, den50 M, route80 M: каждый расход в пределах соответствующего cap, всего160 M. Wreck появляется до metal gates; storage/cutter/wreck/first salvage metal не требуют.',
 '- Q24/Q26 требуют соответственно10/50 новых доставок. Player и salvage реально доставляют metal. Engine сохраняет cargo/storage cap и частичную оплату material investments.',
 '- 15 новых unfunded прогонов A/E/C/B×3 +H×3 завершили Q34 без negative state, debug grants и превышения caps. Дополнительно выполнены два before calibration runs.',
 '',
 '**VERIFIED pre-existing edge:** synthetic fixture metal100 перед activation Q24 либо Q26: progress0, metal delivery блокируется, cargo остаётся, visible metal-cost sinks отсутствуют. Это одинаково before/v07c: [softlock-audit.json](../test-results/v07c/softlock-audit.json). Причина: `activateQuest/questProgress` baseline свежих deliveries +`deposit` cap +`offers/revealed` доступны позже.',
 '',
 'Критерий «достижимы normal routes» подтверждён; абсолютное «никакой softlock» не подтверждено. Исправление требует изменения since_activation, правила склада или раскрытия metal-spending purchases; заданием эти механики защищены. Поэтому критерий10 отмечен как ограничение, а не ложный PASS.',
 '',
 '## Защита Zone 1 / REFERENCE','',
 'REFERENCE bytes before=after, SHA-256: `'+refhash+'`. Все его параметры, rewards, resource values, costs, timers и scaling неизменны.',
 '',
 'FAST Q1–15 целиком, все Zone1 resources, base worker/cargo tables/timers, speedboat, gate1400/30 s, units, AI, combat, movement/collisions, navigation, quests conditions/order/IDs, analytics/localization/UI и save schema неизменны. Zone1 optional late tiers тоже не изменены. Новые worker/cargo prices ограничены runtime state FAST Zone2.',
 '',
 'Source/public изменены ровно4 файла: balance_fast.json, config/types.ts, config/load.ts, game/systems/construction.ts. Остальные '+(Object.keys(hashes).length-changed.length)+' файла src/public совпали по SHA-256. [Exact field diff +hash audit](../test-results/v07c/scope.json). Это non-Git checkout: сохранены before snapshots и SHA-256 вместо недоступного git status.',
 '',
 'Все existing partial/building orders сохраняют cost, paid amounts и deadline; rewards не выдаются второй раз; profile saves не смешиваются. Старые накопленные деньги НЕ удаляются. Поэтому продолжение старого Q26 save может быть быстрее нового fresh run. Пользовательские saves не открывались.',
 '',
 'Добавлены scripts/balance-v07c.mjs, scripts/report-v07c.mjs, tests/balance-v07c.test.ts, этот документ и отдельные evidence в test-results/v07c. Обновлены legacy tests balance-v04a/corrections-v031/traffic-v04b только для разрешённой economy/reward части; все quest conditions и REFERENCE protection сохранены. Штатные docs/QUESTS.md/.csv перегенерированы.',
 '',
 '## Validation','',
 '| Check | Result | Evidence |','|---|---|---|',
 '| TypeScript +Vite | PASS; прежний Phaser chunk warning | test-results/v07c/build.log |',
 '| Full Vitest | PASS229/229,23 suites | test-results/v07c/tests.log |',
 '| Focused late overrides/protection/save contracts | PASS5 tests | tests/balance-v07c.test.ts |',
 '| Unfunded physical Engine A/E/C/B×3 +H×3 | PASS15/15,debug0,no rewarded timer skips | engine-results.json,engine-pattern-results.json |',
 '| Save/load migrations,partial price/deadline,physical coin income,claim once,isolation | PASS fixtures,реальные saves не открывались | balance-v07c/balance-v04a/systems tests |',
 '| Server-backed browser smoke | PASS15 groups,consoleErrors=[] | test-results/v07c/browser/smoke.json,browser.log |',
 '| Generated quest tables | PASS68 rows | npm run quests |',
 '| Source/profile/hash/numeric field diff | PASS scope | scope.json |',
 '| Абсолютное отсутствие metal softlock | НЕ ПОДТВЕРЖДЕНО,старый edge воспроизведён | softlock-audit.json |',
 '| Human34 quest pacing / real device | НЕ ПРОВЕРЕНО | следующий плейтест |',
 '',
 'Первый smoke получил HTTP failure из-за аргументов npm/Vite: они стали неверным root. После прямого запуска Vite на5174 все группы прошли. Native headless visibility недоступна: эта группа smoke проверяет deterministic events, не реальный OS/mobile переход.',
 '',
 '## Uncertainty / следующий живой плейтест','',
 '1. Провести свежий FAST run без Golden/debug/rewarded ads, с обычными free skips. Продолжение старого Q26-save с прежними rewards не проверяет новую кривую.',
 '2. Зафиксировать completion/claim Q15/20/25/30/34, покупки optional tiers, состав флота, pending coins, skips, metal и production. Ориентир ~34 min full/~23 min Zone2.',
 '3. Проверить заметный прирост collected sales после lobster/swordfish, пользу наймов, depletion и новые restocks. Дополнительный запас может сильнее помочь человеку или изменить burst timing.',
 '4. Q26–34 не имеют human calibration; delayed pickup, metal trips, optional purchases и уже выполненные lifetime counters меняют отдельные времена. Нет произвольных duration locks.',
 '5. Отдельно проверить ранее существовавший full-storage edge перед Q24/Q26. Для его устранения нужен следующий scope, допускающий изменение механики.',
 '',
 'Модели соответствуют30–35 min, но одна запись, обрывающаяся наQ26, не позволяет надёжно гарантировать этот диапазон человеку. ±15% изменения Zone2 effective income/interaction даёт ориентировочную полосу ~30:20–37:40; это sensitivity, не statistical interval.',
 '',
 '## Reproduce','',
 'Из fishing-game/, исходный JSON доступен по аргументу либо в Downloads:',
 '',
 '```text','node scripts/balance-v07c.mjs --baseline','node scripts/balance-v07c.mjs --matrix','node scripts/balance-v07c.mjs --baseline --pattern','node scripts/balance-v07c.mjs --pattern','node scripts/report-v07c.mjs','npm test','npm run build','npm run quests','```','',
 'Скрипты пишут только внутрь fishing-game/test-results/v07c и docs. Исходный JSON и production configuration ими не меняются; первые before snapshots не перезаписываются. Исторические candidate-config/results — промежуточное предложение; final evidence — engine-results/projection/scope.'
 );
 fs.mkdirSync('docs',{recursive:true});fs.writeFileSync('docs/FAST_ZONE2_REBALANCE_V07C.md',L.join('\n')+'\n');
 console.log(JSON.stringify({report:'docs/FAST_ZONE2_REBALANCE_V07C.md',factor:k,normal_full_s:scenarios[0].anchored_full_s,softlock:'pre-existing reproduced; acceptance limitation',changed}));

