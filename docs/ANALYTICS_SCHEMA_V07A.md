# Analytics JSON schema v0.7a / version 1

В v0.7b этот inline формат доступен через **Export Full JSON**. Для нового default Compact см. [ссылки snapshots, state tables и zero defaults](ANALYTICS_OPTIMIZATION_V07B.md).

Один самостоятельный UTF-8 JSON object. Top-level keys: `schema_version`, `metadata`, `session`, `initial_snapshot`, `events`, `snapshots`, `aggregates`, `quests`, `balance_configuration`, `final_snapshot`, `summary`. Внутренний persistence checkpoint не экспортируется. Nullable исторические величины обозначаются null, не NaN/Infinity/undefined.

## Metadata / session

Metadata содержит `game_name`, `game_version=0.7a`, `build_identifier=null` (отдельного build ID нет), `balance_profile`, `balance_fingerprint`, `analytics_schema_version=1`, `started_at`, `exported_at`, `language`, `export_language`, `debug_modified`, `recording_started_midgame`, `limitations`, `storage_backend`, `storage_limit_bytes`, `storage_warning`.

Fingerprint — `fnv1a32:<hex>` от canonical JSON с сортированными ключами объектов и исходным порядком массивов. Это identifier, не security hash. Полный реально загруженный Balance JSON включён: 34 quest definitions, цены/награды/build times, worker price growth, ресурсы, gathering/regrow/restock, Golden, combat и прочие небольшие числовые настройки. Ассетов и текстур нет. После debug override baseline config остаётся исходным, новый config находится в событии `balance_configuration_changed`.

Session: `session_id`, `wall_duration_s`, `active_duration_s`, `game_duration_s`, `recording_status` (RECORDING/STOPPED), `stop_reason`, `pause_intervals`. Интервал паузы: UTC `started_at`, nullable `ended_at`, `reason`, `wall_duration_s`. Открытая пауза в экспортируемой копии имеет рассчитанную текущую длительность и null end.

Каждое событие и snapshot имеют UTC `event_timestamp` и числа секунд `elapsed_wall_time_s`, `elapsed_active_time_s`, `elapsed_game_time_s`. В stamp game time — относительное время от Start; исходный абсолютный clock передаётся явно в полях с `*_game_time` / `*_at_game_s`.

## Events

Оболочка: `event_id` = `<session_id>:<monotonic-sequence>`, `event_type`, nullable `quest_id`, три elapsed clocks, UTC timestamp, `payload`. ID стабилен после reload и export. Event types case-sensitive.

| События | Основной payload / значение |
|---|---|
| `session_started`, `session_stopped` | baseline_game_time / reason |
| `session_pause`, `session_resume`, `reload_gap` | reason, wall-only gap, game clock difference |
| `offline_progression` | offlineSeconds, timers-only policy; не доход |
| `restoration_adjustment` | coins/metal differences между независимыми checkpoints |
| `QUEST_ACTIVATED` | quest_id/number/type/title, required_target, target, progress, baseline, economy snapshot |
| `QUEST_COMPLETED` | completion_time, duration_since_activation, wallet, fleet, economy snapshot |
| `QUEST_REWARD_CLAIMED` | reward_amount/reward_metal, completion→claim delay, wallet/metal before/after |
| `quest_baseline_completed`, `quest_reactivated` | неизвестное историческое completion / повторная debug activation |
| `PURCHASE_STARTED`, `PURCHASE_PARTIAL`, `PURCHASE_FULLY_PAID` | purchase ID/category/tier, full/paid/remaining coins и metal, wallet/metal, payment session |
| `CONSTRUCTION_STARTED`, `CONSTRUCTION_COMPLETED`, `CONSTRUCTION_SKIPPED` | duration, actual_waiting_active_s/game_s, skip_type free/rewarded, fleet |
| `worker_created`, `defender_purchased`, `defender_obtained` | boat type/cost, before/after count, progression; defender purchased значит fully paid |
| `boat_type_unlocked`, `defender_unlocked`, `salvage_worker_unlocked`, `purchase_available` | впервые revealed purchase category; ownership отдельно |
| `resource_zone_available`, `resource_zone_built`, `scrap_resource_unlocked` | revealed offer / завершённый объект |
| `territory_paid`, `territory_construction_completed`, `zone_2_entered` | fully paid / завершённый gate / реальное пересечение границы |
| `scrap_storage_unlocked`, `scrap_storage_built`, `scrap_mining_unlocked` | revealed storage / готовый storage / готовый cutter |
| `golden_boat_available`, `golden_offer_shown`, `golden_offer_accepted`, `golden_offer_declined`, `golden_offer_expired`, `golden_reward_cancelled` | offer/transaction identifiers, offered coins когда есть в source event |
| `fake_ad_started`, `fake_ad_completed`, `fake_ad_cancelled` | source golden/timer, transaction/purchase ID; completed означает досмотрен fake ad |
| `golden_coins_spawned`, `golden_coins_collected` | spawned amount отдельно от фактически полученного income |
| `pirate_killed`, `player_destroyed`, `player_respawned`, `defender_destroyed`, `defender_respawned` | authoritative combat milestones |
| `DEBUG_ACTION`, `balance_configuration_changed` | action, parameters, effect snapshot / full runtime override config+hash |
| `economy_interval` | полные агрегированные доходы, металл, resources, workers, combat, resource transitions за интервал |

