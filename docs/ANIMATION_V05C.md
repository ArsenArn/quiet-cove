# Тихая бухта — Animation, VFX & Visual Polish v0.5c

Дата: 2026-10-13. Основа: v0.5b Pass 2. До изменений выполнены build и 170 tests. Backup исходных src/docs/scripts/tests/JSON/README/package: `../../backups/fishing-v05b-before-v05c-20261013/`. Исходный арт и предыдущие отчёты сохранены.

## Реализовано

| Объект / действие | Presentation |
|---|---|
| Cargo | Ящики 36 вместо 28 world px; одна вертикальная стопка, до 7 изображений, подъём 7 px на уровень, малые чередующиеся смещения |
| Палуба | Четыре таблицы × восемь направлений; anchors интерполируются при смене frame, IDs/состав сохраняются |
| Инерция | Затухающий импульс поворота/разгона и critically damped spring; верхние уровни отклоняются сильнее, cap 7° |
| Harvest / pickup | 280 ms перелёт по дуге к движущейся палубе; штатный cargo view временно скрыт; landing вызывает короткий bounce стопки, включая получение сверх семи visible crates |
| Delivery | 300 ms дуга из верхней части стопки к сдаче, отдельный эффект на каждый delivery; фактический FIFO, номинал и engine timing прежние |
| Лодки | Bob ±1.6 px и roll ±0.009 rad с фазой по ID; все рабочие, player, pirate, defender и Golden |
| Wake | Пары коротких полос с V-образным направлением, 750 ms затухание; только при фактическом движении, сильнее speedboat |
| Ресурсы | Различный ambient sway для fish/crab/lobster/mussel/squid/wreck; scale менее 0.8%, четыре прежние стадии |
| Добыча | Редкие кольца/пузырьки у работающего косяка, splash при получении; progress circle сохранён |
| Burst | Каждый существующий crate view проходит дугу от ресурса к своей уже действующей мировой позиции; splash при посадке |
| Floating crates | 42 вместо 40 px; спокойный bob; при раннем pickup burst удаляется, единственный flight идёт от текущего визуального положения |
| Монеты | Одно изображение на payout ID; 400 ms перелёт/подпрыгивание/scale pop; физическая точка и availableAt не меняются |
| Сбор монет | Точное `+value`, подъём и fade 700 ms, отдельные позиции одновременно собранных выплат; золотой sparkle только после coin_collect |
| Golden | Прежние 10 payouts; более высокая дуга/подпрыгивание и больше sparkle, деньги только при физическом collection |
| Бой | Направленный projectile/trail следует реальному projectile; attack flash, hit tint 160 ms, splash; pirate death — fade/погружение/обломки 400 ms |
| Строительство | Редкая активность около круга, timer_finish запускает 420 ms scale bounce объектов/новой лодки/ресурса и sparkle/ring |

## Архитектура и жизненный цикл

`art/animation.ts` — отдельный presentation config, фазы, ambient и spring helpers. Экономические JSON-профили не изменены. `art/VisualEffects.ts` — один Graphics для всех декоративных частиц, заранее созданные числовые slots; shared Image/Text pools для коротких перелётов и collected numbers. Phaser tweens/timers и particle emitters не создаются на каждое событие.

`BayScene` проецирует state на hull/cargo/resource/coin views. Visual clock работает в реальных секундах; игровой speed multiplier не задерживается ради эффекта. Cargo/wake/bob меняют только изображения. Локальные maps для pickup/burst/coin birth/hit/construction и Motion не входят в save.

Engine events читаются один раз по seq. Старт Scene фиксирует текущий seq: сохранённые события, offline construction и уже построенные объекты не проигрываются заново. Замена state очищает transient views, shutdown уничтожает pools/Graphics. Прерванный pickup/unload/coin pop после reload восстанавливается как конечный cargo/pending payout. Никакой VFX callback не начисляет ресурс, деньги или урон.

Обогащение существующих событий: harvest/crate_pickup получают origin x/y; delivery получает resource; pirate_killed получает x/y/angle. Новые `combat_attack` и `combat_hit` содержат координаты и target. Боевые вычисления, RNG, AI и состояния не изменены. Attack/hit events могут увеличивать размер event log до прежнего max_events; save schema и keys прежние.

