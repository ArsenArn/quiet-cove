# REFERENCE source map v0.4a

CONFIRMED — данные/ARM64 shipped Life of Ants1.0.2. INFERRED — восстановленное соответствие. HYPOTHESIS — наша адаптация. Исследовательские файлы read-only. Приоритет1.0.2, не прошлые1.0.1 notes. Настройка не заявлена полным клоном оригинального runtime/server.

## Пищевые станции

Числа каждой строки CONFIRMED, соответствие key→fish INFERRED. Колонки: value, cost, HP, stock, regrow, restock, build. Все переносятся в одноимённые resources.* поля, кроме coins-per-chunk→value.

| Web key | Original key | Source | Значения |
|---|---|---|---|
| sardine | apple | [foods.txt](../../research_102/raw/foods.txt) line24 | 1, 0, 30, 8, 5, 360, 0 |
| crab | lolli | [foods.txt](../../research_102/raw/foods.txt) line25 | 3, 90, 45, 6, 7, 180, 5 |
| mussel | sand | [foods.txt](../../research_102/raw/foods.txt) line26 | 6, 700, 70, 4, 9, 360, 180 |
| snapper | pizza | [foods.txt](../../research_102/raw/foods.txt) line27 | 10, 1600, 100, 3, 12, 1440, 300 |
| tuna | cake | [foods.txt](../../research_102/raw/foods.txt) line28 | 15, 6000, 150, 3, 15, 1800, 600 |
| lobster | donut | [foods.txt](../../research_102/raw/foods.txt) line33 | 28, 8000, 300, 5, 15, 900, 900 |
| swordfish | cheese | [foods.txt](../../research_102/raw/foods.txt) line35 | 48, 55000, 500, 4, 24, 1500, 900 |
| squid | pie | [foods.txt](../../research_102/raw/foods.txt) line39 | 80, 90000, 700, 3, 30, 3300, 900 |
| wreck | log | [foods.txt](../../research_102/raw/foods.txt) line38 | 0, 27500, 600, 3, 28, 3000, 900 |

Starter apple — Watermelon; melon — отдельный parked Apple, не источник sardine. Не подменять ключи. Restock360 относится к apple и sand; остальные имеют собственные180/1440/1800/900/1500/3300/3000.

## Покупки и акторы

| Original source | Original numbers | Web field | Status / boundary |
|---|---|---|---|
| [upgrades.txt](../../research_102/raw/upgrades.txt) lines16–25 backpack | cost20/150/500/1000/2000/3000/5000/20000/75000/150000, capacities2/4/5/6/7/8/9/10/11/12, timers5/5/30/60/120/300/600/900/1200/1500 | capacity_upgrades, units.player.capacity | CONFIRMED; already matched; web initial cap1 adapted |
| upgrades.txt workers / hire-timers | base100, growth1.75, max10; first10 timers5/30/30/60/90/150/300/600/900/1800 | workers | CONFIRMED data |
| native [source-formulas-102.asm](../test-results/v04a/source-formulas-102.asm) GameConfig.WorkerCost0x244e8a8, powf0x4a740f0 | float32 base×powf(growth,count); bands25 for raw<500,50<2000,100<10000,1000 otherwise; floor(float32(raw/step+.5))×step | economy.workerCost(reference) | CONFIRMED; old1.0.1 RoundEven is not1.0.2 formula. JS pow rounded to float32 approximates native powf; verified configured10 hires/boundaries, arbitrary fractional exponents not promised |
| upgrades.txt egg fire/soldier/gate | 300/30,12000/120,12000/900 | special.speedboat, special.combat, expansion.gate | CONFIRMED numbers / INFERRED setting correspondence |
| upgrades.txt storage/storage-up | 14000/120/cap100;20000+40wood/300/cap150 | salvage.storage/upgrade | CONFIRMED numbers; wood→metal INFERRED |
| upgrades.txt mole pickaxe | 5000/300 | salvage.cutter | CONFIRMED numbers; cutter mapping INFERRED |
| upgrades.txt carpenters | base7000/growth1.35/max6/timers120,300 (last repeats) | salvage.worker | CONFIRMED base/growth/max/120,300 timers; optional timers_s repeats last entry. Derived subsequent Math.round costs are web adaptation; native carpenter price rounding not separately verified |
| upgrades.txt hole | 51000+150wood/120 | expansion.den | CONFIRMED; wood→metal INFERRED; original raider behavior not copied |
| [worker_ai.md](../../research_worker_ai/worker_ai.md), SpeciesTable.Stats0x247529c / WorkerAnt.get_Stats0x2441fb8 | Worker80.75/cap3/Bite1/Chew1.95; Fire150/cap2/Bite1/Chew1 | units.worker/speedboat | CONFIRMED; web geometry, state timing, stop radii HYPOTHESIS |
| [WorkerSystem.asm](../../research_worker_ai/evidence/WorkerSystem.asm) HarvestBite0x2443b24, clamp0x2443bc0–0x2443be4/sub HP0x2443cb4–0x2443cc0 | Hp decremented by received chunk count; normal/fire Bite1 | resources.*.damage_per_catch1 | CONFIRMED normal/fire logic; INFERRED common player/salvage normalization; ChewBiteHit0.663 is animation phase, not amount of damage |
| Worker TickPick0x244204c / TryScavenge0x2443294 |65% highestvalue,35% randomeligible; nearby drops before stations | ai.choose_best_probability.65, world.worker_pickup_radius150 | CONFIRMED kernel; web navigation/reservations/salvage states HYPOTHESIS |

