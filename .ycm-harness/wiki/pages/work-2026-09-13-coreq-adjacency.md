# Coreq adjacency leftover (skill-tree map)

<!-- managed by ycm-harness wiki. id: work-2026-09-13-coreq-adjacency -->

# Coreq adjacency leftover (skill-tree map)

Closes the two named leftovers from [[work-lite-2026-09-13-skill-tree-map]].

## Goal
Put CS 5011 on the next skill-tree row under CS 5010, and reuse `layoutProgramFlow` for neighborhood/depth views instead of wrap-4 packing.

## Shipped
Branch `fix/complete-prereq-graph`. Ticket `ticket-seat-coreq-partners-beside-their-course-and-reuse-skill--6b3b09cd`.
- `17fc4c5` occupy-with-coreqs consecutive rows
- `c995fb8` tests: CS 5011 `y === CS 5010.y + PROGRAM_ROW`; exclusive leftover pair; CS 5500 neighborhood LTR
- `745a3b5` GraphWorkspace always calls `layoutProgramFlow`; band labels program-only; `compact: true`; wrap=4 gone

## Verify
`npm test` 53 pass; `npm run typecheck` exit 0.
Live `/map`: CS 5010 `(0,2304)` CS 5011 `(0,2432)` dy=128. CS 5500 neighborhood four cards LTR (5010/5004 | 5500 | 6510).
Harness: `verify run` PASS `evidence-c91d55c1` (implementer `impl-coreq-layout-17fc4c5`, verifier `verify-coreq-layout-r2`).

## Review
Two-phase panel PASS (tech_lead, project_manager, user_advocate). No high findings. Lows: partner rows skip used cells; isolate-band padding still reserved when labels omitted; default-compare tests vs UI typeOrder; CS 5010 unlock stroke can glance-meet CS 5011's row.

## Leftovers
- Parent goal `goal_complete-mscs-seattle-prerequisite-graph_5f65` still **active** (not closed this run).
- Compact `.status-pill` ellipsis on "Prerequisite eligible" unchanged.
- Do not merge to master unless asked.

