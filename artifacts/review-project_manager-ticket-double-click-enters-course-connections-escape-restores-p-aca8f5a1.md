# project_manager review — ticket-double-click-enters-course-connections-escape-restores-p-aca8f5a1

Verdict: **PASS** (round 1; no high findings)

Goal: `goal_double-click-course-connections-escape-back_d248` (active). Single ticket; this slice **is** the goal. Reviewer is **not** the implementer. The only file written by this review is this artifact.

Reviewed state: branch `land/local-graph-focus`. Product commit `520fab8` ("Double-click a course to open its connections and restore the previous map with Escape."). HEAD `97d4968` is harness ledger only. Working-tree dirt is `.ycm-harness/state.json` and `events.jsonl` (submit recorded; kernel verify not yet in evidence). Product files match `520fab8`. No `design.md` / `implementation-plan.md` / `prd.md` under the goal directory; acceptance is the ticket text in `.ycm-harness/state.json`.

Harness ticket `status: "in_review"` was **not** treated as proof. Orchestrator live `/map` notes are **claimed**, not independently driven here. Helpers, UI wiring, and unit tests were inspected in `git show 520fab8`. This seat re-ran `npm test` (88 pass / 0 fail) and `npm run typecheck` (exit 0).

## Evidence I inspected

| Check | Result |
| --- | --- |
| `git rev-parse HEAD` | `97d496831db33d68ffb9012af26ba85ffdb45181` (ledger) |
| Product | `520fab89dcb2dc4a8ab9ec7882de9452e2144460` is ancestor of HEAD |
| `git show 520fab8 --stat` | `course-graph.tsx` +71/−10; `lib/graph.ts` +42; `tests/graph.test.ts` +43. **+146 / −10**. No test deleted. |
| Ticket acceptance | four criteria in `state.json` `local_tickets.ticket-double-click-enters-course-connections-escape-restores-p-aca8f5a1` |
| Helpers | `enterCourseConnectionsView`, `popGraphView`, `shouldRestoreGraphViewOnEscape` in `lib/graph.ts` |
| UI | `CourseNode` / table `onDoubleClick`, `viewStack`, `chooseScope`, `locate` stack-clear, inspector restore |
| Tests | `tests/graph.test.ts:685` stack; `:707` Escape restore gates |
| `npm test` (this seat) | 88 pass / 0 fail / 0 skip / 0 todo |
| `npm run typecheck` (this seat) | `tsc --noEmit` exit 0 |
| Live `/map` | **not driven** by this reviewer |

## Per-criterion map

| # | Acceptance criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Double-clicking a course while Entire program (or another scope) is showing enters GraphScope 1 for that course, focuses it, and records the previous depth/focus/zoom | **met** | Node double-click calls `enterConnections` (`components/course-graph.tsx:68`). Table course button does the same (`:579`). `enterCourseConnectionsView` writes `next.depth = "1"` (`COURSE_CONNECTIONS_SCOPE`), `next.focusCode = code`, `next.zoom = GRAPH_READABLE_ZOOM` (1), and returns `previous: current` unless already on that connections view (`lib/graph.ts:712-731`). UI pushes `previous` onto `viewStack` (`course-graph.tsx:377-380`) and applies next depth/focus/zoom plus `selectedCode` and inspector focus (`:384-389`). `mapScene` uses `scope: depth` (`:151`). GraphScope `"1"` is neighborhood distance 1 (`lib/graph.ts:118-119`). Canvas reveals the selected card (`components/graph-canvas.tsx:115-125`). Locked by `tests/graph.test.ts:685-689` (program `CS 5010` @ zoom 0.4 → connections `CS 5500` @ zoom 1, previous snapshot kept). Status copy distinguishes connections vs chain (`course-graph.tsx:535`). |
| 2 | Escape from the graph layout restores the recorded previous view; a second drill-in stacks so Escape returns one level at a time. Escape still clears find text first, then line focus, and does not steal dialogs, selects, or fullscreen | **met** | Capture listener: line-focus clear first, then `shouldRestoreGraphViewOnEscape` + `popGraphView` restoring depth/focus/zoom (`course-graph.tsx:327-345`). Inspector button uses the same pop (`:397-404`, `:619`). Stacking: second `enterCourseConnectionsView` on a different code returns a new `previous`; UI appends (`:380`); `popGraphView` pops the tail (`lib/graph.ts:734-739`). Locked by `tests/graph.test.ts:695-704`. Find-first: window find listener is registered earlier and `type: "clear"` returns (`course-graph.tsx:291-306`); restore reuses `shouldClearLineFocusOnEscape` with the still-stale `searchRef`, which returns false while find text is in scope (`lib/graph.ts:704,742-751`). Line-focus is an explicit earlier branch (`course-graph.tsx:329-333`) and `shouldRestoreGraphViewOnEscape` also bails when `lineFocus` is true (`lib/graph.ts:746`). Dialog / select / fullscreen: restore tests at `tests/graph.test.ts:707-722` (dialog false, Show `select` false, `fullscreen: true` false, findQuery false). Native fullscreen keeps Escape because restore does not `preventDefault` when `isFullscreen` (`course-graph.tsx:334`). |
| 3 | Double-clicking a course already shown as This course's connections does not push a duplicate view. Explicit Show dropdown, locate/search focus, and Show entire program start a new destination and clear the drill-in stack | **met in source** (duplicate also unit-tested) | Same-course connections returns `previous: null` (`lib/graph.ts:725-726`); UI only pushes when `previousView` is set (`course-graph.tsx:380`). Locked by `tests/graph.test.ts:691-693`. Show `<select>` calls `chooseScope` (`:542`) which `setViewStack([])` (`:391-395`). Locate always `setViewStack([])` then `setDepth("course")` (`:351-355`); search hits (`:522`), auto-locate (`:285`), cycle (`:411`), and Focus map here (`:417`) all go through `locate`. Show entire program calls `chooseScope("program")` (`:615`). Helper tests do **not** lock the React stack-clear (`:low-1`). |
| 4 | `npm test` and `npm run typecheck` pass | **met** | This reviewer: `npm test` → 88 pass including the two new tests; `npm run typecheck` → exit 0. Harness kernel verify evidence is **not** recorded yet (submission-only). |

