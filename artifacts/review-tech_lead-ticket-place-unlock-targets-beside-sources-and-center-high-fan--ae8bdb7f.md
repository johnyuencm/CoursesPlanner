# tech_lead review — ticket-place-unlock-targets-beside-sources-and-center-high-fan--ae8bdb7f

Verdict: **PASS** (round 1; no high findings)

Goal: Seat unlock targets beside their sources.
Reviewed state: branch `land/local-graph-focus` @ `b1825c1b235f24751916f87baf9607cd06973339` (parent `3a1f538`).
Product diff: `git diff 3a1f538..b1825c1` → `lib/graph.ts` +162/−41, `tests/graph.test.ts` +35, `components/graph-canvas.tsx` +3/−1, `components/course-graph.tsx` +3/−1.
Reviewer is not the implementer. No product file was modified. This is the only file written by this seat.
Independent first pass: did not read a `project_manager` artifact.

Harness `evidence-0bc6f5c0` recorded `npm test && npm run typecheck` pass (91/91, 0 skipped/todo, `tsc` clean). That is not this seat’s grade. Layout/wiring are judged from the committed diff plus an independent recompute of `layoutProgramFlow` and `mapScene` on the Seattle fixture (`seattleGraph()` / `mapScene({ scope: "program" })`).

I did **not** live-drive `/map`.

## Evidence inspected

| Check | Result |
| --- | --- |
| `git show b1825c1 --stat` | 4 files, +162/−41; message matches the LTR parent-alignment change |
| `git diff 3a1f538..b1825c1 -- tests/graph.test.ts` | **additions only**; no deletions, `.skip`, `.only`, `todo`, or loosened asserts |
| RTL→LTR column walk | `lib/graph.ts:569` now `for (let column = 0; column < rankKeys.length; column++)` |
| Short-span helper shared | `isShortPrerequisiteSpan` used by `prerequisiteHitPaths` (`:251`), `prerequisiteConnector` (`:471`), `PrerequisiteEdge` (`components/graph-canvas.tsx:30`), busBounds (`components/course-graph.tsx:232`) |
| Fixture AC1 (default `localeCompare`) | CS 5800 `y=2240`, CS 7800 `y=2400` (`PROGRAM_ROW=160` consecutive), CS 6220 `x=360` / `y=2400` in `[2240,2400]` |
| UI `mapScene` (typeOrder compare + column stretch) | CS 5800/7800 still consecutive at 2240/2400; CS 6220 `x=474` / `y=2240` still in band; `5800→6220` handle span `dx=250 <= PROGRAM_COL` → short H-V-H |
| Unique cells / x-order | 107 positions, 107 unique cells; 0 prereq `source.x >= target.x` inversions |
| CS 5010/5011, PHYS 5116/CS 7332, CS 5004/5010 vs CS 5500 | still same-column coreq stack, exclusive same-row, and left-of-5500 |

## Acceptance criteria

1. **met in library + locked by test.** Entire-program `layoutProgramFlow` places CS 6220 to the right of CS 5800 and CS 7800, those sources occupy consecutive rows, and CS 6220’s y sits in that closed interval (`tests/graph.test.ts:271-281`). Independent recompute matches. `mapScene` (the UI comparator) keeps the same source band; only CS 6220’s row inside the band changes (2400 → 2240).
2. **met in library + locked by test.** Isolated five-source graph: sources span `4 * PROGRAM_ROW`, DST y equals the median source row, DST x is to the right (`tests/graph.test.ts:284-298`). Those sources are the only rank-0 leftovers, so the consecutive-source lock does not contend with exclusive/multi packing.
3. **met.** Sole-prereq same-row lock unchanged (`tests/graph.test.ts:306-319`). CS 5004 and CS 5010 remain left of CS 5500 (`:249-258`, neighborhood `:408-417`). Evidence log: 91 pass, typecheck clean; this seat did not treat that as a grade.

## Architecture