## Параметры и ограничения

| Параметр | Значение |
|---|---|
| Видимые cargo crates | 7; реальные cargo/capacity не ограничиваются renderer |
| Высота стопки | 42 px между нижним и верхним центром, плюс artwork |
| Cargo spring | omega=11/s, импульс затухает с коэффициентом 5/s; visual dt ≤50 ms |
| Поворот anchor | exponential interpolation 18/s |
| Pickup / unload | 0.28 / 0.30 s, дуга 22 / 28 px |
| Bob | 1.6 px, frequency=1.8 rad/s, phase от ID |
| Wake | interval=0.11 s (worker ×1.6), lifetime=0.75 s |
| Floating burst | прежний resource_burst.duration_s; дуга 36 px, без задержки collectible |
| Particles | максимум 192 в high, 48 в low, 0 в off |
| Image flights / numbers | максимум 96 / 64 одновременно; images/texts переиспользуются |
| Coin views | прежние 180 видимых payouts; все данные выплат остаются в state |

Запуск `?vfx=low` сокращает декоративный пул и sparkle; `?vfx=off` убирает декоративные частицы. Cargo, перелёты, collected values и bob сохраняются. При заполнении пула collection/impact заменяют wake. Burst использует один существующий view на ID и ограничивается прежним world cap 150, а не дополнительным пулом collectibles.

Лимит 96 flights превышает общий штатный груз максимального REFERENCE флота (74 crates: player 12, workers 30, speedboat 2, salvage 30). Крайние искусственные debug bursts сверх лимита пропускают лишний transient, сохраняя конечное игровое состояние. Декоративные частицы могут опускаться при нагрузке. На update не создаются новые GameObjects/Graphics/textures для ambient/wake; несколько прежних scene collections и лёгкие coordinate helpers продолжают создавать JS values — полный zero-allocation renderer не заявляется.

## Cargo anchors

World px относительно centre отображаемого 192px directional frame. Оси экрана: +X вправо, +Y вниз. Crates остаются upright; их rotation — только малый lean. До 7 уровней: `y=anchorY-index*7`, `x=anchorX ± index*0.3 + sin(lean)*index*7`. Индикатор показывает настоящий cargo count, включая cargo сверх визуального лимита.

| Модель | N | NE | E | SE | S | SW | W | NW |
|---|---|---|---|---|---|---|---|---|
| player | -9,23 | -15,19 | -22,12 | -17,-4 | 0,-11 | 17,-4 | 22,12 | 15,19 |
| worker | -8,22 | -16,18 | -21,10 | -15,-3 | 0,-10 | 15,-3 | 21,10 | 16,18 |
| speedboat | -6,16 | -12,14 | -17,7 | -13,-4 | 0,-9 | 13,-4 | 17,7 | 12,14 |
| salvage | -9,24 | -16,20 | -23,13 | -17,-3 | 0,-10 | 17,-3 | 23,13 | 16,20 |

Во время поворота палуба плавно переходит к новой таблице. Flight endpoint пересчитывается по текущему boat/view, поэтому движущийся корабль не оставляет ящик позади. Composition привязан к Cargo.id, не к sprite frame. Реальный FIFO разгрузки сохранён; presentation показывает ресурс delivery из верхней позиции стопки и уплотняет оставшиеся уровни.

## Постройки

Zone unlock: 106×125 → 143×169 (+35%), центр `gate+(124,-125)` = (1874,1155). Маркер покупки (1750,1280) свободен.

Defender: 150×164 → 203×221 (+35%), центр `defender purchase+(40,-160)` = (2290,1060). Станция стоит в воде над островом склада и отделена от его image bounds. Наклонный mooring guide ведёт к **прежней точке покупки (2250,1220)**. JSON, island colliders, patrol/spawn, цены, stationary delay и guidance не изменены. В renderer и engine bounds не подменяются друг другом.

## Следующая итерация

Физические телефоны и длительный субъективный playtest; более точное camera-aware подавление второстепенных частиц; при необходимости отдельная художественная настройка occlusion кабины и палубы на очень высокой стопке. В этой итерации новые изображения не генерировались, HUD/popups не перерабатывались.
