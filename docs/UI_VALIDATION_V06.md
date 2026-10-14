# Тихая бухта — UI validation v0.6

Дата: 2026-10-13. Приложенный макет — утверждённая спецификация. Финальные visual screenshots сняты в настоящем Chromium/Edge WebGL renderer с production preview `http://127.0.0.1:4197`, 1440×900 desktop и 390×844 portrait. Проверки выполняются в изолированных browser contexts; поздние состояния подготовлены fixtures через исходные engine/UI hooks.

## Проверки

| Проверка | Результат | Свидетельство |
|---|---|---|
| `npm run build` | PASSED | TypeScript и Vite; final app 136.76 kB / gzip 46.21 kB; прежний отдельный Phaser chunk 1.48 MB |
| `npm test` | PASSED — 179/179, 18 файлов | Economy, progression обоих profiles, workers/traffic, save, combat, Golden, purchase, joystick/presentation |
| `node scripts/browser-ui-v06.mjs gameplay` | PASSED — 15 групп, 0 console/page errors | `../test-results/v06-approved/gameplay/report.json` |
| `node scripts/browser-ui-v06.mjs ux` | PASSED — 10 групп, 0 console/page errors | `../test-results/v06-approved/ux-smoke.json` |
| `node scripts/browser-ui-v06.mjs visual` | PASSED — 6 групп, 0 console/page errors | `../test-results/v06-approved/visual-report.json` |
| Performance baseline/current | Выполнен, см. таблицу ниже | `../test-results/v06-approved/performance.json` |

Gameplay runner переиспользует существующий browser-smoke.mjs; UX runner — существующий browser-v032.mjs. Сохранены уже имевшиеся в v06 адаптации legacy fixtures к арт-геометрии v05 и value-only metal HUD. Runtime rules и assertions наград/покупок не ослаблялись. Финальный gameplay прогон — production; UX — dev сервер той же реализации, после изменения компонентов/hitboxes.

Проверены реальные обновления coins/cargo/capacity/worker/metal HUD, quest progress и manual claim после reload, partial payment/exit/reload, timers и physical SKIP (Free/Rewarded с Cancel/Confirm), Golden map tap/transaction/physical reward один раз, resource recovery, route around land, defender combat, spawner timer, native PointerEvent/touch joystick, второй палец на UI, отмена input при modal и camera guidance, profile-isolated save/reset. Цели и поздние покупки не проверялись естественным прохождением человеком.

Responsive visual assertions: 320×740, 360×800, 390×844, 700×900, 820×900, 1024×768, 1440×900, 844×390; locked/unlocked metal, 6-digit wallet. Проверены containment HUD, отсутствие page/counter overflow, separation quest/HUD и видимость/размер nav hitboxes. Все 34 текста цели/награды помещаются в portrait-карточку. Проверены center/top/bottom hitboxes Phaser purchase label: клики направляют лодку, не запускают joystick.

## Снимки и сверка с макетом

Все перечисленные снимки были открыты и просмотрены при проверке. Это визуальная сверка оформления, не числовой pixel-diff: игровой мир и его состояния различаются.

| Требуемое состояние | Снимок | Сверка |
|---|---|---|
| Утверждённый источник | [approved-reference.png](../test-results/v06-approved/approved-reference.png) | Сохранён для review, не используется в runtime |
| Desktop starting bay | [desktop.png](../test-results/v06-approved/desktop.png) | Navy rounded HUD, wave mark, stat pills, cream compact quest, blue/orange/navy нижние кнопки |
| Desktop purchase zones | [buy-zones.png](../test-results/v06-approved/buy-zones.png) | Верхняя цена и coin, нижний cream nameplate; white circle + dashed inner ring |
| Completed quest | [completed.png](../test-results/v06-approved/completed.png) | Green TASK COMPLETE, цель/награда/ручное получение; вся карточка clickable |
| Golden Reward | [golden.png](../test-results/v06-approved/golden.png) | Cream rounded panel, existing golden boat art, restrained gold amount/button |
| Building/SKIP | [building-skip.png](../test-results/v06-approved/building-skip.png) | Clock badge, timer, gold primary / navy secondary |
| Mobile HUD/quest | [mobile.png](../test-results/v06-approved/mobile.png) | Два ряда HUD, самостоятельные размеры текста, читаемая цель |
| Mobile labels/buttons | [mobile-sea.png](../test-results/v06-approved/mobile-sea.png) | Player, purchase badge, warehouse, stacked nav и navy Объекты |
| Zone 2 | [zone2.png](../test-results/v06-approved/zone2.png) | Resource/navy label, defender purchase, metal/worker counters, pirate timer, warehouse |

