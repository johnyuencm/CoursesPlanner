# Recent commit review

Review range: `b76e69be1a58f9945bb67686566a14eec0edca7b...1d0a239` (latest 12 commits). Findings below refer to the committed code before the architecture refactor. Standards and Spec were reviewed independently.

Sources: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/acceptance-checklist.md`, and the local ticket briefs and acceptance criteria in `.ycm-harness/state.json`. No `docs/agents/issue-tracker.md` was present; the code-review skill recommends `/setup-matt-pocock-skills` to configure it.

## Standards

No hard documented coding-standard violations found.

- **P2, judgement — possible Divergent Change**, `components/course-graph.tsx:162–235,258–273`: `matchesRef.current = matches`, `locateRef.current = locate`, and `cycleRef.current = cycle` connect keyboard handling, result selection, focus timing, and scrolling inside the same module that builds the graph. Find changes require tracing effects, mutable references, and input handlers. Consolidate the find lifecycle behind one interaction interface and verify keyboard-to-navigation behavior. The accompanying refactor moves graph projection out of this module; the find lifecycle remains a separate opportunity.

## Spec

- **P2 — sole-prerequisite alignment is partial**, `lib/graph.ts:203,211`. Ticket acceptance at `.ycm-harness/state.json:68`: “A course that is the sole on-map prerequisite of another sits immediately left of it on the same row.” Executing layout against the catalog with the UI comparator places CS 5100 at `(0,936)` and CS 7170 at `(188,1352)`; seven pairs fail the literal rule. The implementation prioritizes parents with one child, while the requirement describes children with one prerequisite. Shared-parent cases need reconciliation: MATH 2331 is the sole prerequisite of two courses in the same column, so universal same-row placement would overlap them. Preserved by this behavior-preserving refactor.
- **P2 — navigating an already-visible neighborhood course replaces the neighborhood**, `components/course-graph.tsx:207,323`. Ticket acceptance at `.ycm-harness/state.json:50`: “selects that course and pans to it when it is on the current view.” In CS 5500's immediate neighborhood, choosing CS 5004 in the inspector calls `setFocusCode`, recomputes membership, and changes the React Flow key; `fitView` replaces the requested pan. Preserve the existing focus when the destination is already visible. Confirmed by source inspection; browser reproduction outstanding. Preserved by this refactor.

Standards: 1 heuristic finding, worst P2 (find lifecycle coupling). Spec: 2 findings, worst P2 (partial alignment and neighborhood navigation).

## Current structure and implementation scope

- `app/` owns routes; `components/` owns interactive screens and shared application state.
- `lib/graph.ts` contains graph traversal, layout, and find helpers; `lib/plan.ts` and `lib/validation.ts` own student-plan and degree rules.
- `catalog-service/` owns source registration, crawling, scheduling, and refresh; `scraper/` owns catalog parsing; `data/` contains normalized snapshots and raw fixtures.
- `tests/` checks catalog, graph, parsing, and planning behavior. The missing graph test surface was the orchestration that determines what the screen actually renders.

The selected architectural improvement concentrates scope membership, selected-chain relationships, ordering, and positions in a framework-free map-projection module. The React Flow adapter retains rendering and interaction. Existing graph helpers stay compatible; tests exercise the new interface consumed by the screen. No dependency or layout-rule changes are part of the refactor.

Baseline: 45 tests passed using Windows Node and the installed `tsx` runner. Linux `npm test` cannot use the Windows esbuild binary in this shared checkout.

Initial refactor verification in the isolated worktree (before the follow-up layout decision):

- `node.exe node_modules/tsx/dist/cli.mjs --test tests/*.test.ts`: exit 0, 48 tests passed (45 existing plus 3 projection tests).
- `node.exe node_modules/typescript/bin/tsc --noEmit`: exit 0.
- `node.exe node_modules/next/dist/bin/next build`: exit 0; all routes compiled and static pages generated. Next warned about multiple lockfiles because the worktree is nested under the original checkout.
- `git diff --check`: exit 0.
- Independent execution compared the original UI projection with the new module across 2,460 combinations (every catalog focus, four scopes, and five representative selections): all matched. The fresh reviewer also verified unchanged find memo dependencies and passed the three focused projection tests.
- No interactive browser smoke test was performed; keyboard and camera behavior were reviewed in source.

Implementation branch: `refactor/map-projection`, worktree `.worktrees/architecture-review`. The original worktree's existing changes were preserved. No commit or merge was made.

## Accepted follow-up decisions

The user resolved both Spec findings:

1. Prioritize same-row alignment with one dependent when a prerequisite is shared. Keep one node per course. The layout now reserves the row of the topmost adjacent dependent whose sole prerequisite is that course, before placing other prerequisites. Other dependents keep separate positions. A course-code comparison breaks ties deterministically.
2. Rebuild the neighborhood around the newly selected course, including when it was already visible. The existing navigation behavior is intentional under this decision and needs no code change.

The original findings above remain as review history; they are no longer outstanding under these accepted requirements. The Standards observation about find lifecycle coupling remains a separate architectural opportunity.

Follow-up verification: the new catalog regression failed before the fix (MATH 2331 aligned with neither CS 5310 nor CS 5330). After the fix, the complete suite passed 50 tests, typecheck passed, and the production build passed. Commands used Windows Node with the existing dependencies at `../../node_modules/`. Regression coverage checks one eligible alignment per prerequisite, unique positions, and one node for a shared prerequisite. Browser interactions were not exercised.
