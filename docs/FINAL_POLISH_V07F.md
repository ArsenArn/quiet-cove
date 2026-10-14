# Quiet Cove / Тихая бухта — v0.7f Final Polish

Дата проверки: 14.10.2026.

**Последующая проверка Q31:** выявлено пересечение старого домика порта с покупкой логова. Домик и привязанный collider перенесены в (2510,1340)/(2510,1368); стоимость и условия прежние. [Совместная проверка, актуальная геометрия и скриншоты](PORT_DEN_COEXISTENCE_V07F.md). Таблицы performance/pacing ниже получены до этой локальной коррекции расположения. Работа выполнена в текущем fishing-game; v0.7e сохранена только как измерительный baseline в .local/v07f/before. Пользовательские browser saves не открывались и не сбрасывались. Тестовые браузеры используют отдельные Playwright contexts.

## 1. Summary

Второй рыбный порт стал отдельной необязательной постройкой после получения награды Q26. Сохранена общая Dual Fish Ports логика: после строительства работают оба причала, выбирается ближайший достижимый по длине маршрута. Добавлены компактные препятствия для портового домика и defender dock, восемь отдельных anchors груза игрока, восстановление HP и три технические оптимизации: очистка terminal metal attribution в Analytics, обработка только новых VFX-событий и кеширование статичных кругов покупки.

Все существующие значения FAST/REFERENCE, включая 34 quests, IDs/order, rewards, income, цены, cap, старые timers, monetization, скорости, max HP и damage, совпадают с v0.7e после удаления только новых second_port/player_regen и ключей secondPort в interaction. Это проверка значений JSON; форматирование JSON изменилось. REFERENCE не переобъявлен байт-идентичным файлом.

## 2. Second Port

| Профиль | Coins | Metal | Construction |
|---|---:|---:|---:|
| FAST | 1800 | 60 | 45 s |
| REFERENCE | 11000 | 120 | 900 s |

Покупка доступна только после rewarded.includes(26): completed_unclaimed Q26 недостаточно. Заказ secondPort проходит через обычные pay/updatePurchases/updateConstruction, сохраняет собственные цену, две paid fractions, duration и readyAt. Действуют прежние stationary payment, cooldown/exit guards, FREE SKIP / confirmed rewarded skip. Таймер также заканчивается естественно и через существующее offline timer settlement.

Zone 1 (1090,1350) действует всегда. Zone 2 (2630,1390) отсутствует в fishPorts до завершения заказа: player/worker/speedboat не разгружаются там, To Port туда не ведёт, label и круг скрыты. Отдельный purchase circle: (2830,1390), вне unload и metal storage. Построенный домик: (2510,1340), к северо-западу от unload, с чистым водным подходом снизу. Модель building-zone2_purchase переиспользована без новых assets. На старом gate сохранены покупка и круг; домик заменён небольшим chart marker. Во время оплаты/строительства домика ещё нет; после завершения он постоянно виден.

FAST цена значима: в трёх финальных unfunded моделях после награды Q26 есть 2426–2719 coins и 62–64 metal; 1800 оставляет резерв, 60 помещается в storage=100. Это модель, а не утверждение о любом игроке. Исходный реальный playtest найден в Downloads: active=20:10, Q24 завершён/Q25 активен, earned=19445, spent=18245, wallet=1200, pending fish-sale coins=1413, metal=12, five workers, speedboat и defender; salvage:0 paid=1040/3000. Его JSON прочитан, но не изменён и не использован как полноценный GameState save. Денег на все последующие покупки одновременно он не гарантирует; доход продолжается, а покупка порта необязательна.

REFERENCE 120 metal превышает начальный cap=100: тест оплачивает первые 100, сохраняется/загружается, затем оплачивает оставшиеся 20. Оплата освобождает место в складе, поэтому ждать cap=120 не требуется. FAST проверен с полным storage и существующим overflow. Порт не входит ни в одно условие завершения Q27–Q34.

