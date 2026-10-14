# UI polish, localization and debug reveal fix

Date: 2026-10-13. Changes apply to the current v0.6 implementation only.

## What changed

- Cargo drop-off at port and metal storage keeps the same position and radius. A 5 px dark under-stroke, 2.5 px pale outline at 82% opacity, faint fill and four small ticks make it readable on bright water.
- Purchase payment arcs use vivid green `#43ed78` in place of dull `#a4dfae`. The shared DOM progress accent uses the same brighter palette. Payment values/timing are unchanged.
- Added a typed English/Russian localization catalog for all 34 quests, nine resources, offer/badge names, HUD, guide/navigation, fleet/status labels, Settings, help, Golden Reward, construction/SKIP, mock rewarded, notices and debug controls. Raw config paths, event identifiers and engine state codes remain technical identifiers.
- English is the default when no valid language preference exists. The gear opens Settings with English / Русский selection. F2 still toggles Balance Lab, also accessible from Settings.
- Language preference is saved separately as `quiet_cove_language`. Existing profile save keys, state schema and progression data are unchanged. A blocked browser storage write does not prevent changing the language for the current session.
- Switching updates DOM text/attributes in place and world text on the next renderer frame. Controller instances, callbacks and gameplay state are retained. Numbers follow the selected locale. Dynamic notices and open popup labels can refresh without rebuilding controls.
- Resource labels also avoid the Golden Boat badge when it passes, using the existing above/below resource-label placement.
- Long purchase names wrap to two lines with an expanding cream nameplate, retaining the same anchored map object and hitbox. HUD titles can wrap rather than truncate. Quest/shop placement follows the measured HUD height via ResizeObserver. Three navigation actions stack at tablet widths to avoid overlapping Objects; short landscape retains a compact horizontal row.
- Debug Open zones previously opened nodes/area but omitted `revealedPurchases`. The debug-only helper now sets all configured reveal-category flags, including worker, speedboat and cargo. It retains the previous area/storage/cutter/resource unlock behavior. It does not buy boats/upgrades, advance quests or change costs/timers. Already completed or maxed purchases remain completed.

## Changed files

| File | Purpose |
|---|---|
| `src/ui/i18n.ts` (new) | Language preference, typed translation helpers, in-place DOM bindings, localized presentation of offers/resources/quests |
| `src/ui/locales/catalog.ts` (new) | Complete English/Russian catalogs |
| `src/debug/openZones.ts` (new) | Reveal every configured purchase category in the debug action |
| `src/ui/UI.ts` | Settings, localized UI/popups/debug text, locale refresh, HUD height observation, debug helper integration |
| `src/ui/WorldLabel.ts` | Wrapping and dynamic nameplate height for language length |
| `src/ui/style.css` | Progress accent, Settings controls, wrapping/HUD placement/tablet navigation |
| `src/ui/tokens.ts` | Vivid purchase green |
| `src/game/scenes/BayScene.ts` | Localized world labels, stronger drop-off outline, vivid purchase payment arc |
| `src/main.ts` | Initialize language and translate startup/save notices |
| `index.html` | Default English document language/title |
| `tests/localization-polish.test.ts` (new) | Catalog/default-language checks, both-profile debug reveal/save/stationary payment checks |
| `scripts/browser-polish-l10n.mjs` (new) | Actual Settings language switching, debug/reload, bilingual layout and popup screenshots |
| `scripts/browser-ui-v06.mjs` | Existing regression runners adapted to English strings/localized test modal and optional separate output directory |
| `docs/UI_POLISH_LOCALIZATION.md` (new) | This record and manual checks |

Generated production files are in `dist/`; evidence is in `test-results/polish-l10n/`. Pre-pass source backup: `.local/polish-before/`. Source review: [implementation.diff](../test-results/polish-l10n/implementation.diff).

## Verification

