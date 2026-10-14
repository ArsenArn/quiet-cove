# Analytics validation v0.7a

Дата: 2026-10-13. Изменения ограничены fishing-game. Аналитика использует observer существующего log; Engine и gameplay systems не переписаны. FAST/REFERENCE JSON не изменялись. Не создавались Git commits, публикация или новая save schema.

## Baseline

`npm run build` PASSED; `npm test`: 187/187, 20 test files. Сохранился штатный Vite warning о большом Phaser chunk.

## Automated checks

| Проверка | Результат |
|---|---|
| Final `npm run build` | PASSED |
| Final `npm test` | 218/218 PASSED, 21 файлов |
| Новые analytics tests | 31/31 PASSED |
| Production Edge analytics browser | 9 групп PASSED, 0 console/page errors |
| Production Edge regression smoke | 15 групп PASSED, 0 console/page errors |
| Scripted unfunded FAST export | 34/34 completed и claimed; обе ledger residual=0 |

Long-session clock test получил собственный timeout 30с: при параллельном full suite искусственное построение сотен snapshots занимает около 8.5с; проверки объёма/данных не ослаблялись. Полный suite после этого изменения прошёл.

Финальные результаты и команды приведены ниже. Основной новый suite: `tests/analytics-v07a.test.ts`. Он проверяет OFF, Start без reset/save mutation, quest activate/complete/claim, reward once, zero-duration, midgame baseline, pending vs collected coins, partial/full prices, workers/unlocks, Golden income, free/rewarded skips, debug contamination, F2 display-only, snapshots, active-time pause, reload, independent-checkpoint adjustment, Stop, export, Clear, profile isolation, bounded long recording, storage errors, resource/crate counters и game-state equivalence ON/OFF.

Полный unfunded FAST прогон использует существующий `balance-model-v04a.ts` controller с observer hooks. Он управляет настоящим Engine через input/legitimate APIs и проходит 34 задания без грантов, Golden или timer skip. Это scripted traversal, не человек.

Артефакты: `test-results/v07a/playtest_FAST_scripted_34.json` и `scripted-validation.json`. Файл действительно записан на диск и прочитан JSON parser обратно. Проверены unique event IDs, chronological wall/active/game times и UTC timestamps, nonnegative quest durations, отсутствие duplicate claims/undefined/nonfinite values, соответствие event interval totals ресурсам и money aggregates, final snapshot и summary.

Сверка scripted FAST:

| Валюта | Initial | Earned | Spent | Adjustments | Final | Residual |
|---|---:|---:|---:|---:|---:|---:|
| Coins | 0 | 88990 | 80368 | 0 | 8622 | 0 |
| Metal | 0 | 290 | 160 | 0 | 130 | 0 |

Получены все 34 completion/claim timing rows. Время scripted controller около 1933.4с; это не оценка реального человеческого pacing. Полнота 34-chain не подтверждает naturally guided 5–10 минут.

## Browser validation

Production preview: `http://127.0.0.1:5180`; отдельные headless Edge contexts, пользовательские browser saves не читались.

`npm run test:analytics-browser`: F2 controls, OFF/Start, реальный download+parser, real navigation к сардине/порту/монетам, manual quest claim, periodic snapshot, отсутствие contamination, IndexedDB reload, pause/resume, UI debug grants, Golden fake-ad cancel/complete, Stop/frozen export, confirmed Clear/cancel без game-save mutation, desktop 1440×900 / portrait 390×844, New Game и profile boundaries.

`npm run test:smoke`: 15 существующих regression groups — quests/reload/rewards, physical cash, gradual payment/construction, workers, navigation, visibility lifecycle, resources, cargo, combat, Golden, portrait joystick, free/rewarded skips, profile saves и reset. Отчёт: `test-results/v07a/regression/report.json`.

Focused report/downloads: `test-results/v07a/browser-validation.json`, `playtest_FAST_browser_stopped.json`, автоматический `playtest_FAST_<date>_<id>.json`. Screenshots `analytics-desktop.png`, `analytics-mobile.png` просмотрены: controls/status/count помещаются, используется прежний стиль debug panel, horizontal overflow отсутствует.

## Повторный запуск

```sh
npm run build
npm test
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5180 --strictPort
```

В другом терминале PowerShell:

```powershell
$env:SMOKE_URL='http://127.0.0.1:5180'
npm run test:analytics-browser
$env:SMOKE_OUTPUT='test-results/v07a/regression'
npm run test:smoke
```

`npm run test:analytics` повторяет целевой unit/integration suite и пересоздаёт scripted export. Browser scripts используют только собственные isolated contexts.

## Ограничения проверки

Headless visibility проверяет deterministic lifecycle boundary; настоящий OS alt-tab и реальные телефоны не измерялись. Длинная запись проверена искусственными clock steps до ограничения snapshots, не многочасовым ручным запуском. Аварийное закрытие браузера может потерять незавершённый асинхронный flush; unknown/reconciliation adjustment явно отмечаются. Idle time AI не реконструируется. Производительность обычных существующих tests и browser smoke сохранилась, отдельный hardware benchmark не выполнен.

## Изменённые файлы

- `src/analytics/playtest.ts`, `src/analytics/storage.ts`: observer, clocks, ledger, persistence, export.
- `src/debug/events.ts`: безопасная подписка на существующий log, вне gameplay save.
- `src/main.ts`: storage bootstrap, lifecycle, periodic sample и New Game boundary.
- `src/ui/UI.ts`: раздел F2, подробные debug payloads, fake-ad events, profile boundary.
- `scripts/balance-model-v04a.ts`: optional observer hooks для scripted validation; поведение controller без hooks прежнее.
- `tests/analytics-v07a.test.ts`, `scripts/browser-analytics-v07a.mjs`, `package.json`: проверки и команды запуска.
- README и три документа v07a; новые артефакты в `test-results/v07a/`.

Каталог без Git, поэтому git diff недоступен. Gameplay protection дополнительно подтверждают existing economy/AI/progression/regression tests и прямое сравнение одинаковых симуляций с Analytics ON/OFF.