Дополнительно просмотрены [completed-mobile.png](../test-results/v06-approved/completed-mobile.png), [free-skip.png](../test-results/v06-approved/free-skip.png), [rewarded.png](../test-results/v06-approved/rewarded.png), [help.png](../test-results/v06-approved/help.png), [objects.png](../test-results/v06-approved/objects.png).

После первого просмотра исправлены исчезавшие nav buttons (ошибка CSS selector), counter overflow в коротком landscape, пересечение player/purchase label и двойной boat frame в DOM. Финальные снимки отражают эти исправления.

Пропорции: quest width 356/1440 = 24.7% экрана, в источнике около 371/1506 = 24.6%. HUD 78 px высота против около 80 px в источнике; нижние desktop controls 70 px против около 75 px. Карточка 128 px минимальной высоты, растёт при переносе длинной цели. Title/card/button typography, borders, cream/navy/gold hierarchy и shadows проверены непосредственно на снимках.

## Performance

Отдельная baseline production сборка собрана из сохранённых исходных UI/BayScene и тех же текущих остальных файлов в `.local/v06-baseline/`. Сравнение в одном запуске Edge поочерёдно baseline/approved: 1440×900, fast/reference, 0/5/10 работников, 150 crates и 240 coin stacks, live simulation/combat, 600 ms прогрев и 2.5 s RAF sample.

| Profile | Workers | Baseline FPS | v0.6 FPS | Изменение |
|---|---:|---:|---:|---:|
| fast | 0 | 19.16 | 18.14 | -5.28% |
| fast | 5 | 18.48 | 17.62 | -4.65% |
| fast | 10 | 17.99 | 17.51 | -2.70% |
| reference | 0 | 18.96 | 18.14 | -4.30% |
| reference | 5 | 18.29 | 17.51 | -4.26% |
| reference | 10 | 17.41 | 17.32 | -0.52% |

Под большой нагрузкой среда headless выдаёт около 17–19 FPS для обеих реализаций. Новый UI в этом коротком замере ниже исходного на 0.52–5.28%; это наблюдение, а не доказательство отсутствия performance regression. p95 нового UI около 60.6–60.7 ms. Возможное влияние расписания/браузерной среды не отделено от затрат UI; реальный device benchmark не выполнен. После кеширования текста в стабильном HUD за sample 0 text mutations вместо 48–52 у baseline; количество scene objects сопоставимо (588–643 против 595–643), накопления объектов от UI не выявлено в этом коротком замере.

## Отклонения и границы

- Вода, арт/геометрия мира, zoom, радиусы и расположения покупок сохранены; кадр отличается от постановочной композиции макета.
- Имеющиеся PNG монеты/ящика/лодки использованы без перерисовки. Остальные иконки проще живописных иконок макета, но принадлежат одному SVG-семейству.
- Нет неработающего «+» у кошелька. Gear сохраняет действующий Balance Lab/F2. Metal скрыт до открытия склада. Дополнительная кнопка склада и его capacity сохранены.
- В portrait кнопки идут вертикально; wallet/HUD плотнее, чем в desktop-источнике. Полная надпись бренда может сокращаться при очень длинном wallet на 320 px.
- Проверены headless Edge renderer и native browser touch/pointer события, не физические Android/iOS. Системные blur/visibility/cancel проверены deterministic events, не OS alt-tab.
- Не заявляются natural pacing, полное ручное прохождение, long-session storage или real-device FPS. В плотном движущемся флоте остаются возможны кратковременные пересечения независимых world labels; текущая защита от пересечения плашки покупки проверена.

Подробности компонентов, tokens и список файлов: [UI_INTEGRATION_V06.md](UI_INTEGRATION_V06.md). Review patch: [implementation.diff](../test-results/v06-approved/implementation.diff). Исходные research/APK/XAPK и balance data не редактировались.
