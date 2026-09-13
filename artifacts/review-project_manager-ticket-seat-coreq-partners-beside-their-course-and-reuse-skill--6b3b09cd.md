# project_manager review — ticket-seat-coreq-partners-beside-their-course-and-reuse-skill--6b3b09cd

Verdict: **PASS** (phase 1 round 1; no high findings)

Goal: Complete MSCS Seattle prerequisite graph (still **active**). This ticket
is the bounded leftover slice: seat CS 5011 on the next row under CS 5010, and
reuse `layoutProgramFlow` for neighborhood / depth views instead of wrap-4
packing. Reviewer is **not** the implementer (agent `5faef9b3`; product commits
`17fc4c5`, `c995fb8`, `745a3b5`). The only file written by this review is this
artifact. Do **not** complete `goal_complete-mscs-seattle-prerequisite-graph_5f65`
from this pass, and do **not** fail this ticket for the parent goal remaining
open.

No `design.md` / `implementation-plan.md` / `prd.md` under the goal directory.
Acceptance is the ticket text. Wiki leftover page
`.ycm-harness/wiki/pages/work-lite-2026-09-13-skill-tree-map.md` named exactly
these two leftovers (CS 5011 not adjacent; neighborhood wrap packing) plus
“parent MSCS graph goal not closed.” Compact status-pill ellipsis was **not**
in this AC and was **not** changed — deferred, not unmet.

## Evidence I inspected

| Check | Result |
| --- | --- |
| Branch | `fix/complete-prereq-graph` |
| Range | `git diff 62ee8b9..HEAD` → 3 files, **+67 / −30**. Commits `17fc4c5` (coreq consecutive rows), `c995fb8` (exclusive-pair + neighborhood LTR tests), `745a3b5` (GraphWorkspace reuses skill-tree layout). No test deleted. |
| Ticket status | harness `in_progress`; `code_changed: true`. Status is not treated as proof. |
| `TODO`/`FIXME` in this diff | none |
| `wrap = 4` / `index % wrap` packing | **gone** from `components/course-graph.tsx` and the rest of `*.ts`/`*.tsx` |
| `npm test` (this review) | **53 pass / 0 fail / 0 skip / 0 todo**, ~1.26 s |
| `npm run typecheck` (this review) | **exit 0** |
| Fixture layout + default compare | `tests/graph.test.ts:156-167` locks CS 5011.x === CS 5010.x and y === y + `PROGRAM_ROW` (128) |
| UI `typeOrder` + `data/catalog.json` probe | CS 5010 `{x:0,y:2304}`; CS 5011 `{x:0,y:2432}`; dy=128. Matches orchestrator live `/map`. HTML-fixture + typeOrder dump is `{2048,2176}` — same relation, two fewer rank-0 rows. |
| Neighborhood probe (catalog.json, typeOrder) | codes `CS 5004`, `CS 5010`, `CS 5500`, `CS 6510`; x `0 / 0 / 208 / 416` (`PROGRAM_COL` 208). 5004 and 5010 left of 5500; 5500 left of 6510. |
| Status-pill ellipsis | `app/globals.css:385` unchanged in this range |

Live React Flow DOM was **not** re-clicked in this review. AC1/AC2 numbers were
recomputed from the same `layoutProgramFlow` path GraphWorkspace calls
(`components/course-graph.tsx:184-186`) against the published catalog snapshot.

## Per-criterion map

| # | Acceptance criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Seattle program map: CS 5011.x equals CS 5010.x and CS 5011.y equals CS 5010.y plus PROGRAM_ROW; a synthetic exclusive coreq pair with no outgoing unlocks also occupies consecutive rows in the same column | **met** | `occupy` stacks same-rank coreq partners on the next `nodeHeight` (`PROGRAM_ROW` 128) in the same column (`lib/graph.ts:288-304,111`). Seattle: `tests/graph.test.ts:165-166` (`x` equal; `y("CS 5011") === y("CS 5010") + PROGRAM_ROW`). Catalog.json + UI `typeOrder`: `{x:0,y:2304}` / `{x:0,y:2432}`. Synthetic pair: `tests/graph.test.ts:169-182` (`a.x === b.x`, `Math.abs(a.y - b.y) === PROGRAM_ROW`) with only a coreq edge and `prerequisites: none`. |
| 2 | Neighborhood of CS 5500 still exactly CS 5004, CS 5010, CS 5500, CS 6510; those four lay out LTR as a skill tree (5004 and 5010 left of 5500, 5500 left of 6510). GraphWorkspace depth views other than program call layoutProgramFlow and no longer use wrap=4 packing | **met** | Membership: `tests/graph.test.ts:52-58` and `:189`. LTR: `:190-194` plus catalog.json probe x=`0/208/416`. GraphWorkspace calls `layoutProgramFlow` **before** the program-only band branch (`components/course-graph.tsx:184-187`); the old `else { wrap = 4; … (index % wrap) * 148 }` block is deleted (`745a3b5`). `GraphScope` remains `"program" \| "1" \| "2" \| "full"` (`:25`); `"1"` / `"2"` / `"full"` share that single layout call. Repo grep: no remaining `wrap = 4`. |
| 3 | `npm test` and `npm run typecheck` both exit 0 | **met** | This review: `tsx --test tests/*.test.ts` → tests 53 / pass 53; `tsc --noEmit` exit 0. |

