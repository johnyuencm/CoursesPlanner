# project_manager review — ticket-lay-out-the-program-map-as-a-prerequisite-flow-bd746304

Verdict: **PASS** (round 1; no high findings)

Goal: Complete MSCS Seattle prerequisite graph (still **active**). This ticket is the
left-to-right flow + inspector-chip pan slice. First ticket
(`ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f`) is already
done. Reviewer is **not** the implementer. The only file written by this review
is this artifact. Do **not** complete
`goal_complete-mscs-seattle-prerequisite-graph_5f65` from this pass.

Reviewed state: branch `fix/complete-prereq-graph` @ `4ed94c1` (`git merge-base`
of `3c0c56e..4ed94c1` = two product commits: `9deaf66` layout, `4ed94c1` pan).
Working tree product files match HEAD; only `.ycm-harness/state.json` and
`events.jsonl` are dirty. User-scoped deferrals for this slice: MiniMap clip,
completed-color-only, dangling chips, explorer keyword spill.

Harness status was **not** treated as proof of product done. Ticket is already
`status: "done"` with `"code_changed": false` despite a 4-file product diff.
`next --json` already points at `goal verify` / complete. That is ledger
overclaim, not a met AC. Verify evidence `evidence-eb328f2d` exists and PASSed
`npm test && npm run typecheck` with distinct `flow-impl-r1` / `flow-ver-r1`.

## Evidence I inspected

| Check | Result |
| --- | --- |
| `git rev-parse HEAD` | `4ed94c1c2f39034a0935b6b701f7315cfcc192e8` |
| `git diff --stat 3c0c56e..4ed94c1` | `course-card.tsx` 4; `course-graph.tsx` 29; `lib/graph.ts` 64+; `tests/graph.test.ts` 19+. **+103 / −13**. No test deleted. |
| `evidence-eb328f2d` | exit 0; **40 pass / 0 fail / 0 skip / 0 todo**; includes `program flow puts prerequisites to the left…`; `tsc --noEmit` clean |
| Independent `npm test` / `typecheck` already recorded on this HEAD | 40/40 exit 0; typecheck exit 0 (terminals `137157`, `137158`) |
| Published `programFlowPositions` + UI `typeOrder` | CS 5004 `{x:164,y:384}` left of CS 5500 `{x:656,y:128}` left of CS 6510 `{x:1148,y:64}`; CS 5010 `{x:0,y:0}`; CS 5800 and CS 5100 present and **linked**; CS 5150 isolate `{x:0,y:720}`; isolateMinY 720 > flowMaxY 576; unique cells; CS 5500 neighborhood exactly 4 codes |
| Fixture `programFlowPositions` (test comparator) | CS 5004/5010 x=0; CS 5500 x=492; CS 6510 x=820; **0** prereq LTR violations; 62 isolates (fixture) / 53 (published catalog) |
| `TODO`/`FIXME`/`HACK` in `lib/` `components/` | none |
| Live `/map` chip pan | **not done** — browser MCP tabs evaporated before navigation (`viewId` invalid on the next call) |

## Per-criterion map

