# Project-manager review - colored course lines

## Verdict: PASS

The latest `c01c837..92479b9` diff satisfies the accepted graph behavior from static code and test evidence. Live visual/pointer proof remains unavailable because this environment has no CUA browser/app surface, but the two previous high findings are now addressed in code and covered by targeted tests.

## Criterion map

| Approved criterion | Status | Evidence |
| --- | --- | --- |
| Selecting a course displays only the related dependency graph for that course | Met | `mapScene` builds `chain` with `directedCourseChain` at [lib/graph.ts](../lib/graph.ts#L347), and `directedCourseChain` walks prerequisite ancestors and unlock descendants while skipping corequisites at [lib/graph.ts](../lib/graph.ts#L324). `locate` resets focus, selected course, relationship selection, scope, and overview on course clicks at [components/course-graph.tsx](../components/course-graph.tsx#L300). |
| Directed course scope excludes unrelated sibling branches | Met | The regression fixture asserts `SIBLING -> C` is not included when selecting `B` at [tests/graph.test.ts](../tests/graph.test.ts#L41). The page footnote states that downstream sibling branches are not added at [components/course-graph.tsx](../components/course-graph.tsx#L493). |
| Colored lines are stable by destination | Met | `stableDestinationColor` hashes the destination into a fixed palette at [lib/graph.ts](../lib/graph.ts#L175), and `unlockArrowView` applies that destination color to prerequisite arrows at [lib/graph.ts](../lib/graph.ts#L219). Stability/distinctness is covered at [tests/graph.test.ts](../tests/graph.test.ts#L86). |
| Clickable branch selects the exact source/target relationship | Met | Branch selection stores exactly `source`, `target`, and the two highlighted codes at [lib/graph.ts](../lib/graph.ts#L209). Each edge wires `onSelectBranch` to that exact pair at [components/course-graph.tsx](../components/course-graph.tsx#L226), and the transparent branch path calls that handler at [components/graph-canvas.tsx](../components/graph-canvas.tsx#L23). |
| Clickable shared bus selects all visible incoming sources for the target, without arbitrary branch capture | Met | Bus selection filters visible arrows by target and sorts sources at [lib/graph.ts](../lib/graph.ts#L213). The rendered bus owner receives target bus bounds and `onSelectBus` at [components/course-graph.tsx](../components/course-graph.tsx#L220). The branch hit path now stops before the bus by hit width plus gap at [lib/graph.ts](../lib/graph.ts#L149), and the overlap regression checks short and long entries at [tests/graph.test.ts](../tests/graph.test.ts#L126). |
| Selection explains relationships and target AND/OR catalog rule | Met | The inspector renders branch/bus explanation text plus the target prerequisite rule and line-vs-rule caveat at [components/course-graph.tsx](../components/course-graph.tsx#L467). `nodeRequirementCopy` delegates to the parsed catalog expression at [components/course-graph.tsx](../components/course-graph.tsx#L73). |
| Full-size scroll, Overview, Back/Forward, and explicit scopes remain available | Met | The scrollable full-size map and Overview zoom are in [components/graph-canvas.tsx](../components/graph-canvas.tsx#L50) and [components/graph-canvas.tsx](../components/graph-canvas.tsx#L83). Back/Forward controls are preserved at [components/course-graph.tsx](../components/course-graph.tsx#L415), and the scope selector remains explicit at [components/course-graph.tsx](../components/course-graph.tsx#L425). |
| Clear/Escape and stale selection reset are present | Met | Escape clears an active relationship selection when focus is in the graph panel at [components/course-graph.tsx](../components/course-graph.tsx#L288), the Clear relationship button is rendered at [components/course-graph.tsx](../components/course-graph.tsx#L472), course navigation clears selected relationships at [components/course-graph.tsx](../components/course-graph.tsx#L300), and scope controls clear selection at [components/course-graph.tsx](../components/course-graph.tsx#L426). |
| Keyboard branch and group controls work | Met | The inspector renders native `button` controls for each bus group and exact branch, with `aria-pressed` state and click handlers at [components/course-graph.tsx](../components/course-graph.tsx#L468). `relationshipControlGroups` sorts destination groups and branches deterministically at [lib/graph.ts](../lib/graph.ts#L193), with coverage at [tests/graph.test.ts](../tests/graph.test.ts#L61). |

## Debate round history

Round 1 project-manager passed before the tech-lead found two high issues: overlapping branch/bus hit regions and no keyboard alternative for shared-bus selection.

Round 2 result: both high findings are resolved. The hit-region issue is addressed by `prerequisiteHitPaths` creating a branch endpoint before the bus and by the non-overlap regression test at [lib/graph.ts](../lib/graph.ts#L157) and [tests/graph.test.ts](../tests/graph.test.ts#L126). The keyboard issue is addressed by the inspector's native bus and branch buttons at [components/course-graph.tsx](../components/course-graph.tsx#L468), including `aria-pressed` state.

## Verification

Parent independent verification at `92479b9` reports `npm.cmd test` passed 76/76, `npm.cmd run typecheck` passed, and `npm.cmd run build` passed. My local rerun of `npm.cmd run typecheck` and `npm.cmd run build` also passed; my local `npm.cmd test` attempt failed before test execution with Node/tsx `uv_os_get_passwd returned ENOMEM`, so I am relying on the parent's successful independent test run for the test result.

## Findings

No high, medium, or low findings.

`ack_zero_findings_reason`: Each accepted behavior has direct file-line evidence, the two prior high findings have explicit fixes, and the remaining gap is only unavailable live-browser proof.
