# Таблица квестов из runtime-конфигов v0.4a

Генерация: `npm run quests`. Стоимость — необходимые новые заказы при прохождении по цепочке; можно оплатить раньше. Для квеста 10 катер уже оплачен в квесте 9, указан полный таймер этого же заказа, а не дополнительное строительство. `+` объединяет последовательные заказы. Таймер строительства не равен времени прохождения. Input-driven Engine simulation до/после и все 34 цели: [BALANCE_V04A](BALANCE_V04A.md), [QUEST_AUDIT_V04A.csv](QUEST_AUDIT_V04A.csv). Это расчёт модели, не измеренный человеческий playtime. REFERENCE использует проверенную ступенчатую формулу найма 1.0.2.

## fast

Zone 2 sequential purchase costs use `fast_zone2` prices after claiming Q15. Prepaid orders keep their original price.

| № | Задание | Монеты / металл | Таймеры, с | Награда ◉ | Условие / режим / момент |
|---|---|---|---|---|---|
| 1 | Поймать первую сардину | 0 / 0 | 0 | 8 | catch_sardine >= 1; lifetime; catch |
| 2 | Доставить улов в порт | 0 / 0 | 0 | 12 | deliver_fish >= 1; lifetime; deposited |
| 3 | Поймать всего 3 ящика улова | 0 / 0 | 0 | 16 | catch_total >= 3; lifetime; catch |
| 4 | Улучшить трюм до Lv.1 | 13 / 0 | 1 | 16 | cargo_level >= 1; lifetime; upgrade_ready |
| 5 | Открыть крабовую отмель | 38 / 0 | 1 | 20 | resource_ready(crab) = unlocked; lifetime; timer_ready |
| 6 | Нанять первую рабочую лодку | 75 / 0 | 1 | 24 | normal_workers >= 1; lifetime; worker_ready |
| 7 | Улучшить трюм до Lv.2 | 98 / 0 | 1 | 32 | cargo_level >= 2; lifetime; upgrade_ready |
| 8 | Заработать 200 монет | 0 / 0 | 0 | 40 | earn_coins >= 200; since_activation; progress_reached |
| 9 | Заказать скоростной катер | 200 / 0 | 12 | 35 | speedboat_ordered >= 1; lifetime; order_paid |
| 10 | Получить скоростной катер | 0 / 0 | 12 | 50 | speedboat_ready >= 1; lifetime; timer_ready |
| 11 | Открыть мидиевую банку | 294 / 0 | 29 | 65 | resource_ready(mussel) = unlocked; lifetime; timer_ready |
| 12 | Довести обычный флот до 3 лодок | 312 / 0 | 7+7 | 100 | normal_workers >= 3; lifetime; workers_ready |
| 13 | Открыть косяк красного луциана | 450 / 0 | 20 | 140 | resource_ready(snapper) = unlocked; lifetime; timer_ready |
| 14 | Открыть косяк тунца | 900 / 0 | 30 | 220 | resource_ready(tuna) = unlocked; lifetime; timer_ready |
| 15 | Открыть проход в открытое море | 1400 / 0 | 30 | 350 | area_unlocked >= 2; lifetime; timer_ready |
| 16 | Приобрести боевой катер | 2200 / 0 | 20 | 350 | defender_ready >= 1; lifetime; timer_ready |
| 17 | Победить двух пиратов | 0 / 0 | 0 | 200 | pirates_killed >= 2; since_activation; progress_reached |
| 18 | Открыть место ловли омаров | 2200 / 0 | 35 | 450 | resource_ready(lobster) = unlocked; lifetime; timer_ready |
| 19 | Увеличить флот до 5 обычных лодок | 1600 / 0 | 15+22 | 500 | normal_workers >= 5; lifetime; workers_ready |
| 20 | Улучшить трюм до Lv.4 | 1725 / 0 | 6+12 | 450 | cargo_level >= 4; lifetime; upgrade_ready |
| 21 | Построить склад металлолома | 2400 / 0 | 25 | 500 | metal_storage_ready >= 1; lifetime; timer_ready |
| 22 | Купить оборудование для резки металла | 1500 / 0 | 0 | 300 | metal_cutter_owned >= 1; lifetime; order_paid |
| 23 | Доставить затонувший корабль | 1800 / 0 | 20 | 550 | wreck_ready >= 1; lifetime; timer_ready |
| 24 | Доставить 10 единиц металлолома | 0 / 0 | 0 | 300 | metal_deposited >= 10; since_activation; progress_reached |
| 25 | Нанять первое судно-разборщик | 3000 / 0 | 30 | 600 | salvage_workers >= 1; lifetime; worker_ready |
| 26 | Доставить 50 единиц металлолома | 0 / 0 | 0 | 300 | metal_deposited >= 50; since_activation; progress_reached |
| 27 | Открыть место ловли рыбы-меч | 3900 / 0 | 45 | 650 | resource_ready(swordfish) = unlocked; lifetime; timer_ready |
| 28 | Увеличить флот до 7 обычных лодок | 3000 / 0 | 37+75 | 600 | normal_workers >= 7; lifetime; workers_ready |
| 29 | Улучшить трюм до Lv.6 | 3600 / 0 | 24+60 | 600 | cargo_level >= 6; lifetime; upgrade_ready |
| 30 | Увеличить вместимость склада металла до 150 | 3400 / 30 | 40 | 600 | metal_storage_capacity >= 150; lifetime; upgrade_ready |
| 31 | Ликвидировать пиратское логово | 5400 / 50 | 45 | 500 | pirate_den_closed >= 1; lifetime; timer_ready |
| 32 | Открыть место ловли редкого кальмара | 5400 / 0 | 50 | 800 | resource_ready(squid) = unlocked; lifetime; timer_ready |
| 33 | Нанять второе судно-разборщик | 4500 / 0 | 30 | 550 | salvage_workers >= 2; lifetime; worker_ready |
| 34 | Открыть дальний морской маршрут | 7400 / 80 | 60 | 1000 | expedition_route_ready >= 1; lifetime; timer_ready |

