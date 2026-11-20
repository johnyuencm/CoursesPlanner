---
reviewed_head_sha: 00ccbc4e5b1acd463f4a9d54eed99520076f15b6
ticket: 144
seat: project_manager
round: 1
date: 2026-11-20
verdict: PASS
---

# Issue #144 review, project manager, round 1

- Branch: `fix/144-planner-cls`, head `00ccbc4`. Base: `aaa76cb` (PR #146 head, open, mergeable).
- Diff: `git diff aaa76cb...HEAD`. 4 files: `app/globals.css`, `components/planner-board.tsx`, `tests/planner-page.test.ts`, the record.
- Record: `docs/reviews/2026-11-20-issue144-verification.md`.

## What I checked myself

| Check | Result |
|---|---|
| `git merge-base --is-ancestor aaa76cb HEAD` | true. The branch is stacked on #146. |
| PR #146 head | `aaa76cb`, state open, mergeable. |
| PR for `fix/144-planner-cls` | None yet. |
| `npm run typecheck` | exit 0 |
| `npm test` | 366 pass, 0 fail |
| `npm run build` | Not run by me. Record says exit 0. |
| CLS in a browser | Not re-measured by me. I read the record. |

## Per-criterion map

| AC | Status | Evidence |
|---|---|---|
| 1. CLS at or below 0.1 after the catalog loads, Boston and Seattle, 1280 and 390 px | Met (from the record) | Record, table "Result": 0.027 / 0.004 Boston, 0.024 / 0.004 Seattle, 3 loads each. Base 0.204-0.339, same as the #140 record. Extra viewports all at or below 0.041. Failure path also drops under 0.1 (0.072 / 0.031). |
| 2. Reserve the board's space while it loads | Met | `components/planner-board.tsx:255` wraps the loading state in `div.board-placeholder` only while `catalogBusy`. `app/globals.css:567` sets `min-height: 100vh`. Test `tests/planner-page.test.ts:142-149` checks both. Failure path has no placeholder (`:139`). |
| 3. Worker CPU per request does not go up meaningfully | Met | Planner pages are prerendered (`X-Vinext-Cache: HIT`). Cache-miss A/B: 43.6-48.4 µs vs 45.8-47.3 µs, inside noise. Change adds one `div` (37 bytes). |

## Design alignment

- The AC says "for example, a placeholder of the same height". The fix uses one screen (`100vh`), not the board height. The record explains why: the loaded board is taller than one screen, so the page text stays below the fold. This is a reasoned choice inside the "for example", not a fork.
- Limit of this choice: on a very tall screen with a very short board, the page text moves up into view. Record measures it: 2560x1440, no terms, CLS 0.018. Named and under the limit.

## Goal alignment and scope

- The change is 3 product lines and one test. No gold-plating. No side-quest.
- The remaining shift is the heading actions growing when the board lands (0.024-0.041). The implementer left it to keep #146's heading unchanged. This is honest and named in the record. It is under the limit, so it does not block the AC.
- No TODOs, no mocks, no deleted tests.

## Findings

| # | Rank | Finding | Action |
|---|---|---|---|
| 1 | medium | Stacked PR, merge order. The branch holds #146's commits. If #146 merges with a squash, `fix/144-planner-cls` will show #146's diff again and must be rebased onto master. | PR body: set base to `fix/140-catalog-loading`, say "merge #146 first", and say how to retarget (rebase `--onto master aaa76cb` after a squash merge). |
| 2 | low | The CLS scripts "stayed in the session scratchpad" (record, "Method" step 6). This machine is temporary, so AC1 evidence is numbers only. The method text is detailed enough to repeat. | Optional: commit the measurement script under `artifacts/` or `docs/reviews/`. Not a blocker. |
| 3 | low | The test checks the CSS with a regex on the exact text `.board-placeholder { min-height: 100vh; }` (`tests/planner-page.test.ts:148`). A format change breaks it with no behavior change. | Accept. It guards the one value that makes the fix work. |
| 4 | low | AC1 was measured on local `wrangler dev` with a 2.5 s delayed API, not on production. Same method as #140, so the comparison holds. | PR body: say "local measurement, not production". |

No high findings.

## What the PR body must name

1. Stacked on #146. Base `fix/140-catalog-loading`. Merge #146 first, then retarget or rebase.
2. CLS table for the 4 AC cells, base vs branch, and that it is a local measurement.
3. Remaining shift: the heading actions (0.024-0.041 at desktop widths), left on purpose to keep #146's heading. Offer a follow-up issue only if the team wants CLS near 0.
4. Known limit: on very tall screens with a short board, the page text moves up (0.018 at 2560x1440).
5. Failure path CLS also drops (0.156 -> 0.072).
6. Worker CPU: prerendered, cache-miss render inside noise.
7. `Closes #144`, and a link to the record.

## Verdict

PASS. All 3 AC are met on the record and the code. The done-state is honest. Finding 1 must be in the PR body.
