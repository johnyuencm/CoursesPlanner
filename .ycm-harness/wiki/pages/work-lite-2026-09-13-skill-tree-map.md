# Prerequisite Graph skill-tree map

<!-- managed by ycm-harness wiki. id: work-lite-2026-09-13-skill-tree-map -->

# Skill-tree Prerequisite Graph (lite run)

## Goal
Make `/map` read like an RPG skill tree that matches catalog CourseCards: directed unlock arrows, readable description, lock/eligible/completed status, labeled no-prereq band.

## Shipped
Branch `fix/complete-prereq-graph`.
- `bbaf742` classify unlinked no-prereq vs catalog-unlinked
- `d703339` labeled bands below the connected flow
- `60ec94e` CourseCard chrome, directed unlock arrows, inspector description, MiniMap/tooltip removed
- `5943b04` corequisite partners stay in the tree (CS 5011), still no coreq lines
- `cc6d2d5` layout seam requires course metadata (`layoutProgramFlow`)
- `9ccfcce` `unlockArrowView` owns draw policy
- `f5e9fd3` drop unused `openCourse` from node data

## Verify
`npm test` 51 pass; `npm run typecheck` exit 0 (re-run after architecture commits).

## Review
Lite two-phase panel PASS (tech_lead, project_manager, user_advocate) — artifacts `artifacts/review-*-skill-tree-map.md`. No high findings. Deferred mediums: CS 5011 same column but not adjacent cards; compact eligible pill may clip.

## Architecture
Report: `%TEMP%/architecture-review-2026-09-13-skill-tree.html`
Implemented all candidates:
- Strong / Top: require course metadata at layout seam
- Worth exploring: `unlockArrowView` interface
- Speculative: remove dead `openCourse` from GraphData
Leftovers: none from the report.

## Leftovers
- CS 5011 not visually adjacent to CS 5010 (same column)
- Neighborhood wrap packing unchanged
- Parent MSCS graph goal not closed

