# Тихая бухта — VFX validation v0.5c

Дата: 2026-10-13. Проверяется локальный production Vite build, Phaser WebGL в headless Microsoft Edge. Артефакты только в `test-results/v05c/`; предыдущие результаты v0.5a/v0.5b сохранены.

## Build и tests

Baseline: `npm run build` PASS, `npm test` — 170/170, 17 files. После реализации: build PASS, tests — **179/179, 18 files**. Прежнее предупреждение о размере Phaser chunk сохраняется; ошибка компиляции отсутствует.

Новые девять тестов: vertical stacks 1/2/5/7/100 × четыре модели × восемь направлений; bounded spring и wrap через ±PI; ambient amplitudes; FAST/REFERENCE burst count, reservation/early pickup, origin/resource event data и separate payouts; water reachability прежнего defender point.

Два теста сравнивают полный игровой state после 90 секунд реального Engine (fleet, gather, delivery, combat) с SHA-256 контрольными состояниями **backed-up v0.5b**. Из сравнения исключены только events/eventSeq: event metadata расширена для VFX. Совпадают world coordinates, cargo, payouts, wallet, nodes, combat, RNG и остальные поля. Контрольные hashes находятся в `tests/fixtures/v05b-core-hashes.json`; тесты не требуют внешнего backup для повторного запуска. Старый bounded-deck test обновлён под новый лимит высоты 42 px.

Оба JSON-профиля и selection сравниваются с backup побайтно; purchase point defender по-прежнему (2250,1220). Цены, rewards, quests, navigation/traffic, input, camera guidance и save schema не изменены.

## Production browser scenarios

`node scripts/browser-v05c.mjs`: оба профиля; отчёт `browser/smoke.json`. Проверены:

- Player 1/5/12 crates и искусственная capacity stress проекция 30; максимум семь visible IDs без дубликатов и реальный count в подписи.
- Player/worker/speedboat/salvage во всех восьми ракурсах, плавное изменение deck anchor, неизменный composition. Direction gallery намеренно перегружает speedboat сверх штатных двух crates для проверки bounded projection.
- Bob меняется при неизменном paused world state; moving WASD создаёт wake; spring выравнивается после остановки.
- Harvest arc → один cargo ID → landing bounce; resource burst 8/15, ранний reserved worker pickup до посадки, отмена старого view.
- Пять rapid unload events → пять flight views и ровно пять payouts [5,25,1,5,10]. До collection wallet=0; после wallet=46 и пять точных floating numbers.
- Реальная Golden transaction создаёт десять кучек без немедленного дохода. Частичный collection, сохранение, reload оставшихся values, отсутствие повторного birth, окончательная сумма равна offer.
- Четыре resource stages, restock в FULL; regrow также покрыт прежним gameplay browser и unit suite.
- Actual combat projectile, hit event/flash и death/sinking. Patrol, respawn, damage и spawner дополнительно покрыты прежними suites.
- Defender и warehouse image bounds не пересекаются. Прежняя physical purchase зона достижима, navigation до неё и stationary payment запускают строительство. Однократный completion pop заканчивается; gate увеличен.
- 1/5/10 workers, supporting salvage/defender/pirates, 150 floating crates, 240 payouts. Пулы ограничены, idle object/texture counts стабильны. Scene stop уничтожает FX pools; restart работает.
- Portrait 390×844: cargo, defender/warehouse, gate, port, low quality; горизонтального overflow нет.

`node scripts/browser-animation-timeline-v05c.mjs`: одиннадцать дополнительных проверок, `animation-timeline.json`. Реальные postupdate samples каждой фазы pickup (280 ms), временно скрытого cargo image и landing impact. Moving corner turn даёт измеримый lean >0.57°, ниже cap 7°, затем settle. Получение восьмого ящика также анимируется при уже заполненной семью изображениями стопке; logical cargo=8, visible=7. Все три quality режима проверены: off не создаёт particles, но cargo flight продолжается. Sparkle вытесняет wake из полного пула high/low. Это проверка анимаций во времени, а не вывод из одного кадра.

`node scripts/browser-regression-v05c.mjs ux`: **10 групп PASS**. Native mouse/touch/CDP: floating origin/deadzone/capture, WASD/arrows, modal/blur/hidden reset, исключение интерактивных объектов, Golden tap, purchase/SKIP, camera guidance и ручной quest claim, portrait, второй палец.

`node scripts/browser-regression-v05c.mjs gameplay`: **15 групп PASS**. Catch/delivery/physical cash, pending claim/load, partial purchase/load, worker payouts/load, island route, visibility/resume, regrow/restock, fleet/metal/defender patrol-combat-patrol, crate preemption, spawner, Golden fake rewarded cancel/confirm, Free/Rewarded Skip и profile isolation. Используются два исправления исторических test fixtures из v0.5b: убрать перекрытие player/defender в patrol sample и гарантировать Free Skip branch. Assertions не ослаблялись.