| # | Acceptance criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Default entire-program map: CS 5004 and CS 5010 left of CS 5500; CS 5500 left of CS 6510 | **met** | Default `depth === "program"` (`components/course-graph.tsx:85,105-109`) now lays `programFlowPositions` (`lib/graph.ts:125-181`) instead of the old alpha grid. Ranks are prereq-only, then coreqs share a column (`:136-142`). Locked by `tests/graph.test.ts:64-74`. Published UI comparator (`typeOrder` then numeric code, `course-graph.tsx:106`) still has 5004.x=164 < 5500.x=656 < 6510.x=1148 and 5010.x=0. See **PM-1**. |
| 2 | No-arrow courses packed below; CS 5800 and CS 5100 still present | **met** | Isolates = program-map codes with no **scoped** edge (`lib/graph.ts:143-179`); `isolateStartY = flowBottom + 80`. Test proxy CS 5150 (`unlocks: []`, `prerequisiteCodes: []` in `data/catalog.json:782-796`) y=720 > CS 5500. CS 5800 / CS 5100 remain on the map (`tests/graph.test.ts:75-76`) but they **are** linked (unlock on-map courses). See **PM-2**. |
| 3 | Inspector prereq/unlock chips: pan if on this view, else open that course's neighborhood | **met in source** | Inspector chips pass `onSelect={focus}` (`course-graph.tsx:240,242`). `CodeLinks` calls `onSelect ?? openCourse` (`course-card.tsx:9-11`). `focus` selects the code; `visible.has` → `panTo` / else `setDepth("1")` (`course-graph.tsx:147-156`). `panTo` uses `getNode` then laid positions so `onlyRenderVisibleElements` does not drop the jump (`:139-146`). Off-map example: CS 5004 chips CS 5001/CS 5002 are not in `programMapCodes`. No automated or live click proof — **PM-3**. |
| 4 | Immediate neighborhood of CS 5500 stays four courses; tests/typecheck pass | **met** | Unchanged `neighborhoodDistances("CS 5500", …, 1)` = `CS 5004, CS 5010, CS 5500, CS 6510` (`tests/graph.test.ts:45-54`). Show control still lists Immediate neighborhood (`course-graph.tsx:174-180`). `evidence-eb328f2d` and the independent 40/40 + `tsc` run on this HEAD both pass. |

## Goal alignment

Correct next slice, not a side-quest. Ticket 1 put every official listed course
(plus direct externals) on `/map`. This ticket makes that set **readable as a
prerequisite flow** and makes inspector chips jump the camera instead of opening
a dialog. That is the remaining user-facing job for a "complete graph": you can
follow a chain left-to-right. Cheaper alternatives (copy-only "use Fit to view",
keep the alpha grid) were not taken. Scope stayed inside layout + chip routing.
No new dependency, catalog snapshot, or parser change.

## Scope honesty

- No test deleted, skipped, or weakened. One test **added** (`tests/graph.test.ts:64-80`). That test does **not** cover chip pan (**PM-3**) and does not lock the UI `typeOrder` comparator (**PM-1**).
- No mock standing in for layout. No TODO in the product diff.
- Commits match the diff: `9deaf66` is `programFlowPositions`; `4ed94c1` is inspector `onSelect={focus}` + `panTo` + onInit center + hint copy.
- Table-view chips still open the dialog (`course-graph.tsx:221-222`). Written AC is **map inspector**, so this is extra, not an unmet AC (**PM-4**).
- Harness `"code_changed": false` + `status: "done"` with **no** `ticket.done` event and **no** checkpoint on this ticket (**PM-5**). Product is not silently incomplete; the ledger is.

## Trade-offs and named deferrals

This slice (user-asked):

1. Rank wrap at 10 rows (`PROGRAM_WRAP_ROWS`, `lib/graph.ts:110,166`) so a fat rank grows extra columns instead of one tall stack. Prereq ranks still strictly increase `columnX`, so sources stay left of targets (0 LTR violations on fixture prereq edges).
2. True isolates pack **below** the connected flow (`PROGRAM_ISOLATE_GAP = 80`). CS 5800 / CS 5100 are **not** in that band; they sit in rank 0 because they unlock on-map courses.
3. Off-map chips remount React Flow at neighborhood + `fitView` rather than panning a missing node (`course-graph.tsx:152-154,185,189`).
4. Default camera still centers the selected course (now `onInit` `centerNode(selectedCode)`, default `CS 5010` at `{x:0,y:0}`), not the whole 114-node canvas. Hint copy discloses chips / minimap / Fit to view (`:191-194,227`).

Explicitly **out of this ticket** (user + prior panel; still open):

5. MiniMap clip (`.graph-panel` / `.react-flow__minimap` overflow, `app/globals.css:357,364`).
6. Completed-color-only (`nodeClassFor` returns `graph-completed` before kind, `course-graph.tsx:63-68`).
7. Dangling inspector chips / two closure rules (CS 5004 still chips CS 5001/CS 5002; `programMapCodes` is direct, snapshot closure is transitive). AC 3 now **routes** those chips to neighborhood; it does not add the missing nodes.
8. Explorer keyword spill (`app/courses/page.tsx` — untouched this diff).
9. First-paint subset / `onlyRenderVisibleElements` / off-canvas tab (prior **PM-6** / **PM-13**). Unchanged on purpose.
10. Duplicate OR text on CS 5004 (`data/catalog.json:585-593`). Upstream.
11. Do **not** complete the parent goal: ticket 2 review is this file; goal evidence for "complete graph" is more than this slice.

