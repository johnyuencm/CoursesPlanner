# project_manager review — ticket-place-unlock-targets-beside-sources-and-center-high-fan--ae8bdb7f

Verdict: **PASS** (phase 1 round 1; no high findings)

Goal: Seat unlock targets beside their sources (`goal_seat-unlock-targets-beside-their-sources_2aad`, **active**). This is the only ticket on that goal. Reviewer is **not** the implementer. Product commit `b1825c1`; HEAD `4779f5c` is harness ledger only. The only file written by this review is this artifact.

No `design.md` / `implementation-plan.md` / `prd.md` under a goal directory. Acceptance is the ticket text and goal description.

## Evidence I inspected

| Check | Result |
| --- | --- |
| Branch | `land/local-graph-focus` (ahead of origin by harness commits) |
| Product range | `git diff 3a1f538..b1825c1` → 4 files, **+162 / −41**. No test deleted. Tests **added** in `tests/graph.test.ts` (two-neighbor band, five-source median, short adjacent bus). Existing sole-prereq and CS 5500 left-of tests remain. |
| Ticket | harness `done`, `code_changed: true`, submitted digest `56783cc1…`. Status is not treated as proof. |
| `TODO`/`FIXME` in this diff | none |
| Harness verify `evidence-0bc6f5c0` | **pass**, command `npm test && npm run typecheck`, implementer `layout-impl-b1825c1` ≠ verifier `layout-verify-b1825c1` |
| `npm test` (this review) | **91 pass / 0 fail / 0 skip / 0 todo** |
| `npm run typecheck` (this review) | **exit 0** |
| HTML `layoutProgramFlow` (test path) | CS 5800 `{x:0,y:2240}`; CS 7800 `{x:0,y:2400}`; CS 6220 `{x:360,y:2400}`. Consecutive span 160 (`PROGRAM_ROW`). Matches the implementer-reported numbers. |
| HTML `mapScene` typeOrder | Same source rows; CS 6220 `{x:474,y:2240}` still in-band and to the right. |
| Live `/map` Entire program | React Flow transforms: CS 5800 `translate(0px, 2880px)`, CS 7800 `translate(0px, 3040px)`, CS 6220 `translate(534px, 2880px)`. Same geometry as `data/catalog.json` `mapScene`. Short bus `CS 5800-CS 6220-18` / `CS 7800-CS 6220-19`: `H 406 V … H 532`, shared vertical at x=406 from 2938–3098, **no** gutter `sourceY+82`. |
| Five-source synthetic | source ys `0,160,320,480,640`; DST y=`320` (median); DST x > SRC x. |
| Sole-prereq / CS 5500 | PHYS 5116 and CS 7332 same row; CS 5004 and CS 5010 x=0, CS 5500 x=534 on live `/map`. |

Implementer live y=`2240/2400/2400` is the HTML-fixture `layoutProgramFlow` packing, not the live catalog `/map` packing (`2880/3040/2880`). Relative AC geometry holds on both. Absolute y is **not** in the written AC.

## Per-criterion map

| # | Acceptance criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | On the entire-program layout, CS 6220 sits to the right of CS 5800 and CS 7800, its y is between those two source rows, and those two sources occupy consecutive rows | **met** | Layout now walks columns left-to-right and seats multi-parent blocks on the median source y (`lib/graph.ts:569`, `:639-669`). Test: `tests/graph.test.ts:271-281` (`x` left-of; `high - low === PROGRAM_ROW`; `y(6220)` in `[low, high]`). Live Entire program (`Show` value `program`): 5800 y=2880, 7800 y=3040 (Δ=160), 6220 x=534 y=2880. Adjacent bus is short surround-then-point (`graph-canvas.tsx:30`, live paths `H 406 V 2938 H 532`). |
| 2 | A synthetic course with five same-column sources sits on the median source row, and those sources occupy five consecutive rows so the bus can surround them | **met** | `packBlock(..., medianY, true)` with `medianY = ys[Math.floor((ys.length - 1) / 2)]` (`lib/graph.ts:657,669`) plus `consecutiveStart` (`:553-565`). Test: `tests/graph.test.ts:284-298` (`sourceYs[4] - sourceYs[0] === 4 * PROGRAM_ROW`; DST y === `sourceYs[2]`; DST x > SRC x). This review recomputed ys `0..640` step 160, DST at 320. |
| 3 | Sole-prerequisite pairs still share a row; CS 5004 and CS 5010 stay left of CS 5500; npm test and npm run typecheck pass | **met** | Exclusive sole-child still packs on the parent row (`lib/graph.ts:629-637`, `isExclusivePair` → `centerOnPreferred: false`). Unchanged test `tests/graph.test.ts:306-319`. Left-of: existing `tests/graph.test.ts:257-258` plus neighborhood `:415-416`. Live `/map`: 5004/5010 x=0, 5500 x=534; PHYS 5116 and CS 7332 same y=4320 on catalog `mapScene`. This review: 91 tests pass, `tsc --noEmit` exit 0. Harness `evidence-0bc6f5c0` pass. |

