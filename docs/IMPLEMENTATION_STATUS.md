# Статус Gameplay Corrections v0.3.1

Дата: 2026-10-13. Изменения только внутри fishing-game/, без публикации, сброса сохранений или изменения research/APK/handoff.

Реализованы все девять корректировок: свободное управление при guidance и плавная отмена; coin radius 38; persistent cooldown+exit/re-entry; ускоряющиеся целые платежи; три стороны центрального хаба и патрульный причал; golden в earn_coins с отдельными источниками; burst 8/15, cap 150 и lifetime 60с; пиратский resolver к логову; mouse/touch captured joystick с deadzone и безопасным reset.

Production build проходит. Автотесты: 116/116 в 12 файлах, включая прежние 82, оба funded 34-chain и четыре unfunded first15. Focused v0.3.1 production smoke: 10 групп PASS, 0 console/page errors. Regression production Edge smoke: 15 групп без console/page errors. Детали текущего focused renderer smoke и ограничения — [VALIDATION_V031](VALIDATION_V031.md); матрица девяти изменений — [GAMEPLAY_FIXES_V031](GAMEPLAY_FIXES_V031.md).

Version=3/profile keys сохранены, additive feature migration с backup_before_v031 проверена fixtures. Backup исходников: .local/v031-backup-20261013/. Сброс партии не требуется. Реальное пользовательское сохранение в браузере не читалось и не удалялось.

Цены, награды, HP/stock/regrow/restock, build timers, характеристики флота/боя и исходная формула EstimatedEarnRate сохранены. Изменения pour, qualifying golden income и burst влияют на pacing; базовый radius и структура хаба — UX изменения. Полный баланс, final art, новые зоны и monetization не делались. Физические телефоны, обычный human playtest, long AFK/max-fleet и hardware FPS остаются PARTIAL.
