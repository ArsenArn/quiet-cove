# Файловое сравнение v0.2 → v0.3

Каталог не является Git-репозиторием. Backup до изменений: `.local/v02-backup-20261012/`. Таблица SHA256 использует фактические файлы, без node_modules/dist/test-results и локальных helper scripts. Исходники backup сохранены неизменными. Все изменения находятся внутри fishing-game.

| Файл | Состояние | SHA256 v0.3 |
|---|---|---|
| README.md | изменён | a135c6a6a6ed04e8948a6fbf391d82ff55450e5b8a991efb451182d3775357df |
| package.json | изменён | bf65454e4705308f42b6dda366157b4acc047c07ba56013ef6045ebbf6475763 |
| package-lock.json | изменён | 0fc89e92be77384776d4d85b0cf06577274c483f61d2692c3c610bdc35f42dbe |
| vitest.config.ts | добавлен | 71bd47648b4d6bee71eb2e67100f33aaf46f5dda7ea90e23745b8dce196d17ec |
| src/config/load.ts | изменён | ff00b047a4bafeb7202047303af9a1f36c4091f1dad4fdf04b07ce3d9e8252a9 |
| src/config/types.ts | изменён | 12469f0c9eff259d6ca126d8461cdd23f8026da45e7d2b029ae54326b4e16de5 |
| src/game/engine.ts | изменён | f31ba4164e8871f634104192251fdeca323a9b052cdbde7968bdfd2f19154324 |
| src/game/scenes/BayScene.ts | изменён | a9cb1007f002a00523a88f75a2783cddaf7b2b67d3bfcead716a81f0b7b02d18 |
| src/game/state.ts | изменён | da5a12720bf255e28afcc90390378897256a347da7e0589be4177a711044b14c |
| src/game/systems/construction.ts | изменён | ac649477083e122faedea3bf09f6501139b62db350d11a1a8d04b67392aed08f |
| src/game/systems/economy.ts | изменён | 1d148f1427c3659e61f06dcee9c16b7804dfedd5bd36755ba0c607bd16aaaf9e |
| src/game/systems/guidance.ts | добавлен | 49c90fd61277488f60fada18085ab8cc001d3a13d851666bf3a628d46190fc4d |
| src/game/systems/merchant.ts | изменён | f0af950443af3a6acb3cd0ee9d52b9021148dc2a098c5d16d0ba2deba7ee3068 |
| src/game/systems/save.ts | изменён | 8a00848dfeacd9b324389f487ae291ed9c0fc97c6ac0a684253fe829c25e13c8 |
| src/main.ts | изменён | 777b5b3ec1321ef450b31c320aff7410afd17504fee2e17af042c5bedae61c0e |
| src/ui/style.css | изменён | 95f331999280486fb27c3117689ec722a1b22e490c284fc769d58b363e9803c4 |
| src/ui/UI.ts | изменён | fb56bc1341c0d0a4b9c18145bd5729a3ce9202dbabd5b0b2fea4189365f530aa |
| public/balance/balance_fast.json | изменён | 7c01e16250d1488607d1c8cd219082b5dd490043ad31c9c761c65e647fa8463f |
| public/balance/balance_reference.json | изменён | be86328f5b5168471e15a7bda97a430fcef8c8006dffe098ad1a439a5243475d |
| tests/balance-v02.test.ts | изменён | 3d6ab414209776702d5be66afb3c9c95871b619c4076ba60f67ca777731de739 |
| tests/coins-v03.test.ts | добавлен | 24c50787d6312e27a4c8ea48f3361774aaa172c5ea9333e373d151bcdd65e3b8 |
| tests/gameplay-v02.test.ts | изменён | cfe803083fa942c1ce63f707f22e7d27bfc6bd6103532049482f118814e303b0 |
| tests/golden-v03.test.ts | добавлен | ecdce7655c2bc7566a2bd18b8643123debbe17d0c7e7d1a05112b902c9486e5f |
| tests/presentation-v02.test.ts | изменён | 53d052d148e4aef484cca238133b8e29fa9c1b4a86fe1e6535e889fe0676f29f |
| tests/purchases-v03.test.ts | добавлен | 09a6c2a84f92f6ea4574899587e49b7623a0e7edf4939a728023716a65b46790 |
| tests/quests-ui-v03.test.ts | добавлен | 7b9b0d9931d50f9159e02e668ed607cb098604ea619b80a491ba833699589f49 |
| tests/systems.test.ts | изменён | d513c2ec61cb651cb318c12321e8f4078dc630920c314c84c3c853f867507472 |
| tests/world-v03.test.ts | добавлен | 612f6692d108b6fdddafe98474838c330bf82eb3aea6105daa60ea26702ee262 |
| scripts/browser-smoke.mjs | изменён | 5895117bc6a6a294fa7a34500ae2f53c193b9a3d90dd309448230da896c6a1be |
| scripts/browser-v03.mjs | добавлен | 2ef59c8385487596b460c3973dacf1e616ae9366d68ea6c9de3d1e6ca3ecf5f1 |
| docs/ARCHITECTURE.md | изменён | 2f22925a18b4fc6048eb4b90613ff319a6aa050c3eed5853621710ef3542629e |
| docs/GAMEPLAY_FIXES_V03.md | добавлен | 934f88ccd4153e9fb0ddd15c2179d2a9e977ac3359775a6616f6202abd6c48ab |
| docs/IMPLEMENTATION_STATUS.md | изменён | b9cf3682ba78b43d6360e2967e5691d77769c2db0daa51b7bf1d4cdf79ad222d |
| docs/NEXT_STEPS.md | изменён | a214bf433bad8fcafd3ff4a2732a2526705fb6fb22df0c87f8139360177db794 |
| docs/VALIDATION_V03.md | добавлен | f79f9383d34369356d6917b42923f60630dfba079d6903b241b0d3c267e7f9de |
| docs/WORLD_LAYOUT_V03.md | добавлен | aa68f07e32683a84550c424e6843aed13418b3f60421687013296f176dca9733 |

Всего 36 файлов. Git no-index diff исходников/конфигов/тестов: `.local/v03-source.diff`. Это сравнение с backup, не commit и не публикация.
