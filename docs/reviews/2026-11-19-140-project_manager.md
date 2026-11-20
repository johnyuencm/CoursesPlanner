---
reviewed_head_sha: a0b581bc4d607a1b3ab222c10d9596fee9c77a33
base_sha: c87953a7c55eb6c4706d82a92dde0b0bb385c943
ticket: johnyuencm/CoursesPlanner#140
seat: project_manager
round: 1
date: 2026-11-19
verdict: PASS (one condition before merge)
---

# Issue #140 review: project manager, round 1

Branch `fix/140-catalog-loading`. Diff `c87953a...a0b581b`: 3 files, +105 / -4.
The product change is 2 lines in `components/planner-board.tsx`.

## What I checked myself

| Check | Result |
|---|---|
| `npx tsx --test tests/planner-page.test.ts` | 5 pass, 0 fail |
| `npm run build` | exit 0, working tree clean after the build |
| `npm test`, `npm run typecheck` | Not re-run. Orchestrator record: 364 pass, typecheck exit 0. |
| Provider state machine | `components/app-provider.tsx:169` starts `catalogBusy` at `true`. `:196-212` sets it `false` only in `finally`, after `setCatalog` or `setCatalogError`. |
| Other failure text during load | `components/plan-backup.tsx:52,114` gates its banner with `isCatalogOutage(..., catalogBusy)`. Overview keeps `CatalogState quiet` (`components/overview.tsx:22`) and has no "unavailable" text. |
| Follow-up for CLS | #144 exists and is open. |
| PR | No PR exists yet for the branch. The branch is on origin at `a0b581b`. |

## Per-criterion map

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | While the catalog loads, a loading state shows, not "unavailable" | met | `components/planner-board.tsx:251` picks the "while the catalog loads" copy on `catalogBusy`. `:254` drops `quiet`, so `components/catalog-state.tsx:11` renders `LoadingState` (`role="status"`). Live walk in the verification record: "unavailable" never visible, Boston and Seattle, 1280 and 390 wide. |
| 2 | "Unavailable" only after the request fails | met | The failure copy shows only when `catalogBusy` is false and no catalog exists. Test `tests/planner-page.test.ts:129-135`. Live walk: aborted `/api/catalog` on Boston shows the failure copy and Try again. |
| 3 | A test covers loading and failure | met | `tests/planner-page.test.ts:121-127` (loading, server render and hydrated) and `:129-135` (failure). Both pass. The record says a mutation test made the failure test fail. |
| 4a | `npm test`, `npm run typecheck`, `npm run build` pass | met | Build: my run, exit 0. Test and typecheck: orchestrator run. |
| 4b | Worker CPU per request does not go up | partial | The record measures 24.2 to 29.4 µs per board render (+5.2 µs, +21% relative, 0.05% of the 10 ms limit). Literally, CPU goes up. See F1. |

## Findings

### F1 (medium): AC4 "does not go up" is not met literally

- The board render costs 5.2 µs more. The cause is the `LoadingState` markup that AC1 requires (1,509 to 1,969 bytes).
- So AC1 and the literal AC4 conflict. Any loading state adds render work.
- In spirit, AC4 guards the 10 ms Workers Free budget. A 0.05% increase does not threaten it. I accept the trade-off.
- Condition: the PR body must state "CPU per request rises about 5 µs (0.05% of 10 ms), because the loading state is new markup". Do not tick AC4 as plain "met". Tick it with that note, or ask the issue owner to amend AC4.
- The benchmark measures only the board render (`renderToStaticMarkup`), not the full Worker request. The delta is the same, because only the board changed. State the method in the PR body.

### F2 (low): the CLS deferral must also be in the PR body

- CLS stays above 0.1 on the branch (0.20 to 0.34). It is better than base (0.25 to 0.51). #144 tracks it.
- CLS is not an AC of #140, so the deferral is honest. Link #144 in the PR body so a reader does not think the load is now smooth.

### F3 (low): the tests set the context directly

- The tests override `catalogBusy` and `catalogError` on the provider value. They do not drive `fetchCatalog`.
- So no unit test proves the provider order (`catalogBusy` false only after `setCatalog` or `setCatalogError`). The live walk covers it. The provider code (`components/app-provider.tsx:196-212`) is unchanged and correct.
- Not a blocker. AC3 asks for coverage of the two states, and it has that.

### F4 (low): the failure path was walked live on Boston only

- The record marks Seattle "not walked" for abort and Try again. The code path does not depend on the tier, so the risk is low. The record names the gap, which is honest.

## Design and goal alignment

- No design doc exists for this ticket. The change reuses the existing `catalogBusy` state and the shared `CatalogState`. It adds no state and no component.
- The change fixes the reported symptom at its source (`quiet` hid the loader, and the copy ignored the busy state). No side-quest.
- A cheaper option does not exist. A copy change alone would leave no loading state for AC1.

## Scope honesty

- No TODO, no mock in product code, no deleted test, no gold-plating.
- Deferred: CLS (#144). Named in the record. Must be named in the PR body (F2).

## Dates

- Today (container clock, UTC) is 2026-11-19. The verification record `docs/reviews/2026-11-19-issue140-verification.md` says 2026-11-19. That matches.
- The orchestrator asked for this file as `2026-11-21-...`. That date is in the future, so I named this file with today's date.
- The record cites `docs/reviews/2026-11-20-126-user_advocate.md`, and this repo has other 2026-11-20 files. Those dates are after today. The clocks of earlier sessions do not agree. This is not a #140 defect, but do not trust file dates to order these reviews.

## Risk surface

- A slow catalog now shows a loader after 300 ms (CSS delay), not a false error. Low risk.
- A failed catalog keeps the old copy and Try again. Unchanged behavior.
- CPU: +5 µs per render. No budget risk.
