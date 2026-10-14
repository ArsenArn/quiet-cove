# FAST ZONE 2 REBALANCE — v0.7c

2026-10-13. FAST Zone 2 реализован. **MODELED normal: 33:46–34:14 за всю игру; Zone 2: 22:38–23:06.** Человеческий результат ещё не подтверждён.

**Ограничение приёмки:** все нормальные модельные маршруты достижимы, но безусловный критерий «нет softlock» не выполнен: воспроизведён существовавший раньше edge заполненного склада перед Q24/Q26. Его исправление требует изменения правил квеста/хранения/доступных metal sinks, которые запрещено менять этим заданием.

## OBSERVED DATA

Источник: `playtest_FAST_2026-10-13_mv6ogkj1-4f714505-c404-414e-9707-aac013917896.json`, найден в Downloads. SHA-256: `70e7e2f5f70be9f3629b651ba411c10869b66ec8cb2520e32bde49f7014cfabb`.

705 events, 174 snapshots. Полная загруженная FAST-конфигурация совпала с before-конфигурацией проекта. Q15 completion=660.395 s; claim/Q16 activation=667.449 s. Q25 completion=970.493 s; claim=976.708 s. Конец записи 995.502 s, Q26 активен. Q26–34 человеком не завершены.

Ledger: 7525 sales +14518 rewards=22043 income; 22043−16654 spending=5389 wallet. Pending 1893 — отдельно, не wallet. Metal 23. Golden/debug income=0. Free construction skips=10.

| Q | Activate s | Complete s | Claim s | Duration s | Wallet start→after reward | Pending start→after claim | Required purchases | Sales to completion / through claim | Reward |
|---|---:|---:|---:|---:|---|---|---|---:|---:|
| 16 | 667.4 | 784.7 | 785.2 | 117.2 | 826→834 | 234→268 | defender=2200 | 1578 / 1578 | 630 |
| 17 | 785.2 | 794 | 799.3 | 8.9 | 834→1622 | 268→460 | — | 0 / 0 | 788 |
| 18 | 799.3 | 843.9 | 863 | 44.6 | 1622→1259 | 460→292 | resource:lobster=2400 | 950 / 1092 | 945 |
| 19 | 863 | 886.1 | 887.5 | 23.1 | 1259→2039 | 292→256 | worker:3=307; worker:4=492 | 476 / 476 | 1103 |
| 20 | 887.5 | 900.2 | 902 | 12.6 | 2039→3025 | 256→80 | cargo:4=650 | 376 / 376 | 1260 |
| 21 | 902 | 919.5 | 923.5 | 17.5 | 3025→2843 | 80→612 | storage=1800 | 200 / 200 | 1418 |
| 22 | 923.5 | 928.6 | 929.6 | 5.1 | 2843→3718 | 612→622 | cutter=700 | 0 / 0 | 1575 |
| 23 | 929.6 | 936.5 | 937.2 | 6.9 | 3718→4051 | 622→662 | resource:wreck=1400 | 0 / 0 | 1733 |
| 24 | 937.2 | 960.4 | 963.4 | 23.2 | 4051→5941 | 662→1238 | — | 0 / 0 | 1890 |
| 25 | 963.4 | 970.5 | 976.7 | 7.1 | 5941→5389 | 1238→1373 | salvage:0=2600 | 0 / 0 | 2048 |

DERIVED payout production=(sales collected +pending_end−pending_start)/active interval. Это стоимость реальных доставок, не теоретическая добыча. Короткие окна шумные. Fleet: N normal, S speedboat, V salvage, D Defender.

