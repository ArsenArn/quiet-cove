# Quiet Cove — UI visual pass v0.6

Implemented in `fishing-game/` on 2026-10-13.

## Result

A cohesive cream-and-teal casual mobile interface: rounded panels, restrained borders/shadows, strong text contrast, shared vector icons and one font stack. The desktop HUD is a single strip; portrait groups location/currency/utilities above cargo, unlocked metal and fishing-fleet status. Cargo has a small fill meter and full-state color. Metal stays hidden until unlocked.

The compact objective card includes task number, objective, progress, a reward chip, and a green completed state with an explicit claim hint. The original full-card mouse, keyboard and second-finger claim hooks remain. Navigation is bottom-left; object toggle is bottom-right with an active state. The drawer, tabs, help, skip, Golden Boat and reward dialogs share the button/panel styling.

World labels use reusable rounded navy badges with separate heading/detail hierarchy and consistent icons. This covers resources, buy zones, port/unload, storage, fishing boats, pirate spawner, Golden Boat and map skip buttons. Neutral, gold, success and danger tones distinguish context. Label positions are presentation coordinates; all gameplay interaction points/radii remain unchanged. Interactive badges use the complete hit area, with hover and pressed feedback.

## Changed files

- `src/ui/UI.ts`: HUD/card markup, counters, cargo display, shared icons, accessible progress and object-toggle state; existing actions retained.
- `src/ui/style.css`: consolidated visual system and responsive layout, buttons, drawer/dialogs, focus and reduced-motion styles; native joystick overlay retained.
- `src/ui/icons.ts` (new): small shared SVG icon vocabulary for DOM and Phaser textures. No remote font or asset dependency.
- `src/ui/WorldLabel.ts` (new): reusable retained Phaser container with rounded panel, shadow, icon, heading/detail, tone and full-panel input feedback.
- `src/game/scenes/BayScene.ts`: label creation/rendering uses WorldLabel; boat/environment/effect rendering and gameplay controls retained.
- `scripts/browser-ui-v06.mjs` (new): reproducible visual checks plus isolated wrappers for the existing gameplay and native-input browser suites.
- `docs/UI_VISUAL_PASS_V06.md` (new): this implementation and validation report.

No balance, engine/system, navigation, collision, save-schema, quest or art-source files were edited. Source changes are attached in `source.diff`; original source snapshots are retained separately. The existing `fishing-game.zip` was not refreshed.

## Validation

- Baseline and post-change: build PASS; 179/179 existing tests across 18 files PASS, including fixed-state engine comparisons for FAST and REFERENCE.
- Final production build PASS; existing large Phaser chunk warning remains.
- Visual browser: 5 groups PASS, no console errors. Eight sizes: 320×740, 360×800, 390×844, 700×900, 820×900, 1024×768, 1440×900, 844×390; locked/unlocked metal and six-digit currency. HUD children stay contained, quest stays clear of HUD, all 34 objective/reward cards fit portrait width. Manual keyboard claim, drawer active state and purchase center/top/bottom edge taps pass.
- Existing gameplay browser: 15 groups PASS, no console errors: quest claim/reload, catch/unload/physical cash, partial purchases/reload/construction, worker cash/reload/collection, routing/collisions, visibility reset/resume, regrow/restock, fleet/metal/defender combat, crate preemption, spawner, Golden cancel/confirm, Free/Rewarded Skip, profile save isolation.
- Existing native-input browser: 10 groups PASS, no console errors: pointer capture/deadzone, WASD/arrows, reset/locks, UI exclusion, map/Golden/SKIP input, guidance and manual claim, portrait and real CDP multitouch with second-finger claim/help.

The gameplay wrapper retains the existing v0.5c fixture corrections for defender overlap and guaranteed Free Skip timing. Only the expected metal-counter text changes because its glyph is now a separate SVG icon. Assertions are otherwise retained. Tests use temporary browser profiles; real user saves were not opened or reset.

Reproduce from `fishing-game/`:

```powershell
npm run build
npm test
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4196
# In a second terminal:
node scripts/browser-ui-v06.mjs visual
node scripts/browser-ui-v06.mjs gameplay
node scripts/browser-ui-v06.mjs ux
```

Reports/screenshots are isolated in `test-results/v06/`; prior results remain intact.

## Remaining polish and limits

The approved UI mockup was not supplied in this chat or located in the project assets, so exact visual matching could not be checked. Styling follows the supplied casual-mobile requirements and current approved environment art.

The vector icons are clean reusable placeholders; bespoke painted icons and a bundled licensed font could bring them closer to the final art direction. Resource types share a fish marker rather than species-specific artwork. Dense fleets or boats beside purchase badges can still overlap labels, as label avoidance between boats is not a gameplay/traffic change in this pass. Extreme debug currency values may require abbreviation later; six-digit values were checked.

Physical Android/iOS, OS safe-area/gesture behavior, long sessions, thermal/performance limits and subjective play feel remain unverified. Browser visibility reset uses deterministic events because native headless-tab hiding is unavailable. Automated tests do not establish natural progression pacing or real-device performance.
