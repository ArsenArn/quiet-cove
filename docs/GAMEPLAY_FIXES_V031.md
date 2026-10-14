# Gameplay Corrections v0.3.1 — девять исправлений

Дата: 2026-10-13. Работа только внутри fishing-game/. Baseline v0.3: build PASS, 82/82 tests и 15 regression renderer smoke групп PASS. Backup: .local/v031-backup-20261013/. Каталог без Git; [CHANGE_MANIFEST_V031](CHANGE_MANIFEST_V031.md) и .local/v031-source.diff показывают изменения. Research, APK/XAPK, handoff и существующие пользовательские saves не изменялись.

FIXED ниже означает реализацию, автоматические проверки и настоящий headless Phaser renderer. Это не утверждение о завершённом ручном прохождении на физических телефонах. Эти аппаратные границы остаются PARTIAL, см. VALIDATION_V031.md.

| № / Проблема | Реализованное решение | Изменённые файлы | Конфигурация | Автоматические проверки | Browser smoke | Статус |
|---|---|---|---|---|---|---|
| 1 / Guidance блокировал лодку | showQuestHint не блокирует Engine и не сбрасывает joystick/keyboard. Input прерывает focus: return из текущего camera midpoint к движущемуся player, один controller без конкурирующих tweens. | src/game/scenes/BayScene.ts, src/game/systems/guidance.ts, src/ui/UI.ts, src/main.ts | Новых duration нет; прежние camera_move/focus/return сохраняются | corrections-v031: реальное движение и smooth interrupt; quests-ui-v03: replace/return и отдельный modal lock | Target cargo показан, D движет лодку и отменяет hint, FOLLOW восстанавливается; native touch claim при активном joystick | FIXED; physical devices PARTIAL |
| 2 / Подбор денег слишком точный | Attraction radius 26→38; один payout/ID/value/source, collection один раз, сохранение pending и availableAt | оба balance JSON; spawnCoins в economy.ts также копирует только x/y из переданной Point | interaction.coin_radius=38 | coins-v03, golden-v03: вне radius нет attraction, внутри плавный pickup; exact totals/IDs/reload | Продажа и golden физически собраны в Engine renderer; реальные маршруты cash в regression | FIXED |
| 3 / Автопокупка следующего объекта | Persistent guard по purchase category; cooldown после paid и completion/Skip. Нужно выйти за radius+hysteresis и снова остановиться внутри. Стояние после cooldown не платит; новый offer ID той же категории сохраняет guard. | construction.ts, state.ts, save.ts, оба balance JSON | purchase_cooldown_s=5, purchase_exit_hysteresis=10 | corrections-v031: cargo/worker/salvage, >5с внутри, reload, дрожание границы, cooldown после раннего re-entry, free/rewarded special | Natural cargo finish, 5.3с внутри, reload, реальный D/A выход/возврат; worker Free Skip без следующего платежа | FIXED |
| 4 / Дорогой pour длился минуты | Кривая cumulative target от цены и paid fraction, independent clocks coins/metal; целые списания без frame-rounding loss. При нехватке funds сохраняется paid, clock возвращается к actual fraction, продолжение плавное. | construction.ts, оба balance JSON; обновлены прежние rate assertions | min_seconds=1, max_seconds=3, ease=1.4, cost_scale=100 | Цены 100/12000/97500 закрываются в 1–3с, точная сумма events; partial, reload, dual currency, движение | 12000 defender: 3.25с включая stop .25с; partial worker20/reload/остаток55; old two-currency unit/regression | FIXED |
| 5 / Круги покупок казались случайными в воде | Cargo юг, worker запад, speedboat север центрального острова; деревянные заменяемые причалы/оборудование. Defender получает патрульный причал острова склада. Центры на воде за пирсами, навигация/островные коллизии сохранены. | оба balance JSON, BayScene.ts, types.ts/load.ts, WORLD_LAYOUT_V031.md | docks anchors/end/width/equipment/zone; purchase_points | world-v03 + corrections-v031: water/clearSegment routes, non-overlap, связь берегового anchor и свободного центра, отступ от unload/resource | Regression реальные обходы суши и порт; live defender payment; hub/patrol screenshots просмотрены | FIXED; solid pier physics намеренно не вводилась |
| 6 / Golden не шёл в Earn Coins | Единый creditIncome классифицирует fish_sale/golden_reward/quest_reward/debug_grant. earn_coins только первые два и только при физическом collection; fish_sales_earned/ActualRate остаются sale-only. Общие income quests меняют condition на earn_coins, остальная семантика сохраняется. | economy.ts, quests.ts, state.ts, save.ts, UI.ts, types/load.ts, оба balance JSON; docs/QUESTS.md/csv | Новых денежных номиналов/цен нет; source counters и income_sources_v031 feature marker | 100gold+100fish→200; quest/debug исключены; half ten piles→50, reload remaining→100, no duplicate; v03 baseline migration | Golden offer/ad/ten physical piles, pending0, collected100→100/200, fish100→complete; claim/debug/reload без дополнительного earn | FIXED; старый debug income исторически неизвестен |
| 7 / Слишком мало drops | Полная HP-порция завершает добычу и выбрасывает 8/15 distinct reachable crates с burst эффектом. Lifetime и глобальный cap; существующий crate preemption/reservation сохранён. Overflow новых drops пропускается. | resources.ts, workers.ts, state.ts, save.ts, BayScene.ts, types/load.ts, оба balance JSON | drop_crates=8/15, max_world_resource_crates=150, floating_crate_lifetime_s=60, resource_burst.duration_s=.35 | cap148→150, suppression count, expiry/reload/offline без cash, уникальность, player/worker/reservation/resume | Настоящий FAST8/REFERENCE15 burst, persisted deadline, player/worker collection, offline expiry; 150-crate renderer/Engine sample | FIXED; max-fleet/device FPS PARTIAL |
| 8 / Квест убийств показывал защитника | Универсальный questFocusTarget pirates_killed→combat.spawner; target наблюдения на rock не сдвигается water correction. Defender quest отдельно→purchase dock. | guidance.ts | Прежний combat.spawner (2750,1100) | All34 resolver, точный den центр, defender dock, reload | Стрелка/кольцо над den, затем FOLLOW; defender quest показывает свой причал | FIXED |
| 9 / Джойстик был mobile-only и ненадёжный | Выделенный Joystick с capture первого pointer, deadzone и normalized vector. Mouse drag и touch360°, keyboard priority. Release/cancel/lostcapture/blur/hidden/modal сбрасывают управление. Secondary touch tap по UI обрабатывается явно с drag rejection; claim не сбрасывает первый палец. Touch по воде не включает click-to-move. | src/ui/Joystick.ts, UI.ts/style.css, BayScene.ts, main.ts, types/load.ts, оба balance JSON | radius=59, deadzone=.12, opacity=.65, thumb_radius=24, ui_tap_slop=12 | 7 vector/deadzone/direction cases + Engine norm; config validation | Real mouse drag за пределами pad, release, WASD, lostcapture/blur/modal; CDP native touch movement, второй палец claim/help, mobile Golden tap, 390×844 layout | FIXED в renderer; физические Android/iOS PARTIAL |

