# tech_lead review — ticket-exit-line-focus-show-course-details-add-line-to-plan-72333a75

**Seat:** tech_lead (independent; not the implementer)
**Commit:** `e88c60f` Let users leave graph line-focus, inspect a course, and add that line to a semester.
**Range:** `361683a..e88c60f`
**Verdict:** PASS (no high / blocker findings)
**Debate:** round 1, independent first pass. Did not wait for `project_manager`. Did not run `ycm-harness review`. Did not write harness review JSON. Did not modify product files.

## What was inspected

Diff of the eight files in `e88c60f` plus current `components/course-graph.tsx`, `components/graph-canvas.tsx`, `components/app-provider.tsx`, `lib/graph.ts` (`shouldClearLineFocusOnEscape`, z-index helpers), `lib/plan.ts` (line-add helpers), `tests/graph.test.ts`, `tests/plan.test.ts`, `app/globals.css`. Cross-checked `@xyflow/react` 12.11.6 `zIndexMode: 'basic'` (`calculateZ` / `getElevatedEdgeZIndex`) so node/edge `zIndex` values actually interleave. Parent browser notes were not treated as this review.

## Architecture

The split is the right shape: `locate` still owns map-scope changes (`setFocusCode` + `setDepth("course")`); new `inspectCourse` updates inspector selection without rewriting the visible neighborhood; line-focus remains a single `selectedRelationship` flag; stacking and Escape policy live in `lib/graph.ts`; plan writes live in `lib/plan.ts` with a thin `addCourses` glue path.

`@xyflow/react` 12.11.6 default `zIndexMode` is `'basic'`, which uses `node.zIndex` / `edge.zIndex` as the stacking numbers. Putting dimmed cards at `GRAPH_NODE_Z.dimmed` (5) above `GRAPH_SELECTED_EDGE_Z` (4) is therefore a real hit-target fix, not a dead constant. Custom edge hit-strokes already `stopPropagation`, so `onPaneClick` is a reasonable empty-map exit.

`addCourses` is a second semester-write path beside `addCourse` (`app-provider.tsx:211` vs `:235`). Capacity, recorded-code skipping, and immutability now exist twice. That will drift (it already does on copy and on `setPlan` style). Not a blocker for this ticket.

## Correctness

**Line-focus exit (AC1).** Visible `Exit line focus` (`components/course-graph.tsx:545`) and `clearLineFocus` only call `setSelectedRelationship(null)`. Escape uses `.graph-layout`, so the inspector sibling of `.graph-panel` is in scope (`lib/graph.ts:707`; `components/course-graph.tsx:319-327`). Empty-map click is `onPaneClick={onClearLineFocus}` (`components/graph-canvas.tsx:147`). None of those paths call `setDepth` or `setZoom`. Find Escape still wins when `shouldClearGraphFindOnEscape` is true; dialogs and fullscreen are skipped so the Fullscreen API can keep Escape. Card clicks go through `inspectRef` → `inspectCourse`, not `locate`, so they do not force “This course’s full chain”.

**Inspector during line-focus (AC2).** `inspectCourse` (`components/course-graph.tsx:349-356`) sets `selectedCode` and clears the relationship. Heading, title, credits, and description read `selectedCode` (`:561-564`) without `openCourse`. Dimmed cards: `graphCourseZIndex({ focused: false, emphasized: false }) === 5 > 4`, plus `.graph-node-main { pointer-events: auto }`. Clicking a card also exits line-focus; that matches “inspect without first using Exit”, not “keep the banner up”.

**Add line to a semester (AC3).** `addableLineCourses` skips recorded codes, unknown codes, and `requirementType === "external"`, de-dupes, and keeps catalog credits (`lib/plan.ts:23-39`). `appendCoursesToSemester` re-filters recorded codes, refuses missing terms / empty inserts / `length + n > 32`, and returns a new plan without mutating the input (`:46-69`). UI preview uses the same helper (`components/course-graph.tsx:403,552`). Button is disabled until `hydrated`, so a line cannot be written onto the pre-hydrate `emptyPlan()` and then get clobbered by `loadPlan`. All-or-nothing capacity matches existing `addCourse`.

### Findings

