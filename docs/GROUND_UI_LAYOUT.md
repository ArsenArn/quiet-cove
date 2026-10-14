> Anchor follow-up: [UI_ANCHORS_STEP2.md](UI_ANCHORS_STEP2.md) contains the current five corrections and screenshots.

# Fixed ground UI and Zone 2 spacing

This supersedes the moving-label experiment in `LABEL_PLACEMENT.md`.

Object labels use fixed world coordinates beneath their object. They never query
nearby boats, avoid crowds, or choose alternate offsets. Resource captions reserve
enough space for a wrapped localized status. Prices/timers sit in their purchase
zone; the name plate sits beneath the price, and the skip button below that.
The map UI and zone rings render below boat hulls and cargo, as marks on the ground.
Passing boats can briefly pass in front of a label; the label does not move.
Existing colors, fonts and pill styling remain.

Boat names are hidden by default, including player, defender, workers, salvage,
speedboat and pirates. Settings contains the localized “Boat names” checkbox,
stored separately as `quiet_cove_boat_names`. It applies immediately and survives
reload. Enabled names follow their own boat at a constant offset without avoidance.
Health bars and the Golden Reward interaction remain available.

Both FAST and REFERENCE use the following Zone 2 layout (world pixels):

| Object | Artwork / resource center | Purchase / interaction center |
|---|---|---|
| Defender station | 2030, 1230 | Purchase 1990, 1410; spawn 2030, 1350 |
| Pirate lair | 2990, 944 | Purchase 2990, 1240; spawner 2990, 970 |
| Second fish port | Hut 2850, 1540 | Purchase 3000, 1430; unload 3000, 1570 |
| Metal storage | 2300, 1446 | Purchase 2580, 1360; unload 2495, 1570 |
| Storage upgrade | — | 2390, 1780 |
| Salvage hire | — | 2080, 1920 |
| Cutter | — | 2380, 1970 |
| Shipwreck | 2630, 2110 | Same resource center |
| Squid | 3030, 1900 | Same resource center |
| Distant route | — | 3080, 2190 |

Three decorative props also moved clear of these anchors. The defender station
art and body share `defenderStation()` to avoid coordinate drift. The lair rock
collider moves with the lair. The second port body follows its hut; obstacle sizes
and purchase/deposit radii are unchanged.

Relocating the defender station and lair required a separate spatial guard center
at 2620, 1260 and two corresponding patrol points. `defender_home` falls back to
the old spawn anchor when absent. This retains the existing chase-range rule while
covering the relocated native pirate spawn slots. No attack/detection/chase radii,
damage, rates, timers, prices, quest requirements or unlock rules changed. Travel
distances necessarily change with the requested layout; human pacing was not measured.
Existing save keys and balances are retained; old units resolve against relocated
colliders on load, while orders retain their payment and construction progress.

Validation evidence is in `test-results/ground-ui/`:

Final `npm test`: **287/287 tests, 29/29 suites passed**. `npm run build` passed
(the existing Phaser chunk-size warning remains). Browser checks passed with no
page errors. All screenshots were generated from the current layout.

- `browser-ground-ui.mjs`: Edge, FAST/REFERENCE, English/Russian, built Q31 plus
  revealed-purchase and construction fixtures. Captures actual image and UI bounds;
  checks object/object, label/label, label/object, zone/zone and zone/object conflicts.
  Each fixture has zero such conflicts among the primary Zone 2 objects.
- 120 rendered frame updates with ten boats/characters crossing the area leave
  all map label coordinates unchanged. Player and enemy names are hidden initially;
  enabling/disabling and restoring the checkbox are verified with actual browser input.
- Actual click on a price pill still navigates to its original purchase-zone center.
- Unit geometry checks sample every relocated interaction circumference, verify
  exact obstacle-free routes, building bodies, patrol water and guarded pirate slots.
- Scope comparison against `tests/fixtures/ground-ui-before.json` allows only the
  named layout coordinates and verifies every other configuration value literally.
- Three unfunded FAST simulations complete all 34 quests. These are engine/model
  checks, not a human playtime or device-performance claim.

Production files: `BayScene.ts`, `WorldLabel.ts`, `UI.ts`, `style.css`, locale
catalog, art registry/assembly, `config/mapLayout.ts`, config types, the spatial
guard anchor in `combat.ts`, building anchor in `movement.ts`, and both balance
JSON files. The previous overlap solver was removed. Historical protection tests
normalize only the newly authorized layout fields; their economy assertions remain.
