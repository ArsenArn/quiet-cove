# Quiet Cove release preparation

Prepared on 2026-10-14. Repository name: `quiet-cove`. Repository root: this `fishing-game/` folder.

## Documents

Both submission documents exist in `docs/submission/`; README links resolve.
The two-page PDF was inspected visually and left unchanged.
All 34 quests per profile were compared against the current balance files, purchase rules and `docs/QUESTS.csv`.

The FAST Zone 2 purchase overrides were missing from the old CSV generator and workbook:

| Quest | Old coin cost | Current sequential coin cost |
| --- | ---: | ---: |
| 19 | 799 | 1600 |
| 20 | 975 | 1725 |
| 28 | 2044 | 3000 |
| 29 | 3250 | 3600 |

The XLSX, CSV, Markdown quest table and generator now reflect these costs.
They apply to new orders after claiming Q15; previously paid orders keep their original price.
Quest timers and rewards match. Q9 and Q10 share one speedboat order.
Nine missing FAST resource Portion HP entries were populated from current JSON: 120, 140, 160, 160, 200, 300, 500, 700, 50.
All other FAST and REFERENCE resource values match.
The optional second port becomes available after claiming Q26: FAST 1800 coins + 60 metal / 45 s; REFERENCE 11000 coins + 120 metal / 900 s.

## Repository contents

Include `src/`, `public/` (art, music and balance JSON), `docs/`, `tests/` with portable fixtures, `scripts/`, package manifest/lockfile, HTML, TypeScript/Vite/Vitest configuration, README, `.gitignore`, and `netlify.toml`.
The useful baseline fixtures formerly read from excluded local output folders are now preserved in `tests/fixtures/release/`. The legacy scripted analytics fixture is gzip-compressed and decoded by its test.

Exclude dependency/build folders, `.local/`, test output, coverage, logs, temporary files, backups, local research folders, archives including `fishing-game.zip`, APK/XAPK/AAB packages, environment secrets and credential files.
Local originals are retained. A temporary Git metadata directory under ignored `.local/` was used only to enumerate the candidate files; no project repository, commit, remote, push or deployment was created.
The candidate inventory was checked for common credential patterns and private keys, APKs and oversized files. No findings; largest file is the water texture (5,223,954 bytes). This is a pattern scan, not a guarantee against every possible secret format.
Game source and all public assets/balance files were checked against pre-preparation SHA-256 hashes and remain unchanged.

## Validation

- `npm test`: 287 tests in 29 suites passed.
- Production build: TypeScript and Vite passed. The existing large Phaser chunk warning remains; no refactor was performed.
- Production preview at the root URL passed in an isolated browser context: public boot with fresh storage, FAST default, Q1 catch/claim, reload persistence, real MP3 decode and playback after a pointer gesture, funded gate construction using its real 30-second timer, entry into Zone 2 and persistence after reload.
- All 56 public static files returned successful responses with exact source bytes; no failed browser requests, console errors or page errors.
- A clean candidate checkout under `.local/release-checkout/` passed `npm ci`, all 287 tests and the production build without old `.local` or `test-results` baselines.

This was a release smoke test; the Zone 2 milestone was staged and funded. It does not measure natural progression pacing or physical-device audio/FPS.
Local evidence and the exact Git candidate manifest are in ignored `test-results/release/`.

## Publish manually

1. On GitHub create an empty **public** repository named `quiet-cove`. Do not initialize it with a README, license or gitignore.
2. In PowerShell run these commands from this project folder, replacing `YOUR_GITHUB_USER`:

```powershell
# Run from the fishing-game folder.
git init -b main
git add .
git status --short
git diff --cached --stat
git commit -m "Prepare Quiet Cove release"
git remote add origin https://github.com/YOUR_GITHUB_USER/quiet-cove.git
git push -u origin main
```

3. In Netlify choose **Add new project > Import an existing project**, connect GitHub and select `quiet-cove` / `main`.
4. Leave the base/project directory empty (repository root). Build command: `npm run build`. Publish directory: `dist`. `netlify.toml` pins Node 22 and these build settings. Vite uses `/` as its base path.
5. Deploy, then smoke-check the live URL and replace the README Netlify placeholder with it.

No GitHub Pages setup is needed. README document links target the GitHub repository; submission documents are not copied into the game deployment.
See [Netlify Vite guidance](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/) and [repository deployment instructions](https://docs.netlify.com/start/quickstarts/deploy-from-repository/).
