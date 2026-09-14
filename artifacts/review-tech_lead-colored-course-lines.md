# Tech-lead review - colored course lines

PASS

## Round 2 Verdict

The two previous high findings are fixed. The shared-bus pointer target is now modeled as a separate hit path owned by one deterministic incoming edge, while each branch target stops before the bus by the configured hit width plus gap. The keyboard path is now a native inspector control for both destination groups and exact branches. I found no high, medium, or low findings.

`ack_zero_findings_reason`: I inspected the round2 diff, graph geometry helpers, rendered edge data wiring, inspector controls, reset paths, graph tests, project-manager round2 artifact, and verification commands; remaining live-browser proof is unavailable because CUA has no browser/app surface.

## Fixed High Findings

### Fixed - shared-bus interaction is deterministic

`lib/graph.ts:149-172` defines `GRAPH_HIT_TARGET_WIDTH`, `GRAPH_HIT_TARGET_GAP`, and `prerequisiteHitPaths`, ending each branch at `busX - width - gap` while the bus path starts at `busX`. `components/graph-canvas.tsx:33-37` renders the visible edge with `interactionWidth={0}`, then separate transparent branch and bus hit paths. `components/course-graph.tsx:193-208` computes the full vertical bus bounds from every visible incoming entry and the target midpoint, and `components/course-graph.tsx:220-227` wires only the deterministic bus owner to the bus action while every branch keeps its own action.

The geometry test at `tests/graph.test.ts:100-137` expands path segments by the real 18px stroke radius and asserts no branch segment overlaps the bus path for both short and long connectors. This directly covers the prior false-green risk around branch/bus overlap and render order.

### Fixed - shared-bus selection has a keyboard route

`lib/graph.ts:193-217` exposes deterministic relationship control groups and distinct branch/bus selections. `components/course-graph.tsx:467-472` renders native buttons for `All into {target}` and each exact branch, with `aria-pressed` reflecting selected bus or branch state, plus a native Clear control. Those buttons provide the keyboard-operable alternative for the relationship that the SVG bus advertises.

## Acceptance Evidence

Course selection now defaults to the selected course graph via `depth` initialized to `"course"` at `components/course-graph.tsx:95`, with `visibleGraphDistances("course")` using `directedCourseChain` at `lib/graph.ts:105-107`. `directedCourseChain` skips corequisites and walks upstream/downstream prerequisite edges only at `lib/graph.ts:324-336`, and tests assert sibling prerequisites of downstream courses are excluded at `tests/graph.test.ts:41-49` plus corequisite neighbors are excluded at `tests/graph.test.ts:596-623`.

Destination colors are stable through `stableDestinationColor` at `lib/graph.ts:175-180` and are applied per arrow target at `lib/graph.ts:231-235`; tests cover determinism at `tests/graph.test.ts:86-89`. Exact branch versus bus highlighting is wired at `components/course-graph.tsx:136-159` for nodes and `components/course-graph.tsx:212-231` for edges. The selected relationship explains the target's full prerequisite rule at `components/course-graph.tsx:467`.

Clear and reset behavior remains covered in code: Escape clears active relationship selection inside `.graph-panel` at `components/course-graph.tsx:288-299`, course navigation clears relationship state and resets scope/history focus at `components/course-graph.tsx:300-308`, and scope controls clear relationship state at `components/course-graph.tsx:426` and `components/course-graph.tsx:462-465`. The map find Escape tests remain in `tests/graph.test.ts:515-543`.

## Debate Round 2

The project-manager round2 artifact is PASS with no high or medium findings to concede or rebut. I agree with its live-UI limitation: no CUA browser/app surface is available, so this review has static code inspection plus test/build evidence, but no live pointer or visual screenshot proof.

## Verification

Passed locally at `92479b9`:

- `npm.cmd test` - 76/76 passing. Initial sandboxed run failed before project tests with `uv_os_get_passwd returned ENOMEM`; rerun outside the sandbox passed.
- `npm.cmd run typecheck` - passed.
- `npm.cmd run build` - passed with Next.js 16.3.4/Turbopack.
