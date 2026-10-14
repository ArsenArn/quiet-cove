# Validation v0.4b

Дата: 2026-10-13. Всё выполнено локально внутри fishing-game/. Build не публиковался. Browser contexts новые и изолированные: пользовательские saves не очищались и не подменялись.

## Baseline и проверки

До source edits: npm run build PASS; npm test PASS 141/141, 14 файлов. Полный backup изменяемых исходников/configs/docs/tests/scripts/package сохранён в .local/v04b-backup/. Git repository отсутствует; эквивалентный файловый diff — .local/v04b-source.diff, manifest — .local/v04b-changes.json.

| Проверка | Результат | Доказательство |
|---|---|---|
| npm run build | PASS, TypeScript + Vite | test-results/v04b/build.log |
| npm test | PASS 161/161, 15 файлов | test-results/v04b/tests.log |
| Новые traffic tests | 20 PASS | tests/traffic-v04b.test.ts |
| npm run test:traffic | 12 × 600s paired fixtures PASS | test-results/v04b/fleet-stress.json, stress.log |
| npm run test:traffic-browser | PASS, оба профиля + mobile viewport, Phaser WebGL type=2 | test-results/v04b/browser/smoke.json, browser.log |
| npm run test:traffic-ux | PASS, 10 native input/guidance групп | test-results/v04b/ux-smoke.json, ux.log |
| npm run test:smoke | PASS, 15 regression групп | test-results/v04b/regression.log |
| Protected source/config | 18/18 SHA256 неизменны; оба JSON без traffic точно равны baseline | test-results/v04b/protected.json |

Предупреждение о крупном Phaser vendor chunk прежнее. Новых зависимостей нет. package version=0.4.0-beta.1, пользовательское имя итерации v0.4b.

## Unit/integration coverage

Новые tests проверяют head-on pass и сохранение цели; idle pinned player и постепенное расхождение 10 совпадающих workers с correction ≤1.2px/step; отсутствие дальнейшего jitter; обход рабочего игроком, свободную diagonal speed и stop/release; land/gate constraints; strict config validation и неизменность всей прочей экономики; static reachability всех ресурсов/портов/purchase points; 5/10/max fleet delivery, mono-resource crowded save, per-boat delivery и оба сервиса; patrol/chase/attack с pirates/defender; cargo/reservation reload и отсутствие runtime fields в save; детерминизм; simultaneous harvest/unload; общий travel budget; раздельный возврат трёх pirates; blocked held-input purchase guard; partial analog speed prediction; variable 120/30/60Hz step pass.

Существующие regression 141 tests включают physical coins, resource portion/restock/drop/cap/expiry, exclusive crates/resume, partial/building orders, stationary/pour/exit/cooldown purchases, Golden transaction/physical collection, quest claims/rewards, save migration/profile isolation/offline, combat, всех 34 funded FAST/REFERENCE quests, unfunded early Reference/Golden, и трёх FAST seeds. Старые FAST guards ≤600s для первых 15 и ≤120s gate→defender не ослаблялись и проходят.

## Browser smoke и визуальная QA

Используется installed Edge/Playwright и настоящий production Phaser WebGL renderer, не headless Engine или mock canvas. Traffic проверяет 1 player, 5 workers, 10 workers, maximum fishing/salvage fleet и fleet+3 pirates; для каждого есть тот же renderer с traffic off и on. Debug panel закрыт при FPS/screenshot. Production save/load восстанавливает тесный флот, сохраняет version=3, count и pinned player и даёт разные позиции после 3s; дополнительно отрисована работа у общего ресурса после 30 игровых секунд. Desktop, close-save, mono-resource и 390×844 portrait screenshots просмотрены визуально. Отмечены оставшиеся bow/stern/label overlaps при круговой модели.

Native UX использует реальный mouse, keyboard, PointerEvent и CDP touch: floating origin/deadzone/diagonal/thumb clamp/capture/release, no water waypoint, blur/cancel/lostcapture/modal/hidden recovery, DOM/Phaser interactive exclusion, Golden hull and drag, SKIP/purchase route, полные guidance cycles при всех inputs, A–D quest readiness/reload/manual claim, multitouch и native touchcancel. Blur/hidden части синтетические события в headless; OS gestures не проверены.

Regression renderer smoke: catch/unload/cash animation/events, pending claim/reload, partial payments и construction/Skip, worker physical cash, path around land/water docks, visibility pause/resume, regrow/restock, HUD/individual rings, combat/patrol/spawner, crate preemption, Golden movement/tap/cancel/reward once, mobile floating joystick, profile isolation/reset. Console/page errors = [] во всех завершённых browser suites.

Screenshots: [FAST close-save](../test-results/v04b/browser/fast-fleet.png), [REFERENCE close-save](../test-results/v04b/browser/reference-fleet.png), [FAST mono-source](../test-results/v04b/browser/fast-resource-traffic.png), [REFERENCE mono-source](../test-results/v04b/browser/reference-resource-traffic.png), [portrait](../test-results/v04b/browser/mobile-fleet.png). Старые v0.3.2/v0.4a screenshots и scripts сохранены; UX wrapper перенаправляет новые артефакты в v04b.

## Fleet stress и FPS

