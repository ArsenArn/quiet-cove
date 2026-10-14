# Five focused UI placement corrections

Current layout, superseding the corresponding anchor values in `GROUND_UI_LAYOUT.md`:

1. Salvage purchase circle moved to **2135, 1630**, immediately southwest of the
   metal warehouse, clear of the model. Its entire price/name panel is below the circle.
2. Pirate countdown bar is **184 × 18** world pixels, above the lair at
   **y = spawner.y − 152**, with a gold outline and thicker gold progress fill.
   Countdown caption stays centered beneath the lair. Den-close purchase moved
   from **2990, 1240** to **2990, 1180**; price/name and Skip stack beneath its circle.
3. Second port hut moved from **2850, 1540** to **2770, 1460**. Unload center is
   **2830, 1600**, below and slightly right of the hut. Port caption is below this circle.
4. All purchase panel tops are now **circle center + radius + 8px**, with Skip
   **12px below the panel bottom**. They no longer occupy the purchase circle.
   The northern first-port circle moved 120px up (880, 1030), the western circle
   40px left (630, 1340) to leave room for localized panels and Skip beside the harbor.
   Cutter moved to 2180, 1990, second-port purchase to 3030, 1430, and lobster
   moved 30px up to avoid adjacent objects when Skip appears.
5. All nine resource captions use the lowest opaque pixel across their four
   sprite frames plus a small gap and bob allowance. Their top edge stays fixed
   as the localized status wraps; there is no avoidance of moving boats.

Both profiles use these coordinates. Hut collider follows the relocated art;
all circle radii, costs, timers, quests, unlocks, combat rules and controls remain.

Validation: **40 focused tests in 3 suites passed**, production build passed.
Browser checks cover FAST/REFERENCE, English/Russian, built Q31, purchase offers
and construction with Skip. Actual bounds are checked for panel/circle overlap
(including the panel's own circle), neighboring UI and primary objects. Resource
captions are checked against opaque art rather than transparent atlas margins.
Native pointer clicks still select the correct purchase coordinates. No page errors.
No new full quest-chain or long-duration stress run was needed for this follow-up.

Screenshots and geometry: `test-results/ground-ui-step2/`.
Build/test logs: `test-results/ground-ui/step2-*.txt`.
