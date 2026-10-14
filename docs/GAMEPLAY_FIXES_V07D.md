# GAMEPLAY FIXES — v0.7d

2026-10-13. Семь задач Zone 2 выполнены. Экономические числа v0.7c сохранены; REFERENCE JSON байт-в-байт прежний. Полный FAST-прогноз после финального размещения: **33:35–34:16**, Zone 2 **22:28–23:09**. Это модельная экстраполяция, не человеческий плейтест.

## Результаты

| Задача | Реализация | Проверка |
|---|---|---|
| 1. Salvager у острова | purchase point (2690,1510)→(2300,1640), на воде с южной стороны scrap island; зона/label/оплата используют те же данные. | Вход/выход по маршрутам, partial payment, reload, SKIP, station exit guard. |
| 2. Максимум 2 пиратов | FAST max_enemies=2; живые hp>0. При лимите bar=0, отсчёт не копится. Освободился слот →новые 18 s от текущего tick; не while/queue. | Реальный projectile kill, cap, большой dt, dead entity, reload, closed den. |
| 3. Entrance dock | existing building-zone2_purchase с голубым флагом (1874,1155)→(1640,1100), к стороне Zone 1. Functional gate circle (1750,1280), цена1400 и timer30 s сохранены. | Вода/clear routes, screenshot, первые15 quests exact. |
| 4. Wreck lifecycle | Переиспользован существующий ready→regrow→restock→ready. Frames отражают остаток общего stock+HP. Added stock12/12 label, restoration countdown; body исчезает при unavailable и возвращается с полным stock. | Полное естественное depletion всех60 активных catches, 4 frames, timer90 s, automatic restore без повторной покупки, worker target resumed. |
| 5. Full metal storage | FAST выгружает всю metal cargo с прежней скоростью выгрузки; принимает только свободный объём; остальное списывает. | A–H ниже; Q24/Q26, analytics, реальная работа salvage. |
| 6. Storage upgrade у острова | (2600,1370)→(2400,1260), северная сторона scrap island. Label (2460,1170), distinct from Salvager (2230,1725). | Окружности/подписи не перекрывают друг друга; partial payment, metal price, reload, free SKIP. |
| 7. Normal fish unload в Zone 2 | FAST active fish dock (2630,1390), ближе к центру open sea. Отдельно от metal storage (2480,1500). Zone 1 port (1090,1350) сохраняется до открытия Zone 2. | Fish delivery, physical coin spawn, worker routes, HUD To port, camera hint, renderer circle/label, docking cache retarget. |

В реализации был только один общий fish port. Новая конфигурация zone2_layout задаёт его active position после открытия Zone 2; не создаётся новый тип валюты, покупки или worker AI. `fishUnload` — общий выбор координат для всех существующих систем доставки. Сохранённые старые coin stacks остаются на своих прежних физических координатах; новые выплаты появляются у нового порта.

При изменении active dock переоформляются сохранённые berth places и route caches, иначе старые рыбаки продолжали идти к прежнему причалу. Есть отдельная проверка реальной повторной доставки после перехода.

В старом FAST save с3 пиратами лишний третий снимается на первом combat tick без kill counter/reward; сохранённые2 остаются. Новый optional pirateSpawnBlocked сохраняется в version3 save, старые saves без него принимаются. REFERENCE спавн и full-storage behavior не менялись.

## Полный склад: точное правило

Каждая уникальная metal unit извлекается из cargo ровно один раз у metal storage dock. Если metal<cap, запас увеличивается на1. Иначе запас не увеличивается, metal_discarded +=1. Во всех случаях metal_deposited +=1 — это реальная доставка, включая списанное у причала. Coins не выдаются. Вне склада груз не списывается; без построенного storage доставка не принимается.

Скорость unloading сохраняется: deposit_s_per_crate=0.09 s. «Выгрузить весь груз» означает разгрузить его обычным процессом за несколько кадров, не мгновенно изменить inventory. Mixed cargo сохраняет fish до отдельной рыбной выгрузки.

