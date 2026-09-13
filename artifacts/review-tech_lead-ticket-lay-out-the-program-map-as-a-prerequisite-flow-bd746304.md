# tech_lead review — ticket-lay-out-the-program-map-as-a-prerequisite-flow-bd746304

Verdict: **PASS** (round 1; no high findings)

Goal: default entire-program map as a left-to-right prerequisite flow; inspector code chips select+pan (or open a neighborhood) instead of only opening a dialog.
Reviewed state: branch `fix/complete-prereq-graph` @ `4ed94c1` (`9deaf66` layout + `4ed94c1` inspector pan).
Product diff: `git diff 9deaf66^..4ed94c1` = `lib/graph.ts`, `tests/graph.test.ts`, `components/course-graph.tsx`, `components/course-card.tsx` (`+103 / −13`).
Reviewer is not the implementer. No product file was modified by this review; the only file written is this artifact.

## Evidence I ran myself

| Command / check | Result |
| --- | --- |
| `git rev-parse HEAD` | `4ed94c1c2f39034a0935b6b701f7315cfcc192e8` |
| `npm test` on `4ed94c1` | **40 pass / 0 fail / 0 skipped / 0 todo** (1668 ms) |
| `npm run typecheck` (`tsc --noEmit`) | clean, exit 0 |
| `git diff 9deaf66^..4ed94c1 -- tests/` | **+19 only** (new flow test; no deletions, skips, or loosened asserts) |
| `programFlowPositions` on published `data/catalog.json` (UI `typeOrder` compare) | **114 nodes**; **61 connected / 53 isolates**; prereq `source.x >= target.x` inversions: **0** |
| AC1 x-order (catalog.json, UI compare) | `CS 5004` x=164, `CS 5010` x=0, `CS 5500` x=656, `CS 6510` x=1148 |
| Watch: coreq column | `CS 5010` and `CS 5011` share x=0 (y=0 and y=64) |
| Watch: CS 5800 / CS 5100 band | both `linked=true`, y=128 / y=192, **below isolateStart 720 is false** |
| Watch: isolate band | `CS 5150` linked=false, y=720 === isolateStart |
| `neighborhoodDistances("CS 5500", …, 1)` | exactly `["CS 5004","CS 5010","CS 5500","CS 6510"]` |
| Fixture rebuild (`seattleGraph()`, same as tests) | 107 nodes / 45 connected / 62 isolates; same AC1 inequalities; 0 inversions; same 4-course neighborhood |
| Scoped coreq edges on program map | only `CS 5011 → CS 5010` |

Harness `evidence-eb328f2d` also recorded 40/40 + clean `tsc`. I re-ran both commands on this HEAD.

I did **not** live-render `/map`. Chip pan is store/layout reasoning, not a click session.

## Acceptance criteria

1. **met.** Default scope remains `program` (`components/course-graph.tsx:85`) and now lays out with `programFlowPositions` (`:105-109`) instead of `programGridDimensions`. Ranks are prereq-only, then coreq min-rank (`lib/graph.ts:136-142`). On published catalog with the UI comparator, `CS 5004` and `CS 5010` are strictly left of `CS 5500`, and `CS 5500` is strictly left of `CS 6510`. Locked for the fixture graph at `tests/graph.test.ts:71-74`.
2. **met.** Unlinked codes pack at `flowBottom + PROGRAM_ISOLATE_GAP` (`lib/graph.ts:150-153, 173-179`). `CS 5150` sits on that band (y=720). `CS 5800` and `CS 5100` remain in `programMapCodes` and in `positions` (`tests/graph.test.ts:75-76`). They are **not** isolates: both have in-scope outgoing prereq edges (e.g. `CS 5800→CS 6140`, `CS 5100→CS 6180`), so they belong in the connected flow (`lib/graph.ts:143-147`). That matches the watch, not an AC miss.
3. **met in code, untested.** Inspector prereq/unlock chips pass `onSelect={focus}` (`components/course-graph.tsx:240,242`). `focus` selects, then `panTo` when `visible.has(code)` (`:147-156, 139-146`); otherwise `setDepth("1")` remounts the neighborhood (`key` at `:185`, `fitView={depth !== "program"}` at `:189`). Explorer `CourseCard` (`components/course-card.tsx:43-44`), dialog (`components/course-dialogs.tsx:34-35`), and the map table (`components/course-graph.tsx:221-222`) omit `onSelect`, so `CodeLinks` still defaults to `openCourse` (`components/course-card.tsx:9-11`).
4. **met.** Neighborhood packing is the unchanged `else` branch (`components/course-graph.tsx:110-126`). Membership still the local four-course set (`tests/graph.test.ts:45-54`). Gates: 40/40 and clean `tsc`.

## Watch items

