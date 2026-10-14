# UX Fixes v0.3.2 — Floating Joystick & Quest Guidance

Дата: 2026-10-13. Основа: завершённая v0.3.1. Все изменения и результаты находятся внутри `fishing-game/`.

Baseline перед изменениями: `npm run build` PASS; `npm test` PASS, 116/116 тестов, 12 файлов. Каталог не является Git repository. Исходники изменённых файлов сохранены в `.local/v032-backup/`; сравнение с baseline — `.local/v032-source.diff`.

## Исправления

### Floating joystick

Постоянная панель в углу удалена. ЛКМ или палец на свободной воде показывает полупрозрачный круг ровно в точке нажатия. Центр фиксирован в CSS координатах; перемещение камеры и лодки его не сдвигает. Без отклонения лодка стоит. Thumb ограничен радиусом, deadzone и нормализация прежние. Все значения берутся из существующих JSON (`radius=59`, `thumb_radius=24`, `deadzone=.12`, `opacity=.65`); скорость лодки не менялась. WASD/стрелки имеют прежний приоритет и нормализацию диагонали.

Canvas захватывает первый допустимый pointer. При отпускании круг исчезает, вектор обнуляется. Pointercancel, lostpointercapture, blur, hidden, modal и shutdown сбрасывают управление; shutdown также удаляет слушатели джойстика. Overlay и thumb имеют `pointer-events:none`. Второй палец может нажать UI, в частности получить награду; первый продолжает управление. Modal прекращает движение.

Перед стартом BayScene проверяет настоящий Phaser hit test всех интерактивных объектов, Golden hull, физические purchase circles, землю и границы карты. DOM-карточка, меню, modal, debug и кнопки сами получают события. Golden, SKIP и покупки сохраняют прежние команды; покупки продолжаются после остановки в физической зоне. Drag через объект не активирует его. Обычный mouse/touch click по воде больше не создаёт waypoint. Кнопки навигации и нажатие на покупку по-прежнему задают маршрут.

Для native touchcancel в `main.ts` выставлено `input.touch.capture=false`: это отключает Phaser `preventDefault`, вызывавший console error на неотменяемом touchcancel. Это отдельная настройка от нативного `setPointerCapture`: захват указателя остаётся в Joystick. Canvas `touch-action:none` управляет жестами; Phaser продолжает получать touch events для объектов.

### Camera guidance

Удалены `interruptGuidance()` и прерывающий `CameraGuidance.interrupt()`. Keyboard update, joystick и `navigate()` не меняют фазу и не сбрасывают таймер. Показ проходит полный прежний цикл: move .6с → focus 1.5с со стрелкой/кольцом → return .6с. Лодка движется весь цикл. Возврат интерполируется к текущей позиции игрока; затем камера следует за ней с прежними world bounds. Guidance не ставит Engine control lock и не меняет позицию лодки. Hidden/shutdown по-прежнему отменяют показ.

### Уже выполненная следующая задача

Общий `nextQuestHintTarget` разрешает подсказку только существующей `active` задаче. Существующий `claimQuest → activateQuest → updateQuests` сначала вычисляет статус следующего задания; оба UI пути claim вызывают защищённый `showQuestHint`. Для `completed_unclaimed` новая подсказка не начинается, карточка показывает TASK COMPLETE, награда требует отдельного нажатия. После последнего задания guidance также отсутствует. Решение применяется ко всем 34 заданиям, без отдельных условий для катера.

| Сценарий после claim | Результат |
|---|---|
| A: квест 9, катер строится | Квест 10 active, показ его причала |
| B: квест 9, катер уже готов | Квест 10 completed_unclaimed, повторного показа нет, награда 10 не выдана |
| C: claim квеста 10, мидии закрыты | Квест 11 active, показ мидий |
| D: claim квеста 10, мидии уже открыты | Квест 11 completed_unclaimed, подсказка пропущена, требуется следующий claim |

## Изменённые файлы