Salvage при полном складе больше не стоит в WAIT из-за cap: выгружает, выбирает доступный wreck/crate и возвращается к обычному циклу. Каждый delivered crate имеет unique ID и после выгрузки удалён из cargo, поэтому повторный tick/reload не засчитывает его снова.

Q24 и Q26 сохраняют since_activation. Уже доставленное до активации не засчитывается. Груз, доставленный после активации, считается даже при full storage. Q30 cap150, Q31 metal50 и Q34 metal80 остаются прежними. Списание не создаёт свободного запаса для покупок: spendable metal никогда не превышает cap.

Краткое EN/RU feedback «Storage full / Склад заполнен» выводится отдельным существующим effect pool на1.2 s с throttling1.2 s, в стороне от nameplate лодки. HUD не переработан.

### Analytics — явно разрешённое исключение

Пользователь отдельно разрешил минимальную поправку наблюдателя: прежний delivery event без accepted_metal всё ещё означает1 принятую единицу; новый event содержит accepted_metal=0/1. All deliveries попадают в resources.units_delivered, но metal income учитывает только принятую часть. JSON schema/формат, UI recording controls, snapshots и все старые события совместимы.

99/100 +cargo6: stored income1, discarded5, delivered6, final storage100, metal reconciliation residual0. 100/100 +cargo6 после reload: stored income0, discarded6, delivered6, residual0. Исправление — одна строка observer; overflow нельзя считать income и затем маскировать фиктивным spending.

| Case | Результат |
|---|---|
| A. Player100/100 +full cargo | Cargo освобождён, storage100, overflow counted as delivered, coins0. |
| B. Salvage100/100 +full cargo | Cargo освобождён, worker выбирает wreck и продолжает рейсы. |
| C. Storage99/100 +cargo>1 | Принята1 unit, остальное discarded, все delivered unique. |
| D. Q24 activated at full cap |10 свежих доставок завершили goal; исходный lifetime baseline не засчитан. |
| E. Q26 activated at full cap |50 свежих доставок завершили goal. Browser: реальная работа salvage/ресурса300 simulated seconds, без добавления progress counters. |
| F. Full cap, then spend | Исходная metal-стоимость30 оплачена; новые deliveries заполняют освободившееся место. |
| G. Upgrade100→150 | Оригинальные price/build/SKIP; cap150; accepted amount ограничен150. |
| H. Reload full warehouse+cargo | Unique cargo сохранена, разгружена; повторного progress/income нет. |

## Life of Ants: что установлено

**VERIFIED CONFIG:** [raw/foods.txt:38](../../research_102/raw/foods.txt) Log: value0, hp600, stock3, regrow28 s, restock3000 s. В [new_mechanics.md:17](../../research_102/new_mechanics.md) это описано как возобновляемый источник. Подтверждённое пользователем восстановление без повторного unlock согласуется с этими данными. Runtime APK здесь не запускался.

**VERIFIED STATIC:** [CarpenterSystem.asm](../../research_102/native/CarpenterSystem.asm), get_CrateFull VA0x242b9c8: counter at state+0x1c сравнивается с Sim.get_WoodCap (call0x2394eb4). TickStore VA0x242bfd8 извлекает cargo и вызывает EconomySystem.DepositChunk VA0x242cfc0. Последний handler в имеющихся native dumps не разобран. [unresolved.md](../../research_102/unresolved.md) также оставляет поведение Carpenter неполным.

**NOT ESTABLISHED:** точный итог incoming wood при full storage в оригинале, правило player/worker overflow и выбрасывание излишка. Нельзя утверждать, что новый FAST fallback воспроизводит оригинал. Это правило из текущего задания, а не реконструированная оригинальная механика.

FAST wreck остаётся stock12, hp50, regrow3 s, restock90 s. Длинные3000 s не копировались. Numeric throughput parameters и source lifecycle code не менялись; меняется только возможность завершить доставку при cap и ясность отображения. При полном складе workers теперь могут быстрее истощить доступный wreck, поскольку продолжают работать — это ожидаемое следствие overflow rule.

