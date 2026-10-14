# Gameplay Visual Integration v0.5b — Pass 2

Дата: 2026-10-13. Основа — текущая v0.5a / gameplay v0.4b. Backup: `../../backups/fishing-v05a-before-v05b-pass2-20261013/`. Исходный утверждённый арт-пак не изменяется. Старые отчёты v0.5a сохранены как история итерации.

## Изменения

| Часть | Pass 2 |
|---|---|
| Лодки | Все 7 approved types, 8 frames; alpha-area normalization вместо maximum-edge normalization |
| Golden / salvage / guard | исправлен фактический compass order исходных frames |
| Ящики | палуба 20→28, вода 28→40, unloading 24→34 world px; прежние IDs/data/stack growth |
| Вода | настоящий TileSprite с неподвижным UV origin, повторение через всю карту |
| Главный порт | 310×220→352×250, примерно +14% по каждой стороне, origin=.5, (880,1348) |
| Зона 1 | 3 бывших placeholder islands заменены cliff/beach assets с пальмами/камнями; 5 лёгких акцентов у ресурсов |
| Зона 2 | pirate lair, defender dock, gate chart post, scrap storage, rocky islands, 4 resource PNGs и metal cargo |
| Подписи | name ресурса переносится наверх при проходе лодки снизу; удалена дублирующая подпись main hub, разгрузка отнесена ниже boat name |

## Boats и ориентация

Runtime: `public/assets/boats/boat_{player,worker,speed,guard,pirate,golden,salvage}_8dir.png`, sheets 768×384, cell 192×192, output order N/NE/E/SE/S/SW/W/NW. PNG origin=.5, exactly boat.x/y, rotation=0. Gameplay radii и state.angle не меняются.

| Gameplay type | Source type | Display cell size |
|---|---|---|
| player | player | 104 |
| worker | worker | 98 |
| speedboat | speed | 106 |
| defender | guard | 108 |
| pirate | pirate | 104 |
| golden | golden | 108 |
| salvage | salvage | 108 |

Исходный atlas order по именам manifest не является верным для всех типов. Визуально проверены нос/корма/anchor и cabin windscreen. Golden и salvage используют исходные индексы **0,7,6,5,4,3,2,1** для output N…NW. Guard использует **0,7,2,3,4,5,6,1** (исправлены NE/NW). Player/worker/speed/pirate используют 0…7.

Размер каждого направления нормализован по сумме alpha/255, с общим safety scale на тип и padding ≥8 px. Это компенсирует меньшую apparent area боковых ракурсов, не растягивая отдельную ось изображения. Реально измеренный max/min opaque-area ratio — 1.006…1.014; защитный assert ≤1.025. Bounding-box ширина/высота различаются естественно между проекциями. Все bbox centres центрированы в cell.

Golden facing в renderer выводится из фактического frame-to-frame displacement. При отсутствии движения сохраняется предыдущее направление; новый offer сбрасывает history. State.angle/path/lifetime/reward не изменяются. В paused art fixtures используется заданный angle для проверки каждого ракурса. History хранится только в Scene и не сериализуется.

## Cargo

Все 9 crate PNG взяты из текущей локальной `cargo/sprites/`, crop/resize до 128×128 с сохранением одинаковой геометрии. `wreck` использует `crate_scrap.png`; остальные runtime имена соответствуют resourceArt. По-прежнему два столбца по Cargo.id, 16 px между центрами; vertical rise ≤18 px. Deck anchors поправлены для увеличенных картинок и боковых направлений, специализированная speed deck имеет свои anchors. Cargo types/values/capacity/collection/unload порядок остаются исходными.

Доставленный crate использует тот же type PNG. Нижние слои полного 12-unit трюма частично перекрываются — stack compression сохранён. Верхние icons и каждый floating crate различимы при обычном zoom=1. Сложные sway/bounce/lean не добавлены.

## Tiled water