## Risk surface

- **Chip-pan regression with tests green (medium process).** `onSelect={focus}` can revert to `openCourse` and `npm test` stays green (**PM-3**).
- **Rank wrap vs intuition (low).** A rank-0 external such as CS 5004 can sit in a later wrap column (published x=164) and still be left of CS 5500. Not an AC miss.
- **Premature goal complete (process).** `ycm-harness next` already wants `goal verify`. Following that now would close the goal before this panel finishes and before named leftovers are either tickets or accepted deferrals.
- **MiniMap / completed-color / dangling chips (low for this ticket).** User deferred; still user-visible if someone treats this ticket as "the map is finished".

## User impact

Visible value, not plumbing: the default map is a left-to-right chain with isolates underneath, and inspector code chips jump (or open a local neighborhood) instead of only opening a dialog. Cost: the first camera is still a readable patch around CS 5010, not a full-program glance; Fit to view / minimap remain the overview.

## Findings

### PM-1 (medium) — layout test uses the default comparator; the UI does not

`tests/graph.test.ts:67` calls `programFlowPositions(codes, relations)` (localeCompare). The default map sorts cores/breadth/electives/externals first (`course-graph.tsx:71-77,106`). Published positions therefore differ (CS 5004 x=164 vs fixture x=0) but the three AC inequalities still hold. Not high: the written coordinates are true on the UI path. A comparator swap that broke LTR for externals could still be green if the fixture alpha order happened to pass.

### PM-2 (low) — CS 5800 / CS 5100 are present **in the flow**, not in the isolate band

Catalog `unlocks` put them on scoped edges (`CS 5800` → CS 5350/6140/…; `CS 5100` → CS 6180/7170/DADS 7305). The AC requires presence plus "no-arrow courses packed below". Both are true. Named so "no parsed prerequisites" from ticket 1 is not misread as "no arrows" for these two cores.

### PM-3 (medium) — AC 3 is wired, not locked by a test, and was not clicked live

No test imports `focus` / `CodeLinks` / `setDepth`. Reverting `course-graph.tsx:240,242` to dialog-only would miss AC 3 with `evidence-eb328f2d`-class gates still green. Browser automation in this review could not keep a tab. Source path is unambiguous (`course-card.tsx:11`, `course-graph.tsx:139-156`). Not high: not a contradiction of the submitted code.

### PM-4 (low) — relationship-table chips still open the course dialog

`course-graph.tsx:221-222` uses `CodeLinks` without `onSelect`. Inspector is the written surface. Search results already call `focus` (`:162`).

### PM-5 (medium, process) — harness "done" is ahead of independent review

`state.json` ticket `status: "done"`, `"code_changed": false` (`:54-55`), `active_ticket_id` still this ticket, `next` = complete the goal. Events: created / started / submitted only — **no** `ticket.done` for `bd746304`. No checkpoint names this slice's deferrals. Product commits and verify PASS exist. This is hidden **process** incompleteness, not a missing layout. High is reserved for goal misalignment or a fake product done-state; the four ACs are present in code and (for 1, 2, 4) tests.

## Design alignment

Change stays inside the existing React Flow map, `visibleGraphDistances` membership, and neighborhood `Show` options. `programGridDimensions` remains for isolate packing only. Neighborhood layout (distance columns, wrap 4) is untouched — CS 5500's local four-course set is unchanged. No parallel graph, no MiniMap rewrite, no catalog edit.

## Not done by this review

- No live `/map` click of an inspector chip, no screenshot of CS 5500 to the right of CS 5010, no neighborhood remount of CS 5001.
- Did not re-fetch the official catalog; layout fidelity is `data/catalog.json` + cached HTML fixtures.
- Did not run `ycm-harness review *`; no harness review JSON written.
- Did not complete or verify the parent goal.
- Did not create follow-up tickets for the named deferrals (MiniMap, completed-color, dangling chips, explorer spill).