| Файл | Изменение |
|---|---|
| `src/ui/Joystick.ts` | Canvas pointer input/capture, floating origin, скрытие и lifecycle cleanup |
| `src/ui/UI.ts` | Подключение canvas и hit-test predicate, скрытый overlay, актуальные тексты управления |
| `src/ui/style.css` | Floating overlay без hit area, canvas touch-action, возврат desktop navigation в освободившийся угол |
| `src/game/scenes/BayScene.ts` | Проверка свободной воды, удаление water click navigation и input interruption, guarded hint, shutdown reset |
| `src/game/systems/guidance.ts` | Универсальная проверка active quest, удаление input interruption API |
| `src/main.ts` | Phaser touch preventDefault выключен; native pointer capture и три touch pointers сохранены |
| `tests/corrections-v031.test.ts` | Прежняя camera interruption проверка обновлена под полный показ при движении |
| `tests/ux-v032.test.ts` (новый) | 11 тестов ownership/reset, all34/Fast/Reference, A–D, separate claims, reload и полного camera timing |
| `scripts/browser-v032.mjs` (новый) | Native mouse/touch/CDP и настоящий Phaser renderer smoke |
| `scripts/browser-smoke.mjs` | Регрессионный smoke адаптирован к floating input; SMOKE_OUTPUT позволяет сохранить прежние изображения |
| `package.json`, `package-lock.json` | Версия .3.2; test:ux/test:corrections запускают актуальный v032 smoke; зависимости прежние |
| `docs/ARCHITECTURE.md` | Актуальные правила input/guidance |
| `docs/UX_FIXES_V032.md` (новый) | Этот отчёт |

`dist/` пересобран. Дополнительные артефакты: `.local/v032-backup/`, `.local/v032-protected-before.json`, `.local/v032-source.diff`, `test-results/v032-*`, `test-results/v032-regression/`. Предыдущие отчёты, screenshots и архив `fishing-game.zip` не перепаковывались.

## Проверки

| Команда / проверка | Результат и доказательства |
|---|---|
| `npm run build` | PASS; TypeScript + production Vite; `test-results/v032-build.log`. Прежнее предупреждение размера Phaser chunk остаётся |
| `npm test` | PASS, 127/127, 13 файлов; `test-results/v032-tests.log` |
| `npm run test:ux` на production preview | PASS, 10 групп; `test-results/v032-smoke.json`, `v032-ux.log`; Phaser WebGL renderer (type 2), consoleErrors=[] |
| `npm run test:smoke` на production preview | PASS, 15 regression групп, consoleErrors=[]; `test-results/v032-regression.log` |
| Protected files SHA-256 | 9/9 неизменны; `test-results/v032-protected.json` |

Browser UX smoke проверяет mouse down/drag/up, нулевой stationary press и deadzone, точный фиксированный центр, thumb clamp, diagonal normalization, выход за круг с capture, отсутствие waypoint и правую кнопку; WASD/стрелки; blur/pointercancel/lostcapture/modal/hidden с восстановлением input; DOM UI и произвольный интерактивный Phaser object; Golden hull и отсутствие активации при drag; map SKIP и purchase navigation; полный camera cycle при keyboard/joystick/navigation; A–D с reload и отдельными наградами; native touch drag/release/touchcancel и UI вторым пальцем, mobile Golden tap и portrait layout. Mouse/touch — реальные browser input; blur/hidden/pointercancel — детерминированные события в headless. Native touchcancel отправлен CDP. Screenshots desktop drag, трёх guidance controls и mobile сохранены; desktop drag и portrait layout просмотрены визуально.

Regression smoke покрывает claim/reload, добычу/продажу/физические деньги, постепенную покупку, worker cash, маршруты вокруг суши, visibility/resume, regrow/restock, HUD/бой/патруль, gather/crate preemption, spawner, Golden reward, Free/Rewarded Skip, profile isolation и explicit reset. Vitest также сохраняет прохождение всех 34 квестов Fast/Reference и предыдущие save/worker/combat/economy проверки.

Исходные balance Fast/Reference/selection, `quests.ts`, `save.ts`, `engine.ts`, `workers.ts`, `combat.ts`, `resources.ts` совпадают с baseline по SHA-256. Экономика, цены защитника, награды/порядок квестов, drops, карта/причалы, worker AI, бой, save schema/keys и арт не изменялись. Browser tests используют отдельные свежие contexts, не пользовательские saves.

Для воспроизведения: `npm run build`, `npm test`; запустить `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4177 --strictPort`. В другом PowerShell: `$env:SMOKE_URL='http://127.0.0.1:4177'`, `$env:SMOKE_OUTPUT='test-results/v032-regression'`, затем `npm run test:ux` и `npm run test:smoke`. По умолчанию Windows smoke использует установленный Edge; BROWSER_CHANNEL позволяет выбрать другой Chromium channel.

## Осталось для ручного тестирования

- Физические Android Chrome и iOS Safari: длительное удержание, диагонали/360°, повторный вход после background/OS gestures, настоящий multitouch, края экрана и portrait/landscape.
- Desktop Chrome/Edge: реальный Alt-Tab, отпускание мыши вне окна, масштаб браузера и смена размера окна во время удержания.
- Полное естественное прохождение Fast/Reference и UX маршрутов/камеры на телефоне. Автоматический funded progression и headless smoke не заменяют это прохождение.

Это UX-итерация v0.3.2; аппаратное ручное тестирование не объявлено выполненным.