The change fits the system. The previous skill-tree walk assigned Y from the right (median of already-placed children). That parked high-fan-in leftover roots such as CS 5800/CS 7800 far from CS 6220. Seating columns left-to-right against already-placed parents is the coherent inverse of the same barycenter machinery, still inside `layoutProgramFlow`, still consumed by `mapScene` for every scope.

Placement stays column-local (`used` is per rank). Exclusive 1:1 pairs claim the parent row first (`:629-638`). Identical incoming fingerprints pack as one consecutive block (`:639-669`). Coreq clusters still occupy consecutive rows with the head (`occupyAt` `:597-609`). Isolate bands are untouched.

`isShortPrerequisiteSpan` (`:236-238`) replaces three copies of `targetX - sourceX <= 180 && targetX > sourceX`. Adjacent-column detection now tracks `PROGRAM_COL` (360) instead of a magic 180px gutter. After `mapScene` stretches the first destination column to 474px (`:457-458`), handle-to-handle span is 250, which was **long** under 180 and is **short** under `PROGRAM_COL` — that is the connector half of the ticket.

No second layout engine, no persistence, no new trust boundary.

## Correctness

- **Named two-source band.** CS 5800 and CS 7800 are rank-0 leftovers with overlapping unlock sets. Leftover packing in barycenter/`childKey` order seats them on consecutive rows (`2240`, `2400`) with EECE 7205 immediately above. The `CS 5800|CS 7800` fingerprint then packs CS 5350/6140/6220/7870 as a 4-row block. CS 6220 lands in-band on both comparators. Collision-free: unique cells hold.
- **Five-source median.** One DST, five same-column roots, `parentCount=5`, `rows=1`, `centerOnPreferred` starts at `ys[2]`. Honest for the synthetic; does not exercise a crowded column.
- **Exclusive 1:1.** `isExclusivePair` is per-column (`childrenInColumn` `:627-631`). PHYS 5116/CS 7332 still share a row. Sole-parent courses whose parent already has other children in the column correctly skip this pass and join `siblingBlocks`.
- **Short vs long bus.** Adjacent `mapScene` edges for CS 6220/CS 5500/CS 7332 are short H-V-H. Skip-column spans remain long (17 of 53 arrows). `busBounds` uses the same helper as the rendered path, so hit geometry and paint stay in lockstep.
- **Idempotency / races.** Pure function; `used`/`positions` are local. `mapScene` still mutates `point.x` in place (pre-existing stretch).
- **Latent (not AC-breaking on this snapshot):** looser `parentCount` blocks pack after tighter ones, then `consecutiveStart` (`:553-566`) searches the whole column (down first, then up) rather than staying inside the parent Y span. CS 6240’s sources occupy `y=2080..2400` but the course sits at `y=1440` on both `layoutProgramFlow` and `mapScene` (TL-1). Same-rank prereqs still cannot align to a parent that has not been placed yet in the current column (pre-existing coreq min-rank).

## Tests

Added coverage is honest:

- Fixture lock for the named CS 6220 band (`tests/graph.test.ts:271-281`).
- Isolated five-source median (`:284-298`).
- Short vs long connector strings (`:301-304`).

No mocks, skips, or deleted asserts in this range. Existing unique-cell, x-order, coreq-row, neighborhood LTR, and “long connectors do not cross cards” tests still run.

Gaps are TL-2/TL-3, not a red-to-green cheat. The CS 6220 test would fail if that course left the source interval. The five-source test would fail if DST missed `sourceYs[2]`. The connector test would not fail if adjacent *layout* spans stopped being short, because it never reads layout coordinates (TL-3).

## Operations

Rollback is revert of `b1825c1`. Client-only positions; no catalog write, flags, or network. Extra work is O(columns × group × coreq BFS) on ~107 connected nodes. `consecutiveStart`’s unbounded `delta` loop always terminates (`used` is finite; search is unbounded upward). `mapScene` column stretch remains `max(PROGRAM_COL, 304 + 10 * destCount)`; current max unique destinations in one column is 17 (width 474). Adjacent short-span breaks only if unique dests in a column exceed ~28 (`304 + 10n - GRAPH_CARD_WIDTH > PROGRAM_COL`). Not this catalog.

