# Navigation & Worker Traffic v0.4b

Дата: 2026-10-13. Основа: актуальные локальные v0.4a, без восстановления прежних версий. Изменения ограничены fishing-game/. Экономика, quests, арт и save schema не перебалансированы.

## Архитектура

Существующий visibility graph в movement.ts остаётся статическим планировщиком вокруг эллипсов островов/скал. Terrain padding=16, геометрия и world/gate bounds прежние. Engine на время одного simulation step подключает motion handler к реальным hull objects. navigateTo и прямой player input используют этот handler; projectile moveTo и Golden movement независимы.

traffic.ts хранит grid, velocity history, arrival owners/FIFO, короткие detours, blocked timers и metrics в WeakMap<GameState, Traffic>. GameState/Boat/Enemy не получают новых persistent fields. Seed/RNG/nextId система avoidance не потребляет. Одинаковые исходное состояние, seed, input и dt sequence дают одинаковые лодки, cargo и counters; абсолютные realTime в старых event logs не являются gameplay state.

## Коллизии и избегание

Участвуют player, worker, speedboat, salvage, defender и pirate. Рыболовные worker/speedboat/salvage с историческим hp=0 остаются активными корпусами. Disabled player/defender исключаются до repair. Golden Boat намеренно non-solid: проходящий рекламный объект не блокирует флот и награду; движение/тап/покупки Golden сохранены.

Grid broadphase = 110px, проверяются 9 соседних buckets. Набор соседей собирается один раз на движение. Проверяются 11 локальных направлений AI; player ограничен направлениями с положительным продвижением относительно input. Прогноз на .35s и предпочтение правого обхода/предыдущего steering уменьшают смену стороны. Actual previous displacement делится на previous dt, поэтому 30/60/120Hz и неравномерные кадры не превращают прошлый шаг в ложную скорость. При блокировке .25s разрешён локальный water detour до 2s, cooldown 2.5s; он не меняет игровую цель. После 2s без движения cache маршрута сбрасывается не чаще раза в 3s. Нет per-pair глобального pathfinding и новой emergency телепортации.

Номинальная оболочка мягкая. Swept disk core = 90% суммы номинальных радиусов: переход через ядро соседней лодки обрезается, включая быстрый катер/диагональный шаг. Небольшое перекрытие оболочек допускается для прохода узких service zones. Импортированная тесная группа не исправляется одним скачком: NPC постепенно раздвигаются, fixed ordering/golden-angle direction разрешают совпадающие центры. Recovery уменьшает общую penetration energy, не создаёт новые пары номинальных пересечений при корректировке, не сдвигает игрока и проверяет endpoint + water segment + world/gate bounds. Старые combat respawns остаются прежними; после relocation обнуляется только prediction/route history.

Correction budget = 36px/s, не более 1.2px за 1/30s на hull суммарно за шаг. Скорость обычного движения ограничена своим прежним unit speed × dt; parking и смена цели не дают второй бюджет. Нулевой player input не создаёт steering/drift. Workers уступают прогнозу реальной аналоговой скорости игрока и своего движения, а не предполагаемой полной скорости слабого joystick.

Компромисс формы: круг соответствует ширине лодки/игровой центральной части, а не полной длине 96×64 procedural texture. Тени, носы, кормы и labels в плотном флоте могут частично накладываться. Это не точная polygon/capsule collision. Полная bounding-circle физика несовместима с одновременным обслуживанием неизменного deposit radius=38 и стоящим в порту игроком. Визуальную приемлемость этого компромисса нужно оценить вручную; полной пиксельной непроницаемости не заявляем.

## Arrival positions и очередь

Ресурсы получают детерминированный hex grid с spacing = 2 × max(worker/speedboat/salvage radius) + 3. Кандидаты строго внутри resource radius=78, на воде, с проверкой пути и без островов/скал. У домов порта/склада прежние island contours; декоративные причалы/over-water platforms не становятся новой физикой. При назначении учитывается расстояние и временно занятое уходящей лодкой место; затем место стабильно до реальной смены intent.

Порт/склад используют кольцо radius=36, места проверяются на воду и достижимость. Рыболовных мест 6; у склада часть кандидатов отсекает берег. Когда всё занято, FIFO ждёт на распределённых water positions за service disk. Удаление owner происходит при смене ресурса/RETURN/UNLOAD, выборе реального crate либо исчезновении hull, а не из-за объезда. Runtime arrival ownership не заменяет crate.reservedBy.

Выгрузка продолжается исключительно внутри прежних 38px. Когда лодка уже в допустимом радиусе, она заканчивает unload без попытки доплыть до точного anchor. У resource используется прежний arrival radius=12; GATHER продолжается только внутри реального resource radius=78. Pickup radius=35 и purchase radius=48 неизменны. Empty WAIT возле сервиса уходит на water parking после Worker AI, поэтому новые crates/nodes сохраняют свою прежнюю приоритетность. Full warehouse не теряет cargo и не заставляет пустые boat занимать berth.

Worker selectTarget/releaseCrates, .65 best-choice branch, loose-box priority, resume, capacity, gather clocks, full/partial return и состояния прежние. Новая навигация не меняет target при временной блокировке и не расходует RNG.

## Player, покупки, combat

Floating joystick, keyboard, capture/release/lifecycle resets, absence of free-water click-to-move и полный quest camera cycle сохранены. Input/UI/BayScene исходники не менялись.