`quest_title` — label из реально загруженного Balance, независимо от языка UI. Milestone snapshots фиксируют текущий кошелёк, квест, флот и открытые ресурсы. Revealed purchase означает показанную возможность; prerequisite/blocked состояния продолжают контролироваться игровым движком.

### Ledger: как не посчитать деньги дважды

Единственные debit records — `PURCHASE_PARTIAL.payload.expense_coins/expense_metal`, включая последний взнос полной оплаты. STARTED/FULLY_PAID/CONSTRUCTION — milestones с cumulative paid amounts, не дополнительные расходы. PARTIAL агрегирует взносы; `wallet_before/after` и `metal_before/after` относятся к первому/последнему взносу этого интервала, `coins/metal` — точные суммы взносов. Между ними могли быть доходы; они находятся в interval ledger.

Единственные credit records — `economy_interval.payload.income` по источникам и `metal_income`. QUEST_REWARD_CLAIMED и golden_coins_collected описывают те же поступления, их **не надо прибавлять ещё раз**. Pending coins считаются отдельно, не входят в income. Debug отрицательные wallet changes и restoration corrections находятся в `coin_adjustments` / `metal_adjustments`; restoration events позволяют объяснить сумму.

Interval payload:

```json
{
  "started": {"event_timestamp":"...","elapsed_wall_time_s":0,"elapsed_active_time_s":0,"elapsed_game_time_s":0},
  "ended": {"event_timestamp":"...","elapsed_wall_time_s":5,"elapsed_active_time_s":5,"elapsed_game_time_s":5},
  "income": {"fish_sale":10},
  "metal_income":0,
  "resources": {},
  "workers": {},
  "combat": {},
  "resource_transitions": []
}
```

Transition entries: `id`, `type` (`resource_depleted` / `resource_recovered`), `active_s`, `game_s`, nullable `ready_at_game_s`, nullable `phase` (regrow/restock). Они сохраняют времена повторяющихся transitions без отдельной большой event envelope. Начальные/current состояния nodes находятся в snapshots. Aggregate combat damage не является отдельной wallet операцией.

## Snapshots / aggregates / quests

Snapshots имеют `reason`; `time.wall_time/active_time/game_time`; `progress.quest_number/quest_status/unlocked_zone/unlocked_resources`; `economy.wallet/pending_coins_total/pending_coins_by_source/metal/total_earned/total_spent/fish_sale_income/golden_income/quest_reward_income/debug_income`; `fleet.player_capacity/worker_count/speedboat_count/salvage_worker_count/defender_count`; `production.resources_collected/delivered_resources/cumulative_sales/last_30s_sales_income/last_60s_sales_income/cargo_units_by_resource/floating_crates_count/resource_states`; current `investments` и `flags`.

Resource aggregate: `units_collected`, `units_delivered`, `coins_earned`, `player_units`, `worker_units`, `floating_crates_collected`, `floating_crates_expired`, `depletions`, `recoveries`. Workers indexed by boat ID: `collected_resources`, `deliveries`, `earned_coins`; player имеет свою запись ID `player`. Purchases indexed by order ID: session coins/metal spent, start/build/complete times, skip_type. `total_workers_hired` включает normal/speedboat/salvage, defender отдельно в fleet.

`quests` всегда содержит 34 строки: quest_id/number, activated_at_s/completed_at_s/claimed_at_s/duration_s (active-time), wallet_at_activation/completion, reward, status, baseline, completion_predates_recording. Статусы: not_activated / active / completed_unclaimed / claimed / claimed_before_recording. Null означает неизвестно/не происходило; 0 — реально нулевая длительность. Previously claimed строки не считаются новыми completed/claimed quests.

Summary содержит количества completed/claimed после Start, active/wall playtime, earned/spent/final wallet, source incomes, hired workers, zone_2_unlock_time (gate ready), defender_purchase_time (fully paid), quest_milestone_times и обе reconciliation objects. Время milestones до baseline остаётся null.

Проверочная формула: `initial + earned - spent + adjustments = final`. `residual=0` означает сверенную запись. Metal считает deposits, quest/debug grants и реальные metal payments; capacity не является начислением. Snapshot total_earned/spent и interval sums должны совпасть с aggregates/summary.

Пример чтения:

```python
import json
import pandas as pd

with open("playtest_FAST_example.json", encoding="utf-8") as f:
    data = json.load(f)
events = pd.json_normalize(data["events"])
quests = pd.DataFrame(data["quests"])
snapshots = pd.json_normalize(data["snapshots"])
assert data["summary"]["coins_reconciliation"]["residual"] == 0
assert data["summary"]["metal_reconciliation"]["residual"] == 0
```