| Q | Construction s / free skip actual wait s | Claim delay s | Collected coins/s | Delivered payout coins/s | Fleet at activation / capacity | Next cost: wallet affordable; +pending affordable |
|---|---|---:|---:|---:|---|---|
| 16 | defender:20 / без skip | 0.5 | 13.4 | 13.7 | 3N 1S 0V 0D / 5 | — |
| 17 |  / без skip | 5.3 | 0 | 13.5 | 3N 1S 0V 1D / 5 | 2400: нет; нет |
| 18 | resource:lobster:35 / resource:lobster:1.6 | 19.1 | 17.2 | 14.5 | 3N 1S 0V 1D / 5 | 799: да; да |
| 19 | worker:3:15; worker:4:22 / worker:3:1; worker:4:1.7 | 1.4 | 19.4 | 17.9 | 3N 1S 0V 1D / 5 | 650: да; да |
| 20 | cargo:4:12 / cargo:4:5.6 | 1.8 | 26 | 13.8 | 5N 1S 0V 1D / 5 | 1800: да; да |
| 21 | storage:25 / storage:3.9 | 4 | 9.3 | 34 | 5N 1S 0V 1D / 6 | 700: да; да |
| 22 | cutter:0 / без skip | 1 | 0 | 1.6 | 5N 1S 0V 1D / 6 | 1400: да; да |
| 23 | resource:wreck:20 / resource:wreck:1.8 | 0.7 | 0 | 5.3 | 5N 1S 0V 1D / 6 | — |
| 24 |  / без skip | 3 | 0 | 22 | 5N 1S 0V 1D / 6 | 2600: да; да |
| 25 | salvage:0:30 / salvage:0:1.6 | 6.2 | 0 | 10.2 | 5N 1S 0V 1D / 6 | — |

Q21: wallet 3025, cost 1800. Q22: 2843 vs700. Q23: 3718 vs1400. Q25: 5941 vs2600. Rewards Q19–24 суммарно 9577 при обязательных расходах 5349: именно награды финансируют цепочку. Нулевые продажи в походах за metal означают задержку подбора, а не отсутствие работы флота.

[Полный рассчитанный ledger](../test-results/v07c/observed.json). Исходный JSON не менялся.

## До/после

Zone 2 rewards: 38907→9800. Это не единый множитель: промежуточные инвестиции становятся дороже, дорогие поздние открытия дешевле. Defender price, fish values, stock/HP/regrow/gathering, combat, metal requirements/caps и все construction timers неизменны.