- `npm run build`: passed (TypeScript + Vite). Existing large Phaser chunk warning remains.
- `npm test`: **184/184**, 19 files. Five new checks include both fast/reference profiles. Existing progression, economy, traffic, worker, combat, Golden, save/load and control tests pass.
- Existing gameplay browser regression: **15 groups passed**, no page/console errors; production preview at port 4197. [Report](../test-results/polish-l10n/regression/gameplay/report.json).
- Existing native pointer/touch/joystick/camera regression: **10 groups passed**, no page/console errors; dev build of the same source. [Report](../test-results/polish-l10n/regression/ux-smoke.json).
- Bilingual browser checks: **7 groups passed**, no page/console errors. Final run uses production preview. [Report](../test-results/polish-l10n/report.json).
- The early Russian speedboat badge is explicitly checked for overlap with the quest card. Golden/resource label separation is also checked in both languages.
- Tested 320×740, 360×800, 390×844, 700×900, 820×900, 1024×768, 1440×900 and 844×390, with unlocked metal and six-digit currency. Both languages and all 34 quest texts fit. Assertions check page/text overflow, HUD separation and navigation overlap.
- Fresh browser uses English. Russian updates HUD/quest/world/Settings immediately and survives reload. Language switching does not change the paused game-state snapshot. English DOM and world labels are checked for untranslated Russian text.
- Debug Open zones at the first quest renders worker:0, speedboat and cargo:1, preserves quest index and survives reload. All three badge hitboxes route the boat and exclude joystick activation. Unit checks confirm stationary payment after reveal in both profiles.
- Gameplay systems, engine/state, config source, art renderer/registry and joystick source are byte-identical to the pre-pass backup. No balance JSON was edited.

## Screenshots reviewed

| State | English | Russian |
|---|---|---|
| Desktop / early revealed purchases | [desktop](../test-results/polish-l10n/desktop-en.png) | [desktop](../test-results/polish-l10n/desktop-ru.png) |
| Portrait HUD / navigation | [mobile](../test-results/polish-l10n/mobile-en.png) | [mobile](../test-results/polish-l10n/mobile-ru.png) |
| Settings | [Settings](../test-results/polish-l10n/settings-en.png) | [Настройки](../test-results/polish-l10n/settings-ru.png) |
| Completed quest | [completed](../test-results/polish-l10n/completed-en.png) | [completed](../test-results/polish-l10n/completed-ru.png) |
| Field guide | [objects](../test-results/polish-l10n/objects-en.png) | [objects](../test-results/polish-l10n/objects-ru.png) |
| Help | [help](../test-results/polish-l10n/help-en.png) | [help](../test-results/polish-l10n/help-ru.png) |
| Construction / SKIP | [skip](../test-results/polish-l10n/skip-en.png) | [skip](../test-results/polish-l10n/skip-ru.png) |
| Golden Reward | [golden](../test-results/polish-l10n/golden-en.png) | [golden](../test-results/polish-l10n/golden-ru.png) |
| Mock rewarded | [rewarded](../test-results/polish-l10n/rewarded-en.png) | [rewarded](../test-results/polish-l10n/rewarded-ru.png) |

[Golden/resource labels in English](../test-results/polish-l10n/world-labels-en.png) and [Russian](../test-results/polish-l10n/world-labels-ru.png).

[Visible unload zone and 50% purchase payment arc](../test-results/polish-l10n/unload-purchase-progress.png). Early debug state and late popups use fixtures; this is functional browser validation, not natural progression timing.

## Manual checks

1. Refresh the current preview. In Settings select Russian, then English; reload and confirm the chosen language remains. Existing game progress should stay intact.
2. Use F2 → Open zones early in a run. Check the worker boat, speedboat and hold upgrade circles; navigate to each and stop to pay. The action reveals available purchases without granting them.
3. Catch fish, follow To port and confirm the clearer unload circle. Watch partial payment green, then construction, Free/Rewarded Skip and cancel/confirm behavior.
4. Complete and claim a quest; check cargo/worker/metal HUD changes and reload once after partial payment.
5. On a physical phone, try both languages in portrait and landscape, movement with the floating joystick, Settings and a second-finger UI tap. Check long quest titles and the three-button navigation layout.

Physical Android/iOS, OS-level background/foreground behavior, long sessions and device FPS are not established by headless Edge tests. No redesign, economy changes, new monetization or save migration was added.
