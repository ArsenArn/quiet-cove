# Проверки v0.3.1

Дата: 2026-10-13. Scope только fishing-game/. Production preview: http://127.0.0.1:4175, отдельный headless Edge context каждого smoke. Пользовательская browser партия не читалась, не удалялась и не использовалась как fixture. Backup исходников .local/v031-backup-20261013/ игнорируется Git. Каталог не является Git repo: файловый diff и manifest вместо git diff.

| Проверка | Результат | Граница |
|---|---|---|
| Baseline v0.3 | build PASS, 82/82 tests (11 файлов), 15 regression smoke групп PASS | Старое стабильное поведение до правок |
| После core changes | build PASS; ожидаемые старые rate/fish-only assertions обновлены без удаления тестов | Новые семантики, прежние cases сохранены |
| Итог build / Vitest | **PASS, 116/116 tests, 12 файлов** | 82 прежних +34 новых; состав кейсов corrections-v031.test.ts |
| Полные quests | Обе funded all34 PASS | Реальные headless movement/AI/combat/salvage; funded не natural pacing |
| First15 | 4 unfunded runs PASS (fast/reference, golden off/on) | Scripted controller делает exit/re-entry; earn progress fish+golden |
| Config protection | PASS | Fixture v0.3 защищает цены/rewards/resource values/HP/stock/timers/units/combat |
| Quest table | npm run quests PASS, 68 runtime rows | 34 задания каждого профиля, обновлён общий income condition |
| Regression production smoke | **PASS, 15 групп, 0 console/page errors** | Manual fishing, workers/speedboat, unloading, partial/claim/reload, timers Free/Rewarded, patrol/combat, salvage HUD, golden/profile/debug |
| v0.3.1 focused production smoke | **PASS, 10 групп, 0 console/page errors** | scripts/browser-v031.mjs, test-results/v031-smoke.json |
| Desktop / portrait | 1440×900 и390×844 PASS | Mouse drag, native CDP touch, real Phaser renderer; не физический телефон |
| Migration | v1/v2→v3 и v03→v031 features PASS | Raw backup, wallet+paid, historical income baseline, pending piles/IDs, repeated load, guard corruption reject |

## Focused renderer scenarios

1. Desktop mouse joystick: drag за pad удерживает capture; direction/diagonal, deadzone, release stop; WASD продолжает работать.
2. Blur/lost capture/modal: vector/thumb/capture сбрасываются, лодка не плывёт скрыто; после закрытия управление работает. Headless blur — событие, настоящий OS alt-tab требует ручной проверки.
3. Camera: Engine unlocked, D движет лодку в focus и запускает smooth RETURN, FOLLOW восстанавливается. Cargo coordinates из нового JSON, pirate quest — den, defender quest — pier.
4. Natural cargo finish: после >5с внутри новый заказ не появляется; reload сохраняет guard; реальный D/A exit и return разрешает следующий pour.
5. Live defender12000: **3.25с wall-clock с учётом stationary .25с**, exact paid12000/wallet0 при speed1. Game pour duration≈2.98с; build120с не изменён.
6. Worker partial20, reload, remaining55, Free Skip и отсутствие worker1 payment без re-entry.
7. Golden tap/ad: ten physical payouts, pending income0, golden100→100/200, fish100→complete. Quest/debug/reload не добавляют qualifying доход. Half-pile collection и no duplicate подробнее в unit golden/corrections tests; browser gold piles для income scenario размещены fixture рядом для точного collection через настоящий Engine.
8. FAST8/REFERENCE15 depletion burst, distinct visible positions, сохранённый lifetime deadline, player+worker collection, offline expiry без payouts. Counts проверены до pickup; отдельный cap test148→150. Renderer stress использует fixture150 actual crate records.
9. Portrait: native continuous touch, вторичный палец получает quest reward без сброса первого; secondary help tap открывает modal и прекращает joystick. После release нет движения; touch по воде не задаёт путь; Golden tap открывает popup без navigation. UI помещается без overflow.
10. Local renderer/Engine sample150 crates, без crashes/errors. Ниже — замер этой машины.

Первые smoke итерации обнаружили необходимость secondary touch activation: браузер не синтезирует click для второго пальца при занятом primary pointer. Обработчик pointerup с tap-slop использует тот же button/card click path. В CDP touchEnd touchPoints обозначают завершаемые пальцы: сценарий явно завершает second/helpFinger, сохраняя primary. Сценарии не подменяют движение UI рисованной заглушкой.

## Производительность и визуальная проверка

test-results/v031-performance.json: 150 floating crates; Engine step p95 **0.10мс**; rAF median **24.2мс**, p95 **30.3мс**. 120 Engine samples и90 renderer frames. Последний замер выполнялся параллельно regression браузеру; фоновые процессы влияют на rAF. Локальный headless замер на этой машине не гарантирует FPS на телефоне/max fleet. Прежний max_coin_views180 и max_live_effects40 сохранены; payout data ради render cap не теряется.

Просмотрены screenshots: v031-hub.png (три стороны острова и оборудование), v031-patrol-dock.png (defender water centre/стройка), v031-pirate-guidance.png (den arrow/ring), v031-mobile.png (свободный joystick/compact HUD), v031-mobile-golden.png (popup), v031-fast-burst.png иv031-reference-burst.png (drops). Art procedural placeholders, не финальные assets.

## Команды воспроизведения

```powershell
npm run build
npm test
npm run quests
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4175 --strictPort
$env:SMOKE_URL='http://127.0.0.1:4175'
npm run test:smoke
npm run test:corrections
```

`test:ux` alias нового focused smoke. Старый browser-v03.mjs сохранён как historical сценарий прежней версии, с прежними ожиданиями, не текущий acceptance runner. Smoke создаёт собственные contexts и test-results, reset fixtures не затрагивает browser data пользователя.

## Оставшиеся ручные проверки

Android/iOS portrait+landscape, настоящие multitouch/system gestures, реальный focus/alt-tab и full natural campaign/pacing обоих профилей. Длительный max-fleet/AFK, storage quota, densely stacked coin labels и device FPS PARTIAL. Точное historical debug income неизвестно; current source counters отслеживают новые grants. Реальный старый save не открывался: сначала проверять копию, исходник получает backup автоматически, reset не требуется.

Production build успешен; прежнее Vite предупреждение о большом Phaser vendor chunk осталось. Исходные цены/rewards/timers не менялись. v0.4 не начиналась.
