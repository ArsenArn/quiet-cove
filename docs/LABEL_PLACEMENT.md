> Historical report. Current fixed ground labels and expanded Zone 2 layout: [GROUND_UI_LAYOUT.md](GROUND_UI_LAYOUT.md).

# World label readability

Map labels prefer a position above their object. A presentation-only placement
pass tries upward offsets of 32, 64 and 96 world pixels, followed by left/right
offsets of 40 and 80 pixels. Boat sprites reserve a 48-pixel exclusion radius
(visible hull with an additional 8-pixel margin). Visible cargo, boat names and
previously placed labels also reserve space, with a 6-pixel label gap.

Positions are recomputed from the object's anchor every frame, so offsets never
accumulate. Candidates stay inside map bounds. A completely crowded set of
candidates uses the least obstructed bounded position, prioritizing boat clearance.
This is a small heuristic rather than a global layout solver.

Boat names, ports, resource labels, purchases, construction skip pills, Golden
Reward, storage, pirate status and visible coin labels use the same pass. Existing
fonts, colors, panels and input callbacks remain unchanged. Clicking a moved
purchase label still targets the original purchase zone. No Engine, balance,
quest, collision, navigation or save code was changed.

Changed production files: `src/game/scenes/BayScene.ts` and the new
`src/ui/labelPlacement.ts`. Validation: `tests/label-placement.test.ts` and
`scripts/browser-label-placement.mjs`.

Verification:

- `npm test`: 287 tests, 29 suites passed.
- `npm run build`: passed; existing Phaser chunk-size warning remains.
- Headless Edge: four fixtures covering zones 1/2 and English/Russian. Player
  positioned at the old port-label location, another boat at the preferred upper
  location, and a nearby worker. Port clears hulls, boat names and action pills;
  action pills clear boat names. Actual pointer clicks reach original purchase
  coordinates. No page errors.
- Screenshots visually reviewed in both zones. These are controlled browser
  fixtures, not a long natural-play session or physical-device check.

Evidence: `test-results/label-placement/` includes JSON geometry, screenshots,
build output and test output.