## Security

No new trust boundary. Layout consumes in-memory course codes. No filesystem, URL, or command surface. Edge click handlers are unchanged in-process callbacks.

## Code health

Easier to evolve the *rule* (one short-span helper, one LTR parent seater). Harder to evolve the *column body*: exclusive / fingerprint / leftover passes are nested closures inside `layoutProgramFlow` with an implicit contract that `occupyAt` must write exactly the row count `consecutiveStart` reserved. `childKey` tie-break uses `localeCompare` without `{ numeric: true }` while `compare` does — latent, not this catalog. Fingerprint `parents.join("|")` / `split("|")` assumes codes never contain `|`.

## Findings (round 1)

### TL-1 (medium) — looser fan-in blocks can leave the source band entirely

`lib/graph.ts:662-669` packs `multiBlocks` by ascending `parentCount`, then `consecutiveStart` (`:553-566`) accepts the first free consecutive run anywhere in the column. On the Seattle program map, CS 6240’s on-map sources are EECE 7205/CS 5800/CS 7800 at `y=2080,2240,2400` (already a consecutive band). The tighter `CS 5800|CS 7800` 4-course block and the earlier 3-parent CS 7980 claim `1920..2560`. CS 6240 (`parentCount=3`) then lands at `y=1440` — five rows above its sources — under both default `layoutProgramFlow` and UI `mapScene`. Overlap is still impossible. Ticket ACs name CS 6220 and a 1-target synthetic, so this is not a false-green; it is the goal’s “sit beside sources” rule failing for a real 3-source course on the same unlock set.

### TL-2 (low) — median seating is at fingerprint-block grain, not per course

`lib/graph.ts:614-626,669` centers one consecutive block on `medianY`. The `CS 5800|CS 7800` group is four courses on a two-row parent span, so CS 5350 (`y=2080`) and CS 7870 (`y=2560`) sit one row outside `[2240,2400]` while CS 6220 stays inside by `compare` order. The five-source test has a single DST, so it cannot catch this. Intentional given the change summary; brittle if another same-fingerprint elective sorts CS 6220 to the block edge after a downward collision.

### TL-3 (low) — short-bus test does not lock adjacent *layout* spans

`tests/graph.test.ts:301-304` asserts `prerequisiteConnector(224, 58, 500, 218)` (dx=276) is short and dx=576 is long. Live adjacent `mapScene` handle span is 250 after stretch (`source.x + GRAPH_CARD_WIDTH` → `target.x`). The helper is shared, and 250 is short today, but reverting `isShortPrerequisiteSpan` to a looser/tighter constant, or stretching a column past `PROGRAM_COL + 224`, would not fail this test. The card-crossing test (`:151-176`) still walks real `mapScene` paths.

## Areas inspected and found clean

- **Architecture.** LTR parent alignment belongs in `layoutProgramFlow`; short-span predicate is one function; neighborhood/program still share that layout.
- **Correctness of named ACs.** CS 6220 band, five-source median, exclusive same-row, CS 5500 x-order, unique cells, 0 x-inversions, coreq CS 5011 `+ PROGRAM_ROW`.
- **Tests.** Strengthened, not loosened; no skipped/disabled/deleted asserts in range.
- **Ops / security.** Pure client layout; revert to roll back; no secrets or injection surface.
- **Connector/hit consistency.** Canvas, busBounds, connector, and hit paths all call `isShortPrerequisiteSpan`.

## Not done by this review

- No live browser of `/map` (CS 6220 band, CS 6240 bus, five-source is synthetic-only).
- Did not re-run `npm test` / `npm run typecheck` as this seat’s score (inspected `evidence-0bc6f5c0` plus independent layout recompute).
- Did not run `ycm-harness review *`; no harness review JSON written.
- Did not propose a fix implementation.
- No debate round 2 (did not consume the project_manager artifact).