## Новые/изменённые параметры

Параметры одинаковы в обоих профилях, кроме drop_crates. Все добавлены в JSON и доступны в F2 numeric configuration. Профили и speeds сохранены.

| Путь | Значение / назначение |
|---|---|
| interaction.coin_radius | 38 (было26) |
| interaction.purchase_cooldown_s | 5 игровых секунд |
| interaction.purchase_exit_hysteresis | 10; exit строго за48+10 |
| interaction.purchase_pour_min_seconds | 1 |
| interaction.purchase_pour_max_seconds | 3 |
| interaction.purchase_pour_ease | 1.4 |
| interaction.purchase_pour_cost_scale | 100; мягкое приближение duration к max |
| interaction.joystick_radius | 59 CSS px (внешний круг) |
| interaction.joystick_deadzone | 0.12 от thumb travel radius |
| interaction.joystick_opacity | 0.65 |
| interaction.joystick_thumb_radius | 24 CSS px |
| interaction.ui_tap_slop | 12 CSS px; вторичный тап по UI |
| resources.*.drop_crates | FAST8 / REFERENCE15 |
| world.max_world_resource_crates | 150 |
| world.floating_crate_lifetime_s | 60 игровых секунд |
| resource_burst.duration_s | .35 игровых секунд |
| docks | Четыре data-driven pier records; координаты в WORLD_LAYOUT_V031.md |
| interaction.purchase_points | cargo(880,1530), worker(670,1340), speedboat(880,1150) |

Старые coins_per_s/metal_per_s сохранены в schema/config для совместимости, но больше не задают темп gameplay pour. Duration=min+(max-min)*cost/(cost+scale), target=floor(cost*(elapsed/duration)^ease). Проектная формула не названа реконструкцией оригинала.

## Сохранения и экономика

Нет reset и нового profile key. Version=3, совместимые optional fields и idempotent feature migration с raw backup_before_v031. Guards, expiry deadlines и income stats persistent; camera/vector/capture/pour clocks transient. Старый active income baseline учитывает historical golden offset, не начисляя прошлый доход заново. Дробные partial paid tails возвращаются в ту же валюту; wallet+paid сохраняется. Pending golden, payout IDs и completed_unclaimed сохраняются прежним pipeline. Legacy >150 crates не обрезаются; новые не спавнятся, пока нет места. Historical debug grants не угадываются.

Три экономические изменения: быстрый pour, qualifying golden income, рост free drops. Цены/номиналы/rewards/HP/stock/timers/units/combat не менялись и защищены fixture comparison. Подробнее BALANCE_ASSUMPTIONS.md; полный баланс и natural pacing оставлены v0.4. Матрица реализации не заменяет ручное прохождение.