## Скриншоты

Снимки созданы в отдельном browser context с техническими setup-состояниями. Большой wallet/разблокированный контент на снимках не являются evidence человеческой экономики. Аннотированные исходные изображения в доступном приложении отсутствовали: найден только текст задания, поэтому точное совпадение с рисунками пользователя ещё нужно подтвердить.

![Zone 2 overview](../test-results/v07d/browser/zone2-overview.png)

![Scrap purchase zones](../test-results/v07d/browser/storage-purchase-zones.png)

![Full storage feedback and delivered quest progress](../test-results/v07d/browser/storage-overflow.png)

[Mobile viewport](../test-results/v07d/browser/zone2-mobile.png) · [Progressive wreck](../test-results/v07d/browser/wreck-depleted.png) · [Restoration timer](../test-results/v07d/browser/wreck-restoring.png) · [Restored wreck](../test-results/v07d/browser/wreck-restored.png)

Desktop/mobile screenshots просмотрены. Обнаруженные перекрытия устранены: рыбная выгрузка отделена от purchase label upgrade; Storage full feedback вынесен из nameplate YOUR BOAT. Окружности и главные подписи различимы. На маленьком viewport quest/HUD могут частично прикрывать удалённые объекты карты; UI design этим заданием не менялся.

## Pacing: честное сравнение с v0.7c

Источник — [pacing.json](../test-results/v07d/pacing.json). Ровно тот же Engine/input-driver, seeds41/97/211, no Golden, no debug grants, available free skips. До правок bundled Engine сохранён отдельно; before-results повторно используются только для неизменного baseline.

Calibration из реального705-event JSON v0.7c: k=0.957458, anchor Q16=667.4 active seconds. Full projection=anchor+k×(Engine end34−Engine end15). Это наследованная calibration, а не новое измерение человека. Транспортные изменения делают её менее точной для отдельных квестов.

| Seed | Before raw full | After raw full | Before projected full | After projected full | Projected Zone 2 | Delta projected s |
|---|---|---|---|---|---|---|
| 41 | 32:52 | 32:30 | 33:57 | 33:35 | 22:28 | -21.3 |
| 97 | 33:15 | 33:17 | 34:14 | 34:16 | 23:09 | 2.5 |
| 211 | 32:44 | 32:46 | 33:46 | 33:48 | 22:41 | 2.3 |

Full target30–35 min сохраняется в этих моделях. Первые15 complete rows совпали exact для всех3 seeds. Но суммарное совпадение не означает прежнее распределение по quests:

| Q | Before calibrated duration mean s | After calibrated duration mean s |
|---|---:|---:|
| 16 | 117.7 | 174.6 |
| 17 | 10.3 | 10.2 |
| 18 | 104.6 | 229 |
| 24 | 51.4 | 22.9 |
| 26 | 88.6 | 56.1 |
| 27 | 70.2 | 129.5 |
| 30 | 73.9 | 41.9 |
| 32 | 102.8 | 72.9 |
| 34 | 92.6 | 48.1 |

**Риск для следующего плейтеста:** до lobster рыба в основном приходит из Zone1, а новый общий port дальше от этих мест. Q16 и особенно Q18 стали длиннее; далее новые морские ресурсы ближе к port, metal trips короче, поэтому финал ускоряется. Q18 даёт199–272 s raw Engine, это существенное изменение от v0.7c. Таймеры/награды/цены не подгонялись, чтобы скрыть этот эффект.

Не утверждаем, что новый human run точно останется33–34 min или что early Zone2 tempo уже принят. Отдельно проверить Q16/Q18, продажи до/после lobster, накопление pending, загруженность salvage и работу wreck после overflow. При необходимости следующая итерация может изменить routing/layout по реальному плейтесту; economy v0.7c в этой задаче не трогалась.

## Защита и validation

