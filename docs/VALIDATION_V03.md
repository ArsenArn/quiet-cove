# Проверки Gameplay & UX v0.3

Исходное состояние 2026-10-12: v0.2, build PASSED; Vitest 58/58, 6 файлов; dev smoke PASSED в headless Edge, 15 групп, 0 console/page errors. Сервер этой работы: 127.0.0.1:5174 (5173 уже занят). Каталог без Git. Исходные файлы сохранены в `.local/v02-backup-20261012/`, которая исключена `.gitignore`. Сохранения пользователя не читались и не сбрасывались.

Smoke использует отдельный browser context; поздние механики проверяются подготовленными fixtures. Это проверка настоящего Phaser renderer, а не естественное прохождение человеком. Реальные телефоны и ручное измерение pacing требуют отдельной проверки.

Этап A: build PASSED, 64/64 tests (8 файлов); Edge smoke PASSED, 15 групп, 0 console/page errors. Vitest ограничен `tests/**/*.test.ts`, чтобы не запускать копии из локального backup. Старые изолированные system fixtures явно раскрывают категории; новые v03 tests проверяют последовательное раскрытие. Smoke подбирает оставшиеся деньги отдельным движением — новый небольшой радиус требует этого.

Этап B: build PASSED; 68/68 tests, 9 файлов; regression Edge smoke PASSED (15 групп), focused v03-B smoke PASSED (5 групп). Журнал `test-results/v03-B-smoke.json`; desktop/mobile snapshots. Проверены отдельные [5,5,1], reload, новые radius/stop, компактный UI, отдельный SKIP и popup, Free/Rewarded Cancel/Confirm.

Этап C: build PASSED, 72/72 tests (10 файлов), focused v03-C smoke PASSED (6 групп), 0 console/page errors. Камера в обеих территориях, player invariant, блок управления, full-card claim, safe replacement при быстрых наградах, удаление highlight и return проверены в renderer. Скриншоты `v03-camera-first.png` и `v03-camera-second.png`.

## Итоговые D / E

| Проверка | Результат | Граница |
|---|---|---|
| D production build / tests | PASSED; 82/82, 11 файлов | Golden transaction, snapshot, integer split, sources и reload |
| D focused production smoke | PASSED, 7 групп, 0 console/page errors | test-results/v03-D-smoke.json |
| E final build / tests после переноса storageUpgrade | PASSED; 82/82, 11 файлов | Суша/пути, несовместимые зоны, оба причала и весь regression |
| E focused production Edge smoke | PASSED, 10 групп, 0 console/page errors | test-results/v03-E-smoke.json |
| E regression production Edge smoke | PASSED, 15 групп, 0 console/page errors | Manual fishing, workers/speedboat, pending/partial/reload, route/recovery, combat/defender, metal HUD, timer/spawner, Golden tap, profiles/debug |
| Полные 34 quests | Обе funded integration PASSED | Реальные headless маршруты/AI/combat/salvage; funded fixtures, не natural pacing |
| First15 | 4 unfunded runs PASSED | fast/reference с/без Golden, physical payments и collection; scripted controller |
| Quest table | npm run quests PASSED: 68 rows | 34 строки каждого runtime профиля; количество и условия не изменялись |
| Desktop/portrait | 1440×900 и 390×844 PASSED | Playwright Chromium touch/joystick, не физический Android/iOS |
| Migration | v1/v2→v3 fixtures PASSED | Реальная пользовательская партия не читалась; raw backup/profile isolation проверены |

Focused E проверяет по порядку: новые hidden purchases; keyboard pass-through без оплаты; остановка и возобновление; [5,5,1] и exact 11 после reload/pickup; отдельный SKIP, Cancel, Free/Rewarded и автоматическое закрытие естественно завершившегося заказа; full-card claim и camera/arrow/ring/return в двух территориях; tap-only Golden с альтернативной подписью, frozen snapshot, отказом и отменой ad; ad принят до expiry и подтверждён после него; ровно десять кучек, четыре собраны и после reload шесть, wallet равен snapshot и sale quest не засчитывается; portrait native touch для claim/joystick/Golden; поздняя оплата склада монетами и металлом с отдельной water purchase point; массовый cash и reload.

Late storage fixture изолирует combat и использует существующий debug speed x10, чтобы не ждать 65с платежа в smoke. Combat проверяется отдельно regression smoke и full-chain integration. Golden частичный сбор использует явные fixture-позиции с настоящим Engine collection; завершение сбора — реальное click-to-move. Не выдаём fixtures за ручное прохождение.

## Производительность и данные

`test-results/v03-performance.json`: **10000** уникальных pending payouts на **20000** монет, **180** active views, max **40** transient effects. После reload те же 10000 выплат и точная сумма. В последнем headless запуске: engine step p95 **0,60мс**, rAF median **18,2мс**, p95 **30,4мс**. CPU/renderer sampling на этой машине; фоновые browser проверки и headless влияют на кадры. Это не гарантия FPS телефона или максимального игрового флота. Automatic 1000 worker-delivery test проверяет индивидуальность, total, ID и save; в benchmark 10000 выплат подготовлены fixture.

Суммы не агрегируются ради rendering cap. Очень длительное накопление растит state и localStorage; риск quota и FPS на слабых устройствах остаётся. Прозрачная граница **PARTIAL**: real max fleet/mobile, длинный AFK, плотные coin labels и долгие сессии.

## Визуальная проверка

Просмотрены desktop/mobile screenshots, camera first/second, portrait target highlight, mobile Golden popup и ten piles. Зелёная карточка компактна и целиком доступна; popup помещается; joystick свободен; target виден в portrait viewport; arrow/ring и номиналы десятка кучек читаются. Реальные устройства, landscape и hardware FPS требуют ручной проверки.

## Команды

```powershell
npm run build
npm test
npm run quests
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174 --strictPort
$env:SMOKE_URL='http://127.0.0.1:4174'
npm run test:smoke
$env:SMOKE_STAGE='E'
npm run test:ux
```

Production preview smoke использует готовый `dist` и HTTP balance JSON, без Vite HMR. Первый dev server оставался на 5174; другой уже запущенный сервер 5173 не затронут. Source diff — `.local/v03-source.diff`, SHA256 manifest — docs/CHANGE_MANIFEST_V03.md. Существующие tests не удалены: old isolated fixtures раскрывают категории, proximity test ждёт stationary delay, bounded-stack assertions заменены на per-delivery conservation, Golden tests/controllers используют offer→begin→physical claim/pickup. Vitest исключает backup через bounded include.

## Непроверенное

Natural human campaign/доход/pacing, реальные телефоны/альбом, аппаратный max fleet/квота и обычный alt-tab. Headless visibility — детерминированный listener, не настоящая смена вкладок ОС. Сброс saves не нужен, original backups сохранены. В обеих конфигурациях структурно подтверждена неизменность prices/rewards/units/combat/resource economics/build timers; новые расстояния меняют фактический доход и EstimatedEarnRate. Vite предупреждает о размере Phaser vendor chunk; production build успешен. v0.4 не начиналась.
