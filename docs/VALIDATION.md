# Проверки v0.2

Дата: 2026-10-12. Проверки из `fishing-game/`, пользовательские localStorage-партии не открывались smoke-тестом.

| Проверка | Результат | Граница вывода |
|---|---|---|
| A | build passed; 46/46 tests; Edge smoke passed | Основные физические оплаты, pending claims, cash/reload, desktop/mobile |
| B | build passed; 53/53 tests; extended smoke passed | Geometry/reachability, coast/route, exact Phaser smoothing reproduction, visibility listener, first-15 sanity |
| C / итоговый test suite | build passed; 58/58 tests, 6 files | Patrol/spawner/merchant/continuous delivery added; no console errors in extended smoke |
| Полная кампания | Обе 34-chain funded integration passed | 10 000 000 стартовых тестовых монет; не баланс и не естественный browser playtest |
| First 15 economy | 4 unfunded controller runs passed | fast/reference с/без golden, physical payments, реальная симуляция; один seed, scripted активный player |
| Desktop/mobile renderer | 1440×900 и 390×844, joystick, no horizontal overflow | Headless Edge; не физический Android/iOS |
| Visibility | suspend/resume, exact normal speed, first-frame clamp passed | Native listener детерминированными событиями; реальный headless tab switch не меняет hidden |
| Saves | partial orders, pending cash/quest, once rewards, profile switch/reset, v1 backup tests passed | Реальная старая партия пользователя ещё требует ручного подтверждения |

## Browser smoke

`scripts/browser-smoke.mjs` создаёт отдельный новый context. Ранние catch/delivery/claim выполняются через настоящие UI/маршруты. Для поздних сцен создаются явные fixtures с тестовыми деньгами/сущностями; движение, renderer, combat, оплаты, timers и fake ad действуют через текущую игру.

Проверяет: зелёный pending/reload/claim, разделённые события доставки и сбора, proximity payment/leave/reload, деньги рабочих после reload, обход острова и water dock, pause/resume listener и скорость, HUD grouping/metal, individual rings/новый crate priority, patrol-combat-patrol, den countdown/limit/closed, golden movement/click cancel/proximity claim once, Free/Rewarded Skip с карты, profile isolation и reset/pagehide. School recovery отдельным подготовленным сценарием.

Снимки desktop.png/mobile.png/gather-v02.png/spawner-v02.png/golden-v02.png просмотрены для проверки layout. Стройка/цена находится над или под зоной, чтобы не перекрывать лодку и название ресурса; подписи также кликабельны. Основной справочник закрыт, HUD/quest и F2 доступны.

## Команды

```sh
npm run build
npm test
npm run quests
npm run test:smoke
```

Production: `npm run preview`, затем `SMOKE_URL=http://127.0.0.1:4173` и `npm run test:smoke`. Production preview smoke на http://127.0.0.1:4173: **PASSED**, 15 групп проверок, console/page errors: 0. Журнал — `test-results/production-smoke.log`; команды и fixture-сценарии одинаковы с dev.

## Непроверенное

Полный natural human playtest, привычное переключение вкладок/alt-tab, реальные телефоны/ориентации, all-34 browser progression, max fleet FPS, несколько RNG seeds. B2 и B4 PARTIAL; это не скрытые ошибки тестов. Локальная копия v0.1 в test-results служит источником до/после; отдельный clean-install v0.2 не проводился. Vite крупный Phaser vendor warning ожидаем, build успешен.
