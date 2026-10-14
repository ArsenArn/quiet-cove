# ART integration v0.5a

Дата: 2026-10-13. Основа — текущий локальный v0.4b, с traffic navigation. Backup до изменений: `../../backups/fishing-v04b-before-v05a-20261013/`. Исходный `art_lab/fishing_art_pack_v2` только читается. Экономика, world/configs, Engine, системы, UI/input и save schema не изменялись.

## Реестр и подготовка

`src/game/art/registry.ts` содержит ключи, preload, направления, ресурсные стадии, deck offsets и выбор монет. `BayScene.preload()` загружает общие Phaser spritesheets/images один раз. `scripts/prepare-art-v05a.py` воспроизводимо подготавливает runtime PNG из текущего локального пакета (Pillow): resize/crop/recenter, без перерисовки. Источники, SHA256, размер и байты каждого результата: `test-results/v05a/asset-preparation.json`. Всего 19 PNG, 3 266 583 байта. Sources, previews, ненужные лодки/ресурсы, большой исходный cargo sheet не копируются.

Пути источников ниже относительны `art_lab/fishing_art_pack_v2/`, runtime пути — `public/assets/`.

| Объект / ID | Источник | Runtime | Runtime / размер в мире |
|---|---|---|---|
| player | boats/atlases/boat_player_8dir.png | boats/boat_player_8dir.png | 512×256 sheet, 128×128 кадр / 92×92 |
| worker | boats/atlases/boat_worker_8dir.png | boats/boat_worker_8dir.png | 512×256 / 86×86 |
| speedboat | boats/atlases/boat_speed_8dir.png | boats/boat_speed_8dir.png | 512×256 / 94×94; новый спортивный вариант |
| golden | boats/atlases/boat_golden_8dir.png | boats/boat_golden_8dir.png | 512×256 / 96×96 |
| sardine | resources/atlases/sardines_4states.png | resources/sardines_4states.png | 384×384 sheet, 192×192 кадр / 160×160 |
| crab | resources/atlases/crabs_4states.png | resources/crabs_4states.png | аналогично |
| mussel | resources/atlases/mussels_4states.png | resources/mussels_4states.png | аналогично |
| snapper | resources/atlases/red_snapper_4states.png | resources/red_snapper_4states.png | аналогично |
| tuna | resources/atlases/tuna_4states.png | resources/tuna_4states.png | аналогично |
| 5 типов cargo | cargo/sprites/crate_{sardines,crabs,mussels,red_snapper,tuna}.png | cargo/crate_{type}.png | 128×128 / 20×20 на палубе, 28×28 в воде, 24×24 delivery |
| single / small_stack / large_pile | coins/sprites/coin_{type}.png | coins/coin_{type}.png | 96×96 / 24, 29, 34 px соответственно |
| Главный порт | buildings/harbor_main.png | buildings/harbor_main.png | 640×640 / 310×220 |
| Вода | water/water_approved_original.png | water/water_approved_original.png | 1024×1024 / неизменная карта 3300×2400 |

## Центры, направления и масштаб

Boats origin=(0.5,0.5), позиция точно (boat.x,boat.y). Каждая alpha-область направления центрируется в 128×128 и приводится к максимальной стороне 112 px: видимый корпус примерно 80.5 / 75.25 / 82.25 / 84 world px. Это устраняет скачки исходных прозрачных полей и нормализует масштаб между направлениями. Исходные collision radii не зависят от sprite size.

Frame order: **N, NE, E, SE / S, SW, W, NW**. Engine angle=0 означает E, -π/2 означает N, +π/2 означает S. `directionFrame` округляет к ближайшему сектору 45°, с wrap. Новые корпуса не получают дополнительный rotation. Placeholder hulls сохраняют прежний rotation.

Все resource frames origin=(0.5,0.5), точно в (resource.x,resource.y). Каждый визуальный центр выравнивается, но масштаб FULL используется общий для всех стадий данного вида: LOW/LAST сохраняют меньшее количество и размер группы. FULL видимая максимальная сторона около 142 px.

Harbor origin=(0.5,0.5), позиция=(880,1348), 310×220. Иллюстрация помещается вокруг старого центрального острова; его декоративный ellipse и первая упрощённая постройка отключены. Navigation obstacle остаётся (880,1340), rx=130, ry=95. Прежние декоративные zone-1 dock polygons отключены. Все исходные docks, purchase points и circles продолжают существовать функционально.

