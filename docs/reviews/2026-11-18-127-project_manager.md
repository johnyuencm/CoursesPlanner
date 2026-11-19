---
ticket: 127
seat: project_manager
round: 1
reviewed_head_sha: a5e2ad75d46c39961ea8772df48fa9818e14f373
base_sha: 04e51ff
verdict: PASS
---

# #127 project_manager review, round 1

Branch `fix/127-build-tracked-only`. Reviewed code head `a5e2ad7`.
After this review started, `1a5d16e` landed on the branch. It adds only `docs/reviews/2026-11-18-127-tech_lead.md`. No code change.

## Verdict

PASS. All three acceptance criteria are met. One medium finding: a user-visible API change is not named in the commit message or the docs.

## Per-criterion map

| AC | State | Evidence |
|----|-------|----------|
| 1. The build reads only `programs.json`, published roadmaps and other tracked files | met | `lib/snapshot-manifest.ts:71` calls `readPrograms()`, not `readState()`. `readReadyRoadmap()` (`lib/roadmap-reader.ts:131-132`) uses `readPrograms()`, not `readProgramDirectory()`. `readPrograms()` (`lib/roadmap-reader.ts:71-83`) reads only `programs.json`. Grep: the only status-file read is `readState()` (`lib/roadmap-reader.ts:89`). The build path does not call it. The other build input, `programPageIndex()` via `readProgramCatalog()`, is covered by the #123 test (`tests/published-programs.test.ts:94-107`). |
| 2. The build output is the same with or without ignored crawl output, an invalid status file included | met | Unit level: `tests/snapshot-manifest.test.ts:58-64` compares the full `buildSnapshotAssets()` map. Independent check by this seat: `npm run build` in a temp worktree, clean twice and planted once (`plantCrawlOutput()`). Exit 0 all three times. `dist/client/_snapshots/` is byte-equal clean vs planted. The 773 prerendered route paths are the same set. Sampled HTML differs only in chunk hashes, which also differ between two clean builds. Whole-tree byte equality is not possible, as the implementer said. The proof is honest for the parts the data can reach. |
| 3. A test plants an invalid status file in a temp copy and runs `buildSnapshotAssets()` | met | `tests/snapshot-manifest.test.ts:58-64` with `tests/published-copy.ts:26-38` (`{ version: 1 }` status file). Red proof: HEAD tests on base code `04e51ff` give `not ok 17 - the build reads only tracked files ...`, 1 fail. Green on HEAD: 7/7 in that file. |

## Design and goal alignment

- The fix is at the root cause: one shared reader, `readPrograms()`. `readState()` reuses it, so the crawler keeps the status file. No fork of the design.
- The `readReadyRoadmap()` change is in scope. The build calls it (`lib/snapshot-manifest.ts:66`). Without it, AC1 fails.
- The docs line (`docs/deploy.md:59`) states the new rule. It is short and correct.
- No gold plating. The test helper move (`plantCrawlOutput()`) removes duplicate code. It does not add scope.

## Scope honesty

- No TODOs, mocks, skipped tests or deleted assertions. The #123 test keeps all its assertions and now shares the helper.

## Findings

### medium: an API behavior change is not named where a reader finds it

`readReadyRoadmap()` is also used by `app/api/roadmaps/route.ts:85`, `catalog-service/cli.ts:57` and `catalog-service/server.ts:98`. Two answers change:

1. The status file says discovery is `ready`, but `programs.json` is missing. Before: 503 ("temporarily unavailable"). Now: 404 ("Unknown roadmap program"), via `route.ts:34`.
2. The status file is invalid. Before: `?university=northeastern&program=<id>` gave 503. Now it gives 200. But `?university=northeastern` (`readProgramDirectory()`, `lib/roadmap-reader.ts:107-112`) still reads the status file and still gives 503. The two endpoints now disagree for the same local state.

Both happen only with local crawl output; production ships no status file. The implementer named change 1 to the orchestrator. The commit message (`a5e2ad7`) does not name either change, and no test pins the new 404. Fix: name both in the PR body (and optionally one test for the 404). No code change is required for this ticket.

### low: AC2 at full-build level rests on manual evidence

The automated test covers `buildSnapshotAssets()` and `programPageIndex()`, which are the only build inputs that read `data/catalogs/`. The full `npm run build` comparison is manual. This is acceptable, because two clean builds already differ. Keep the manual result in the PR body.

## Trade-offs and risk

- Deferred: the program-directory listing still reads the status file (by design, for the crawler and local UI). Not named in the commit. Covered by the medium finding.
- Risk: low. Production reads `_snapshots/`, which this review proved equal.

## Not checked

- `npm run typecheck` and full `npm test` were not re-run by this seat. The orchestrator reports 0 / 356 pass.
- The tech_lead review was not read (round 1 is independent).
