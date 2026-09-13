# tech_lead review — ticket-seat-coreq-partners-beside-their-course-and-reuse-skill--6b3b09cd

Verdict: **PASS** (round 1; no high findings)

Goal: Seat corequisite partners on consecutive skill-tree rows in the same column, and reuse that layout for neighborhood / non-program depth views instead of `wrap=4` packing.
Reviewed state: branch `fix/complete-prereq-graph` @ `745a3b500d8fcf9fb30dafebc5ea34d0ebf84569`.
Range: `git diff 62ee8b9..HEAD` → `17fc4c5`, `c995fb8`, `745a3b5`.
Product diff: `components/course-graph.tsx` +5/−21; `lib/graph.ts` +31/−9; `tests/graph.test.ts` +31.
Reviewer is not the implementer (id `5faef9b3`). No product file was modified. This is the only file written by this seat.
`artifacts/review-project_manager-ticket-seat-coreq-partners-beside-their-course-and-reuse-skill--6b3b09cd.md` may exist in the tree; this pass does not read it (independent first pass, no debate round 2).

I did **not** live-drive `/map`. Layout and wiring are judged from the committed diff plus the existing graph tests. Orchestrator live `/map` numbers are noted below as external evidence, not this seat’s score.

## Evidence inspected

| Check | Result |
| --- | --- |
| `git diff 62ee8b9..HEAD --stat` | 3 files, +67/−30; no other product paths |
| `git diff 62ee8b9..HEAD -- tests/graph.test.ts` | **additions only**; no deletions, `.skip`, `.only`, `todo`, or loosened asserts |
| `wrap = 4` / neighborhood column pack | **gone** from `components/course-graph.tsx` (old `:204-219` else-branch deleted) |
| `layoutProgramFlow` call sites | `lib/graph.ts:195`; `components/course-graph.tsx:185` (all depths); tests |
| CS 5010 unlocks in `data/catalog.json` | four targets (`CS 5400`, `CS 5500`, `CS 6510`, `CS 7980`) → 5010 is `multi`, not `exclusive` |
| Scoped coreq construction | `catalogRelations` dedupes pairs (`lib/graph.ts:33-43`); occupy reads those edges bidirectionally (`:227-238`) |
| `PROGRAM_ROW` | `128` (`lib/graph.ts:111`); matches orchestrator dy=128 |

## Acceptance criteria

1. **met in library + locked by test.** After rank-sharing, occupy places same-rank coreq partners in the current column immediately under the primary (`lib/graph.ts:208-213, 288-304`). Seattle fixture: `y(CS 5011) === y(CS 5010) + PROGRAM_ROW` and equal x (`tests/graph.test.ts:156-167`). Synthetic leftover pair with no outgoing unlocks: same x and `abs(dy) === PROGRAM_ROW` (`:169-183`). CS 5010 is a `multi` parent (four unlocks), so the Seattle assertion exercises the aligned occupy path, not only leftover packing.
2. **met in library + wiring.** Neighborhood membership unchanged (`tests/graph.test.ts:52-61, 185-189`). `layoutProgramFlow(neighborhood.keys(), …)` is LTR: 5004 and 5010 left of 5500, 5500 left of 6510 (`:190-194`). `GraphWorkspace` now always calls `layoutProgramFlow` (`components/course-graph.tsx:184-186`); band nodes only when `depth === "program"` (`:187-201`). `wrap=4` packing is deleted. `compact: true` is unconditional (`:175`). `focusCode` correctly left the graph memo deps because `visible` already depends on it (`:137-140, 219`).
3. **not re-scored here.** Tests were added, not disabled. Orchestrator reported `npm test` 53 pass and `tsc` exit 0; this seat did not treat that as a grade.

## Architecture

The change fits the system. Skill-tree geometry already lived in `layoutProgramFlow`; neighborhood views were the leftover wrap packer. Hoisting the layout call so every depth uses that function (`components/course-graph.tsx:184-186`) is the right cohesion: one collision-free column/row model, one coreq rule, one compare hook.

`occupy` (`lib/graph.ts:288-305`) keeps placement in one column-local `used` set. Partners are gated to the same rank so a coreq cannot be written into the wrong column. `catalogRelations` already emits one undirected pair; the new map just indexes both ends.

Isolate-band packing still runs inside `layoutProgramFlow` (`:314-329`) even for neighborhood keys. Connected BFS neighborhoods (AC2’s four courses) have empty classified bands, so positions are the skill tree only. Band *labels* stay a program-only view concern (`course-graph.tsx:187`). Acceptable split.

No new abstraction layer, no second graph engine, no persistence.

## Correctness