| Q | Goal | Old reward | New reward | Old price(s) | New price(s) | Observed duration s | MODELED mean [seed range] s | Reason |
|---|---|---:|---:|---|---|---:|---|---|
| 16 | Приобрести боевой катер | 630 | 350 | 2200 | 2200 | 117.2 | 117.7 [101.9–132.3] | Цена и timer приняты по 117 s; меньший бонус оставляет gap перед lobster. |
| 17 | Победить двух пиратов | 788 | 200 | — | — | 8.9 | 10.3 [10.3–10.3] | Естественный бой сохранён; бонус не оплачивает открытие. |
| 18 | Открыть место ловли омаров | 945 | 450 | 2400 | 2200 | 44.6 | 104.6 [90.8–116.2] | Меньше цена, но намного меньше reward surplus; нужен доход. |
| 19 | Увеличить флот до 5 обычных лодок | 1103 | 500 | 307 + 492 | 700 + 900 | 23.1 | 77 [73.9–79.3] | Два найма становятся инвестициями в доход. |
| 20 | Улучшить трюм до Lv.4 | 1260 | 450 | 650 (+325 если Lv.3 нет) | 1400 (+325 если Lv.3 нет) | 12.6 | 61.7 [48.6–81.4] | Cargo требует продаж; ранние tiers сохранены. |
| 21 | Построить склад металлолома | 1418 | 500 | 1800 | 2400 | 17.5 | 60.2 [50.6–73.3] | Инфраструктура соответствует доходу флота из 5 лодок. |
| 22 | Купить оборудование для резки металла | 1575 | 300 | 700 | 1500 | 5.1 | 42.8 [27.4–56.1] | Промежуточная инвестиция, без искусственного таймера. |
| 23 | Доставить затонувший корабль | 1733 | 550 | 1400 | 1800 | 6.9 | 61.5 [55–69.1] | Доход требуется до открытия metal; circular gates нет. |
| 24 | Доставить 10 единиц металлолома | 1890 | 300 | — | — | 23.2 | 51.4 [37.9–64.7] | 10 новых metal deliveries; естественная длительность. |
| 25 | Нанять первое судно-разборщик | 2048 | 600 | 2600 | 3000 | 7.1 | 37.3 [23–44.6] | Значимый salvage hire; небольшой бонус. |
| 26 | Доставить 50 единиц металлолома | 2205 | 300 | — | — | нет данных | 88.6 [82.5–92.9] | 50 новых deliveries; фоновая рыба накапливается. |
| 27 | Открыть место ловли рыбы-меч | 2363 | 650 | 8500 | 3900 | нет данных | 70.2 [58.4–88.9] | Сниженная цена согласована с новыми rewards и depletion. |
| 28 | Увеличить флот до 7 обычных лодок | 2520 | 600 | 786 + 1258 | 1300 + 1700 | нет данных | 95.7 [78.5–105.7] | Поздние наймы растут в цене; ранние неизменны. |
| 29 | Улучшить трюм до Lv.6 | 2678 | 600 | 1300 + 1950 | 1500 + 2100 | нет данных | 65.2 [47.9–75.8] | Два cargo upgrades поддерживают логистику. |
| 30 | Увеличить вместимость склада металла до 150 | 2835 | 600 | 6500 +30 M | 3400 +30 M | нет данных | 73.9 [60.5–81.6] | Цена соответствует swordfish income; 30 M и cap сохранены. |
| 31 | Ликвидировать пиратское логово | 2993 | 500 | 9000 +50 M | 5400 +50 M | нет данных | 97.8 [82.3–106.3] | Цена снижена вместе с rewards; 50 M и логика прежние. |
| 32 | Открыть место ловли редкого кальмара | 3150 | 800 | 16000 | 5400 | нет данных | 102.8 [83.9–119.9] | Старая цена давала 262 s; новое открытие поддерживает темп. |
| 33 | Нанять второе судно-разборщик | 3308 | 550 | 4420 | 4500 | нет данных | 59.9 [57.3–64.7] | Второй salvage улучшает снабжение route. |
| 34 | Открыть дальний морской маршрут | 3465 | 1000 | 14000 +80 M | 7400 +80 M | нет данных | 92.6 [74.3–101.9] | Финал требует нового дохода и 80 M, без windfall. |

`fast_zone2` содержит цены workers №4–10: **700,900,1300,1700,2400,3200,4200**, cargo Lv.4–6: **1400,1500,2100**. Они действуют только при FAST +area2 +questIndex≥15, после claim Q15. До этого даже опциональные поздние покупки используют прежнюю цену. Исходная worker formula и capacity_upgrades сохранены; REFERENCE не использует overrides.

| Resource | Value before=after | Restock before→after s | Причина |
|---|---:|---|---|
| Lobster | 40 | 450→180 | Убирает длинную просадку при истощении первой редкой рыбы большим флотом. |
| Swordfish | 70 | 750→300 | Поддерживает доход поздних инвестиций при уменьшенных rewards. |
| Squid | 110 | 1650→1650 | Начального запаса достаточно; менять восстановление не обосновано. |

Wreck/metal production не менялась. Рост мощности сохраняется: новые fish дают 40→70→110 и normal fleet 3→5→7. Salvage работает на metal, а не coin income.

## MODELED ESTIMATES и калибровка

Используется реальный Engine и существующий input-driver `balance-model-v04a.ts`. Он движется, собирает/доставляет, подбирает физические монеты, платит, claims и применяет штатный free skip. Нет debug grants, ускорения Engine, принудительного завершения goals или rewarded timer skips.

До правок Engine A seed41 завершает Q15 в 541.8 s, человек — 660.395 s: Zone 1 модель быстрее в 1.2 раза. Поэтому принятая Zone 1 в проекции закрепляется на реальном anchor=667.449 s, без балансных правок.

Старый Engine Q16–25: 323 s. Человек activation16→claim25: 309.3 s. **k=0.957458**. Формула milestone=667.449+k×(Engine milestone−Engine Q15). Поздний участок модели уже близок к реальности; механически переносить коэффициент ранней Zone 1 на него неверно.