`water_tile_matched_edges.png` был проверен в реальном renderer: исходный файл содержит baked straight grid lines, хорошо заметные при повторении. Поэтому выбран approved `water_approved_original.png` с техническим **mirror repeat**. Runtime `water/water_approved_mirrored_tile.png` — 2048×2048: original resized to 1024×1024, четыре отражённых копии 2×2. Новая вода не рисовалась; исходный pack не изменялся. Opposite edges и внутренние mirror joins pixel-identical.

Phaser `TileSprite(0,0,3300,2400)`, origin=(0,0), tileScale=.65, tint=0x91c4ce, alpha=.72. Repeat period=1331.2 world px; камеры не сдвигают UV. Текстура не растягивается на всю карту и не меняет карту/коллизии. Зона 2 получает прежний принцип фонового tint overlay, с менее насыщенным синим оттенком.

## Scene assembly и mapping

`src/game/art/sceneAssembly.ts` создаёт статичные изображения; `registry.ts` загружает только используемые runtime textures. Всего 52 shared PNG, 11 461 788 bytes, около 39.2 MiB RGBA pixels без учёта Phaser repeat buffer/Text canvases. Новых JS dependencies нет.

| Объект | Pack source | Визуальное размещение |
|---|---|---|
| Main hub | buildings/harbor_main.png | (880,1348), 352×250 |
| Pirate base | buildings/pirate_lair.png | spawner+(0,-26), 194×194, rocky base env_15 |
| Guard station | buildings/defender_dock.png | (2305,1320), 150×164, рядом со старым dock |
| Metal island | buildings/scrap_storage.png | existing island[4]+(0,-24), 244×214, cliff base env_39 |
| Gate chart post | buildings/zone2_purchase.png | gate purchase+(74,-50), 106×125, оставляет круг свободным |
| Shipwreck | resources/atlases/shipwreck_4states.png | actual wreck.x/y, 196×196 |
| Другие zone-2 ресурсы | lobster/swordfish/squid_4states.png | actual resource.x/y, 160×160 |
| Resource cargo | cargo/sprites/crate_{type}.png | прежние resource IDs; wreck→scrap |
| Острова/декор | environment/props/env_{03,06,07,09,12,14,15,17,18,30,33,36,37,38,39,49,51,55}.png | точные placements в sceneAssembly |

Все старые land obstacle centres/radii сохранены. Main hub и metal island сохраняют функциональные mooring/interaction markers. Старые procedural острова, hulls и zone-2 постройки убраны из renderer; новые decorations не добавляют input handlers/colliders. Shipwreck и все девять resources используют прежнюю stock+portion_hp projection стадий. Scene assembly не меняет Engine/config/state или construction.

Поддерживающие props разнесены с resource/purchase circles на `interaction radius + half maximum sprite dimension` минимум; проверено unit test для обоих профилей. Seaweed/небольшие reef rocks имеют alpha .48–.85, чтобы отличаться от collectible crates. Нет runtime генерации art canvas textures каждый кадр.

Порядок слоёв прежний: water=-20, coasts=0, supporting marine props=.4, resources=1, vegetation=1.2, loot=2, buildings=3, boats=4, cargo=5, markers/labels=7, effects=8–9, DOM HUD/modals сверху. Zone-2 imagery показывается при area=2; закрытое pirate lair остаётся approved PNG с мягким tint и прежним closed label.

## Проверки

| Проверка | Результат / артефакт |
|---|---|
| Build | PASS, `test-results/v05b/build.log` |
| Unit/integration | 170/170 PASS, 17 files, `tests.log` |
| Gameplay browser smoke | 15 групп PASS, `regression.log`; v05b wrapper исправляет только overlapping patrol fixture |
| Native input / CDP touch / guidance | 10 групп PASS, `ux-smoke.json`, `ux.log` |
| Production Phaser WebGL | оба профиля, 7 actual boats × 8 directions, `browser/smoke.json` |
| Live Golden motion | 363 движущихся кадров в каждом профиле, 0 sprite/displacement mismatches |
| Original services | port/cargo/worker/speed/defender/storage/cutter/salvage/den достижимы в обоих профилях |
| Water | TileSprite/scale/fixed origin проверены в 5 camera locations; edge pixels совпадают |
| Mobile | 390×844 touch emulation, bay/resources/pirate screenshots, no overflow |
| Baseline protection | 25 исходных source/config files и 52 используемых approved sources неизменны; `protected.json` |

