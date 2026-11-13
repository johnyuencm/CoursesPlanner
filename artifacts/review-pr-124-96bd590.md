# Review: PR #124 at 96bd590

PR: https://github.com/johnyuencm/CoursesPlanner/pull/124 (Closes #123).
Pinned head: `96bd59039d136767f5049c84acf6662917194e07`. Base: `origin/master` `351973f`.
Diff: `351973f..96bd590` (3 files: `lib/catalog.ts`, `tests/packaged-snapshot.test.ts`, `README.md`). Reviewer: independent.

**Verdict: PASS** (no high or medium finding. 2 low findings for follow-up.)

## Findings

| id | severity | file:line | issue | suggested fix |
|----|----------|-----------|-------|---------------|
| F1 | low | lib/roadmap-reader.ts:75-77 | One more ignored file reaches the tests through `process.cwd()`: `data/catalogs/northeastern/.roadmap-crawl-status.json`. Every roadmap crawl writes it (`catalog-service/roadmaps.ts:69`). `readState` validates it even when the tracked `programs.json` exists. A planted invalid file (`{"version":1}`) makes 5 tests fail (331/336). A file from the current crawler passes, and the schema has not changed since `bb6f8f0`. So the result is the same today, but a later schema change gives the #123 failure again. | Follow-up ticket: in tests, read the committed Northeastern data from a temp copy of the tracked files, or ignore a persisted status when `programs.json` exists. |
| F2 | low | catalog-service/refresh.ts:313-318 | After this PR, nothing reads the `data/catalogs/<id>/catalog.json` mirror. The app reads `data/catalog.json`. The service server reads `storagePaths(...).catalogFile`, which is also `data/catalog.json` (`catalog-service/sources/neu-mscs-seattle.json` `storage`). The refresh still writes the mirror, so it keeps making the file that can go stale. The README now says this, so it is not a defect. | Follow-up: remove the mirror write, or keep it and name its reader when a second catalog ships. |

## Checked and found correct

- **Root cause.** Base `defaultCatalogFilePath()` preferred `data/catalogs/neu-mscs-seattle/catalog.json` when it existed. The PR removes that read (`lib/catalog.ts:580-585`). `CATALOG_DATA_PATH` still wins.
- **Callers.** `readCatalog()` with no argument: `app/api/catalog/route.ts:109,136`, `app/page.tsx:19`, `app/sitemap.ts:9`, `lib/program-page.ts:29`, and tests in `catalog-service`, `course-code`, `course-pages`, `snapshot-manifest`. The build (`lib/snapshot-manifest.ts:30,47`) already passed `data/catalog.json`. Now prerender and the Worker use the same file. This closes `docs/reviews/2026-11-08-pr94-review.md` finding 2.
- **No dev behavior lost.**
  - The only source sets `storage.catalogFile` to `data/catalog.json`. Each refresh writes that file first. `publishSnapshots` then copies the same catalog to the mirror. The mirror is never newer than `data/catalog.json`.
  - The `!anyChange` path reads `data/catalog.json` and copies it to the mirror. Same result.
  - Base code took the mirror id from `CATALOGS[DEFAULT_CATALOG_KEY].id` (fixed `neu-mscs-seattle`), not from `CATALOG_ID`. `CATALOG_ID` never changed the read. A refresh of another id fails in `findSource`, because the registry has one source.
  - The in-process refresh (`scraper/refresh.ts`) re-exports the same `refreshCatalog`.
- **Imports.** `existsSync`, `CATALOGS` and `DEFAULT_CATALOG_KEY` are now unused in `lib/catalog.ts`. The PR removes them. Typecheck passes.
- **New test fails without the fix.** A scratch worktree at `351973f` with only the new test applied gives 4 pass, 1 fail: `actual: 'data\\catalogs\\neu-mscs-seattle\\catalog.json'`, `expected: 'data\\catalog.json'`. At `96bd590` it passes.
- **`process.chdir` is safe.**
  - `node --test` runs each test file in its own process.
  - Top-level tests in one file run in sequence, and this test is synchronous. No other test runs while cwd points at the temp dir.
  - `finally` restores cwd to `ROOT` (`tests/packaged-snapshot.test.ts:14`) before `rmSync`. It also restores `CATALOG_DATA_PATH` only when it was set.
  - `path.relative` uses the same `process.cwd()` string as the function, so a Windows short temp path is not a problem.
- **Other ignored data.** These planted files in the PR worktree change no result (336/336): `data/catalogs/northeastern/roadmaps/zz-extra.json`, `data/catalogs/northeastern/raw/x.html`, `.env` and `.env.local` with `CATALOG_DATA_PATH=/nope.json`. `tsx --test` loads no `.env`. Only `northeastern` is crawlable in `catalog-service/universities.json`, so other `data/catalogs/<university>/` folders are not read. Source scans in `tests/course-code.test.ts:237` and `tests/ia.test.ts:145` read `app/`, `components/`, `lib/`, `catalog-service/` and `scraper/`. The `.gitignore` has no pattern there except `node_modules/`, `.next/` and `.env*`. `.next/`, `.vinext/`, `.wrangler/` and `dist/` were present during all runs. The only ignored file that changes a result is the status file in F1.
- **README.** Line 158 matches the new read path. The diagram at line 77 still shows the refresh output, which is correct.

## Acceptance criteria (#123)

| criterion | result |
|---|---|
| Tests do not read ignored local data; they use fixtures or a temp dir. | Met for the catalog, which is the cause of #123. Partly met in strict terms: tests still read the ignored crawl status file (F1). It gives the same result for all files the current crawler writes. |
| `npm test` gives the same result in a dirty checkout and a clean worktree. | Met. Base with the stale mirror copied from the main checkout: 316/335 (19 fail). PR with the same mirror: 336/336. PR clean: 336/336. |

## Commands and results

| command | where | result |
|---|---|---|
| `npm test` | PR worktree, clean | 336 tests, 336 pass, 0 fail |
| `npx tsx --test tests/packaged-snapshot.test.ts` | scratch worktree at `351973f` + new test only | 4 pass, 1 fail (the new test) |
| `npm test` | scratch `351973f` + mirror copied from main checkout | 335 tests, 316 pass, 19 fail |
| `npm test` | PR worktree + same mirror | 336 tests, 336 pass, 0 fail |
| `npm test` | PR worktree + invalid status file, extra roadmap, `raw/`, `.env`, `.env.local` | 336 tests, 331 pass, 5 fail |
| `npm test` | PR worktree + extra roadmap, `raw/`, `.env`, `.env.local` (no status file) | 336 tests, 336 pass, 0 fail |
| `npm run typecheck` | PR worktree | exit 0 |
| `npm run build` | PR worktree | exit 0, "Build complete." |

The 5 failures with the invalid status file: "the committed snapshot ships a ready Northeastern program", "the committed roadmap validates and preserves the cached source date", "the route serves the committed directory and roadmap with 200", "the build manifest lists every published snapshot, and each listed file ships", and "catalog service HTTP handlers list sources and universities without changing refresh behavior".

Mirror source: `C:\Users\user\Desktop\github\CoursesPlanner\data\catalogs\neu-mscs-seattle\` (read only; `catalog.json` sha1 `28c7477b…`). All planted files and the scratch worktree were removed after the runs. The main checkout was not changed.
