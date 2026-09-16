# Graph line-focus, inspector details, and plan-from-line

<!-- managed by ycm-harness wiki. id: work-2026-09-15-line-focus-plan -->

# Graph line-focus, inspector details, and plan-from-line

## Goal

Operators can leave a selected prerequisite line, see the clicked course in the inspector, and add that line’s catalog courses to a semester without rebuilding the map.

## Shipped

- Line-focus exit: `Exit line focus` banner, Escape from `.graph-layout` (not dialogs, not fullscreen, not find text, not form fields), empty-map pane click. Dimmed cards stack above selected edges via `graphCourseZIndex`.
- Card click uses `inspectCourse` (updates inspector, clears line-focus, keeps Show depth). Find, chips, and Focus map here still `locate`.
- Back/Forward replay `inspectCourse` so Entire program does not collapse.
- `addableLineCourses` + `appendCoursesToSemester` insert program courses, skip externals and recorded codes, enforce 32 per term. Graph banner adds the line to a chosen semester. Picker `addCourse` uses the same append helper.

Commits: `e88c60f`, `ab05039`, `cfc9918`, `54f9fba`. Branch `land/local-graph-focus`.

## Verify

- `npm test` — 86 pass
- `npm run typecheck` — pass
- Harness `verify run` — pass (`evidence-ff71d93c`)
- Browser: line banner, inspect CS 5500 / dimmed CS 6410, add CS 5010 and CS 5500 to Fall 2026

## Review

Phase-1 `tech_lead` × `project_manager` PASS, then `user_advocate` PASS. No high findings. Artifacts: `review-*-line-focus-details-plan.md`.

## Architecture

Report: architecture-review-20260915-line-focus.html (temp). Top recommendation implemented: plan append lives in `appendCoursesToSemester`. Second candidate implemented: history replays inspect. No skipped leftovers from that report.

## Leftovers

None for this goal. Native fullscreen and phone-gesture proof remain UNVERIFIED from the earlier zoom pass (browser-control runtimes failed there).