Первый native UX запуск одновременно с тяжёлыми CPU tests не прошёл короткий wall-clock keyboard threshold; последовательный запуск проходит с исходными assertions. В историческом regression smoke обнаружен отдельный некорректный fixture: player=(2300,1190), defender spawn=(2290,1190), distance=10 px. Защитник сначала обходит player, поэтому его смещение за первую секунду может быть 66–79 px, хотя он движется. Это воспроизведено чистым Engine при 165/60Hz, без renderer (`patrol-fixture.json`). Диагностический production запуск измерил 149.6 px за 1.007 game seconds (`patrol-diagnostic.log`). `scripts/browser-regression-v05b.mjs` сохраняет исторический script и все его assertions, но переносит только player в тестовом patrol fixture на (2300,1100). Порог >80 px и проверки боя остаются прежними. Art suite также исправила Reference fixture: HP/stock выставлены по общему проценту, а не по FAST числу порций. Gameplay при этом не менялся.

В Free Skip test wrapper также гарантирует 15-second remaining window на speed=1 и ждёт 120 ms после смены viewport/state до вычисления screen hit. Исторический timer=7 s при speed=3 мог завершиться до обработки клика; наблюдался уже построенный третий worker вместо открытого popup. Это fixture deadline, аналогичный прежнему gate fixture, и сохраняет Free branch/все исходные assertions. Реальные timers обоих профилей не менялись.

Production maximum fleet sample: FAST 15 boats / REFERENCE 18 boats + defender/pirates, 3-second RAF, около 165 FPS, p95 ≈6.1 ms на текущем desktop Edge. Это не мобильный FPS и не гарантия для других машин. Renderer использует общие textures и существующий pooling.

Скриншоты: 39 PNG в `test-results/v05b/browser/`, индекс `test-results/v05b/screenshots.html`: 8 compass views для каждого профиля, bay/reef/south, dangerous sea/scrap island, readable cargo, live Golden, FULL/LAST salvage, maximum fleet, 3 mobile views. Галереи используют paused art fixtures; live gameplay и input проверены отдельными suites. Просмотрены N/E/W boats, bay/zone2, cargo и portrait.

## Self-check и ограничения

- [x] Все 7 boats используют approved directional sprites с одинаковой projected area, E/W больше не уменьшаются из-за нормализации по maximum bbox edge.
- [x] Golden/Salvage/Guard compass исправлен; Golden соответствует фактическому движению.
- [x] Ящики крупнее на палубе, в воде и при разгрузке; виды и data сохранены.
- [x] Вода повторяется TileSprite, не stretched image; прямой grid artifact исключён.
- [x] Главный остров увеличен; navigation geometry/purchase points сохранены.
- [x] Zone 1 умеренно оформлена; placeholder islands заменены approved scenery.
- [x] Zone 2 собрана: pirate/guard/gate/storage/shipwreck/resources и supporting props.
- [x] Resource/purchase circles не перекрываются supporting props; прежние hit tests и управление работают.
- [x] Build/tests/browser проходят, экономика/quests/combat/save не переписаны.

Для дальнейшего polish: отдельные foreground facade layers/Y-depth для крупных PNG, точная художественная привязка иллюстрированных dock boards к старой cardinal geometry, разнесение boat labels в плотном флоте, читаемость нижних слоёв очень полного трюма. Исходный AI art имеет небольшие outline/halo и различия деталей между ракурсами; исходники не перерисовывались. Mirror повтор может быть узнаваем при длительном обзоре открытой воды. Physical Android/iOS FPS, долгие сессии и native OS gestures требуют ручной проверки.

Актуальный builder — `scripts/prepare-art-v05b.py` (Pillow). Исторический v05a builder не следует запускать поверх текущих 192px sheets. Полный файловый diff и список: `test-results/v05b/source.diff`, `changes.json`; Git checkout отсутствует.