## reference

| № | Задание | Монеты / металл | Таймеры, с | Награда ◉ | Условие / режим / момент |
|---|---|---|---|---|---|
| 1 | Поймать первую сардину | 0 / 0 | 0 | 12 | catch_sardine >= 1; lifetime; catch |
| 2 | Доставить улов в порт | 0 / 0 | 0 | 18 | deliver_fish >= 1; lifetime; deposited |
| 3 | Поймать всего 3 ящика улова | 0 / 0 | 0 | 24 | catch_total >= 3; lifetime; catch |
| 4 | Улучшить трюм до Lv.1 | 20 / 0 | 5 | 24 | cargo_level >= 1; lifetime; upgrade_ready |
| 5 | Открыть крабовую отмель | 90 / 0 | 5 | 35 | resource_ready(crab) = unlocked; lifetime; timer_ready |
| 6 | Нанять первую рабочую лодку | 100 / 0 | 5 | 45 | normal_workers >= 1; lifetime; worker_ready |
| 7 | Улучшить трюм до Lv.2 | 150 / 0 | 5 | 60 | cargo_level >= 2; lifetime; upgrade_ready |
| 8 | Заработать 200 монет | 0 / 0 | 0 | 80 | earn_coins >= 200; since_activation; progress_reached |
| 9 | Заказать скоростной катер | 300 / 0 | 30 | 60 | speedboat_ordered >= 1; lifetime; order_paid |
| 10 | Получить скоростной катер | 0 / 0 | 30 | 90 | speedboat_ready >= 1; lifetime; timer_ready |
| 11 | Открыть мидиевую банку | 700 / 0 | 180 | 120 | resource_ready(mussel) = unlocked; lifetime; timer_ready |
| 12 | Довести обычный флот до 3 лодок | 475 / 0 | 30+30 | 180 | normal_workers >= 3; lifetime; workers_ready |
| 13 | Открыть косяк красного луциана | 1600 / 0 | 300 | 240 | resource_ready(snapper) = unlocked; lifetime; timer_ready |
| 14 | Открыть косяк тунца | 6000 / 0 | 600 | 450 | resource_ready(tuna) = unlocked; lifetime; timer_ready |
| 15 | Открыть проход в открытое море | 12000 / 0 | 900 | 700 | area_unlocked >= 2; lifetime; timer_ready |
| 16 | Приобрести боевой катер | 12000 / 0 | 120 | 1080 | defender_ready >= 1; lifetime; timer_ready |
| 17 | Победить двух пиратов | 0 / 0 | 0 | 1350 | pirates_killed >= 2; since_activation; progress_reached |
| 18 | Открыть место ловли омаров | 8000 / 0 | 900 | 1620 | resource_ready(lobster) = unlocked; lifetime; timer_ready |
| 19 | Увеличить флот до 5 обычных лодок | 1500 / 0 | 60+90 | 1890 | normal_workers >= 5; lifetime; workers_ready |
| 20 | Улучшить трюм до Lv.4 | 1500 / 0 | 30+60 | 2160 | cargo_level >= 4; lifetime; upgrade_ready |
| 21 | Построить склад металлолома | 14000 / 0 | 120 | 2430 | metal_storage_ready >= 1; lifetime; timer_ready |
| 22 | Купить оборудование для резки металла | 5000 / 0 | 300 | 2700 | metal_cutter_owned >= 1; lifetime; order_paid |
| 23 | Доставить затонувший корабль | 27500 / 0 | 900 | 2970 | wreck_ready >= 1; lifetime; timer_ready |
| 24 | Доставить 10 единиц металлолома | 0 / 0 | 0 | 3240 | metal_deposited >= 10; since_activation; progress_reached |
| 25 | Нанять первое судно-разборщик | 7000 / 0 | 120 | 3510 | salvage_workers >= 1; lifetime; worker_ready |
| 26 | Доставить 50 единиц металлолома | 0 / 0 | 0 | 3780 | metal_deposited >= 50; since_activation; progress_reached |
| 27 | Открыть место ловли рыбы-меч | 55000 / 0 | 900 | 4050 | resource_ready(swordfish) = unlocked; lifetime; timer_ready |
| 28 | Увеличить флот до 7 обычных лодок | 4550 / 0 | 150+300 | 4320 | normal_workers >= 7; lifetime; workers_ready |
| 29 | Улучшить трюм до Lv.6 | 5000 / 0 | 120+300 | 4590 | cargo_level >= 6; lifetime; upgrade_ready |
| 30 | Увеличить вместимость склада металла до 150 | 20000 / 40 | 300 | 4860 | metal_storage_capacity >= 150; lifetime; upgrade_ready |
| 31 | Ликвидировать пиратское логово | 51000 / 150 | 120 | 5130 | pirate_den_closed >= 1; lifetime; timer_ready |
| 32 | Открыть место ловли редкого кальмара | 90000 / 0 | 900 | 5400 | resource_ready(squid) = unlocked; lifetime; timer_ready |
| 33 | Нанять второе судно-разборщик | 9450 / 0 | 300 | 5670 | salvage_workers >= 2; lifetime; worker_ready |
| 34 | Открыть дальний морской маршрут | 60000 / 80 | 600 | 5940 | expedition_route_ready >= 1; lifetime; timer_ready |
