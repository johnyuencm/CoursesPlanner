# Review: PR #124 round 2 at fa1a389

PR: https://github.com/johnyuencm/CoursesPlanner/pull/124 (Closes #123).
Pinned head: `fa1a38922e844a0f22c58e9e57cf10470cc308b7`. Base: `origin/master` `351973f`.
Round 1: `artifacts/review-pr-124-96bd590.md` (PASS, F1 and F2 low).
Diffs read: `1e8e84d..fa1a389` (round 2 change, 4 test files) and `351973f..fa1a389` (whole PR). Reviewer: independent.

**Verdict: PASS** (no high or medium finding. F1 is fixed. F2 stays open as an accepted low follow-up. 2 new low or info notes.)

## Findings

| id | severity | file:line | status | issue | suggested fix |
|----|----------|-----------|--------|-------|---------------|
| F1 | low | tests/packaged-snapshot.test.ts:22-23, tests/snapshot-manifest.test.ts:20-21, tests/catalog-service.test.ts:566-567 | **fixed** | The 5 tests that read `data/catalogs/northeastern/.roadmap-crawl-status.json` through `process.cwd()` now read a temp copy of the tracked files. An invalid planted status file gives 336/336 (it gave 331/336 at `1e8e84d`). | None. |
| F2 | low | catalog-service/refresh.ts:313-319 | **open, accepted** | The refresh still writes the `data/catalogs/<id>/` mirror for the default source. See "F2 decision" below. The decision is OK for #123. | Open a follow-up issue so the dead write is tracked. No issue for it exists now (`gh issue list --search mirror` is empty). |
| F3 | low | PR #124 body | new | The PR body is stale. "Change" does not list `tests/published-copy.ts` or the 3 changed test files. "Crawl leftovers alone change no test result, so the catalog mirror was the only leak" is false: round 1 showed an invalid status file gave 5 failures before `fa1a389`. | Update the PR body: add the round 2 change and the status-file evidence. |
| F4 | info | tests/published-copy.ts:15 | new | The copy list is hard-coded. It repeats the `.gitignore` allowlist (`data/catalogs/**` except `programs.json` and one roadmap). A new published roadmap needs an edit here too. This is not a silent coverage loss: `buildSnapshotAssets` throws "missing or invalid" for a published key whose file is not copied, so the manifest test fails loudly. | None now. |

## F1 check: the moved tests still test the real repo files

- **Same content.** `publishedCopy()` copies `catalog-service/universities.json`, `data/catalog.json`, `data/published.json`, `data/catalogs/northeastern/programs.json` and the one roadmap. These are exactly the tracked files that the 4 tests read (`git ls-files`). The copy is byte-for-byte (`fs.cp`). So the tests still check the committed snapshot, not a fixture.
- **Only ignored files are dropped.** Under `data/catalogs/`, git tracks only `programs.json` and the one roadmap. The copy leaves out every ignored file: the crawl status, `raw/`, extra roadmaps and the `neu-mscs-seattle/` mirror.
- **Assertions unchanged.** The diff changes only the root argument (`ROOT` or `process.cwd()` to `SNAPSHOT` or `rootDir`). No assertion changed. The manifest test still asserts the full manifest list.
- **Helper move is pure.** `publishedCopy()` moved from `tests/snapshot-manifest.test.ts` to `tests/published-copy.ts` with no logic change (`ROOT` became `process.cwd()`, which is the same value at import time). The 5 old callers in `snapshot-manifest.test.ts` (lines 39, 58, 71, 84) work as before.
- **Fix is needed and works.** Scratch worktree at `1e8e84d` + invalid status file: 331/336, the 5 tests listed in round 1. `fa1a389` + same file: 336/336.

## Temp dir cleanup

| test | create | remove |
|---|---|---|
| packaged-snapshot (3 tests) | `before` hook, line 22 | `after` hook, line 23, `rmSync` with `force` |
| snapshot-manifest "build manifest lists every published snapshot" | line 20 | `.finally(() => rm(...))`, line 21, before any assertion |
| catalog-service "HTTP handlers list sources and universities" | line 566 | `t.after(...)`, line 567 (node:test awaits it) |

- `os.tmpdir()` had 0 `snapshots-*` folders before and after a full `npm test` run. Nothing leaks.
- `before` runs before the `process.chdir` test (`packaged-snapshot.test.ts:103`). `SNAPSHOT` is absolute, so the `chdir` does not change it.

## Other process.cwd() reads in tests

I checked every `process.cwd()` and `ROOT` use in `tests/*.ts`. All read tracked files only:

