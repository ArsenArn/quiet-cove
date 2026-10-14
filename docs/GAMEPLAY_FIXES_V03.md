# Gameplay & UX v0.3 — матрица исправлений

Дата: 2026-10-12. FIXED означает реализовано и проверено автоматическими tests и headless Phaser browser scenarios. PARTIAL относится к явно указанной границе проверки; smoke не называется естественным playtest. Baseline v0.2: 58 тестов и browser smoke; backup `.local/v02-backup-20261012/`. Исходники research, APK и handoff не изменялись. Каталог без Git; файловое сравнение — CHANGE_MANIFEST_V03.md.

| Пункт / исходная проблема | Решение | Изменённые файлы | Конфигурация | Автотест | Browser проверка | Статус |
|---|---|---|---|---|---|---|
| 3: слишком короткая логистика | Пять ранних ресурсов дальше и в разных направлениях; вода/обход суши; follow camera | balance_fast/reference.json, world tests | resource x/y/distance, arrival_radius | world-v03, navigation-v02, обе 34-chain | New Game, real click routes, camera A/C/E | FIXED |
| 4: большая доставка/магнит | Dock 38, pickup 26, фиксированная задержка появления и короткое attraction | balance JSON, economy.ts | deposit_radius, coin_radius, coin_speed, coin_delay_s, coin_scatter_radius | coins-v03, systems, gameplay-v02 | Отдельное движение к cash, worker reload, точная сумма | FIXED |
| 5: покупки тесно сгруппированы | Трюм юг, найм юго-восток, скоростной север; поздний storageUpgrade удалён от metal dock | balance JSON | purchase_points, purchase_radius=48 | world-v03, purchases-v03 | Keyboard/click/touch, physical stop, late dual-currency purchase | FIXED |
| 6: все будущие точки видны | Category/resource reveal по квесту, persistent opened state, owned/partial legacy сохраняют доступ | construction.ts, state.ts, save.ts, engine.ts, BayScene.ts, UI.ts, balance JSON | reveal_at_quest | purchases-v03, coins-v03 migration, progression | New Game без future circles, debug visibility, first/late fixtures | FIXED |
| 7: случайная оплата при движении | Фактическая скорость после коллизий, непрерывная остановка 0,25с; один ближайший offer | engine.ts, construction.ts, UI.ts, balance JSON | stationary_delay_s=.25, max_stationary_speed=5; прежние coin/metal rates | purchases-v03, gameplay-v02 | Pass-through funded → no pay; stop/pay; departure/reload; late coins+metal | FIXED |
| 8: большая карточка / маленький claim | Короткий title, bar/progress/reward; вся зелёная TASK COMPLETE карточка получает награду | UI.ts, style.css | нет новых economy values | quests-ui-v03, systems, gameplay-v02 | Pending reload, click reward/footer, native touch, repeated rewards | FIXED |
| 9: выплаты объединены | Один Cargo → один payout ID/value/provenance; новые deliveries не откладывают старые | economy.ts, state.ts, save.ts, BayScene.ts | coin_delay_s/scatter; max_coin_views только rendering | coins-v03, gameplay-v02, presentation-v02 | [5,5,1], collect 11; worker cash; 10000 payouts/reload | FIXED |
| 10: длинные ресурсные тексты | Ready: название; recovery: короткий timer; покупка: icon/remaining/name/ring | BayScene.ts, UI.ts | прежние цены | resource systems, geometry | Desktop/mobile screenshots reviewed, stock/HP остаются F2 | FIXED |
| 11: непосредственный Skip | Отдельная map SKIP → popup → Skip Now; Cancel; строго <60 free / ≥60 rewarded | BayScene.ts, UI.ts, main.ts | free_skip_below_s=60, fake_ad_s=2 без изменений | systems strict boundary + skip once | Map circle/proximity без popup; SKIP choice; Cancel/Free/Rewarded; natural finish closes popup | FIXED |
| 12: новая цель неизвестна | Общий resolver; smooth camera → hold → return; arrow/ring; input/purchases locked | guidance.ts, BayScene.ts, UI.ts, engine.ts, main.ts, balance JSON | camera durations, arrow_offset, ring_radius | quests-ui-v03 | Обе территории, координаты player прежние, rapid rewards, portrait target in viewport, return | FIXED |
| 13: Golden proximity / direct wallet | Tap-only; TAP/reward label; immutable snapshot; popup choice → fake ad → ten physical payouts | merchant.ts, engine.ts, economy.ts, state.ts, save.ts, BayScene.ts, UI.ts, balance JSON | label interval=3, scatter=64, count=10 | golden-v03 | No proximity; tap no waypoint; cancel twice; accepted expiry; 4/10 → reload 6/10; exact sum | FIXED |
| 13.7: rewarded смешан с продажами | source fish_sale/golden_reward; golden_collected отдельно; actual и sale quests исключают golden | economy.ts, engine.ts, state.ts | нет новых prices/rewards | golden-v03, systems, balance-v02 | Golden collection увеличивает только wallet, sale quest остаётся active | FIXED |
| 15: v3 save и прошлый прогресс | Exact backups; v1/v2 migration; preserve old stack values, orders, pending claim, profile keys | save.ts, state.ts, engine.ts, main.ts | save version=3, keys прежние | coins-v03, gameplay-v02, golden-v03, systems | Cash/partial/pending reload, profile isolation; v2 fixtures проверены автоматикой | FIXED |
| 14: mobile/readability | Компактный HUD/task, finger-size SKIP, joystick и tap popup | UI.ts, style.css, BayScene.ts | нет новых economy values | UI/controller regressions | 390×844 native Chromium touch; screenshots reviewed | FIXED в headless; реальные устройства PARTIAL |
| Performance: отдельные деньги растут | Culling/pool ≤180 coin views и ≤40 transient effects, O(N) collection, без economic merge | BayScene.ts, economy.ts, save.ts, balance JSON | max_coin_views=180, max_live_effects=40 | 1000 actual deliveries + distinct IDs/reload | 10000 payout stress + exact value/reload, engine/rAF timing | PARTIAL: пределы на реальном max fleet/mobile ещё не измерены |
| E: сохранение v0.2 scope | Catch/pickup/AI/repair/combat/metal/patrol/offline/debug сохранены | ранее перечисленные systems, обновлённые test fixtures | nominal balance неизменен | 82/82, две 34-chain и четыре unfunded first15 | 15 regression групп, production Edge, отдельный context | FIXED в автоматическом scope |

