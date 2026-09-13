# Spec review — ticket-lay-out-the-program-map-as-a-prerequisite-flow-bd746304

- **Reviewer role:** spec_reviewer (independent; not the implementer)
- **Repo:** `C:\Users\user\Desktop\github\CoursesPlanner`
- **Reviewed state:** `fix/complete-prereq-graph` @ `4ed94c1c2f39034a0935b6b701f7315cfcc192e8`
- **Ticket status when reviewed:** `done`, `code_changed: false` (stale vs the two layout/pan commits)
- **Verdict:** **PASS** (4/4 acceptance criteria met; no high findings)
- **Product files modified by me:** none. Only this artifact was written.

No `design.md` / `implementation-plan.md` / `prd.md` exists under the goal directory. Alignment is judged against `.ycm-harness/state.json` ticket brief plus the four acceptance criteria.

Implementer commits in scope: `9deaf66` (left-to-right `programFlowPositions`) and `4ed94c1` (inspector chips call `focus` / `panTo` instead of `openCourse`).

## Execution evidence I ran myself

| Command / probe | Result |
| --- | --- |
| `git rev-parse HEAD` | `4ed94c1c2f39034a0935b6b701f7315cfcc192e8` on `fix/complete-prereq-graph` |
| `npm test` | `tests 40 / pass 40 / fail 0 / todo 0`, ~1.88 s. Includes `program flow puts prerequisites to the left of the courses they unlock` (`tests/graph.test.ts:64-80`) and the CS 5500 four-course neighborhood case (`:45-55`). |
| `npm run typecheck` (`tsc --noEmit`) | Exit 0, no diagnostics. |
| Published catalog `readCatalog()` → `programFlowPositions(programMapCodes, catalogRelations, typeOrder)` (same compare as `components/course-graph.tsx:106-107`) | 114 nodes. `CS 5004` `{x:164,y:384}`, `CS 5010` `{x:0,y:0}`, `CS 5500` `{x:656,y:128}`, `CS 6510` `{x:1148,y:64}`. `164<656`, `0<656`, `656<1148`. Unique cells: true. |
| Isolate vs connected (same published snapshot) | `CS 5800` and `CS 5100` present and **linked** (outgoing unlock edges). `CS 5150` isolate (`unlocks: []`, `prerequisiteCodes: []`) at `{x:0,y:720}`. `flowBottom=640`, `isolateMinY=720`, `isolateGap=80` → isolates sit on/below the isolate band. 53 isolates. |
| `neighborhoodDistances("CS 5500", relations, 1)` on published snapshot | `["CS 5004", "CS 5010", "CS 5500", "CS 6510"]` — local four-course set. |
| `TODO\|FIXME\|XXX` in `lib/graph.ts`, `components/course-graph.tsx`, `components/course-card.tsx`, `tests/graph.test.ts` | No matches. |
| Test deletions `git log --diff-filter=D 9deaf66^..4ed94c1 -- tests` | Empty (no deleted test files). `tests/graph.test.ts` +19 lines only. |
| Live `/map` chip click | **Not executed.** `next dev` is listening on `http://localhost:3000`, but browser tools failed (`No browser tab available` / `Browser view not found`) and I did not click the running app. Criterion 3 is judged from click-handler wiring only. |

## Per-criterion map