## Golden и drops

| Source | Original | Web | Status |
|---|---|---|---|
| EconomySystem.GoldenReward0x242b67c, [fresh disassembly](../test-results/v04a/source-formulas-102.asm), mul0x242b6bc / tie parity0x242b718–0x242b724 / max0x242b748–0x242b75c | max250, RoundEven(float32(EarnRate×180)) | monetization.golden_min_coins250, golden_estimate_seconds180; reference float32 outer product | CONFIRMED formula. Web estimatedEarnRate remains HYPOTHESIS: spatial routes/availability differ; not original measured throughput |
| [constants.json](../../research_102/constants.json) GameConstants.GoldenLife field22822 offset0x60f5ad |30 | golden_lifetime_s | CONFIRMED |
| constants GoldenCooldownCaught field22823 offset0x60f5b1 / GoldenCooldownMissed field22824 offset0x60f5b5 |150/250 | golden_cooldown_claimed_s/missed_s | CONFIRMED numbers, already matched |
| constants DropChunks field22785 offset0x60f52a; FoodSystem.Explode0x2433ce0 |15 | resources.*.drop_crates | CONFIRMED count, web drop geometry/actor eligibility adapted |
| constants DropLife field22786 offset0x60f52b |60 | world.floating_crate_lifetime_s | CONFIRMED value, already matched; web expiry semantics HYPOTHESIS correspondence |
| constants GoldenCoinCount field22828 offset0x60f5c3 |15 | presentation.golden_pile_count remains10 | CONFIRMED original15; HYPOTHESIS retained web10 to preserve save/UI transaction contract, economy amount matches outer formula |

## Явные адаптации HYPOTHESIS

- Все34 coin-only quest rewards и часть условий (оригинал45 целей, многие15g). Никакой конвертации15g в coins не придумано; сохранена наша цепочка. Источник оригинала [balance.txt](../../research_102/raw/balance.txt), IsGemReward в [ObjectiveDef.asm](../../research_102/native/ObjectiveDef.asm).
- Map3300×2400, port/storage/gate/resource coordinates, visibility graph, purchase/deposit radii, player speed165/HP80/combatdamage8, gather1.5/unload.09, salvage95/cap5/gather1.8. Не оригинальные world parameters.
- Route60000+80metal/600 внутри зоны2. Original Terrace250000+200wood/1800 является зоной3; не перенесена из-за scope. Nest211000+120wood/900 тоже не является нашим route, нового delivery nest нет.
- FreeSkip60, firstGolden150, fake_ad2, integer pour1–3с, category exit/cooldown, coins physical attraction и capped world crates150 — текущие web rules; точное соответствие оригинальным branches здесь не доказано.
- В REFERENCE добавлен optional salvage.worker.timers_s=[120,300], последний повторяется; FAST оставляет scalar30. Уже созданный salvage order сохраняет старый duration. Число34 целей не расширено под45.

## Откуда взяты файлы

research_102/raw/*.txt — TextAssets resources.assets из split_UnityDataAssetPack.apk datapack.unity3d. research_102/il2cpp_map.json и распакованный libil2cpp.so — metadata39/ARM64 текущей1.0.2. scripts/source-evidence-v04a.py читает эти inputs и пишет только fishing-game/test-results/v04a/source-formulas-102.asm, не запускает APK и не обращается к серверам. Статус оригинальных 1.0.1 заметок отдельно указан там, где код изменился.