Калибровка учитывает claim/navigation overhead в агрегате. До Q25 есть человеческий calibration segment, после Q25 только экстраполяция. Seed ranges — разброс модели, НЕ статистический доверительный интервал человеческой игры. Состояние человека в Q16 имело wallet826/capacity5, а driver checkpoint — wallet435/capacity4; такого агрегатного соответствия недостаточно для гарантии каждого индивидуального времени.

Tquest определяется реальной доступностью дохода, действиями, неизбежным ожиданием и navigation. Lower-bound gap=max(0,price−wallet−pending); pending ещё нужно физически подобрать. Resources availability, AI, drops, recovery и lifetime counters исполняет Engine. Обязательные новые доставки Q24/26 считают since_activation; заранее построенный lifetime upgrade может сократить следующий quest.

Доход накапливается и во время construction. Ниже income loop/construction phase/other — взаимоисключающие фазы input-driver, а не независимые таймеры, наивно добавленные друг к другу. Рыбалка и pickup внутри construction уже включены. Worker 75 s нельзя сразу пропустить: free skip только при remaining<60 s.

| Q | Wallet start | Pending start | Fresh gap lower bound | Collected sales | Wallet after reward | Income loop s | Construction phase s | Other activity/navigation s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 16 | 470.7 | 147.3 | 1582 | 1859.3 | 480 | 106.1 | 1.9 | 9.7 |
| 17 | 480 | 131.3 | 0 | 147 | 827 | 0 | 0 | 10.3 |
| 18 | 827 | 71 | 1302 | 1476 | 553 | 93.3 | 1.9 | 9.4 |
| 19 | 553 | 74 | 973 | 1127.7 | 580.7 | 60.4 | 4 | 12.6 |
| 20 | 580.7 | 273.7 | 870.7 | 1294 | 599.7 | 48.1 | 4 | 9.5 |
| 21 | 599.7 | 414 | 1386.3 | 1878.7 | 578.3 | 47.2 | 2.1 | 10.9 |
| 22 | 578.3 | 198.3 | 723.3 | 1226.3 | 604.7 | 32 | 0 | 10.9 |
| 23 | 604.7 | 228.7 | 966.7 | 1318.3 | 673 | 48.1 | 1.9 | 11.6 |
| 24 | 673 | 362.3 | 0 | 1251.3 | 2224.3 | 0 | 0 | 51.4 |
| 25 | 2224.3 | 381.7 | 394 | 904.3 | 728.7 | 22.8 | 2.1 | 12.4 |
| 26 | 728.7 | 382 | 0 | 1610.7 | 2639.3 | 0 | 0 | 88.6 |
| 27 | 2639.3 | 245 | 1015.7 | 1439 | 828.3 | 55.7 | 2.1 | 12.4 |
| 28 | 828.3 | 185.3 | 1986.3 | 2663 | 1091.3 | 66.6 | 16.3 | 12.8 |
| 29 | 1091.3 | 656 | 1852.7 | 3087.7 | 1179 | 49.1 | 3.8 | 12.2 |
| 30 | 1179 | 566.3 | 1654.7 | 2651.7 | 1030.7 | 50.1 | 2 | 21.8 |
| 31 | 1030.7 | 773 | 3596.3 | 4578.7 | 709.3 | 83.7 | 1.9 | 12.1 |
| 32 | 709.3 | 1227.3 | 3463.3 | 5286 | 1395.3 | 87.4 | 1.9 | 13.5 |
| 33 | 1395.3 | 554 | 2550.7 | 3652.7 | 1098 | 45.3 | 1.9 | 12.7 |
| 34 | 1098 | 684 | 5618 | 6610.3 | 1308.3 | 72.2 | 1.9 | 18.4 |

Income growth по широким этапам, откалиброванный active clock:

| Q | Collected coins/s | Delivered payout coins/s | Fleet/content |
|---|---:|---:|---|
| 16–18 | 15 | 14.7 | 3 normal +speedboat; lobster появляется в конце |
| 19–25 | 23 | 23.7 | 3→5 normal, lobster, metal infrastructure |
| 26–30 | 29.1 | 30.1 | 5→7 normal, swordfish, salvage |
| 31–34 | 57 | 56.7 | 7 normal, squid, 1→2 salvage |

