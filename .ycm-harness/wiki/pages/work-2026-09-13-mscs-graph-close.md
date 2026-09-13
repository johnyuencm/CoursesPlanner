# MSCS program map closeout

<!-- managed by ycm-harness wiki. id: work-2026-09-13-mscs-graph-close -->

# MSCS program map closeout

Reusable contracts after closing `goal_complete-mscs-seattle-prerequisite-graph_5f65`.

## Map scene

`mapScene` is the program-map module. GraphWorkspace binds xyflow; it does not re-sequence catalog relations, distances, layout, and unlock arrows.

`mapFind` owns find query, key routing, dialog skip, and Escape scope. `Modal` is a `role="dialog"` so native course-details skip works.

Compact graph cards use `compactGraphStatusLabel` (`Eligible`). Inspector keeps `Prerequisite eligible`.

## Layout

`layoutProgramFlow` is the skill-tree layout for program, neighborhood, and depth views. Coreq partners occupy consecutive rows in the same column (CS 5011 under CS 5010). Wrap-4 packing is gone.

Do not export layout internals (`neighborhoodDistances`, `topologicalRanks`, `classifyUnlinkedProgramCodes`, `programGridDimensions`, `selectedChainRelations`). `listedProgramCodes` stays exported for `buildCourseGraph`.

Highlight and unlock arrows come from one `catalogRelations` walk. Coreq partners stay on the selected chain on purpose. Do not add a second catalog adapter.

Do not restore MiniMap.

## Closed leftovers

Named leftovers on `work-lite-2026-09-13-skill-tree-map` and `work-2026-09-13-coreq-adjacency` are shipped: CS 5011 adjacency, neighborhood skill-tree layout, Eligible pill, dialog Ctrl+F skip, canvas Escape find-clear, architecture candidates, parent goal close.

## Human-only

Merge `fix/complete-prereq-graph` to master only when asked.