## Goal alignment

Correct slice, not a side-quest. Goal text is double-click → that course's connections, Escape → previous map including Entire program. The ticket adds a snapshot stack plus Escape priority after existing find-clear and line-focus. Cheaper alternatives (overwrite a single "back" slot, or only handle Entire program) were not taken; stacking is in the written AC. Scope stayed in graph helpers, graph workspace, and unit tests. No catalog, plan, or layout rewrite.

## Scope honesty

- No product TODO/FIXME in the diff. No test deleted, skipped, or weakened; two tests **added**.
- Helpers are real (`enterCourseConnectionsView` / `popGraphView` / `shouldRestoreGraphViewOnEscape`), not mocks standing in for UI.
- Extra vs written AC (not unmet): inspector "Return to previous view" (`course-graph.tsx:619`); "Show neighborhood" now goes through `enterConnections` so it also records a restore point and jumps to readable zoom (`:616`); hint copy (`:587`). That matches double-click rather than forking the design.
- `GraphViewSnapshot` records depth/focus/zoom only (`lib/graph.ts:714-718`). Restoring does not reset `selectedCode`. AC1 names those three fields; inspector remaining on the drilled course on the restored map is consistent with "focuses it," not hidden incompleteness.
- Default `/map` depth remains `"course"` (`course-graph.tsx:109`). AC1 says Entire program **or another scope**; chain → connections → Escape back to chain is in-scope.

## Trade-offs (named, not blockers)

- Unit tests lock helpers, not the React `viewStack` mutations. `:low-1`.
- Escape restore is disabled while fullscreen so native Exit wins; a later Escape restores. Matches "does not steal fullscreen."
- Explicit Show dropdown **clears** the stack (AC3) instead of pushing, so Escape will not undo a dropdown change. Double-click / inspector neighborhood remain the restore path.

## Risk surface

- Rapid double-Escape before re-render can see a stale `viewStack` closure (`course-graph.tsx:336,346`) and pop only one level. Normal stacked Escapes after paint still walk one level at a time.
- Locate/search while drilled in wipes the stack by requirement (AC3), including auto-locate.
- Live double-click on React Flow nodes was not driven here; `zoomOnDoubleClick={false}` (`graph-canvas.tsx:140`) and the node `<button>` handler (`course-graph.tsx:68`) are the intended path.

## Findings

None high or medium.

- `low-1` `tests/graph.test.ts:685` vs `components/course-graph.tsx:351,392`: stack-clear on locate / Show dropdown / Show entire program is visible in UI but not asserted. A wiring regression would not fail `npm test`.
- `low-2` Live `/map` (dblclick CS 5500 from chain / Entire program) is orchestrator-claimed; this seat confirmed code + unit tests + `npm test` / typecheck only.

## Debate record

Round 1 independent pass. Did not wait for `tech_lead`.
