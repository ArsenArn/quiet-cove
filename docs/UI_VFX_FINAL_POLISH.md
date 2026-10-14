# Final UI / VFX polish

Date: 2026-10-13. Scope: button removal, coin presentation/placement, fishing net, calm resource idle motion.

## Changes

- Removed To sardines / К сардинам from the DOM, its action, localization entries and button styling. To port, Objects and unlocked To storage remain. Steering with WASD/arrows and the floating joystick is unchanged.
- Coin pickup display sizes: single **24 → 32 px**, small stack **29 → 38 px**, large pile **34 → 44 px** (world-space renderer dimensions). Numeric tags move up to leave room for larger art; existing textures/pools are reused.
- New fish-sale payouts appear in a compact crescent on the open-water arrival side of the port: **60–64 world px from its center**, outside the unchanged **38 px unload radius**. ID-based placement consumes no gameplay RNG. Candidate points must be on water, inside world bounds and reachable; edited maps can use a wider outer ring.
- Fish-sale pop-up animation starts at the new outer point, so coins do not visually start inside the unload circle. Golden reward scatter and its origin animation are unchanged. Already saved coin positions are retained on load.
- Net presentation now has a soft translucent oval, a defined cream rope rim with dark under-stroke, clipped mesh chords, eight restrained floats and smooth cast expansion. Low VFX quality reduces strands/floats; Off keeps only the lightweight tether/outline. Geometry is drawn into the existing Graphics object, with no per-frame textures, timers or additional particle systems.
- Resource motion uses deterministic phase-shifted sine curves: most fish ±1.6 px vertical, squid ±1.8 px, crustaceans ±1 px, mussels ±0.7 px, heavy wreck ±0.1 px. Horizontal drift is one fifth of vertical amplitude, scale stays exactly 1, rotation stays below 0.002 radians. About a 9.7 s vertical cycle; no randomness or per-frame position accumulation. The net follows the resource artwork, while gameplay node coordinates/colliders stay fixed.

## Protection of gameplay and saves

Prices, rewards, fish values, income classification, capacities, worker AI, movement/collision, pickup radius/speed/delay, construction times, quests and save schema/keys were not changed. The requested payout relocation is the only new simulation-position behavior. Coins remain one independent payout per delivered crate and credit only when collected. Moving toward the outer pile is now part of collection; standing at the port center need not collect it.

Engine, state schema, workers/resources/construction/save/movement systems and Joystick source were checked byte-for-byte against `.local/final-polish-before/`. `economy.ts` changes only the new fish-sale spawn position selection. Balance JSON and world geometry were not edited. Existing user saves were not accessed by the isolated browser tests.

## Changed files

Game sources:
- `src/ui/UI.ts`, `src/ui/style.css`, `src/ui/locales/catalog.ts` — remove navigation control/action/style/strings.
- `src/game/art/animation.ts` — visual coin sizes, calm idle motion, bounded net shape.
- `src/game/scenes/BayScene.ts` — net drawing, coin size/tag placement, outer-point coin pop-up.
- `src/game/systems/economy.ts` — reachable outer payout region.

Validation:
- New `tests/final-polish.test.ts`, `tests/helpers-coin-pickup.ts`, `scripts/browser-final-polish.mjs`.
- Updated `tests/coins-v03.test.ts`, `tests/gameplay-v02.test.ts`, `tests/systems.test.ts`, `tests/presentation-v02.test.ts`, `tests/progression.test.ts`, `tests/balance-v02.test.ts`, `tests/balance-v04a.test.ts`, `tests/animation-v05c.test.ts` for the explicitly changed pickup location.
- Updated `scripts/browser-smoke.mjs`, `scripts/browser-v032.mjs`, `scripts/browser-ui-v06.mjs` to use current controls/localized fixtures. The smoke command directly runs against the current UI; the wrapper no longer duplicates its old patches.
- New `docs/UI_VFX_FINAL_POLISH.md` (this report).