| # | Acceptance criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | On the default entire-program map, CS 5004 and CS 5010 sit to the left of CS 5500, and CS 5500 sits to the left of CS 6510 | **met** | Default depth is `"program"` (`components/course-graph.tsx:85`). Program nodes are placed by `programFlowPositions` (`:105-108`), which columns by `topologicalRanks` then advances `columnX` after each rank (`lib/graph.ts:125-171`). Prerequisites therefore occupy strictly smaller `x` than the courses they unlock, independent of within-rank wrap. Published UI-compare probe: `CS 5004.x=164`, `CS 5010.x=0` left of `CS 5500.x=656` left of `CS 6510.x=1148`. Guarded by `tests/graph.test.ts:72-74`, passing in the run above. |
| 2 | Courses with no parsed arrows remain on the map packed below the connected flow; CS 5800 and CS 5100 are still present | **met** | Unlinked codes go to `isolates` and are packed at `flowBottom + PROGRAM_ISOLATE_GAP` (`lib/graph.ts:143-180`). `CS 5150` has no scoped edges (`data/catalog.json:787-796` `prerequisiteCodes: []`, `unlocks: []`) and sits at `y=720` below `CS 5500` (`y=128`) / `flowBottom=640`. `CS 5800` / `CS 5100` have empty prereqs but **outgoing unlocks** (`data/catalog.json:1338-1345`, `:765-768`), so they are in the connected flow (`linked: true`, positions `{x:0,y:128}` and `{x:0,y:192}`), not the isolate band — allowed by the ticket note. Both remain in the position map; `tests/graph.test.ts:75-77` asserts presence plus `y(CS 5150) > y(CS 5500)`. |
| 3 | Clicking a prerequisite or unlock chip in the map inspector selects that course and pans to it when it is on the current view; a chip for a course not on this view opens that course neighborhood | **met** | Inspector chips pass `onSelect={focus}` (`components/course-graph.tsx:240`, `:242`). `CodeLinks` calls `(onSelect ?? openCourse)` (`components/course-card.tsx:9-11`), so inspector clicks no longer only open the dialog. `focus` (`:147-156`) always `setSelectedCode(code)`; if `visible.has(code)` it `panTo` (`:139-146` → `centerNode` / `setCenter` at `:22-32`); if not on this view it `setDepth("1")` (Immediate neighborhood) and `setFocusCode(code)`. React Flow remounts non-program views via `key={\`${focusCode}-${depth}\`}` (`:185`) with `fitView={depth !== "program"}` (`:189`). **Live pan/neighborhood switch was not clicked.** |
| 4 | Immediate neighborhood of CS 5500 stays the local four-course set; npm test and npm run typecheck pass | **met** | Show control still offers `<option value="1">Immediate neighborhood</option>` (`:177`). Non-program scope uses `neighborhoodDistances` (`lib/graph.ts:104-105`). Published snapshot and fixture test both yield exactly `CS 5004`, `CS 5010`, `CS 5500`, `CS 6510` (`tests/graph.test.ts:51`; probe above). `CS 5800` is excluded from that neighborhood (`:54`). `npm test` 40/40; `tsc --noEmit` exit 0. |

## Design alignment

No separate design doc. The change matches the ticket brief: default map is a left-to-right prerequisite flow (`programFlowPositions` on `"program"`), isolates pack below, neighborhood zoom is unchanged, inspector chips select/pan or open neighborhood instead of only opening a dialog.

## Honest done-state

- No TODOs in the ticket's key files.
- No mocked layout: tests parse cached official HTML; the published catalog probe repeats the same left-of / isolate / neighborhood facts.
- No tests deleted or weakened; one new assertion block was added.
- Harness `code_changed: false` while status is `done` is stale relative to `9deaf66` / `4ed94c1`. Product behavior still matches the written criteria.

## Scope

**Required work is present.** Extra / adjacent:

- Table-view `CodeLinks` (`components/course-graph.tsx:221-222`) still omit `onSelect` and therefore open the course dialog. The written criterion names the **map inspector**, not the table.
- Search results already called `focus` (`:162`); that predates / sits beside this ticket and is not gold-plating of the layout.

## Findings

### medium

1. **On-view inspector chips on a neighborhood (or 2-hop / full) view also retarget `focusCode`, which remounts the graph.** `focus` always `setFocusCode(code)` (`components/course-graph.tsx:147-149`) before the on-map `panTo` branch (`:154-155`). Non-program React Flow `key` is `` `${focusCode}-${depth}` `` (`:185`), so clicking a chip that **is** already on CS 5500's immediate neighborhood (e.g. CS 5004) remounts to that course's neighborhood instead of only selecting and panning on the current four-node view. The default entire-program map is unaffected (`key` is `"program"` at `:185`). Off-view chips still open Immediate neighborhood (`:152-153`), which is what AC3 asks for that branch.

### low

2. **Flow unit test does not use the UI `typeOrder` compare.** `tests/graph.test.ts:67` calls `programFlowPositions` with default `localeCompare`. The live map passes `typeOrder` (`components/course-graph.tsx:106-107`), which moves `CS 5004` (external) to `{x:164,y:384}` vs `{x:0,y:128}` under default sort. Rank still keeps it left of `CS 5500`; AC1 is not broken. The automated lock is slightly weaker than the painted layout.

3. **Harness ticket metadata says `code_changed: false` on a code-changing ticket.** `.ycm-harness/state.json` local ticket `ticket-lay-out-the-program-map-as-a-prerequisite-flow-bd746304`. Does not change product AC.

## Limits of this review

I recomputed default-map positions and the CS 5500 neighborhood from the published catalog the app serves (`lib/catalog.ts:220-231`) and read inspector chip handlers. I did **not** pan the live React Flow viewport or click chips in a browser in this pass. Do not treat this artifact as live-camera proof.

No numeric score assigned. No `ycm-harness review *` command run. No harness review JSON written.