## Design alignment

Matches the agreed leftover, does not fork it. Prior skill-tree panel left
CS 5011 in the same column as CS 5010 but **not** on the next card
(`artifacts/review-project_manager-skill-tree-map.md` PM-2 / wiki Leftovers).
This slice pins partners in `occupy` rather than inventing a second layout.
Neighborhood / two-away / full-component packing is the same `layoutProgramFlow`
the program map already used — the ticket title’s “reuse,” not a parallel
algorithm. Coreq rank-share via `Math.min` (`lib/graph.ts:208-213`) is unchanged
policy from the earlier follow-up; Seattle’s only in-scope pair stays rank 0.

`compact: true` on every graph node (`course-graph.tsx:175`) is extra vs the
written AC but required to keep neighborhood chips on the `PROGRAM_COL` /
`PROGRAM_ROW` grid. Not a silent product fork.

## Goal alignment

Correct next slice, not a side-quest. Parent goal is a readable official MSCS
Seattle graph; an idle-looking coreq partner and wrap-4 neighborhood were the
named leftovers blocking that readability. Cheaper alternatives (inspector-only
“taken with CS 5010” copy, or leaving neighborhood as wrap-4) were **not**
taken. Catalog membership, parser, and program-map LTR from prior tickets are
untouched. Parent goal remains incomplete (first-paint camera, pill ellipsis,
and whatever else the parent still lists). **This ticket is not that job.**

## Scope honesty

- No product TODO standing in for a met criterion. No test skipped, deleted, or
  weakened. Two tests **added** (`tests/graph.test.ts:169-195`); the existing
  CS 5011 tree test **gained** the directional `+ PROGRAM_ROW` assert (`:166`).
- Wrap-4 packing is actually gone, not gated behind a flag.
- Neighborhood membership is still the local four-course set (prior ticket AC
  preserved).
- Gold-plating: none beyond always-compact nodes, which is the skill-tree chrome
  the neighborhood now shares.
- Compact status-pill ellipsis (`app/globals.css:385`) is **out of AC** and
  **unchanged**. Named deferred only.
- Band labels still render only when `depth === "program"` (`course-graph.tsx:187`).
  CS 5500 neighborhood has no isolates, so AC2 is unaffected. Not claimed done
  for `"full"`.
- Harness ticket is still `in_progress`; this review does not treat that as
  “submitted/verified.”

## Trade-offs (named)

1. Coreq partners still have **no canvas stroke** (prior skill-tree decision).
   Inspector/table copy remains the take-together path.
2. Neighborhood nodes are now compact CourseCard chrome, not the old taller
   wrap-4 cards. Fits reuse; changes the depth-view look.
3. Tests lock layout with default `localeCompare`; the map injects `typeOrder`
   (`course-graph.tsx:184-185`). Relative AC geometry still holds under
   typeOrder (this review’s catalog.json probe). Absolute y differs between
   HTML fixtures (2048/2176) and live catalog.json (2304/2432).
4. Status-pill ellipsis left as-is.
5. Parent MSCS graph goal left active.

## Risk surface

- Partner stacking walks `coreqPartners` immediately after the first endpoint
  (`lib/graph.ts:295-304`). Seattle has one pair; a multi-partner or
  already-occupied row uses `while (used.has(partnerY))` and can skip a row.
  The exclusive synthetic test covers the empty-column case, not a crowded
  column. Residual, not an AC miss.
- Pre-existing min-rank coreq share can still pull a later-rank partner left
  (`tests/graph.test.ts:197-214`). Not introduced here; Seattle 5010/5011 are
  both rank 0.
- GraphWorkspace wrap-4 deletion is locked by source inspection, not a React
  test. `layoutProgramFlow` on the neighborhood key set **is** tested
  (`tests/graph.test.ts:185-195`), which is the behavior the UI now calls.

## Findings

None high or medium.

- **PM-1 (low)** — `tests/graph.test.ts:159` and `:190` call `layoutProgramFlow`
  without the UI `typeOrder` comparator (`components/course-graph.tsx:184-185`).
  Independent catalog.json + typeOrder probe still meets AC1 and AC2. A future
  typeOrder-only packing change would not turn those tests red. Not an unmet
  criterion.

## Debate round 1

Independent first pass. `artifacts/review-tech_lead-ticket-seat-coreq-partners-beside-their-course-and-reuse-skill--6b3b09cd.md` not read (round 1).
