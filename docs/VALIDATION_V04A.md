# Validation v0.4a

Дата2026-10-13. Локальная production preview, без публикации и без доступа к пользовательским saves.

## Checks

| Проверка | Результат | Evidence |
|---|---|---|
| Baseline build/tests | PASS127/127,13 suites | test-results/v04a/baseline-build.log,baseline-tests.log |
| Final build | PASS TypeScript+Vite; прежнее warning большого Phaser chunk | test-results/v04a/build.log |
| Final npm test | PASS141/141,14 suites | test-results/v04a/tests.log |
| All34 funded progression fast/reference | PASS; mechanics only, excludes pacing claims | tests/progression.test.ts,tests.log |
| All34 unfunded Engine A/B/C/D seeds41,97,211 before/after | PASS24/24; debug_income0, no timer skips | test-results/v04a/baseline-final-*.json,final-*.json |
| Browser regression | PASS15 groups, consoleErrors=[] | browser-regression.log; browser-regression/ screenshots |
| Browser UX | PASS10 groups, WebGL renderer2, consoleErrors=[] | browser-ux.log,v032-smoke.json,v032-mobile.png,v032-desktop-drag.png |
| Browser economy profiles+old save fixtures | PASS2 profiles, consoleErrors=[] | browser-v04a.log,browser/smoke.json,browser/fast-pending.png,reference-pending.png |
| Golden, qualifying earn, real pickups, worker income, drops | PASS existing unit+browser regression | golden-v03,coins-v03,corrections-v031,systems tests |
| Storage/metal, category exit, Free/RewardedSkip | PASS; free threshold59.999 vs60, double-currency conservation | systems,corrections-v031,balance-v04a tests |
| Old partial/building/pending/unclaimed/zone2 saves, isolation | PASS, both profiles, saved costs/deadlines authoritative | balance-v04a.test.ts,browser-v04a.mjs |
| Fresh1.0.2 native formulas | CONFIRMED stepped worker rounding and banker Golden rounding | source-formulas-102.asm; source-evidence-v04a.py |

## Simulation

| Сценарий | 15 квестов ДО, мин | ПОСЛЕ, мин | Море → готовый защитник ДО, с | ПОСЛЕ, с | Все 34 ДО, мин | ПОСЛЕ, мин |
|---|---|---|---|---|---|---|
| A | 17.87–18.27 | 9.57–9.91 | 1278.20–1284.60 | 108.00–118.40 | 140.23–140.41 | 31.53–32.23 |
| B | 16.03–16.31 | 8.53–9.02 | 1124.00–1144.40 | 100.40–112.20 | 125.60–126.61 | 29.36–29.81 |
| C | 21.46–21.55 | 12.28–12.71 | 1324.80–1361.40 | 115.20–148.80 | 149.81–151.85 | 35.37–36.91 |
| D | 69.88–70.01 | 76.75–76.97 | 596.60–617.60 | 1180.60–1209.80 | 310.42–312.92 | 308.93–310.46 |

Model controls Engine.input every.2с and advances Engine.update(.2) at speed1; real Engine internally ticks at min(dt_s,1/30). No teleport, coins grant, opened flags, forced order readiness, offline acceleration or rewarded skips in A–D. Uses real navigationTarget, stock/restock, HP drops, cap/expiry/reservation, worker65/35AI, depot, physical coins, orders/payment/exit guards, construction, combat and quests. A/D/B prioritize required chain, choose trip by route-adjusted cycle return, collect nearby loose crates and banked worker money. Metal payments can be partial to free full storage. Full metal cargo does not stop port coin collection; driver visits worker cash while holding metal until a sink opens. B journeys to moving merchant, waits fake_ad_s and physically collects10 piles; claims only naturally appearing offers. C documented input/routes/optionalcargo investment.

Baseline uses immutable configs AND original Engine/modules from .local/v04a-baseline/src via esbuild resolver, so new reference worker rounding cannot contaminate before runs. Simulation policy is shared before/after. Source systems, tests and JSON were backed up before edits. Optional baseline loader depends on local snapshot; current simulation and tests work from public JSON/source.