- **CS 5010 / CS 5011.** 5011 has no outgoing prereqs, so it is not in `aligned`. occupy(5010) during the multi pass stacks 5011 at `y + nodeHeight` unless that cell is already in `used`. Fixture test requires exact `+ PROGRAM_ROW`.
- **Leftover exclusive pair.** Filter snapshot + inner `positions.has` continue (`:308-311`) so placing A as leftover also positions B as partner without a second occupy clobbering `y`.
- **Collision.** `while (used.has(y))` on both primary and partners prevents overlapping cells. Existing full-program unique-cell assert (`tests/graph.test.ts:239-240`) still applies.
- **Neighborhood subgraph.** `layoutProgramFlow` scopes relations to `keep` (`:204-206`). Ranks are topological on that subgraph, so CS 5500’s four-node view is LTR independent of the full program’s column index.
- **Idempotency / races.** Pure layout; no shared mutable store beyond the function-local maps. React memo inputs are consistent after dropping `focusCode`.
- **Latent (not AC-breaking on this snapshot):** partner seating skips occupied rows (TL-1). Coreq min-rank remains a single non-iterating pass (`:208-213`, pre-existing); occupy then refuses different-rank partners (`:298`). Seattle program map coreqs are 1:1 recitation pairs, so this ticket’s required pair is not on a chain.

## Tests

Added coverage is honest:

- Consecutive-row lock for CS 5011 (`tests/graph.test.ts:166`) — previously only “same column, above no-prereq band”.
- Synthetic no-outgoing coreq pair (`:169-183`) — leftover occupy path.
- Neighborhood LTR via `layoutProgramFlow` (`:185-195`) — the function GraphWorkspace now calls with `visible.keys()`.

No mocks, skips, or deleted asserts in this range. The neighborhood test uses default `localeCompare`, not UI `typeOrder` (`course-graph.tsx:184`). Rank-separated x-order does not depend on compare. Not a false-green.

Gap (not high): no component test that `GraphWorkspace` deleted wrap packing. The else-branch is gone in source; the library test would still pass if that UI branch were restored. Wiring is a small, inspectable hoist.

## Operations

Rollback is revert of `17fc4c5..745a3b5`. Client-only positions; no catalog write, flags, or network. Extra work is O(coreq edges) plus partner loops inside an existing O(ranks × group) layout. Compact nodes (`196px`, `app/globals.css:374`) still fit `PROGRAM_COL=208`. Neighborhood previously used 230×148 wrap cells; sharing 208×128 is the point of reuse, not a new overlap risk versus the program map (already compact).

## Security

No new trust boundary. Layout consumes in-memory course codes. No filesystem, URL, or command surface. `selectCourse` remains the existing in-process callback.

## Code health

Easier to evolve: one layout function, one coreq stacking rule. The leftover `if (positions.has(code)) continue` is the necessary partner-placed-mid-loop guard. `layoutProgramFlow` still named for program and still computes bands for callers that ignore them — mild naming/scope stretch, not a bend that will force a rewrite.

`compact` is now a dead branch parameter on `GraphData` (always true). Pre-existing field; not introduced as a new API.

## Findings (round 1)

### TL-1 (low) — consecutive-row seating is best-effort around `used`

`lib/graph.ts:295-303`: after the primary takes `y`, partners start at `y + nodeHeight` and skip any y already in `used`. If an earlier exclusive/multi occupy left a hole (e.g. used `{0, 256}` and the primary lands at `128`), the partner jumps to `384` and another course can sit between the pair. Overlap is still impossible. The Seattle CS 5010/5011 lock (`tests/graph.test.ts:166`) and the empty two-node leftover fixture (`:181-182`) do not hit a contended cell. Other recitation pairs (e.g. CS 5004/CS 5005) are not row-locked.

### TL-2 (low) — non-program views inherit isolate-band y padding with labels stripped

`layoutProgramFlow` always `packBand`s (`lib/graph.ts:317-329`), which reserves `PROGRAM_BAND_LABEL_ROW` before band courses. `GraphWorkspace` omits band nodes unless `depth === "program"` (`components/course-graph.tsx:187-201`). AC2’s CS 5500 neighborhood is a connected four-node subgraph, so classified bands are empty and coordinates are the skill tree. A depth view whose `keep` set contains classified unlinked codes would sit on band rows with a 40px unlabeled gap.

## Areas inspected and found clean

- **Architecture.** Reuse of `layoutProgramFlow` instead of a second packer; `occupy` local to one column; bands remain program chrome.
- **Correctness.** Bidirectional coreq index; same-rank gate; leftover snapshot + continue; unique cells preserved; neighborhood scoped `keep`.
- **Tests.** Strengthened, not loosened; both leftover and aligned (multi) stacking paths covered for the stated ACs.
- **Ops / security.** Pure client layout; revert to roll back; no secrets or injection surface.

## Not done by this review

- No live browser of `/map` (CS 5010/5011 transforms, CS 5500 neighborhood).
- Did not re-run `npm test` / `npm run typecheck` as this seat’s score.
- Did not run `ycm-harness review *`; no harness review JSON written.
- Did not propose a fix implementation.
- No debate round 2 (did not consume the project_manager artifact).