- `data/catalog.json`, `data/requirements.json`, `data/published.json`, `data/raw/*` (tracked), `config/pathways.json`, `catalog-service/*.json`, `tests/fixtures/*`, and source files (`app/`, `lib/`, `components/`, `catalog-service/`, `worker.ts`).
- `catalog-service.test.ts:252` passes `rootDir: process.cwd()` to `crawlRoadmaps`, but the call rejects on the unknown adapter before it reads any file.
- `catalog-service.test.ts:644` (cross-site refresh test) passes `rootDir: process.cwd()`. Its requests are refused (403) or use the stub `refresh`. It reads no `data/catalogs/` file. The planted runs confirm this.
- `course-pages.test.ts:45,56` calls `programPageIndex(process.cwd())`, which reads only `data/catalog.json`.
- No test calls `handleRoadmapsRequest`, `readProgramDirectory`, `readReadyRoadmap` or `listRoadmapUniversities` with the default `rootDir`.

## F2 decision

The author keeps the mirror write. I agree that this is OK for this PR:

- `storagePaths()` (`catalog-service/refresh.ts:52-57`) puts every source without a `storage` block in `data/catalogs/<id>/`. For those sources the per-id file is the primary file, and `publishSnapshots` skips the mirror (`refresh.ts:315`). So the per-id layout is the real default, not a leftover.
- Only `neu-mscs-seattle` sets `storage` to `data/`. For it, the mirror is a write with no reader: not the app (`lib/catalog.ts:580-585`), not the service server (`server.ts:124` reads `storagePaths(...).catalogFile`), not the build, not any test. A stale copied mirror gives 336/336.
- #123 is about tests that read ignored data. The mirror no longer reaches any test. A dead write is a cleanup item, not an isolation defect.
- Remaining risk: a later reader could pick up a stale mirror again, as in #123. The comment at `lib/catalog.ts:582` and README line 158 warn against this. A tracked follow-up issue closes the gap (see F2 fix).

## Acceptance criteria (#123)

| criterion | result |
|---|---|
| Tests do not read ignored local data; they use fixtures or a temp dir. | **Met.** The catalog mirror read is gone (round 1). The 5 crawl-status reads now use a temp copy (round 2). No other test reads an ignored file. |
| `npm test` gives the same result in a dirty checkout and a clean worktree. | **Met.** Clean: 336/336. Dirty (all planted files below): 336/336. Dirty with a mismatched but schema-valid status file: 336/336. |

## Commands and results

| command | where | result |
|---|---|---|
| `npm test` | PR worktree at `fa1a389`, clean | 336 tests, 336 pass, 0 fail |
| `npm test` | PR worktree + planted files (set A below) | 336 tests, 336 pass, 0 fail |
| `npm test` | PR worktree + set A, status file replaced by a valid one with `universityId: "mit"` | 336 tests, 336 pass, 0 fail |
| `npm test` | scratch worktree at `1e8e84d` + invalid status file only | 336 tests, 331 pass, 5 fail (the 5 F1 tests) |
| `npm test` | PR worktree, clean again after removal | 336 tests, 336 pass, 0 fail |
| `npm run typecheck` | PR worktree, clean | exit 0 |
| `npm run build` | PR worktree, clean | exit 0, "Build complete." |

Set A (planted in the PR worktree only):

- `data/catalogs/neu-mscs-seattle/catalog.json`, `courses.json`, `requirements.json`, copied read-only from `C:\Users\user\Desktop\github\CoursesPlanner\data\catalogs\neu-mscs-seattle\` (`catalog.json` sha1 `28c7477b…`; tracked `data/catalog.json` is `967e5c05…`).
- `data/catalogs/northeastern/.roadmap-crawl-status.json` = `{"version":1}` (invalid).
- `data/catalogs/northeastern/roadmaps/zz-extra.json` = `{"bad":true}`.
- `data/catalogs/northeastern/raw/x.html`.
- `data/catalogs/.scheduler-status.json` = `{"version":1}`.
- `data/catalogs/mit/.roadmap-crawl-status.json` = `{"version":1}`.
- `.env` and `.env.local` with `CATALOG_DATA_PATH=/nope.json`.

Cleanup: I deleted every planted file. `git status --short --ignored` shows only build output (`.next/`, `.vinext/`, `.wrangler/`, `dist/`, `next-env.d.ts`, `tsconfig.tsbuildinfo`) and `node_modules/`. The scratch worktree was in the session scratchpad. It used a junction to this worktree's `node_modules`. I removed the junction first, then ran `git worktree remove` and `git worktree prune`. Git kept that worktree's admin entry in the shared `.git/worktrees/` of the main checkout for the run, and removed it after. I changed no file in the main checkout's working tree.