Source review: [implementation.diff](../test-results/final-polish/implementation.diff). Generated build files are in `dist/`; verification artifacts are isolated in `test-results/final-polish/`.

## Validation

| Check | Result |
|---|---|
| `npm run build` | PASSED; TypeScript + Vite. Existing large Phaser chunk warning remains. |
| `npm test` | **187/187**, 20 files, PASSED |
| Existing `npm run test:smoke` on production preview | **15 groups**, 0 console/page errors, [report](../test-results/final-polish/gameplay/report.json) |
| Existing native pointer/touch/joystick/camera suite | **10 groups**, 0 errors, [report](../test-results/final-polish/regression/ux-smoke.json) |
| Focused production browser polish checks | **3 groups**, 0 errors, [report](../test-results/final-polish/report.json) |

Both profiles test 1,000 deterministic outside-water positions and exact value conservation for player/worker payouts through save/reload. New payouts are not credited by remaining at the center; entering the original pickup radius collects them exactly once. Old aggregate save migration behavior remains covered. Funded all-34-quest traversal and unfunded progression checks still pass with physical collection.

The old regression fixtures assumed pickup at the port center; they now explicitly visit actual payouts. The v0.5b core checksum test normalizes only new fish-sale positions before the original delay expires, isolating unchanged core rules. Real new placement is tested separately without normalization.

The position change affects travel time, not numeric balance. In the seeded FAST scenario, first 15 quests took approximately **610.4–610.8 s**; seed 41 gate-to-defender took **122.2 s**. The previous fixed 600/120 s timing assertions are now the original limits plus a conservative geometric pickup-travel allowance (maximum possible payout count × additional round-trip distance / unchanged player speed). This is an explicit change to the pacing test contract, not a price/reward/timer rebalance. These simulations do not establish natural human pacing.

The focused browser actually catches fish, claims a quest, unloads, hires a worker with original purchase/skip methods, unloads its three crates, saves/reloads four pending payouts, navigates into their collection range and verifies the exact **13-coin** total once. Renderer assertions require at least four actual coin sprites, not merely an empty-list size check. [Bobbing samples](../test-results/final-polish/bobbing.json) confirm idle resource motion while simulation time is paused, bounded displacement and no frame-to-frame jumps.

Navigation checks cover English/Russian at 320×740, 390×844, 820×900, 1440×900 and 844×390. Removed-button count is zero; remaining controls stay inside the viewport without overlap. Native input/camera regression checks include second-finger taps and no ghost hitbox/input regressions.

## Screenshots reviewed

- [Desktop fishing net](../test-results/final-polish/net-desktop.png)
- [Portrait fishing net](../test-results/final-polish/net-mobile.png)
- [Desktop outer unload coins](../test-results/final-polish/unload-coins-desktop.png)
- [Portrait outer unload coins](../test-results/final-polish/unload-coins-mobile.png)

## Exact manual checks

1. Refresh the current preview. Confirm To sardines is absent in both languages. Check To port and Objects in desktop/portrait; unlock storage and check To storage. Try a joystick gesture in the space formerly used by the removed button.
2. Use WASD/arrows or the floating joystick to reach a ready fishing group. Watch the net cast: oval rim, restrained floats and clean mesh, with no flashing/noise. Repeat with multiple workers fishing nearby.
3. Keep a ready resource group in view for about 10 s without harvesting it. Look for gentle drifting/bobbing, without twitching, size pumping or collider movement.
4. Catch fish and unload at port. Confirm the larger new coins appear beyond the circle on its open-water side. Nudge toward the outer pile and confirm pickup/wallet increment. Check several player crates and worker deliveries; each should retain its own exact payout.
5. Leave some new coins uncollected, reload, then collect them. Confirm no value loss/duplicate credit. Verify quest claim and an ordinary purchase still work.
6. Repeat the fishing/unloading loop on a physical phone in portrait and landscape; check joystick response, labels, coin readability and frame pacing.

Physical Android/iOS, OS alt-tab and long-session/device performance are not proven by headless Edge. No new art assets, dependencies or save migration were added.