Для stationary purchase передаётся max(actual displacement speed, requested input speed): удержание управления в заблокированную сторону не провоцирует оплату. После настоящего отпускания и прежних .25s действует обычная оплата, pour/cooldown/exit guards неизменны. Игрок separation не сдвигает, поэтому NPC не проталкивает его в buy circle.

Pirate water spawn выбирает свободное место, не меняя clocks/HP/damage. Возврат получает разные подходы к общему home; chase anchor не перенесён. Defender сохраняет patrol/chase и sea minimum x. Выбор целей прежний, fishing workers не становятся combat targets. attack() вызывается независимо от успешности движения и сохраняет radius/cooldown/projectiles.

## Новые настройки обоих профилей

| navigation.traffic | Значение |
|---|---|
| radii.player / worker / speedboat / salvage / defender / pirate | 18 / 15 / 16 / 16 / 18 / 17px |
| neighbor_radius | 110px |
| correction_speed | 36px/s |
| arrival_spacing | 3px |
| stuck_s / repath_s | 2 / 3s |

Все числовые поля положительные и finite; neighbor radius ≥ 2 × max radius + 12, repath_s ≥ stuck_s. Новые поля optional только для исторических config fixtures; оба production JSON их содержат. Остальные JSON fields полностью совпадают с backup v0.4a. Сохранения version=3 и quiet_cove_fast_v1 / quiet_cove_reference_v1 прежние; actor velocity/routes/queues не сериализуются.

## Throughput до/после

Оригинальный Engine собран из pre-edit backup, не из новой логики с условным flag. Обе стороны получают одинаковые snapshots/seed и 600 игровых секунд. Это unlocked technical fixtures, не естественное прохождение: всё нужное открыто, player обычно стоит в порту, Golden выключен. У warehouse есть одинаковый test-only spending sink: −80 metal при ≥80, чтобы законный full-storage WAIT не считался navigation defect. Pirate fixture начинает с трёх врагов и defender.

Доставка = физически выгруженная единица fish cargo, не количество рейсов. Issued income = сумма value delivery events, собранных инкрементально до log eviction; wallet income хранится отдельно в JSON. Максимальный near-service time включает подход/ожидание/unload при distance<150 и cargo>0. Queue boat-seconds = waiting requests /30 в этом фиксированном-step harness. Stuck = TO_PICKUP/RETURN/UNLOAD без заметного движения >5s к концу прогона; transient waits учитываются отдельным blockedBoatSeconds.

| Профиль / сцена | Fish deliveries до → после | Δ deliveries | Δ issued income | Max near service, s | Queue boat-s | Stuck на финише |
|---|---:|---:|---:|---:|---:|---:|
| fast / 1 лодка | 0 → 0 | +0.0% | +0.0% | 0.0 | 0.0 | 0 |
| fast / 5 рабочих | 207 → 207 | +0.0% | +0.0% | 3.0 | 0.0 | 0 |
| fast / 10 рабочих | 435 → 423 | -2.8% | -2.6% | 9.0 | 96.4 | 0 |
| fast / максимальный флот | 486 → 487 | +0.2% | -3.2% | 12.3 | 165.5 | 0 |
| fast / один ресурс + тесный save | 982 → 905 | -7.8% | -7.8% | 6.1 | 372.8 | 0 |
| fast / флот + 3 пирата | 486 → 490 | +0.8% | -3.5% | 12.1 | 168.0 | 0 |
| reference / 1 лодка | 0 → 0 | +0.0% | +0.0% | 0.0 | 0.0 | 0 |
| reference / 5 рабочих | 207 → 207 | +0.0% | +0.0% | 3.0 | 0.0 | 0 |
| reference / 10 рабочих | 417 → 411 | -1.4% | -1.9% | 9.0 | 111.4 | 0 |
| reference / максимальный флот | 475 → 449 | -5.5% | -2.0% | 12.3 | 153.2 | 0 |
| reference / один ресурс + тесный save | 540 → 491 | -9.1% | -9.1% | 4.6 | 117.1 | 0 |
| reference / флот + 3 пирата | 475 → 462 | -2.7% | -0.8% | 12.2 | 145.5 | 0 |

FAST maximum = player+10 workers+speedboat+3 salvage (15); REFERENCE = player+10+speedboat+6 salvage (18). Combat добавляет defender и до 3 pirates: до 19/22 корпусов. В одиночной idle сцене доставок нет; движение одного player проверено unit/native input tests.

Во всех 12 fixtures незаконных water/bounds positions и конечных stuck boats = 0. Доход 5 workers совпал с baseline. Max-fleet issued income: около −3.2% FAST / −2.0% REFERENCE. В mono-resource/stacked 600s fixture остаются −7.8% / −9.1%; отрицательный delta не скрыт и не компенсирован ценами/скоростями. Здесь теснее traffic, а короткий REFERENCE sample чувствителен к фазе долгого restock. Нулевой конечный stuck не означает нулевого ожидания. Для этого крайнего случая нужны длительный hardware/AFK playtest и оценка дохода по полным восстановительным циклам. Прежние FAST absolute pacing guards для трёх seed проходят.

Числа и per-boat deliveries/metal/cash/waits/CPU: [fleet-stress.json](../test-results/v04b/fleet-stress.json). Browser FPS и аппаратные ограничения: [VALIDATION_V04B](VALIDATION_V04B.md).