Zone 2: около 44063 coins от collected sales и 9800 от rewards; продажи дают 81.8% поступлений. [Engine ledger: payments, pending, phases, resource states](../test-results/v07c/engine-results.json). Никакие доходы от theoretical production не зачислены прямо в wallet.

Нормальные bottlenecks: Defender и lobster, hires4/5, storage/cutter/wreck, затем fresh metal deliveries, swordfish/hires6/7, den/squid/route. Пока player занят metal, флот копит cash — один отдельный hire может стать коротким. Серии нескольких economic purchases подряд за quest windfall в normal не наблюдаются.

## Проекция milestones

| Q | OBSERVED completion | MODELED normal mean | Seed range |
|---|---|---|---|
| 15 | 11:00 | 11:00, закреплено | Zone 1 неизменна |
| 20 | 15:00 | 17:19 | 17:09–17:28 |
| 25 | 16:10 | 21:32 | 21:24–21:37 |
| 30 | нет данных | 28:06 | 27:50–28:22 |
| 34 | нет данных | 33:59 | 33:46–34:14 |

| Scenario | Raw Engine full | Calibrated Zone 2 | Full with observed Zone 1 anchor |
|---|---|---|---|
| NORMAL, free skips available | 32:44–33:15 | 22:38–23:06 | 33:46–34:14 |
| EFFICIENT, более частый pickup | 32:38–33:18 | 22:35–23:15 | 33:43–34:22 |
| SLOWER,85% input speed +detours +optional cargo | 36:55–37:38 | 23:40–24:47 | 34:48–35:54 |
| Optional Golden, штатные offer/watch/claim | 28:13–29:21 | 19:31–20:33 | 30:39–31:40 |

C закрепляет принятую Zone 1 для сравнения только Zone 2. При столь же медленной Zone 1 общий прогноз 38:39–39:13. E не гарантированно быстрее на каждом seed: смена маршрутов pickup меняет depletion/AI и накопление pending. Средние близки; нельзя обещать фиксированный выигрыш.

Golden даёт около 2–3 минут ускорения Zone 2. На отдельных seeds Q27 проходит за 12–26 s после денег, накопленных во время Q26; следующие hires/infrastructure требуют свежих продаж. Значимых подряд reward-financed purchase chains нет. Monetization logic не менялась.

### Free skips, совпадение с записью

A использует все доступные free skips: 26 за полную игру. В записи было 10 до Q25, поэтому добавлен отдельный H: ровно те же 10 order IDs и реальные задержки skip до Q25; остальные ранние таймеры ждёт, затем использует обычные free skips. В Defender человек ждал timer; H делает то же. Собственная calibration H: k=0.948066.

| H seed | Raw Zone 2 | Calibrated Zone 2 | Full anchor |
|---|---|---|---|
| 41 | 24:14 | 22:59 | 34:06 |
| 97 | 24:28 | 23:12 | 34:19 |
| 211 | 23:27 | 22:14 | 33:22 |

Наблюдавшиеся skip IDs: tuna,cargo3,gate,lobster,workers4/5,cargo4,storage,wreck,salvage1. Free threshold `<60 s`, не `≤60`. H и A поддерживают прогноз около 34 минут. Это моделирование обычных бесплатных пропусков, без rewarded ads.

### Все 34 quests

