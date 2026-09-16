# Seat unlock targets beside their sources

<!-- managed by ycm-harness wiki. id: work-2026-09-15-seat-unlock-targets -->

# Seat unlock targets beside their sources

## Goal

Entire-program unlock targets sit next to the courses that point at them. A two-source target such as CS 6220 stays in that source band. A target with five or more same-column sources sits on the median source row so the bus can surround those courses and point in.

## Shipped

- `layoutProgramFlow` walks columns left-to-right. Exclusive 1:1 pairs claim the parent row first. Multi-parent sibling groups pack as consecutive blocks centered on the median parent Y, tighter parent-count first. Remaining exclusive siblings stack from the parent row. Roots keep barycenter order. Coreq clusters stay consecutive with the head.
- Adjacent-column arrows use `isShortPrerequisiteSpan` (`dx <= PROGRAM_COL`) for a short H-V-H bus instead of a 180px gutter heuristic. `graph-canvas` and `course-graph` busBounds share that helper.

Commits: `b1825c1` (product). Branch `land/local-graph-focus`. Related: [[work-lite-2026-09-13-skill-tree-map]], [[work-2026-09-15-dblclick-connections]].

## Verify

- `npm test` — 91 pass
- `npm run typecheck` — pass
- Harness `verify run` — pass (`evidence-0bc6f5c0`, implementer `layout-impl-b1825c1`, verifier `layout-verify-b1825c1`)
- Live `/map` Entire program: CS 5800 and CS 7800 consecutive; CS 6220 in that band with a short bus.

## Review

Phase-1 `tech_lead` × `project_manager` PASS, then `user_advocate` PASS. No high findings.

## Architecture

Diff-scoped pass: no implementation candidates. Top recommendation: keep Y assignment inside `layoutProgramFlow`; keep `isShortPrerequisiteSpan` as the shared short-bus helper. HTML report: architecture-review-20260915-seat-unlock-targets.html in the session temp directory.

## Leftovers

High fan-in across several columns (CS 6180) still spans more than one viewport; the target sits on the median source row and the bus surrounds then points, but a tight one-screen cluster is not possible. Map find of an on-map course can still switch Show off Entire program (pre-existing).

