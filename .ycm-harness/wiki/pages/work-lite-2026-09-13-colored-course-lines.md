# Focused course graphs and selectable colored relationships

<!-- managed by ycm-harness wiki. id: work-lite-2026-09-13-colored-course-lines -->

# Focused course graphs and selectable colored relationships

## Goal
Make course selection isolate its dependency graph and make straight colored connectors explain and highlight their relationships.

## Shipped
- 334e2dc: selected-course graph, destination colors, branch/group selection, relationship explanations and highlighting.
- 92479b9: non-overlapping branch/shared-connector hit areas and keyboard-operable prerequisite-group controls.
- Modules: components/course-graph.tsx, components/graph-canvas.tsx, lib/graph.ts, app/globals.css; regression proof in tests/graph.test.ts.

## Interaction contract
Selecting a course through its card, search, or navigation history opens its directed ancestors and downstream unlocks. It does not add unrelated sibling prerequisites of downstream courses. Entire program remains an explicit display option. This supersedes the previous default-entire-program behavior described in [[work-2026-09-13-mscs-graph-close]] and [[work-lite-2026-09-13-skill-tree-map]].

Colors are stable by destination. Clicking an individual branch selects its source and destination; clicking the shared connector selects all visible prerequisite sources feeding that destination. Destination-group and exact-relationship buttons provide the same keyboard actions. Selection highlights the related cards/lines and displays the destination's complete catalog rule. Color and arrows do not imply AND/OR satisfaction. Course or scope changes clear stale relationship selection; Clear and Escape provide explicit reversal. Readable-size native scrolling, explicit Overview, and Back/Forward are retained.

## Verify
Independent parent execution at 92479b9: npm.cmd test (76 passed, exit 0); npm.cmd run typecheck (exit 0); npm.cmd run build (exit 0). Regression tests cover directed-chain filtering, relationship groups, stable colors, connector/card routing and numeric branch/shared-connector hit-area separation. Build-only next-env.d.ts churn restored.

## Review
PASS: tech_lead, project_manager, and user_advocate. Initial high findings (overlapping junction hit regions and missing keyboard group selection) were fixed and independently re-reviewed. Evidence: artifacts/review-tech_lead-colored-course-lines.md, artifacts/review-project_manager-colored-course-lines.md, artifacts/review-user_advocate-colored-course-lines.md.

## Architecture
Diff-scoped architecture pass produced no implementation candidates. Top recommendation: retain the existing graph/domain, workspace projection, and SVG rendering module split. No architecture candidates or refactors left unimplemented. The standalone HTML report is architecture-review-20260913-graph-c01c837-334e2dc.html in the session temporary directory.

## Leftovers
Live visual and pointer smoke remains unverified: CUA reported no connected browser or app surface. The HTML architecture report could not be opened through CUA either. Changes are committed locally; no remote publication was requested.
