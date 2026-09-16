# Project manager review: Exit line-focus, show course details, add line to plan

Ticket: `ticket-exit-line-focus-show-course-details-add-line-to-plan-72333a75`
Commit reviewed: `e88c60f` on `land/local-graph-focus`
Goal: `goal_graph-line-focus-details-and-plan-from-line_705e` — leave a selected graph line and return to the current map, see the clicked course in the inspector, and add that line's catalog courses to a semester.
Round: 1 (independent; did not wait for tech_lead)
This reviewer did not modify product files and did not run a live browser session.

Verdict: **PASS**

ack_zero_findings_reason: Each acceptance line is implemented in e88c60f with file:line wiring for exit, inspect-without-scope-change, and line-to-semester insert; unit tests cover the Escape helper, dimmed z-index, skip/filter, and 32-course cap, and this reviewer did not find an unmet required criterion.

## Criterion map

| Criterion | Status | Evidence and limits |
| --- | --- | --- |
| 1. With a relationship selected, Exit line focus, Escape from graph layout (including inspector), and empty-map click all clear the selection and restore previous map scope and zoom; they do not switch depth to This course's full chain | **Met in code**; live Escape/pane UNVERIFIED by this reviewer | Visible control: `components/course-graph.tsx:540-545` renders the banner and `Exit line focus` only when `selectedRelationship` is set; `clearLineFocus` at line 407 is `setSelectedRelationship(null)` only. Escape: `shouldClearLineFocusOnEscape` at `lib/graph.ts:696-707` requires Escape, active line-focus, not fullscreen, not a dialog, yields to map-find Escape, and otherwise requires `.graph-layout` (inspector and pane sit in that layout). Handler at `components/course-graph.tsx:319-323` only nulls the relationship. Empty map: `components/graph-canvas.tsx:147` `onPaneClick={onClearLineFocus}` wired at `course-graph.tsx:522`. None of these three paths call `setDepth` or `setZoom`. Contrast `locate` at `course-graph.tsx:328-336`, which still does `setDepth("course")` for search/chips. Visibility uses `focusCode` + `depth` (`lib/graph.ts:99-106`, `course-graph.tsx:141-147`), which these exits do not change. Tests: `tests/graph.test.ts:682-693`. Named trade-off: Escape is skipped while fullscreen (`lib/graph.ts:702`; test line 691) so native fullscreen exit can proceed; Exit button and pane click remain available. |
| 2. Clicking a course card updates inspector heading, title, credits, and description even while a line is selected; does not require Full course details; dimmed cards remain clickable | **Met in code**; live dimmed-card clicks UNVERIFIED by this reviewer | Course cards call `inspectCourse`, not `locate` (`course-graph.tsx:63`, `184`, `349-356`): sets `selectedCode`, clears relationship, does not call `setDepth`/`setFocusCode`. Inspector copy is bound to that selection without opening the details dialog: heading `561`, title `562`, credits `563`, description `564`. `Full course details` remains a separate optional action at line 590. Dimmed nodes still render the same button; dim class is opacity only (`app/globals.css:391`); `pointer-events: auto` on `.graph-node-main` at line 393; `graphCourseZIndex` dimmed=5 > `GRAPH_SELECTED_EDGE_Z`=4 (`lib/graph.ts:151-180`; `course-graph.tsx:165`, `251`; `tests/graph.test.ts:676-679`). Clearing the line on inspect is intentional (same handler) so the click does not isolate `This course's full chain`; the inspector fields still update from the click that started under line-focus. |
| 3. With a line selected, Add this line to a semester lists the line's program courses, skips externals and already-recorded codes, and addCourse-equivalent inserts the rest into the chosen term without exceeding 32; npm test and npm run typecheck pass | **Met in code and unit tests**; npm test / typecheck cited from parent, not re-run here | Banner: `course-graph.tsx:546-554` label `Add this line to a semester`, term `<select>`, `Add N courses`, preview of addable codes via `addableLineCourses` at line 403. Skip rules: `lib/plan.ts:23-39` drops recorded, unknown, `requirementType === "external"`, and duplicates. Insert: `appendCoursesToSemester` at `lib/plan.ts:46-69` refuses missing term, empty remainder, and `length + newItems > MAX_COURSES_PER_SEMESTER` (32); `addCourses` at `components/app-provider.tsx:235-249` uses those helpers then `setPlan`. Default `addCourse` also refuses over-32 and skips already-recorded (`app-provider.tsx:211-233`); picker corequisite add is opt-in false (`course-dialogs.tsx:50`), so batch insert matching default addCourse is honest. Tests: `tests/plan.test.ts:191-229`. Parent independently reported `npm test` 86 pass and `npm run typecheck` 0 errors; this tree declares 86 `test(` cases. This reviewer did not re-run those commands and did not repeat the parent's browser add of CS 5010+CS 5500 to Fall 2026. |

## Goal alignment

The change is the goal, not a side-quest. User asks were: (1) leave line-focus, (2) add the selected line to semester planning, (3) course click shows details on the right. Ticket brief matches: return to the current map, inspect the clicked course, add the line's catalog courses without changing map scope. No cheaper substitute would meet all three acceptance lines; an Exit-only patch would miss inspect and plan-from-line.

No `design.md` / `implementation-plan.md` under a goal directory. Implementation matches the ticket acceptance and the stated inspect vs locate split.

## Scope honesty

Diff is eight files: graph UI, canvas pane click, plan helpers, provider batch add, CSS banner/clamp/pointer-events, and two test files. No TODOs, mocks, deleted tests, or unrelated feature work. Description clamp 4→8 (`app/globals.css:415`) supports showing inspector details without the dialog. `MAX_COURSES_PER_SEMESTER` export is used by the new helper, not a silent schema change.

Course click is an extra line-focus exit besides the three AC1 controls; that is named above, not hidden incompleteness. Search hits and inspector chips still `locate` (`course-graph.tsx:277`, `362`, `472`, `578-585`) and still switch depth — pre-existing, out of this ticket's exit list.

## Trade-offs (named, not treated as undone)

- Escape does not clear line-focus during fullscreen or while map-find owns Escape (`lib/graph.ts:702-704`).
- Inspecting a card clears the line banner (`course-graph.tsx:354`). Users who inspect first must reselect the line to add it. Scope and zoom stay put.
- Capacity failure announces "already has 32 planned courses" (`app-provider.tsx:244`) even when the term is under 32 but the batch would overflow; insert still refuses, matching addCourse's all-or-nothing cap.
- Batch add does not auto-include off-line corequisites; that matches the picker's default, not the optional checkbox path.

## Risk surface

Live stacking of dimmed nodes above selected-edge hit paths, pane-click vs node-click, and inspector Escape while a native `<select>` is open were not exercised in a browser by this seat. Parent reported banner, inspect CS 5500/CS 6410, and add CS 5010+CS 5500 to Fall 2026; treat that as parent evidence, not this reviewer's. Unit tests compare z-index numbers and helper predicates; they do not mount React Flow.

Residual: `addCourses` snapshots `plan` then `setPlan(result.plan)` rather than a functional update (`app-provider.tsx:240-248`). A single UI click is the intended path; this is not an unmet criterion.

## Debate record

Round 1 independent pass. No high findings. Ready to read `artifacts/review-tech_lead-line-focus-details-plan.md` (or the tech_lead artifact for this ticket) on later rounds.