| Q | Источник | Duration s | Cumulative time |
|---|---|---:|---|
| 1 | OBSERVED, unchanged | 5.4 | 0:05 |
| 2 | OBSERVED, unchanged | 0 | 0:11 |
| 3 | OBSERVED, unchanged | 2.2 | 0:19 |
| 4 | OBSERVED, unchanged | 7.2 | 0:28 |
| 5 | OBSERVED, unchanged | 13.7 | 0:43 |
| 6 | OBSERVED, unchanged | 55.2 | 1:42 |
| 7 | OBSERVED, unchanged | 53.7 | 2:38 |
| 8 | OBSERVED, unchanged | 88.2 | 4:08 |
| 9 | OBSERVED, unchanged | 5.2 | 4:16 |
| 10 | OBSERVED, unchanged | 10.2 | 4:28 |
| 11 | OBSERVED, unchanged | 69.1 | 5:41 |
| 12 | OBSERVED, unchanged | 46.2 | 6:29 |
| 13 | OBSERVED, unchanged | 75.4 | 7:46 |
| 14 | OBSERVED, unchanged | 67 | 9:07 |
| 15 | OBSERVED, unchanged | 106.3 | 11:00 |
| 16 | MODELED | 117.7 | 13:05 |
| 17 | MODELED | 10.3 | 13:16 |
| 18 | MODELED | 104.6 | 15:00 |
| 19 | MODELED | 77 | 16:17 |
| 20 | MODELED | 61.7 | 17:19 |
| 21 | MODELED | 60.2 | 18:19 |
| 22 | MODELED | 42.8 | 19:02 |
| 23 | MODELED | 61.5 | 20:03 |
| 24 | MODELED | 51.4 | 20:55 |
| 25 | MODELED | 37.3 | 21:32 |
| 26 | MODELED | 88.6 | 23:01 |
| 27 | MODELED | 70.2 | 24:11 |
| 28 | MODELED | 95.7 | 25:47 |
| 29 | MODELED | 65.2 | 26:52 |
| 30 | MODELED | 73.9 | 28:06 |
| 31 | MODELED | 97.8 | 29:44 |
| 32 | MODELED | 102.8 | 31:26 |
| 33 | MODELED | 59.9 | 32:26 |
| 34 | MODELED | 92.6 | 33:59 |

Q1–15 duration — фактический activation→completion; claim delays уже есть в cumulative clock. Для Zone 2 duration — агрегатно откалиброванный progression/claim estimate; точное разделение completion/claim без нового человека неизвестно. [Все clocks и projections](../test-results/v07c/projection.json).

## Metal / softlock boundary

- Storage100→150, upgrade30 M, den50 M, route80 M: каждый расход в пределах соответствующего cap, всего160 M. Wreck появляется до metal gates; storage/cutter/wreck/first salvage metal не требуют.
- Q24/Q26 требуют соответственно10/50 новых доставок. Player и salvage реально доставляют metal. Engine сохраняет cargo/storage cap и частичную оплату material investments.
- 15 новых unfunded прогонов A/E/C/B×3 +H×3 завершили Q34 без negative state, debug grants и превышения caps. Дополнительно выполнены два before calibration runs.

**VERIFIED pre-existing edge:** synthetic fixture metal100 перед activation Q24 либо Q26: progress0, metal delivery блокируется, cargo остаётся, visible metal-cost sinks отсутствуют. Это одинаково before/v07c: [softlock-audit.json](../test-results/v07c/softlock-audit.json). Причина: `activateQuest/questProgress` baseline свежих deliveries +`deposit` cap +`offers/revealed` доступны позже.

Критерий «достижимы normal routes» подтверждён; абсолютное «никакой softlock» не подтверждено. Исправление требует изменения since_activation, правила склада или раскрытия metal-spending purchases; заданием эти механики защищены. Поэтому критерий10 отмечен как ограничение, а не ложный PASS.

## Защита Zone 1 / REFERENCE

REFERENCE bytes before=after, SHA-256: `3312de6265923cb3bef87f6a0359cb898dbaf3e003df4d63957f3acb97f1553b`. Все его параметры, rewards, resource values, costs, timers и scaling неизменны.

FAST Q1–15 целиком, все Zone1 resources, base worker/cargo tables/timers, speedboat, gate1400/30 s, units, AI, combat, movement/collisions, navigation, quests conditions/order/IDs, analytics/localization/UI и save schema неизменны. Zone1 optional late tiers тоже не изменены. Новые worker/cargo prices ограничены runtime state FAST Zone2.

Source/public изменены ровно4 файла: balance_fast.json, config/types.ts, config/load.ts, game/systems/construction.ts. Остальные 87 файла src/public совпали по SHA-256. [Exact field diff +hash audit](../test-results/v07c/scope.json). Это non-Git checkout: сохранены before snapshots и SHA-256 вместо недоступного git status.