## 3. Life of Ants comparison

**VERIFIED:** research_102/quests_102.csv: guided_029 Collect 50 wood; guided_030 Dig the Kitchen Nest. research_102/raw/upgrades.txt:39 содержит nest2 | 11000 | 900 | wood 120. Эти три числа сохранены в новой REFERENCE покупке; wood заменён metal, порядок открытия и map delivery адаптированы. Это не точная копия оригинальной постройки. FAST 1800/60/45 — собственные параметры по экономике текущего проекта, существующие цены/награды не подгонялись.

**VERIFIED static constants:** constants.json PlayerHp=40 (fieldIndex=22768), RegenPerSecond≈0.1 (22783), RegenDelay=5 (22784). Их единицы нельзя выводить только из названия.

**DERIVED from native instructions:** AntsLife.Core.Sim.TickPlayerHealth VA 0x2392f70, metadataMethodIndex=39210, читает Sim.Player +0x20 и PlayerAnt.Hp +0x50 / CombatT +0x54; сравнивает HP с 40, delay с 5, затем прибавляет dt×4 и ограничивает до 40 (0x2392fa8–0x2392fc0). То есть реальный player health path даёт 4 HP/s, а не 0.1 HP/s. CombatSystem.TickKitchenRaiderFight 0x242fb54–0x242fb68 уменьшает PlayerAnt.Hp и обнуляет CombatT. Точечная дизассемблированная запись находится в test-results/v07f/player-health-native.txt; исследовательские исходники не изменялись. Отдельный dormant/AI regen этим не объявляется подтверждённым. Static/native evidence не заменяет runtime test оригинального APK.

## 4. Collisions

| Постройка | Центр тела | Базовые rx / ry | Когда существует |
|---|---|---|---|
| Port hut | (2510,1368) | 38 / 27 | area 2 и secondPort built |
| Defender dock | (2290,1090) | 49 / 35 | area 2, когда существующий dock показан |

Тело, а не флаг/мачта/декоративная область. Для максимального hull radius=18 при static boat_radius=16 footprints дополнительно расширены на 2 px; это даёт водный clearance для player/defender и меньших лодок. Старые island/rock препятствия не изменялись. Навигация объединяет исходную геометрию с transient building obstacles; topology меняется при unlock/load и инвалидирует graph/route caches. Препятствия не входят в save JSON и восстанавливаются из flags. Невидимой коллизии до постройки нет. Boats внутри нового footprint при load мягко выносятся в воду, без потери их ID/cargo.

Focused navigation checks покрывают player, worker, speedboat, defender, salvage; сегменты маршрутов вокруг обоих тел чистые, purchase/unload/storage доступны. Дополнительный 1200-second Engine stress с десятью workers, speedboat, salvage и combat: before/final terminal stuck=[], illegalPositions=0. Issued fish income 77986 → 79013; delivered fish 1677 → 1680. Счётчики local neighbor checks: 1320360 → 1376261 за 1200 s; route recovery repaths=0 в обоих. Малый разброс обусловлен новой геометрией/regen/детерминированным взаимодействием флота, не изменением income values. Это один stress fixture, не гарантия всех трафиковых сценариев.

## 5. Cargo stacks

Палуба проверена по настоящему boat_player_8dir.png; это задняя грузовая площадка относительно cabin, а не центр прозрачного 192×192 frame. Player anchors в world pixels при прежнем boat size=104:

| N | NE | E | SE | S | SW | W | NW |
|---|---|---|---|---|---|---|---|
| (0,12) | (-12,8) | (-20,2) | (-13,-9) | (0,-18) | (13,-9) | (20,2) | (12,8) |

Worker/speedboat/salvage anchors, crate size, stack rise, maxVisible, cargo capacity и layer ordering сохранены. Стабилизация/lean/бобинг используют прежние motion anchors. Проверена матрица 8×6: cargo-eight-directions-1-to-6.png. Footprint основания лежит внутри палубы во всех направлениях; вертикальная башня высоких грузов сохраняет прежнее перспективное перекрытие cabin, особенно N/S. Это не перемещение центра спрайта и не изменение вместимости.

