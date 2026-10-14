# ART validation v0.5a

Дата: 2026-10-13. Локальный текущий v0.4b → v0.5a. Browser contexts изолированы; реальные пользовательские saves не очищались. Публикация не выполнялась.

## Baseline и результат

До изменений создан полный backup проекта без node_modules, прежних test-results и ZIP: `../../backups/fishing-v04b-before-v05a-20261013/`. Baseline build PASS; baseline tests PASS 161/161, 15 файлов. SHA256 исходных src/public записаны в `test-results/v05a/baseline-hashes.json`.

| Проверка | Результат | Доказательство |
|---|---|---|
| Финальный npm run build | PASS, TypeScript + Vite | test-results/v05a/build.log |
| npm test | PASS 167/167, 16 файлов | test-results/v05a/tests.log |
| Новые визуальные projection tests | 6 PASS | tests/art-v05a.test.ts |
| Прежний gameplay browser smoke | PASS, 15 групп, errors=[] | test-results/v05a/regression.log |
| Native input / touch / guidance | PASS, 10 групп, WebGL type=2 | test-results/v05a/ux-smoke.json, ux.log |
| Art browser, FAST и REFERENCE | PASS, WebGL type=2, errors=[] | test-results/v05a/browser/smoke.json, art-browser.log |
| Gameplay/config и исходный арт | SHA256 PASS | test-results/v05a/protected.json |
| Файловый diff | подготовлен; Git repository отсутствует | test-results/v05a/source.diff, changes.json |

Предупреждение о большом Phaser vendor chunk прежнее. Новых JS dependencies нет. Package metadata сохранены от v0.4b; имя визуальной итерации — v0.5a.

Art suite проверена на production `dist/` через Vite preview, с фактической загрузкой runtime PNG. Старые gameplay/UX suites проверены на локальном Vite dev с теми же источниками/ассетами. Unit tests включают все прежние 161 проверки экономики, всех 34 quests, worker AI, collision/navigation/traffic и save migration.

## Browser A–O

| Пункт | Проверка и границы доказательства |
|---|---|
| A Вода | один stationary approved image покрывает исходную карту; desktop/mobile screenshots просмотрены, швов/квадратного повторения нет; shader не добавлен |
| B Player | реальный WASD во всех 8 направлениях; правильный frame и rotation=0; wrap/sector boundaries unit test |
| C Worker | прежний browser smoke проходит gather/delivery; новые worker views в live fleet; data/system файлы неизменны |
| D Speed | 8-way gallery сверяет frames; live fleet использует новый спортивный PNG |
| E Golden | реальное движение, 8 frames, hull tap → прежний popup; cancel/confirm; 10 отдельных physical payouts |
| F 5 ресурсов | все PNG loaded; FULL/MEDIUM/LOW/LAST проверены в настоящем renderer для обоих профилей |
| G Истощение | actual harvest → hp=0/restock → sprite hidden; actual timer recovery → FULL; unit tests прослеживают весь stock без сброса stage при regrow |
| H Ящики в воде | actual harvest создаёт отдельные FloatingCrate IDs и sprites; физическое приближение увеличивает cargo, рендер не выдаёт ресурс |
| I Cargo | реальный полный capacity=12 в обоих профилях, 5 видов ящиков; per-ID sprites и 8-way deck gallery; bounded stack unit test |
| J Unload | исходный deposit удаляет 3 отдельных cargo, создаёт 3 payout IDs; прежний smoke проверяет реальные движения/delivery tweens |
| K Монеты | payout images/labels соответствуют IDs; wallet неизменен при draw; physical collect и reload проходят в прежнем browser smoke |
| L Порт | production navigate до port/cargo/worker/speed points завершён в обоих профилях; native purchase/SKIP interactions проходят; декоративные старые dock polygons отключены |
| M Управление | native mouse, keyboard, CDP touch, floating joystick, UI/Phaser exclusion, capture/release, full camera guidance cycles; детерминированные blur/hidden/cancel события |
| N Навигация/AI | защищённые systems/config SHA256 неизменны; прежние traffic tests, collision/reachability и renderer route checks PASS |
| O Save/profile | прежний browser smoke: reload pending money/cargo/purchases, isolated FAST/REFERENCE, manual claim/reset; save schema v3 неизменна |

Галереи направлений и resource-stage coverage используют явно подготовленные тестовые states. Они не доказывают человеческое прохождение или баланс времени. Native gameplay, input и rewards дополнительно проверены отдельными suites. Mobile — 390×844 portrait с touch emulation, не физический Android/iOS.