REFERENCE SHA-256 before=after: `3312de6265923cb3bef87f6a0359cb898dbaf3e003df4d63957f3acb97f1553b`. FAST JSON exact после исключения3 одобренных layout/gameplay изменений: max_enemies, две purchase-point пары и новый zone2_layout. Все prices, rewards, resource values/supply/timers, construction timers, metal costs/caps, early tiers, quest conditions/order/IDs, units speeds/damage и monetization совпадают.

Engine loop, resources lifecycle, movement/physics, resource frame selection и HUD CSS байт-в-байт прежние. Все старые EN/RU строки сохранены; добавлены только storageFull/restoring. [Полный scope/hash audit](../test-results/v07d/scope.json).

| Проверка | Результат | Evidence |
|---|---|---|
| TypeScript +Vite | PASS; прежний chunk warning | test-results/v07d/build.log |
| Full Vitest | PASS247/247,24 suites | test-results/v07d/tests.log |
| New regressions A–H,spawn,lifecycle,routing,payment,scope,analytics | PASS18 focused tests | tests/gameplay-v07d.test.ts |
| Normal no-grant full34 before/after ×3 | PASS6/6; debug_income0 | pacing.json |
| Zone1 exact replay | PASS3/3 | scope.json,pacing.json |
| Browser targeted Zone2 | PASS4 groups,consoleErrors=[] | browser/report.json |
| Standard browser smoke | PASS15 groups,consoleErrors=[] | smoke/report.json,smoke.log |
| Save/profile/old events | PASS old suites and new load/overflow/pirate-flag tests | tests.log |
| Real human34 pacing/native mobile | НЕ ПРОВЕРЕНО | следующий живой плейтест |

Legacy assertions обновлены только для разрешённых изменений: cap2 вместо3, новые coordinates/fallback, fresh spawn countdown и unloading overflow. Старый90-second SHA snapshot всё ещё pinned для REFERENCE; FAST теперь проверяет неизменные engine/resources/movement source boundaries и новую cap/storage семантику. Новые unit/browser проверки не являются funded pacing evidence.

## Changed files

- src/analytics/playtest.ts
- src/config/load.ts
- src/config/types.ts
- src/game/art/sceneAssembly.ts
- src/game/art/VisualEffects.ts
- src/game/scenes/BayScene.ts
- src/game/state.ts
- src/game/systems/combat.ts
- src/game/systems/construction.ts
- src/game/systems/economy.ts
- src/game/systems/guidance.ts
- src/game/systems/save.ts
- src/game/systems/traffic.ts
- src/game/systems/workers.ts
- src/ui/locales/catalog.ts
- src/ui/UI.ts
- public/balance/balance_fast.json
- tests/animation-v05c.test.ts
- tests/balance-v04a.test.ts
- tests/balance-v07c.test.ts
- tests/corrections-v031.test.ts
- tests/presentation-v02.test.ts
- tests/quests-ui-v03.test.ts
- tests/systems.test.ts
- tests/traffic-v04b.test.ts
- scripts/balance-model-v04a.ts

New files: delivery helper, focused test/helper, three v07d scripts, этот report, snapshots/logs/screenshots в отдельном test-results/v07d. Existing v0.7c report/JSON playtest и research artifacts не изменялись. Git commit/push/publish не выполнялись.

## Следующий ручной плейтест

- Подтвердить расположение относительно исходных аннотаций: входной dock, salvage, upgrade, отдельные fish/metal deliveries.
- Проверить естественное прохождение Q16/Q18: модель показывает длинный ранний доход, несмотря на общий target30–35 min.
- Заполнить storage100, привести полный cargo игрока/worker, убедиться в понятной надписи и возможности продолжать движение; Q24/Q26 должны получать новый delivered progress.
- Проверить restore wreck и сброс bar пиратов при реальном бою, не только fixtures.
- Проверить touch/navigation на реальном устройстве; headless mobile viewport не доказывает real-device управление.

Reproduce from fishing-game/: `npm test`, `npm run build`, `node scripts/balance-v07d.mjs`, `node scripts/browser-v07d.mjs` при Vite на5175. Generated before bundle сохранён в .local/v07d/before-model.mjs. Technical test contexts не используют реальные пользовательские saves.