Traffic browser: **5 групп PASS**, оба профиля и 20 RAF samples для 1/5/10/max/pirate fleet с/без traffic. Итоговые параметры прогонов перечислены в `traffic/smoke.json` и `run-summary.json`. Консольные ошибки проверяются каждым browser suite.

## Производительность

`browser-performance-v05c.mjs` сравнивает два production builds: исходный v0.5b пересобран из backup в отдельный `baseline-dist`, v0.5c из текущих src. Один и тот же viewport 1440×1000, 0/5/10 workers, полный cargo, combat, 150 crates и 240 начальных payouts; sequential warmup 600 ms + RAF sample 2.5 s. Значения всех двенадцати sample в `performance.json`.

В desktop sample обе версии держались около **165 FPS**, p95 около **6.1–6.2 ms**. Заметного падения относительно v0.5b в этих сценах нет. Частота упирается в desktop scheduling/display limit: результат не измеряет оставшийся GPU запас и не является гарантией Android/iOS FPS. Полный JavaScript zero-allocation не заявляется; FX не создаёт новые GameObjects/Graphics/textures каждый frame, декоративные numeric slots предсозданы, images/texts переиспользуются.

Ограничения: high particles ≤192, low ≤48, off=0; flights ≤96; collected number views ≤64; visible cargo ≤7; coin views ≤180. Ни один визуальный лимит не удаляет cargo/payout из игры. Под максимальным флотом wake может заполнить пул; collection/impact reclaim его slots. Экстремальные искусственные debug bursts сверх flight cap могут опустить transient, сохранив конечный state и деньги.

## Скриншоты и просмотр во времени

Индекс: [screenshots.html](../test-results/v05c/screenshots.html). PNG из настоящего renderer лежат в `browser/`; mouse/touch/guide captures дополнительно в `regression/`.

- `*-player-cargo-{1,5,12,30}` и `*-direction-{N,NE,E,SE,S,SW,W,NW}` — размеры, stack, anchors. 30 — synthetic stress, штатная максимальная player capacity=12.
- `*-pickup-{050,150,landed}`; `*-burst-{050,150,landed}` — начальная/промежуточная/конечная фазы. Имена — ожидания script, не обещание точной миллисекунды capture: screenshot encoding тоже занимает время. Точные postupdate timestamps находятся в animation-timeline.json.
- `*-port-unload-090`, `*-port-unloaded`, `*-coin-collection` — доставка/выплаты.
- `*-golden-boat`, `*-golden-piles-{080,landed}`, `*-golden-collection` — Golden.
- `*-combat-{attack,hit,death-040,death-220}` — бой во времени.
- `*-construction-{active,complete-080,complete-240}`, `*-zone-unlock-building`, `*-defender-storage` — постройки.
- `*-stress`, `mobile-*`, `turn-{high,low,off}` — флот, portrait, quality.

Просмотрены игровые кадры грузовых стопок N/S/E, pickup до/после посадки, burst до/после разлёта, station/warehouse, Golden/coin и combat/construction sequences, mobile cargo. После просмотра N anchor немного смещён влево для чтения кабины; station — на 40 px вправо от оси purchase для свободного пространства рядом с lobster. Стопка читается отдельной вертикальной колонной, marker покупки отделён от здания.

## Что остаётся человеку

Короткая игра на физическом телефоне и desktop: оценить естественность инерции, читаемость максимальной стопки и удобство захода к станции. Проверить долгую сессию/нагрев и native OS gestures. В очень плотном флоте подписи и корпуса могут перекрываться; штатные traffic radii ради artwork не увеличивались. Верхние crates частично перекрывают друг друга в плотной стопке. Исходный арт/HUD остаются прежними, новые изображения не создавались.

## Файлы и воспроизведение

Исходники: BayScene, art/registry, art/sceneAssembly, новые art/animation и art/VisualEffects. В resources/economy/combat изменены только события для presentation. Добавлены tests/animation-v05c, контрольные hashes, четыре browser scripts; обновлены bounded-deck test, README, ARCHITECTURE, package scripts; два новых отчёта.

Полный перечень/hashes: `changes.json`; unified diff: `source.diff`. Git checkout в этой директории отсутствует, поэтому diff построен относительно локального backup. Подробные параметры и anchors: [ANIMATION_V05C.md](ANIMATION_V05C.md).

```powershell
npm run build
npm test
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4193 --strictPort
# В другом терминале, browser suites последовательно:
npm run test:vfx
npm run test:vfx-timeline
npm run test:v05c-ux
npm run test:v05c-regression
npm run test:v05c-traffic
```

Performance comparison требует также отдельный baseline preview на порту 4194. Browser fixture injection доступен только через исходный debug mode; release gameplay rules не обходятся VFX.