12 paired Engine fixtures, каждый 600 игровых секунд: FAST/REFERENCE × 1,5,10,max,mono-source+stacked,full fleet+3 pirates. Исходный v0.4a bundle строится из backup; snapshots/seed совпадают. Максимум: 15 friendly FAST /18 REFERENCE, с defender+pirates до19/22 hulls. Все корпуса оставались на законной воде/в bounds; конечных moving stuck >5s нет. Deliveries по каждой boat, выдача/сбор income, metal deliveries, queue boat-seconds, longest near-service interval, transient blocked seconds и CPU находятся в fleet-stress.json. Warehouse test-only sink одинаково убирает80 metal при ≥80 и исключает законное удержание cargo в полном складе из navigation замера.

Near-service metric содержит approach/unload/yield внутри150px, а не только стояние. Он достигает12.3s в artificial max fixtures. Queue waiting и transient blocks не равны permanent jam; число конечных stuck=0 не скрывает эти ожидания. Таблица before/after и численные income deltas в [NAVIGATION_V04B](NAVIGATION_V04B.md). 5 workers имеют тот же income; max issued income около−3.2% FAST/−2.0% REFERENCE. Mono-source/stacked −7.8%/−9.1% остаётся sensitivity case, требует длинного AFK/manual замера; цены/скорости для компенсации не менялись.

Max measured Engine CPU/step: 0.267ms на этой Windows машине (harness overhead отделён). Это CPU evidence, не обещание mobile FPS. RAF sample =3s после warm-up .5s; uncapped headless desktop refresh, одноимённый baseline здесь current renderer с traffic disabled, не старый dist. Короткая пара не доказывает причинную разницу FPS; public renderer/script неизменны.

| Профиль / сцена | Baseline FPS | Traffic FPS | p95 frame, ms |
|---|---:|---:|---:|
| fast / one boat | 164.3 | 164.0 | 6.2 |
| fast / 5 workers | 164.7 | 163.3 | 6.2 |
| fast / 10 workers | 162.0 | 158.0 | 6.3 |
| fast / max fleet | 163.3 | 163.3 | 6.2 |
| fast / fleet + pirates | 165.0 | 164.7 | 6.1 |
| reference / one boat | 157.0 | 164.7 | 6.1 |
| reference / 5 workers | 165.0 | 165.0 | 6.1 |
| reference / 10 workers | 165.0 | 157.6 | 6.2 |
| reference / max fleet | 158.0 | 165.0 | 6.1 |
| reference / fleet + pirates | 161.7 | 165.0 | 6.1 |

Mobile screenshot — viewport emulation, не physical Android/iOS benchmark. Длинная mobile сессия, thermal throttling, low-end GPU, page lifecycle/OS input требуют устройства.

## Оставшиеся ограничения и ручные сценарии

- Центральные collision circles отражают ширину корпуса. Носы/кормы/shadows/labels в плотном флоте могут накладываться; pixel-perfect hull collision не реализована. Golden non-solid. Проверить, приемлема ли форма столкновений визуально.
- Тесные старые saves расходятся постепенно; исходное пересечение не исчезает за один кадр. Старые combat respawn relocations сохранены; новая навигация не вводит обычную teleport recovery.
- Shared-source max fleet сохраняет отрицательный throughput delta. Проверить длинные циклы восстановления и настоящую плотность у порта/склада, а не только один600s sample. Exhaustive proof для произвольных edited saves/configs не заявлен.

Вручную:

1. Desktop: удерживать WASD/joystick в рабочую лодку, объезжать, отпускать; Alt-Tab и mouse release вне окна; остановиться в каждой buy zone. Проверить отсутствие оплаты во время заблокированного input, обычную .25s оплату после release и exit/re-entry cooldown.
2. 5/10/max workers: совместная добыча одного ресурса, loose boxes/reservations, встречные рейсы, одновременно port unload; потом6 REFERENCE salvage у склада. Full warehouse сохраняет cargo, расход metal возобновляет доставку. Замерить доход за несколько полных restock циклов.
3. Max fleet + pirates: patrol/chase/attack, home returns, repair; fishing workers immune, берег/closed gate и все docks/покупки доступны.
4. Копия старого save с overlap, partial/building order, pending money и reserved crates: reload без reset/потери, затем safe separation/delivery; Golden/claims не удваиваются.
5. Android Chrome/iOS Safari: 360°/диагонали, слабый joystick, release/cancel, второй палец, portrait/landscape, OS background/gestures и FPS длительного максимального флота. Затем естественные FAST/REFERENCE full34.

## Воспроизведение

npm run build; npm test; npm run test:traffic. Сервер: node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4188 --strictPort. В другом PowerShell:

    $env:SMOKE_URL='http://127.0.0.1:4188'
    npm run test:traffic-browser
    npm run test:traffic-ux
    $env:SMOKE_OUTPUT='test-results/v04b/regression'
    npm run test:smoke

Можно задать BROWSER_CHANNEL. Backup и .local/v04b-baseline нужны только paired baseline stress; обычные npm tests используют tracked fixture tests/fixtures/balance-v04a-baseline.json. Никакие commits/push/merge/reset не выполнялись, fishing-game.zip и исходные APK/research/art packs не менялись.