**medium — `inspectCourse` records history that Back/Forward replay through `locate`, which forces depth `"course"`.**
`inspectCourse` pushes `navigation` when the inspected code changes (`components/course-graph.tsx:350-351`) but does not change `depth` or `focusCode`. Back/Forward still call `locate(...)` (`:482-483`), and `locate` always `setDepth("course")` (`:335`). On Entire program / neighborhood / prerequisites, inspect keeps the current map (AC1/AC2), then Back collapses it to “This course’s full chain”. Same `locate` mechanism the ticket removed from card clicks. Recoverable via the Show control; not data loss.

**medium — Escape on the new semester `<select>` dismisses line-focus.**
`shouldClearLineFocusOnEscape` returns true for any `.graph-layout` descendant that is not a dialog and not a find-clear (`lib/graph.ts:696-707`). Find already opts `select`/`input`/`textarea` out of find-clear (`:681`). The new `#line-focus-semester` control (`components/course-graph.tsx:549`) does not get that exception. Capture-phase `preventDefault` (`:322`) can steal native “close the dropdown” Escape and drop the add-line banner.

**low — `addCourses` replaces the plan from a render snapshot.**
`addCourses` computes `appendCoursesToSemester(plan, ...)` then `setPlan(result.plan)` (`components/app-provider.tsx:240-248`). `addCourse` appends with a functional updater (`:232`). A second in-flight plan write can be overwritten. Unlikely for a single click; worse than the sibling path.

**low — Table course buttons no longer open Full course details.**
`:529` switched from `openCourse` to `inspectCourse`. Inspector updates without the modal; the inspector still has “Full course details”. Behavior change at the edge of this ticket.

## Tests

No skipped, disabled, or loosened tests in this diff.

Covered well: stacking invariant (`tests/graph.test.ts:676-679`); Escape from inspector, pane, null target, inactive, find-occupied, fullscreen, non-Escape, dialog (`:682-693`); addable skip/dedupe (`tests/plan.test.ts:191-200`); append success, immutability, missing term, empty items, full-term capacity (`:203-230`).

Gaps (not false-green): nothing locks `inspectCourse` vs `locate` vs Back; nothing asserts the semester `<select>` is outside line-focus Escape; `addCourses` glue is untested (logic is in the pure helpers). Consistent with this repo’s node:test style (no mounted graph).

## Operations

Exit / Escape / pane-click do not touch zoom or `fitRequest`. Controlled `viewport` in `GraphCanvas` is unchanged. Fullscreen Escape is intentionally not used for line-focus (`lib/graph.ts:702`); Exit button and pane click still work. Capacity refusal is all-or-nothing (no silent truncation). Hydration guard avoids writing before localStorage load. Rollback is the git commit. No new network or persistence format.

## Security

No new endpoints, secrets, or HTML injection. Codes come from `selectedRelationship.codes` (catalog graph). Semester IDs come from `plan.semesters`. `addableLineCourses` will not insert unknown or external codes. Save still runs `parsePlan(plan)` (`components/app-provider.tsx:160`). Dialog skip keeps course-details Escape from also clearing the map.

## Code health

Extracted z-index, Escape, and plan helpers are easier to test and reuse. `inspect` vs `locate` is the right seam but is incomplete while history still calls `locate`. `addCourse` still hard-codes `32` while `appendCoursesToSemester` uses `MAX_COURSES_PER_SEMESTER`. Description clamp 4→8 is unrelated but harmless.

## Acceptance vs code

| Criterion | Result |
| --- | --- |
| Exit control, Escape from layout/inspector, empty-map click; restore scope/zoom; do not switch to full chain | Met on those three exits. Card inspect also preserves depth. Back/Forward after inspect does not (medium). |
| Card click updates inspector fields during line-focus; dimmed cards clickable; no Full course details required | Met (`inspectCourse` + z-index contract). |
| Add line skips externals/recorded, appends rest, 32 cap | Met in `lib/plan.ts` + `addCourses`. |

## Debate round 1

Independent first pass. No `artifacts/review-project_manager-line-focus-details-plan.md` yet. No high findings. Mediums are the incomplete `inspect`/`locate` history seam and Escape on the new semester select.

Parent-reported 86 tests + typecheck were not re-run here (no fabricated evidence). Live CUA not used.