## Производительность

Runtime art — 19 shared PNG, 3 266 583 bytes; приблизительно 11 MiB RGBA decoded pixel data. Огромные исходные sheets/sources/previews не загружаются. Boat/cargo/crate views сохраняются по IDs; coins используют pool и прежний viewport/max_coin_views. 4 common placeholder cargo textures и 3 placeholder hull textures создаются один раз. Renderer не генерирует canvas textures для нового арта каждый кадр. Phaser Text по-прежнему имеет canvas textures для прежних labels; общий texture count в стресс-сценарии включает их.

Stress: 10 workers + speedboat + supporting salvage, 150 floating crates и первоначально 240 отдельных payouts, реальный Engine включён, 3-second RAF sample. На конце sample остаётся 222 payout (18 были физически собраны), 150 crates, 15 FAST / 18 REFERENCE boats, около 355–358 image objects. Для stationary state дополнительно подтверждена стабильность object/texture counts через 600 ms: per-frame creation отсутствует.

| Последний production-run | Средний RAF FPS | p95 frame time |
|---|---|---|
| FAST | 145.5 | 12.1 ms |
| REFERENCE | 132.7 | 12.2 ms |

Полные значения в `browser/smoke.json`; числа зависят от desktop нагрузки и headless Edge scheduling, не являются Android/iOS FPS. Более ранний одновременный запуск build/browser suites давал 86.6–129.8 FPS, поэтому фиксированная гарантия FPS не заявляется.

## Скриншоты и визуальный просмотр

30 PNG в `test-results/v05a/browser/`. Индекс для просмотра: `test-results/v05a/screenshots.html`.

- `{fast,reference}-main-bay.png` — основная бухта, порт и исходные функциональные точки.
- `*-full-cargo.png`, `*-cargo-detail.png` — полный трюм, обычный и увеличенный масштаб.
- `*-directions-cargo.png` — player/worker/speed, 8 ракурсов и deck attachments.
- `*-port-workers.png` — несколько рабочих у порта.
- `*-resources-{full,medium,low,last}.png` — общий вид стадий.
- `*-floating-crates.png`, `*-payouts.png` — физические ящики/выплаты.
- `*-golden.png`, `*-golden-piles.png` — катер и 10 кучек.
- `*-stress.png` — много crates/coins/fleet.
- `mobile-port.png`, `mobile-game.png` — portrait.

Просмотрены главная бухта, direction gallery, FULL/LOW, cargo closeup, payouts/Golden piles, fleet, mobile. Исходный approved water и matched_edges просмотрены отдельно: выбран original без повторения; matched_edges содержит заметные внутренние линии. На normal zoom рыба/виды груза/монеты различимы. Сокращённая по вертикали иллюстрация порта уменьшает наложение корпусов на верхние постройки на старом разрешённом маршруте.

## Остаточные визуальные ограничения и ручная проверка

1. Единая harbor illustration не совпадает с cardinal dock layout: mooring guides и circles соединяют смысл с прежними точками; покупки не передвинуты. Проверить субъективную понятность каждого причала и движение по кромке старой collision ellipse. Цель — сохранить gameplay, точная подгонка отдельных фасадов потребует отдельной художественной итерации.
2. Плотный флот может перекрывать labels/части корпусов; старые traffic radii не увеличены ради арта. Cargo при 12 units компактно перекрывается по вертикали, верхние crates видны лучше нижних. Полностью разделять все 12 boxes на обычном масштабе не планировалось; каждый объект и его тип сохранены.
3. На portrait камера следует игроку: часть острова и далёких purchase labels выходит за границы viewport. HUD/modal находятся выше world и остаются кликабельны. Проверить удобство на физическом телефоне и плавность при долгой игре.
4. Original pack имеет мелкие цветные alpha halos; агрессивная очистка не применялась. Debug zoom×2 показывает предел уменьшенных изображений; штатный zoom=1 проверен.
5. Guard/pirate/salvage, остальные islands, zone-2 resources/buildings/cargo остаются placeholders по scope. Сложные sway/lean/bounce/waves/unload FX не добавлены.

Для человека: сделать короткую desktop и portrait сессию, оценить естественность масштаба/направлений, палубу при всех поворотах, визуальный подход ко всем четырём сервисам, readability resource LAST и субъективную яркость воды. Фактический мобильный FPS и native OS gestures остаются непроверенными.
