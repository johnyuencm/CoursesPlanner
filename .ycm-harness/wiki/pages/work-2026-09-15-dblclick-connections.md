# Double-click course connections and Escape restore

<!-- managed by ycm-harness wiki. id: work-2026-09-15-dblclick-connections -->

# Double-click course connections and Escape restore

## Goal

Double-click a course to enter This course's connections; Escape restores the previous map view, including Entire program.

## Shipped

- Double-click on a graph card or table course enters GraphScope `"1"` for that code, snapshots `{ depth, focusCode, zoom }`, and focuses the course at readable zoom.
- Escape from `.graph-layout` pops one snapshot after find-clear and line-focus. Dialogs, selects, and fullscreen keep Escape.
- Same-course connections does not push a duplicate. Show dropdown, locate/search, and Show entire program clear the stack.
- Inspector **Return to previous view** mirrors Escape.

Commits: `520fab8` (product). Branch `land/local-graph-focus`. Related: [[work-lite-2026-09-13-colored-course-lines]], [[work-2026-09-15-line-focus-plan]].

## Verify

- `npm test` — 88 pass
- `npm run typecheck` — pass
- Harness `verify run` — pass (`evidence-ed999acb`)
- Live `/map`: Entire program → double-click CS 5500 → connections; Escape → Entire program. Full chain → double-click → connections; Escape → chain.

## Review

Phase-1 `tech_lead` × `project_manager` PASS, then `user_advocate` PASS. No high findings.

## Architecture

Diff-scoped pass: no implementation candidates. Top recommendation: keep the graph-helper seam (`enterCourseConnectionsView` / `popGraphView` / `shouldRestoreGraphViewOnEscape`) with GraphWorkspace as the adapter. HTML report filename: architecture-review-20260915-dblclick.html.

## Leftovers

Discoverability of double-click/Escape is weak (muted canvas hint). Toolbar Back is course history, not view restore. Neither is a contract change.