## Координаты и параметры до/после

Полная схема и дистанции — WORLD_LAYOUT_V03.md. Основные радиусы: deposit 105 → 38; coins 140 → 26; purchase 62 → 48; arrival 40 → 12. Рыболовный радиус 78 и скорость player 165 не менялись. Три ранних purchase points и пять ранних ресурсов перенесены. Дополнительно storageUpgrade (2510,1510) → (2600,1370): прежняя точка пересекала радиус разгрузки металла.

Новые числа в **обоих** JSON:

| Параметр | Значение |
|---|---:|
| interaction.purchase_stationary_delay_s | 0.25 |
| interaction.purchase_max_stationary_speed | 5 |
| interaction.coin_scatter_radius | 22 |
| presentation.camera_move_duration_s | 0.6 |
| presentation.camera_focus_duration_s | 1.5 |
| presentation.camera_return_duration_s | 0.6 |
| presentation.target_arrow_offset | 135 |
| presentation.target_ring_radius | 68 |
| presentation.golden_label_interval_s | 3 |
| presentation.golden_scatter_radius | 64 |
| presentation.golden_pile_count | 10 |
| presentation.max_coin_views | 180 |
| presentation.max_live_effects | 40 |

Reveal at quest: cargo 4, crab 5, worker 6, speedboat 9, mussel 11, snapper 13, tuna 14, gate 15, defender 16, lobster 18, storage 21, cutter 22, wreck 23, salvage 25, swordfish 27, storageUpgrade 30, den 31, squid 32, route 34. Sardine открыта изначально. Повторные upgrades/workers не зависят от текущего задания после открытия категории. `max_coin_stacks=12` сохранён в старой схеме конфига для совместимости, больше не ограничивает payouts; visual limit находится в presentation.

## Миграция и события

v1/v2 → v3, `<profile key>_backup_before_v03` хранит исходный JSON; v1 также имеет v02 backup. Старые агрегированные coin stacks остаются точными исходными суммами с source=fish_sale. Уже собранные продажи не материализуются ещё раз. Первая категория открывается по questIndex, существующим orders/owned state и запоминается. Неоплаченная стройка и pending quest не откатываются. Новый ID больше всех сохранённых. Перезагрузка прерванного fake ad возвращает offered, не выдаёт деньги; spawned транзакция сохраняет issued IDs, pending — только остаток.

Persistent: wallet, cargo, partial/build orders, pending payouts/provenance, quest/reward IDs, revealed categories, merchant snapshot/transaction. Transient: остановка/скорость, camera controller/highlight, waypoint, input locks, rendered objects/tweens. Старый save сбрасывать не нужно. Реальная пользовательская партия не открывалась: миграция проверена fixtures, предусмотрена ручная проверка без удаления данных.

События `coin_spawn` / `coin_collect` получают source и crate/boat либо transaction. Spawn содержит fromX/fromY и target x/y для визуального разлёта. `golden_offer`, `golden_reward_started`, `golden_reward_cancelled` связывают ID с snapshot; golden reward отмечает delivery=physical. Прежние события и экспорт CSV/JSON сохраняются; подробнее ARCHITECTURE.md.

## Изменившаяся экономика и границы

Цены, номиналы, quest rewards, workers/combat stats, build timers и базовая формула EstimatedEarnRate не изменены (структурное сравнение с backup для fast/reference). **Фактическая экономика изменилась** из-за логистики, небольшого pickup radius и stationary delay; другая геометрия также меняет EstimatedEarnRate и GoldenReward по прежней формуле. Доход/pacing нужно повторно измерить человеком. First15 scripted sanity не заменяет этот замер.

Плотные выплаты не объединяются. Visual limits защищают renderer; объём persistent cash растёт при долгом AFK, возможны quota/FPS ограничения на слабых устройствах. Полный hardware playtest, alt-tab и реальный max fleet остаются PARTIAL; v0.4 не начиналась.