| Scenario | Longest quest, min (range) | Longest interval without collected sale, s | Longest stationary without player catch/cash/metal, s |
|---|---|---|---|
| A | 2.85–3.50 | 46.00–56.80 | 3.60–5.40 |
| B | 3.03–3.52 | 51.80–56.60 | 3.20–9.40 |
| C | 3.12–3.58 | 56.60–63.60 | 2.20–5.00 |
| D | 55.82–55.99 | 55.80–97.40 | 7.00–83.60 |

The last column ignores worker activity/construction and is a narrow player-idle diagnostic, not total time with no decisions. cash_wait_s means active accumulation while unable to fund next required order, includes gathering/travel; it is not passive waiting. fish_per_min uses stage-collected payouts and is affected by accumulated cash/bursts. Golden/quest income tracked separately. Per-quest wallet, prerequisites, fleet, timers and source recovery states are in JSON and QUEST_AUDIT_V04A.csv.

A41 gate checkpoint stress: intact109.6с, depleted178.8с, intact+forcedGolden103.6с, depleted+forcedGolden135.6с. Only this technical sensitivity modifies source phase/merchant timing, no grants. These values are not natural gameplay measurements. Natural C worst148.8с, remaining risk disclosed.

## Save compatibility

No save.ts or schema/key changes. Tests create v0.3.2 states from frozen config: partially paid defender12000, unfinished wreck order with old duration,83 pending coins, completed_unclaimed goal, zone2/metal12–17; load with new configs preserves amounts and deadlines. Collection and claims credited once, repeated reload safe. New-price orders use new JSON; existing-price orders remain old contract, including expensive partial defender. Changing HP/stock does not discard old source state/cargo values; ordinary full restock loads new stock/HP.

## Regression fixture changes

- Old frozen price test no longer asserts all economy fields unchanged; retains units/combat/geometry/quest order, plus v04a explicitly checks unchanged interaction/navigation/world/docks/presentation/save/AI/all quests.
- worker cost assertion306→300 follows freshly verified1.0.2; FAST geometric rounding unchanged.
- Free/RewardedSkip technical test sets remaining60 explicitly; production gate timer30 naturally enters free branch. Browser regression gate rewarded fixture sets120 to continue testing cancel/confirm, not pacing. Game logic untouched.
- All natural model tests remain unfunded; technical funded fixtures are labelled and excluded from duration evidence.

## Reproduce

~~~powershell
npm run build
npm test
npm run balance:baseline
npm run balance
npm run balance:stress
npm run balance:reports
npm run quests
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4184 --strictPort
# Another terminal
$env:SMOKE_URL='http://127.0.0.1:4184'
$env:SMOKE_OUTPUT='test-results/v04a/browser-regression'
npm run test:smoke
npm run test:ux
npm run test:economy-browser
~~~

## Limits and manual pass

This is actual-system simulation with synthetic decisions, not a human gameplay timing measurement. It omits reading/claim delays, unscripted indecision, touchscreen precision, fatigue and hypothetical future navigation changes. Native powf is emulated via Math.pow→float32; configured10 normal hires and band boundaries verified. Human20-minute session and original runtime/server not observed. No exhaustive economic reachability proof for arbitrary old saves/optional investments/AFK.

1. Fresh FAST without Golden/skips:15 quests at≈10мин, defender ready by≈12, compare collected wallet and fishing decisions with A.
2. Deliberately waste routes, buy optional upgrades, drain tuna and allow loose crates to expire: check whether >2min defender feels acceptable; retry alternatives.
3. Full34 FAST session, especially metal10/50, full warehouse before den, swordfish/squid and distant route. REFERENCE early and a long zone2 session.
4. Copy an existing save with partial12000 defender, building objects and pending coins/quest: observe grandfathered price/deadline, export/import, no duplicate income.
5. Real AndroidChrome/iOSSafari: input/camera and pickup readability, background resume, maxfleet150crate performance. These are not claimed passed by headless smoke.

No v0.4b collision/nav work, third zone, combat change, publishing, reset, commit or archive rewrite performed.