## Design alignment

Matches the ticket brief; does not fork it. The old right-to-left walk aligned parents to already-placed children and parked CS 6220 at the top of the canvas. The new parent-first walk places each unlocked course at the median of on-map sources, clusters same-child sources via barycentric `childKey` (`lib/graph.ts:549-550`) plus consecutive occupy, and treats adjacent-column arrows as a short bus (`isShortPrerequisiteSpan` uses `PROGRAM_COL` 360, not the old 180px cap that would send scaled adjacent columns into the gutter). Extracting that helper into `course-graph.tsx:232` and `graph-canvas.tsx:30` is the same policy, not a second algorithm.

No silent product fork. Column width scaling in `mapScene` (`lib/graph.ts:457-458`) pre-existed; live adjacent dx into 6220 is 310 ≤ 360, still short.

## Goal alignment

This is the promised slice, not a side-quest. The goal names the CS 6220 / 5800 / 7800 band and five-plus median seating so the bus can surround sources. Cheaper alternatives (inspector copy only, or only nudging 6220 without clustering 5800/7800) were **not** taken. Catalog membership, neighborhood of CS 5500, coreq stacking, and drill-in are untouched. Completing this ticket is what the goal asked for; this review does **not** `goal complete`.

## Scope honesty

- No product TODO standing in for a met criterion. No test skipped, deleted, or weakened. Three tests **added**; sole-prereq and CS 5500 left-of tests **kept**.
- Short-bus path is actually used on Entire program 5800/7800→6220, not gated.
- Gold-plating: none beyond the barycentric `childKey` tie-break needed to keep same-child sources adjacent in rank-0 packing.
- Ticket already `done` in harness after verify; this review does not treat that as independent proof.

## Trade-offs (named)

1. Rank-0 source clustering is barycentric adjacency plus sequential pack, not a second pass that pulls sources into a window around the child. Seattle 5800/7800 consecutive rows are locked; a crowded column with divergent outgoing sets could still interleave. Residual, not an AC miss.
2. Two-parent median uses `ys[floor((n-1)/2)]` (the lower row). 6220 sits at an endpoint of the two-row band (live: same y as 5800). AC requires in-band, not geometric center.
3. AC1 unit test uses `layoutProgramFlow` without UI `typeOrder` / `mapScene` x-scaling. Live catalog packing shifts absolute y vs the HTML fixture. Relative AC still holds (this review).
4. Five-source fixture has no competing rank-0 courses; consecutive rows are easier there than on the Seattle map. The Seattle two-source test is the crowded-column lock.
5. Parent goal left active until closeout.

## Risk surface

- `consecutiveStart` prefers the first free slot **below** a blocked median (`lib/graph.ts:562-564`). A collision can move a high-fan-in target off the exact median while remaining in a wider span. AC2’s isolated fixture does not hit that branch.
- `isShortPrerequisiteSpan` compares against unscaled `PROGRAM_COL`. Extreme per-column destination counts could stretch `mapScene` x so adjacent dx exceeds 360 and fall back to the gutter. Live 6220 dx=310; not observed.
- Live `/map` default depth is `"course"` (`course-graph.tsx:110`); AC1 is Entire program (`scope: "program"`). Operator must select Entire program, which the live tab had.

## Findings

None high or medium.

- **PM-1 (low)** — `tests/graph.test.ts:273` (and `:252`) call `layoutProgramFlow` without the UI `mapScene` comparator / column stretch (`components/course-graph.tsx:149-155`, `lib/graph.ts:440-458`). Independently, catalog `mapScene` and live Entire program still meet AC1 and AC3 left-of. A future typeOrder-only packing change would not turn those tests red. Not an unmet criterion.

## Debate round 1

Independent first pass. `artifacts/review-tech_lead-ticket-place-unlock-targets-beside-sources-and-center-high-fan--ae8bdb7f.md` not read (round 1).