Иллюстрация не имеет точного совпадения с четырьмя сторонами старого gameplay layout. К точкам cargo=(880,1530), worker=(670,1340), speedboat=(880,1150) идут тонкие пунктирные mooring guides от визуальных anchors (880,1455), (735,1340), (880,1250). Unload остаётся (1090,1350), с исходным кругом и подписью «ВЫГРУЗКА». Это только графические указатели, не новые docks/colliders. Camera guidance использует прежний resolver.

## Stock → четыре стадии

`fraction = clamp((stock - 1 + hp / portion_hp) / initial_stock, 0, 1)`.

| Остаток | Frame |
|---|---|
| >75% | 0 FULL |
| >50% … 75% | 1 MEDIUM |
| >25% … 50% | 2 LOW |
| >0 … 25% | 3 LAST |
| locked, hp=0, stock=0, regrow или restock | скрыт |

stock включает текущую порцию. HP учитывается только как доля текущей порции; после её regrow общий остаток не растёт. На короткий regrow источник тоже скрывается, сохраняя прежнюю недоступность; после полного restock снова FULL. Name/recovery timer остаётся. Это статичные frames; animation не создаётся. HP, stock, damage, gather, timers, drop count и quests остаются исходными.

## Груз и деньги

Cargo data model не изменён: один image соответствует одному Cargo.id. Две компактные колонки, 11 px между центрами, upright crates. Deck anchor выбирается по направлению и типу лодки; вертикальный шаг min(5,18/(rows-1)), общий подъём стопки ≤18 px. Cargo images сохраняются по ID и удаляются после delivery; нет пересоздания каждого кадра. Разные PNG сохраняют цвет/тип груза, кабина остаётся частично видна. Для позднейших sway/bounce можно трансформировать вычисленные offsets без изменения Cargo.

Свободные ящики — images по FloatingCrate.id; прежний pickup по радиусу остаётся единственным способом получения. Существующие burst/delivery tweens используют те же crate PNG. Delivery texture берётся из cargo view, а для pickup+unload в одном кадре — из уже существующего события acquire. Новые gameplay events не вводились.

Coin visuals: обычная fish payout <10 — single; ≥10 — small_stack; ≥100 — large_pile. Golden piles всегда large_pile. Это только texture/size; ID/value/source/provenance/availableAt не меняются. Coin image+label пара переиспользуется через прежний pool и viewport/max_coin_views. Один выгруженный ящик сохраняет отдельную payout, Golden — 10 отдельных IDs. Wallet изменяется только исходным collectCoins.

## Вода и слои

Исходная approved water выбрана после сравнения обоих PNG и просмотра Phaser screenshots. У matched_edges заметна внутренняя квадратная сетка. Вода рисуется одним неподвижным image на всю существующую карту, origin=(0,0); поэтому не возникает повторов, швов или UV-мерцания. Tint=0xafd5da смягчает яркость для читаемости. Новая вода, shader и анимация не создавались. Соотношение сторон адаптировано только визуально.

| Depth | Содержимое |
|---|---|
| -20 | вода |
| 0 | прежние остальные острова, фон второй зоны |
| 1 | resource PNG |
| 2 | floating crates, coin images |
| 3 | harbor |
| 4 | hulls, Golden |
| 5 + index×0.0001 | cargo, нижний ящик раньше верхнего |
| 7 | rings, guidance, purchase/resource labels, boat labels/HP |
| 8–9 | прежние transient effects, TAP!/reward label |
| DOM | HUD/modal UI |

Harbor целиком ниже boats: большая единая иллюстрация не скрывает лодку при пересечении decorative pier. Разбиение на facade foreground/Y-layers пока не нужно; береговая геометрия сохраняет здания внутри защищённой области насколько позволяет единый арт. Sprites не имеют input handlers: прежние hit tests, functional circles и interactive labels работают без нового перекрытия.

## Placeholder scope

Guard/defender, pirate, salvage остаются прежними procedural hulls. Другие острова и постройки второй зоны, lobster/swordfish/squid/wreck и их cargo остаются placeholders. Для cargo второй зоны используются четыре общие procedural textures, генерируемые один раз, вместо graphics каждый кадр. v0.5b/v0.5c не начаты; новая combat/экономика/FX-логика не добавлена.
