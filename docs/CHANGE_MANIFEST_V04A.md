# Change manifest v0.4a

Изменения только в fishing-game/. Каталог не является Git repository; исходный snapshot — `.local/v04a-baseline/`, source diff получен `git -c core.autocrlf=false diff --no-index -- .local/v04a-baseline/src src` и сохранён в `.local/v04a-source.diff`. Постатейный баланс — `BALANCE_V04A_COMPARISON.csv`.

| Группа | Файлы / причина |
|---|---|
| Runtime JSON | public/balance/balance_fast.json, balance_reference.json — FAST pacing и REFERENCE source values |
| Расчёт экономики | src/game/systems/economy.ts — worker rounding 1.0.2, float32 outer Golden multiplication |
| Найм | src/game/systems/construction.ts — optional JSON timers для salvage, scalar fallback |
| Schema/config | src/config/types.ts, load.ts — optional timers_s и валидация; save schema не меняется |
| Тесты | tests/balance-v04a.test.ts (новый), fixtures/balance-v032-baseline.json (новый), systems.test.ts, corrections-v031.test.ts — новые правила и сохранение scope |
| Анализ | scripts/balance-model-v04a.ts, balance-v04a.mjs, balance-stress-v04a.mjs, balance-reports-v04a.mjs, source-evidence-v04a.py (новые) |
| Browser | scripts/browser-v04a.mjs (новый); browser-smoke.mjs — явный technical rewarded timer fixture |
| Quest export | scripts/quest-table.mjs — единая runtime цена worker, salvage timers, модельные времена |
| Документы | четыре обязательных v04a отчёта, QUEST_AUDIT_V04A.csv, QUESTS.md/csv, BALANCE_ASSUMPTIONS.md, NEXT_STEPS.md, README.md, этот manifest |
| Package | package.json/lock — версия0.4.0-alpha.1 и analysis/smoke команды; зависимости не менялись |

`test-results/v04a/source-hashes.json` проверяет все production source файлы против snapshot: изменились только четыре перечисленных TS файла. Engine, resources, workers, save, combat, movement, guidance, scene, UI/joystick, main и CSS совпадают. JSON world/units/navigation/interaction/docks/combat/presentation/save/AI и все34 quest definitions защищены тестом против frozen v0.3.2.

Research/АПК/handoff, арт, карта, причалы и fishing-game.zip не изменялись. Production dist пересобран. Новые отчёты и тестовые артефакты лежат в test-results/v04a; исторические UX screenshot names могли обновиться при запуске существующего test:ux, их копии сохранены в v04a. Пользовательский browser storage не используется: smoke создаёт новые contexts.
