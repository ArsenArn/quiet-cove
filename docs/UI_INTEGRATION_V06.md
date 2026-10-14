# Тихая бухта — внедрение утверждённого UI v0.6

Дата: 2026-10-13. Основной визуальный источник — приложенный утверждённый макет 1506×1044. Доработана существующая частичная версия интерфейса; сохранены её компоненты и обработчики. Все изменения находятся внутри `fishing-game/`.

## Компоненты и привязки

| Элемент | Реализация | Привязка к игре |
|---|---|---|
| Верхний HUD | DOM, `UI.ts`, `.hud`, `.hud-stat` | coins, player cargo / capacity, metal / storage capacity, worker + speedboat count |
| Логотип и utility | SVG waves, help, gear | Help вызывает прежнюю справку; gear открывает Balance Lab, F2 сохранён |
| Карточка квеста | DOM grid, `quest-art`, progressbar, reward | Исходные questProgress, questTarget, claimQuest; клик всей completed-карточки и Enter/Space |
| Кнопки навигации | DOM `.navigation`, `.shop-toggle` | Прежние navigate(port/sardine/storage), справочник и вкладки |
| Покупки | Phaser `WorldLabel`, variant purchase | Те же purchasePoint, взаимодействия, частичная оплата, таймеры, SKIP |
| Круги покупки | Phaser Graphics, `drawPurchases` | Тот же purchase_radius; тонкий внешний контур, 20 внутренних штрихов, маркер, дуга оплаты |
| Все 9 ресурсов | Phaser `WorldLabel`, variant status | Sardine/crab/mussel/snapper/tuna/lobster/swordfish/squid/wreck; исходная видимость и таймеры |
| Игрок, работники, FULL, пираты, защитник, выгрузка | Phaser `WorldLabel` | Исходные статусы, вместимость, цветовые тона; подпись лодки переносится выше при пересечении плашки покупки |
| Golden, rewarded, building/SKIP, help | DOM `.modal`, `.golden`, `.construction` | Исходные Golden transaction, control lock, cancel/confirm, free/rewarded skip |
| Джойстик | Исходный `Joystick.ts`, пассивный DOM overlay | Контроллер и размеры/жесты не изменены |

## Система оформления

`src/ui/tokens.ts` содержит палитру Phaser. Семантические CSS-переменные зеркально задают палитру DOM в одном месте: navy `#083d56`, teal `#10546b`, ocean `#1192cf`, cream `#fff4db`, gold `#ffd15d`, orange `#ff8036`, success `#80d29a`, danger `#e58c82`, ink `#122634`, outline `#409ac3`.

HUD: navy/teal gradient, яркий голубой контур, радиус 34 px, нижняя тень; заголовок 28 px, монеты 25 px, белые stat pills. Карточка: cream gradient, 356 px ширина, 62 px иконка, 18 px заголовок, тонкая полоса прогресса и отдельная строка награды. Completed сохраняет зелёный TASK COMPLETE.

Покупки: тёмная округлая плашка цены с иконкой и монетой; отдельная кремовая плашка названия. Price 21 world px, name 17 world px. Resource labels 17 world px, compact status 13 world px. Phaser сохраняет дробные world coordinates; контейнеры автоматически следуют камере и zoom. Текст рисуется с resolution 2; нет пересчёта координат в DOM или округления позиции.

Desktop-кнопки: 70 px высота, 22 px текст, радиус 32 px, объёмная тень, hover/pressed/disabled/focus. Порт — синий, сардины — оранжевый, Объекты — navy. Существующая кнопка склада остаётся доступной после открытия склада.

Монеты, ящики и лодки используют имеющиеся игровые PNG. Boat sprite sheet 4×2 кадра; DOM показывает один кадр, Phaser использует тот же frame 3. Остальные иконки используют общее семейство SVG: waves, crew, settings, anchor, fish, crab, shell, squid, map, metal, shield, clock и др. Нет emoji, скачанных icon packs или новых внешних зависимостей.

## Responsive

До 950 px HUD переходит в два ряда; до 700 px его плашки и typography компактизируются отдельно от world renderer. В portrait utility hitboxes 44 px, кнопки навигации 46–48 px. Карточка 278 px, отдельная иконка 48 px и текст 15 px. Навигация размещается вертикально слева, Объекты — справа. Metal label в узком HUD скрывается, числовой счётчик и capacity остаются видимыми. Safe-area и reduced-motion сохранены. Landscape малого height имеет компактный однорядный HUD.

## Производительность и защита механик

DOM обновляется прежним интервалом 200 ms. `text()` меняет textContent только при изменении значения; quest icon создаётся только при смене типа. `WorldLabel` перерисовывается при изменении текста/тона или hover/pressed, существующие контейнеры переиспользуются. Панели не пересоздаются каждый frame. HUD не имеет дополнительных фоновых циклов.

Не редактировались economy/quests/resources/workers/movement/navigation/construction/save/Golden formulas, balance JSON, world coordinates, camera zoom, joystick logic, VFX или арт мира. Изменения BayScene ограничены представлением UI. Пользовательское браузерное сохранение не открывалось и не сбрасывалось; браузерные проверки используют отдельные context fixtures.

## Изменённые файлы

- `src/ui/style.css`: оформление и responsive.
- `src/ui/UI.ts`: компоновка/иконки, premium и construction classes, кеш текста; прежние действия сохранены.
- `src/ui/icons.ts`: SVG vocabulary и ссылки на существующий арт.
- `src/ui/WorldLabel.ts`: общая rounded status/purchase presentation.
- `src/ui/tokens.ts`: новый renderer palette.
- `src/game/scenes/BayScene.ts`: circles, purchase badge presentation, resource icons и смещение boat label при пересечении покупки.
- `scripts/browser-ui-v06.mjs`: дополнены visual scenarios, hitbox/overflow проверки; новые результаты отдельно в v06-approved.
- `scripts/browser-performance-v06.mjs`: новый текущий/baseline stress замер.
- `docs/UI_INTEGRATION_V06.md`, `docs/UI_VALIDATION_V06.md`.

Build outputs — `dist/`. Проверочные артефакты — `test-results/v06-approved/`. Исходный интерфейс сохранён в `.local/v06-before/`; review diff — `test-results/v06-approved/implementation.diff`. Checkout без Git; Git не инициализирован.

## Отклонения от картинки

Не добавлена кнопка «+» у валюты: в игре нет связанной функции. Gear открывает действующий Balance Lab, а не фиктивные настройки. Счётчик металла появляется после открытия склада; вместимость склада и дополнительная кнопка навигации сохранены. Нет фиктивной стрелки активного квеста.

Сохранены исходные вода, масштаб арта, геометрия мира, реальные радиусы кругов и положения покупок: композиция игрового мира отличается от постановочного макета. Иконки без готовых assets упрощены в общем SVG-семействе. Точные цены, цели, награды, состояние флота и FULL зависят от текущего сохранения. Portrait использует самостоятельную компактную раскладку. Скриншот не используется как статичный background.