- **Prereq-only ranks then coreq min-rank.** `topologicalRanks` runs on `!edge.corequisite` (`lib/graph.ts:136`); coreq pairs then share `Math.min` (`:137-142`). On this snapshot that is one pair, both already rank 0, same column.
- **CS 5800 outgoing edges.** `linked` is any scoped endpoint, not “has incoming prereqs”. CS 5800/CS 5100 stay in the flow; CS 5150 is the isolate used by the new test (`tests/graph.test.ts:77`).
- **`onlyRenderVisibleElements` pan fallback.** Renderer culls via `getNodesInside` (`node_modules/@xyflow/react/dist/esm/index.js:2129-2132`); `nodeLookup` still holds every node, so `getNode` should succeed off-canvas. `panTo` still falls back to laid `graph.nodes` positions when `getNode` is missing (`components/course-graph.tsx:139-146`). `onInit` now `centerNode`s `selectedCode` (`:192-195`) instead of pinning origin.
- **Neighborhood layout unchanged.** `programFlowPositions` is gated on `depth === "program"` (`:105-109`).

## Findings (round 1)

### TL-1 (medium) — inspector pan / neighborhood-open is an unguarded UI contract

`4ed94c1` is the AC-3 behavior: `onSelect={focus}`, `panTo`, culled-node fallback, `setDepth("1")` for off-view chips. `tests/graph.test.ts` gained only coordinate asserts. Reverting `:240,242` to bare `CodeLinks`, or deleting `panTo`’s `graph.nodes` fallback, would restore “chip opens a dialog only” / silent no-op-on-cull with every test still green. Not a skip/delete/loosen false-green; it is an untested acceptance surface.

### TL-2 (medium) — flow test does not lock the watch invariants it was written beside

`tests/graph.test.ts:64-80` calls `programFlowPositions` with the **default** `localeCompare`, not the UI `typeOrder` comparator (`components/course-graph.tsx:106-107`). Rank-separated AC-1 x-order still holds under both comparators (recomputed), but the test does not assert `CS 5010.x === CS 5011.x`, nor that `CS 5800`/`CS 5100` sit above `isolateStart`. `y("CS 5150") > y("CS 5500")` (`:77`) is true for the real isolate band (720 vs 128) and would also be true if `CS 5150` were connected in a lower wrap row. Presence of `CS 5800`/`CS 5100` (`:75-76`) would still pass if they were packed as isolates.

### TL-3 (low) — coreq min-rank is a single non-iterating pass

`lib/graph.ts:137-142` equalizes each coreq pair once and does not recompute longest-path ranks afterward. A later catalog with chained coreqs, or a coreq whose partner has a much lower prereq rank, can place a course left of its own remaining prereq column. Current program map has one coreq edge and **0** prereq x-inversions, so this is latent.

### TL-4 (low) — `programGridDimensions(114)` no longer describes the default map

`tests/graph.test.ts:57-62` still packs a 114-cell **grid**. The default map no longer uses that function for the 114-node field; `programFlowPositions` uses it only for the isolate band (`lib/graph.ts:174`). The test remains true of a helper that is no longer the program layout.

## Areas inspected and found clean

- **Architecture.** Layout is a pure function in `lib/graph.ts` with an injected `compare`; React keeps requirement-type banding. `CodeLinks` gained an optional `onSelect` without changing the default. Neighborhood algorithm is not folded into the program flow, so depth-1 locality stays a separate packing. `PROGRAM_COL` / `PROGRAM_ROW` moved to the library so pan fallbacks share the compact node box (`components/course-graph.tsx:30-31, 145`).
- **Correctness / data integrity.** Independent rank-and-position recompute on `data/catalog.json` and on the test fixture: AC-1 inequalities hold; no prereq x-inversions; unique cells; isolates start at y=720; CS 1800 absent; CS 5500 neighborhood is the four-course set. `keep` membership is unchanged (`programMapCodes`). `linked` uses scoped endpoints, so a no-incoming core with in-scope unlocks is not dropped into the isolate band.
- **Tests.** New test added; none skipped, todo’d, mocked away, or deleted. Gaps are TL-1 / TL-2, not a red-to-green cheat.
- **Operations.** Client-only positions; no catalog write, network, or persistence change. Rollback is revert of `9deaf66` + `4ed94c1`. `onlyRenderVisibleElements` (`components/course-graph.tsx:203`) still culls the 114-node field; pan talks to the store / laid coordinates rather than the culled DOM.
- **Security.** No new URL, filesystem, or credential surface. `onSelect` is an in-process callback. `type="button"` on chips (`components/course-card.tsx:11`) avoids accidental implicit submit. `document.getElementById("graph-inspector")` is the pre-existing hardcoded id.
- **Code health.** Flow vs neighborhood packing is duplicated by design (watch: neighborhood unchanged). Isolate packing reuses `programGridDimensions`. Default `CodeLinks` callers were left alone.

## Not done by this review

- No live browser of `/map` (first-paint camera, chip click, culled `getNode`).
- No live catalog fetch; fidelity is committed `data/catalog.json` plus the HTML fixtures the graph tests already rebuild.
- Did not run `ycm-harness review *`; no harness review JSON written.
- Did not propose a fix implementation.