## 6. Player HP

До v0.7f существовали max HP=80, damage projectiles и repair after death, но отсутствовали last damage timestamp и live regen. Добавлен сохранённый playerLastDamageAt. После последнего реального projectile hit: delay 5 s, затем 8 HP/s (=10% max/s, пропорционально найденному native player path 4/40). Учитывается только часть dt за границей delay. Повторный hit перезапускает задержку, hp≤0 не регенерирует, значение не превышает 80. Смерть/respawn сохраняют прежние правила. HUD и world HP bars читают тот же живой hp, отдельного визуального HP нет.

Reload сохраняет последнюю атаку. Старому save без timestamp назначается текущее game time, чтобы не выдавать моментальный regen из неизвестной истории. Offline время не симулирует дополнительное healing: при возвращении лечение идёт живыми ticks. Browser projectile test: 80→72, 4.9 s без изменений, после задержки HP растёт; repeated damage, death и reload проверены unit tests. Damage и max HP прежние.

## 7. Performance

Причина пользовательского desktop hitch после ~15 минут полностью не доказана. Найдены и исправлены три конкретных источника лишней работы/retention:

1. Analytics сохранял ID каждого выгруженного metal crate навсегда: delivery назначал crate_resources, а последующего coin_spawn для metal нет. Теперь ID удаляется после учёта; sample также чистит terminal IDs старых recording checkpoints, сохраняя live cargo/floaters. Формат compact/full export, aggregates и точность ledger прежние; новые recordings помечаются game_version=0.7f.
2. VFX каждый кадр просматривал весь consumed event history (до 5000). Теперь обрабатывает только непрочитанный suffix; lastEvent/state replacement rules прежние.
3. CPU profiles показывали GraphicsWebGLRenderer/earcut/isEarHashed/batchFillPath среди главных затрат. Статичные круги покупки с 20 dashes кешируются в две небольшие texture variants; динамическая зелёная шкала продолжает обновляться. Активные images удаляются при исчезновении offer; textures очищаются при scene shutdown. Visible markers/VFX/лодки не отключались, игровая скорость не менялась.

| Контрольная проверка | Before | After |
|---|---:|---:|
| Retained metal crate IDs после 2000 deliveries | 2000 | 0 |
| Accepted metal / resource units / worker deliveries | 2000 / 2000 / 2000 | 2000 / 2000 / 2000 |
| drawEvents: median 20000 calls, 5000 consumed events | 117.0 ms | 1.8 ms |
| Paused identical scene: renderer mean | 27.2 ms | 18.1 ms |
| Cached marker texture count | 0 | 2 |

Renderer comparison — отдельная одинаковая paused fixture, 5 s, один headless Edge page за раз; параллельный долгий прогон делит CPU/GPU. Это измерение снижения конкретной работы, не гарантированный desktop FPS uplift. Cache закономерно увеличивает число display objects за счёт дешёвых marker Images.

Fresh game, five-second RAF samples (developer panel closed):

| Версия | FPS | p95 ms | Objects | JS heap |
|---|---:|---:|---:|---:|
| before | 163.39 | 6.2 | 61 | 54.0 MiB |
| optimized | 165.00 | 6.2 | 62 | 52.4 MiB |

Полные долгие прогоны: 1440×900, Edge headless/WebGL, обычная speed=1, шесть workers + speedboat + два salvage + defender/pirates, все nodes открыты, реальные доставки. Test-only spending sink освобождает полный metal storage; collection circuit ходит к физическим payouts, не выдаёт деньги. Analytics ON/OFF используют разные чистые contexts. На baseline оба порта бесплатны; в final fixture второй построен заранее для сравнения флота. Это technical stress с подготовленным состоянием, не human playthrough. Ниже последние 30-second RAF окна; heap raw / after forced GC в конце:

| Версия / Analytics | Wall / game elapsed | FPS | p95 ms | Objects | Heap MiB raw / GC | Crates / coins | Fish deliveries |
|---|---|---:|---:|---:|---:|---:|---:|
| v0.7e / OFF | 20:10 / 20:10 | 22.67 | 60.6 | 186 | 70.3 / 14.2 | 4 / 11 | 1093 |
| v0.7e / ON | 20:09 / 20:08 | 22.76 | 54.8 | 218 | 67.6 / 14.5 | 21 / 8 | 1135 |
| v0.7f / OFF | 20:07 / 20:07 | 62.69 | 24.1 | 186 | 89.9 / 12.5 | 3 / 0 | 1118 |
| v0.7f / ON | 20:05 / 20:05 | 67.08 | 18.3 | 193 | 81.4 / 13.8 | 6 / 8 | 1103 |

В baseline поздние фазовые engine/drawEvents CPU counters не сохранились из-за ошибки инструментирования массивов; они не используются для before/after вывода. Frame/heap/object/delivery samples и CDP CPU profile сохранены. Baseline heap включает накопленные диагностические буферы CPU samples; разница heap не приписывается только игре. В after прямые routeTo frequency / GPU draw calls недоступны, local traffic export также изолирован Vite module instances; для traffic counters используется общий bundled Engine stress fleet.json. Максимальный active object count по 30 s snapshots: baseline 219, after 230. VFX/coin view pools остаются bounded, finished views удаляются; pending coin data сохраняется до physical collection, не выбрасывается ради FPS. Analytics events/snapshots растут до существующего предела намеренно; terminal attribution после очистки следует числу живых cargo/floaters, а не сумме metal deliveries.

Не обнаружено монотонного роста display objects/VFX за этот прогон. Это ограниченное свидетельство, не доказательство отсутствия всех возможных утечек. Raw FPS чувствителен к одновременно запущенным браузерам, тестам и software rendering; baseline и after частично перекрывались по wall time, нагрузка хоста неодинакова. Поэтому таблица не используется как причинное доказательство общего FPS улучшения. Файлы: before/performance.json, optimized/performance.json, CPU profiles, markers.json, fresh.json, performance-contract.json, fleet.json. Physical-device и пользовательский foreground desktop retest остаются ручными.

## 8. Save compatibility

Новые saves получают portRules=1, secondPort изначально отсутствует. Version=3 и профильные ключи quiet_cove_*_v1 сохранены. В legacy FAST save без portRules и с area=2 выдаётся grandfathered secondPort=true: это сохраняет доступ бесплатного v0.7e порта и не отнимает достигнутую прогрессию. Сохраняется точный raw backup *_backup_before_v07f; миграция идемпотентна. Legacy area=1 не получает бесплатную постройку, legacy REFERENCE тоже не получает прежнего несуществовавшего там бесплатного Dual Port. Coins/metal/fleet/orders/quests/pending payouts сохраняются. Partial payment/building/completed port заказы сериализуются как обычные Order; transient route caches/obstacles/VFX не входят в save.

## 9. Tests/build/browser results

- npm test: **275 tests / 26 suites PASS**, без unhandled errors. Первые запуски при параллельном профилировании ловили host contention и worker RPC timeouts; runner ограничен двумя workers, синтетический многосуточный analytics fixture периодически уступает event loop, assertions и simulation dt не ослаблены. Его time budget 60 s; реальная игра от этих test-only изменений не зависит.
- npm run build: PASS; прежнее Vite warning о размере Phaser chunk >500 KiB.
- Focused browser: seven groups PASS, pageerrors=[]; gate/Q26 reward, partial/timer/free skip, обе выгрузки/physical coins, HUD navigation, actual combat regen, матрица cargo. Навигация, save/load, rewarded skip, metal batches/cap и оба профиля дополнительно покрыты unit/Engine tests.
- Nine full unfunded physical pacing runs: three seeds × three scenarios, 34/34 quests, debug_income=0; first fifteen per-quest rows полностью совпадают before/after.
- Общий 1200 s fleet fixture: оба варианта без illegal positions и terminal stuck boats.

