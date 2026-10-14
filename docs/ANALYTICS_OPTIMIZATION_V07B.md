# Analytics Optimization v0.7b

F2 → PLAYTEST ANALYTICS: **Export JSON** теперь скачивает Compact (без форматирующих пробелов), **Export Full JSON** — прежний подробный pretty-printed JSON с суффиксом `_full.json`. Оба содержат один самостоятельный JSON и работают во время записи или после Stop. UI style, gameplay, цены, квесты и управление не менялись.

## Формат и сохранённые данные

Compact сохраняет metadata/profile/config, все event IDs и clocks в исходном порядке, quest definitions/timings/rewards, income/spending/metal ledger, purchases/construction/fleet, resources/workers, Golden, combat, milestones, debug flags, periodic snapshots, initial/final snapshots, summary и aggregates. Денежные суммы и времена не округляются.

Главные изменения — обратимое устранение повторов:

- `payload.economy_snapshot_ref` и `effect_on_state_ref` указывают на `snapshots[].snapshot_id`. Центральные snapshots имеют стабильные IDs; отсутствовавшие там event-only snapshots добавляются с ID от event ID. Исходные periodic snapshots сохраняются.
- Числовые значения в `snapshot.investments[order_id]` и `snapshot.production.resource_states[resource_id]` — индексы в `snapshot_encoding.state_values`. Повторяющиеся order/node objects, включая locked resources, хранятся один раз. Полные initial/final snapshots сохранены непосредственно в своих top-level полях.
- Нулевые counters ресурсов/лодок внутри `economy_interval` опускаются, с явными defaults в `snapshot_encoding.zero_defaults`. В top-level aggregates все исходные поля сохранены.
- `resource_transition_rows` — строки по колонкам `snapshot_encoding.resource_transition_columns`: id/type/active_s/game_s/ready_at_game_s/phase. Все переходы и точные значения сохранены.
- `ended_ref="event_stamp"` заменяет interval ended, только когда его четыре clocks полностью совпадают с родительским event stamp. Started и отличающийся Ended остаются исходными объектами.

`snapshot_encoding.version=1` маркирует кодирование. Это дополнение к analytics schema_version=1; database version и keys не менялись. В самом JSON есть описание ссылок, paths, columns и zero defaults: Full файл для анализа не требуется. `original_snapshot_count` нужен только для точного восстановления старой diagnostic collection без добавленных event-only snapshots.

Пример чтения Python:

```python
import json
import pandas as pd

with open("playtest_FAST_compact.json", encoding="utf-8") as f:
    d = json.load(f)
encoding = d["snapshot_encoding"]
by_id = {s["snapshot_id"]: s for s in d["snapshots"]}
event = next(e for e in d["events"] if "economy_snapshot_ref" in e["payload"])
snapshot = by_id[event["payload"]["economy_snapshot_ref"]]
nodes = {k: encoding["state_values"][v]
         for k, v in snapshot["production"]["resource_states"].items()}
quests = pd.DataFrame(d["quests"])
for event in d["events"]:
    if event["event_type"] == "economy_interval":
        for resource, counters in event["payload"]["resources"].items():
            counters = {**encoding["zero_defaults"]["resources"], **counters}
assert d["summary"]["coins_reconciliation"]["residual"] == 0
assert d["summary"]["metal_reconciliation"]["residual"] == 0
```

## Storage / совместимость

Тот же lossless Compact representation записывается в существующий IndexedDB/localStorage key. При чтении он разворачивается в прежнюю in-memory структуру: observer, timing, ledger и recovery логика остались прежними. Старые inline v0.7a checkpoints читаются напрямую и доступны в обоих форматах. Разрушающая migration не выполняется.

Full восстанавливается целиком, включая прежние embedded snapshots, resource states и нулевые counters. Ограничения объёма, background/active-time policy, buffered flush и независимый игровой save сохраняются. В памяти остаётся исходная диагностическая структура; оптимизированы JSON export и persisted representation. Сжатие типа ZIP/gzip и внешние зависимости не добавлялись.

## Проверки и измерения

Representative source: существующий v0.7a `test-results/v07a/playtest_FAST_scripted_34.json` — 34 квеста, около 32.2 минуты scripted simulation. Источник не переписывается новыми тестами. Артефакты этой итерации находятся в `test-results/v07b/`.

`tests/analytics-v07b.test.ts` проверяет полное semantic равенство `expand(compact(original)) == original`, refs/ID stability, periodic snapshots, оригинальные quest timestamps/event clocks, все ledger/resource/worker/Golden/debug totals, компактное сохранение и reload, pause/stop/clear, старый v0.7a checkpoint и оба экспорта. Все поля Full сравниваются, а не только wallet.

`size-comparison.json` содержит точные UTF-8 before/after byte sizes. Для storage измеряется serialized recording payload без IndexedDB overhead; реальная browser quota зависит от браузера. Новый 34-chain прогон сохраняется в `playtest_FAST_scripted_34.json` / `scripted-validation.json` этой итерации. Coins/metal reconciliation остаётся нулевой.

| Одна и та же 34-quest запись | UTF-8 bytes |
|---|---:|
| Прежний pretty-printed Full | 4 945 124 |
| Новый Compact | 1 418 836 |
| Прежний minified payload | 2 959 054 |

Compact меньше Full в **3.485× (71.3%)**, minified payload — на **52.1%**. Полное разворачивание возвращает каждый исходный field/value; ориентир 5× не достигнут. In-memory диагностические копии сохраняются, чтобы ограничить риск recovery regression.

Итог: build PASSED; `npm test` — **224/224**, 22 файла; v0.7b tests — 6/6. Новый scripted FAST прогон: 34/34, coins `0+88990-80368=8622`, metal `0+290-160=130`, оба residual=0. Production Edge browser: 10 групп PASSED, 0 console/page errors, включая оба настоящих downloads. Portrait screenshot просмотрен: дополнительная кнопка использует существующий wrap строки, controls видимы, CSS не менялся.

Browser smoke использует существующий production Edge script и isolated context: Start/Stop, Compact/Full downloads с чтением файла обратно, identical analytical totals/times, actual quests/physical pickup, IndexedDB reload, Clear, New Game, FAST/REFERENCE isolation и portrait controls. Browser report: `browser-validation.json`.

Команды: `npm run build`, `npm test`, `npm run test:analytics`, `npm run test:analytics-browser` (production preview на 5180 или `SMOKE_URL`).

Ориентир 5× желателен, но не гарантируется для любого состава записи: доля уникального interval ledger ограничивает lossless reduction. Full намеренно остаётся большим. Worker idle time, реальные телефоны, аварийное закрытие браузера и human pacing сохраняют ограничения v0.7a.