Все existing partial/building orders сохраняют cost, paid amounts и deadline; rewards не выдаются второй раз; profile saves не смешиваются. Старые накопленные деньги НЕ удаляются. Поэтому продолжение старого Q26 save может быть быстрее нового fresh run. Пользовательские saves не открывались.

Добавлены scripts/balance-v07c.mjs, scripts/report-v07c.mjs, tests/balance-v07c.test.ts, этот документ и отдельные evidence в test-results/v07c. Обновлены legacy tests balance-v04a/corrections-v031/traffic-v04b только для разрешённой economy/reward части; все quest conditions и REFERENCE protection сохранены. Штатные docs/QUESTS.md/.csv перегенерированы.

## Validation

| Check | Result | Evidence |
|---|---|---|
| TypeScript +Vite | PASS; прежний Phaser chunk warning | test-results/v07c/build.log |
| Full Vitest | PASS229/229,23 suites | test-results/v07c/tests.log |
| Focused late overrides/protection/save contracts | PASS5 tests | tests/balance-v07c.test.ts |
| Unfunded physical Engine A/E/C/B×3 +H×3 | PASS15/15,debug0,no rewarded timer skips | engine-results.json,engine-pattern-results.json |
| Save/load migrations,partial price/deadline,physical coin income,claim once,isolation | PASS fixtures,реальные saves не открывались | balance-v07c/balance-v04a/systems tests |
| Server-backed browser smoke | PASS15 groups,consoleErrors=[] | test-results/v07c/browser/smoke.json,browser.log |
| Generated quest tables | PASS68 rows | npm run quests |
| Source/profile/hash/numeric field diff | PASS scope | scope.json |
| Абсолютное отсутствие metal softlock | НЕ ПОДТВЕРЖДЕНО,старый edge воспроизведён | softlock-audit.json |
| Human34 quest pacing / real device | НЕ ПРОВЕРЕНО | следующий плейтест |

Первый smoke получил HTTP failure из-за аргументов npm/Vite: они стали неверным root. После прямого запуска Vite на5174 все группы прошли. Native headless visibility недоступна: эта группа smoke проверяет deterministic events, не реальный OS/mobile переход.

## Uncertainty / следующий живой плейтест

1. Провести свежий FAST run без Golden/debug/rewarded ads, с обычными free skips. Продолжение старого Q26-save с прежними rewards не проверяет новую кривую.
2. Зафиксировать completion/claim Q15/20/25/30/34, покупки optional tiers, состав флота, pending coins, skips, metal и production. Ориентир ~34 min full/~23 min Zone2.
3. Проверить заметный прирост collected sales после lobster/swordfish, пользу наймов, depletion и новые restocks. Дополнительный запас может сильнее помочь человеку или изменить burst timing.
4. Q26–34 не имеют human calibration; delayed pickup, metal trips, optional purchases и уже выполненные lifetime counters меняют отдельные времена. Нет произвольных duration locks.
5. Отдельно проверить ранее существовавший full-storage edge перед Q24/Q26. Для его устранения нужен следующий scope, допускающий изменение механики.

Модели соответствуют30–35 min, но одна запись, обрывающаяся наQ26, не позволяет надёжно гарантировать этот диапазон человеку. ±15% изменения Zone2 effective income/interaction даёт ориентировочную полосу ~30:20–37:40; это sensitivity, не statistical interval.

## Reproduce

Из fishing-game/, исходный JSON доступен по аргументу либо в Downloads:

```text
node scripts/balance-v07c.mjs --baseline
node scripts/balance-v07c.mjs --matrix
node scripts/balance-v07c.mjs --baseline --pattern
node scripts/balance-v07c.mjs --pattern
node scripts/report-v07c.mjs
npm test
npm run build
npm run quests
```

Скрипты пишут только внутрь fishing-game/test-results/v07c и docs. Исходный JSON и production configuration ими не меняются; первые before snapshots не перезаписываются. Исторические candidate-config/results — промежуточное предложение; final evidence — engine-results/projection/scope.