Screenshots в test-results/v07f/browser: port-before-unlock.png, port-construction.png, port-after-construction.png, both-ports.png, cargo-eight-directions-1-to-6.png; markers-uncached.png / markers-cached.png для visual cache review. Build/tests stdout и browser/report.json сохранены рядом с результатами.

## 10. FAST pacing

MODELED ESTIMATES. Сохранены driver A, seeds 41/97/211, dt=.2, без Golden/rewarded/debug grants. Вариант с покупкой добавляет только легальный маршрут к secondPort после Q26, оплату/стройку через те же системы. Применено прежнее v0.7e free-skip правило (>2 s после начала и below threshold). 26 skips без порта, 27 с портом — модельная частота, не обещание поведения человека. Projection сравнивается по прежней фиксированной калибровке k=0.9574582043343284, anchor Q16=667.449 s; новая история Q25 не используется для искусственного refit. Latest human source заканчивается на Q25, поэтому human Q26–Q34 timing неизвестен.

| Seed | Вариант | Raw model | Same-calibration projection | Free skips |
|---|---|---:|---:|---:|
| 41 | v0.7e | 29:28 | 30:42 | 26 |
| 97 | v0.7e | 29:00 | 30:10 | 26 |
| 211 | v0.7e | 29:14 | 30:25 | 26 |
| 41 | v0.7f без покупки | 32:51 | 33:55 | 26 |
| 97 | v0.7f без покупки | 33:02 | 34:02 | 26 |
| 211 | v0.7f без покупки | 32:47 | 33:49 | 26 |
| 41 | v0.7f с покупкой | 30:26 | 31:37 | 27 |
| 97 | v0.7f с покупкой | 30:56 | 32:01 | 27 |
| 211 | v0.7f с покупкой | 31:09 | 32:16 | 27 |

Mean raw quest duration, seconds:

| Quest | v0.7e | v0.7f без порта | v0.7f с портом |
|---|---:|---:|---:|
| Q16 | 122.5 | 122.5 | 122.5 |
| Q18 | 102.6 | 102.9 | 102.9 |
| Q25 | 55.1 | 49.0 | 49.0 |
| Q26 | 88.8 | 87.3 | 87.3 |
| Q27 | 82.9 | 84.5 | 148.8 |

Q16/Q18 удлиняются ожидаемо: до Q26 второй причал больше не сокращает путь. В optional сценарии длительность строки Q27 включает отвлечение на покупку порта до Swordfish; это не новый квест. Следующие доставки сокращают общий run. Оба варианта остаются приблизительно в целевом диапазоне 30–35 min projection, старые цены/rewards не менялись. Полные строки, кошельки, платежи и nodes: pacing.json / projection.json. Новые препятствия дают несколько секунд seed-dependent route variation, поэтому финальные числа получены после radius-clearance проверки.

## 11. Remaining risks/manual checks

Нужен свежий human FAST run до Q34: реальная частота FREE SKIP, выбор optional port и сбор выплат у двух причалов могут отличаться от driver. Отдельно проверить foreground desktop smoothness после 15–20 min и физическое мобильное устройство; headless shared-host FPS не является device benchmark. Cargo base центрирован, высокая вертикальная башня остаётся прежней по стилю и может перекрывать cabin при N/S. Двадцатиминутный stress и bounded counters не подтверждают многочасовую память/все импортированные layouts. Сохранён legacy бесплатный FAST-порт намеренно: для проверки новых правил нужна отдельная new game fixture, пользовательский save сбрасывать не требуется.

Deploy/publish/commit/push не выполнялись.
