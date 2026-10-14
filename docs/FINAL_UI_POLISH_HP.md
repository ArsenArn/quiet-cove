# Quiet Cove — Final UI Polish (2026-10-14)

Runtime changes are limited to `src/game/scenes/BayScene.ts` and the Salvager purchase point in both balance JSON files. No engine, economy, AI, collision, quest or save logic was edited.

- Resources use `nodes[id].hp / resources[id].portion_hp`: current harvest portion, independent of stock, crate count and recovery timers. Existing world graphics draw a compact rounded dark track and green fill above the resource. At depletion the track stays empty until the real recovery resets HP. Locked/hidden resources have no HP bar.
- Player, defender and pirate bars use their actual configured maximum HP, hide at full health, and show damage or zero HP. Player recovery remains visible in either territory. Workers, speedboat and salvagers have no combat HP; their `hp=0` is an existing sentinel, so they have no health bar.
- Salvager purchase moved from `(2135,1630)` to `(2160,1595)` in FAST and REFERENCE. Existing purchase circle, label, click navigation and payment share that point. Costs, prerequisites and collider geometry remain unchanged.
- Speedboat atlas directions are N, NE, E, SE / S, SW, W, duplicated NE. NW now mirrors the NE frame. All other frames retain their original mapping; logical heading and cargo placement remain unchanged.

Validation:

- `npm test`: final run 29 files, 287/287 tests passed. Initial run had one 60-second analytical simulation timeout and two worker RPC timeouts; unchanged suite passed on rerun.
- `npm run build`: passed (existing large-chunk warning).
- `scripts/browser-final-ui-polish.mjs`: both profiles, both territories; real harvest HP decrement, depletion/crates, regrow and restock; actual projectile damage, player regeneration and defender repair; pirate HP display; noncombat boats hidden; save roundtrip; full purchase-circle water clearance and route; real click/navigation/payment; all eight speedboat frames; 120 frames with stable display-object count. Zero console/page errors.
- General browser smoke: 15 groups passed, covering economy, quest claims, construction, save reload and profile isolation, navigation/collisions, combat, Golden Reward, touch UI and timers. Original script raced the Golden boat's next render frame; a copy in `test-results/final-ui-polish/smoke-run.mjs` replaces that immediate visibility assertion with `expect.poll`, leaving the source script and game unchanged. Its reset check uses a fresh isolated browser context only.
- Visually inspected eight directions and resource/boat partial/full HP screenshots. Evidence is in `test-results/final-ui-polish/`, including `browser.json` and `smoke/report.json`.

Manual follow-up: check readability at the actual phone's zoom and HP placement while many boats pass near a resource; this browser run does not establish physical-device performance or long-session traffic behavior. No user browser saves were accessed or reset. No deploy, commit or push.
