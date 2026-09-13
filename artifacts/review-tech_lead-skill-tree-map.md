# tech_lead review — skill-tree-map

Verdict: **PASS** (round 2; no high findings)

Goal: entire-program map as a CourseCard skill tree — directed prereq arrows for every in-scope edge, selected chain emphasized, no coreq/undirected lines, inspector description instead of hover tooltip, MiniMap not covering cards, unlinked no-prereq official courses in a labeled band, CS 5010 a tree root, externals out of that band.
Reviewed state: branch `fix/complete-prereq-graph` @ `5943b04` (product commits `bbaf742` classify, `d703339` band layout, `60ec94e` render, `5943b04` coreq-as-linked).
Diff inspected: `git show bbaf742 d703339 60ec94e 5943b04` on `lib/graph.ts`, `tests/graph.test.ts`, `components/course-graph.tsx`, `app/globals.css`.
Reviewer is not the implementer. No product file was modified. This is the only file written.
`artifacts/review-project_manager-skill-tree-map.md` is still **round 1** @ `60ec94e` (no high/medium). Debate round 2 below.

I did **not** live-drive `/map`. Arrowheads, MiniMap absence, tooltip absence, locked muting, and inspector readability are judged from committed source plus a fixture classification dump, not from a click session.

## Evidence I ran myself

| Command / check | Result |
| --- | --- |
| `git rev-parse --abbrev-ref HEAD` / `HEAD` | `fix/complete-prereq-graph` / `5943b04` |
| `git show 5943b04 --stat` | `lib/graph.ts` +8/−2; `tests/graph.test.ts` +38 (three new tests). No deletions |
| `npm test` | **50 pass / 0 fail / 0 skipped / 0 todo** (1602 ms) |
| `npm run typecheck` (`tsc --noEmit`) | clean, exit 0 |
| Tests deleted / skipped / `.only` / loosened | **none**. Round-1 suite was 47; +3 coreq tests = 50 |
| Fixture dump (`seattleGraph()` helpers at HEAD) | 107 visible / **53** in-scope directed prereq edges / **1** in-scope coreq pair (`CS 5011`→`CS 5010`, `corequisite: true`). `directedPrerequisiteRelations` on that set: **53**, `drawnHasCoreq: false`. `noPrerequisite` **52** (was 53) / `unlinked` 10. `CS 5011` **not** in either band. `CS 5150` still in no-prereq. `CS 5010` tree root **x=0 y=2176**. `CS 5011` **x=0 y=2688** (same column, y < no-prereq label **2896**). Externals in no-prereq: **[]**. Unlinked: CY/DADS/DS `unknown` only |

## Acceptance criteria

1. **met in source.** Program and neighborhood edges are `directedPrerequisiteRelations` of in-scope catalog relations (`components/course-graph.tsx:146`), then **all** of those become `smoothstep` edges with `MarkerType.ArrowClosed` (`:222-236`). Coreqs are dropped before draw. Dump: 53 prereq / 1 coreq; only the former can reach `edges`. `5943b04` did not reintroduce coreq strokes.
2. **met in source.** Inspector renders `selected.description` (`:472`) with `.inspector-description` (`app/globals.css:404`). Hover tooltip markup/CSS and `MiniMap` remain gone (grep: no `MiniMap`, no `.graph-node-tooltip`). Clamp caveat is TL-3 (low).
3. **met in source.** Compact program nodes use `requirementBadge` + `courseStatus` + `.course-code` + title + `.credits` (`components/course-graph.tsx:68-78, 155-172`). `core-course` top border matches compact `CourseCard` (`app/globals.css:212, 373`). Unchanged by `5943b04`.
4. **met in source.** Drawn set is full in-scope prereqs, not `selectedChainRelations` (`:146`). Chain only darkens stroke (`:147-148, 223-232`). Locked uses `courseStatus` → `graph-locked` mute (`:113-116, 157, 69`; `app/globals.css:378-379`). Nodes stay on the map regardless of status.
5. **met in source; round-1 TL-1 closed.** `classifyUnlinkedProgramCodes` now treats **any** in-scope relation (prereq **or** coreq) as linked (`lib/graph.ts:139-144`). Official `prerequisites.type === "none"` isolates that are **not** incident still pack under `"No prerequisite required"` (`:146-155, 269-283`). Tests: `CS 5150` in-band, `CS 5010` not (`tests/graph.test.ts:111-120`); `CS 5011` in neither band (`:122-128`); layout `CS 5011.y` above the band label and `CS 5011.x === CS 5010.x` (`:130-139`). Dump matches. `CS 5010` remains a connected root (unlocks `CS 5400` / `CS 5500` / `CS 6510` / `CS 7980`, x=0). Externals still excluded from the no-prereq list by `requirementType !== "external"`; PHYS remains a connected tree node (TL-2).

Gates: 50/50 and clean `tsc`.

## Architecture

Fits the existing `/map` React Flow + `lib/graph.ts` helper split. Classification is a pure function; layout consumes it; the client maps positions to CourseCard-token nodes and directed edges.

- `directedPrerequisiteRelations` (`lib/graph.ts:126-128`) remains the single filter for “what is a skill-tree **arrow**.” `5943b04` correctly **widened** “what counts as **linked** for banding” to all `GraphRelation`s without widening the draw filter. That is the right cohesion: coreq incidence keeps the recitation in the tree; coreq is still not an unlock arrow.
- Layout rank-share for coreq partners (`:185-190`) restores the `d703339`-deleted `Math.min` so a coreq-only node shares the earlier prereq rank. On the Seattle fixture both `CS 5010` and `CS 5011` already sit at rank 0, so the share is a no-op for column assignment; the **linked-set** change is what pulls `CS 5011` out of the isolate pack. Synthetic `A→C` prereq + `B↔C` coreq collapses `C` into `A`’s column (TL-6).
- `programFlowPositions` is still a compatibility wrapper with `courses=[]` (`:288-297`). UI uses `layoutProgramFlow` (`components/course-graph.tsx:189`). After `5943b04`, CS 5011 is in the tree even via the wrapper because layout `linked` walks `scoped` (all relations) (`lib/graph.ts:191-195`). Isolates with `type: "none"` still need course metadata for the no-prereq band (TL-4).
- Band labels remain inert React Flow nodes (`id: band:${id}`, `selectable: false`).

No new graph stack, no catalog mutation, no persistence.

## Correctness

Happy path on the Seattle fixture: 53 directed unlock arrows stay on the program map; selecting a course emphasizes the `dependencyClosure` chain; official `type: "none"` isolates (e.g. `CS 5150`) sit under the labeled band; `CS 5010` remains a connected root; `CS 5011` is in the rank-0 column above that band, not labeled startable.

Coreq edges cannot become arrows (`course-graph.tsx:146` + `lib/graph.ts:126-128`). Neighborhood BFS is still undirected and **includes** coreqs, so `CS 5011` can still appear as a **lineless** neighbor of `CS 5010` at depth 1. Matches AC1.

`graphStatus` for a missing catalog row returns locked (`components/course-graph.tsx:114`). `unknown` prereqs become `Needs review` via `courseStatus`, not `graph-locked`.

No races that look like data loss. Graph memo rebuilds from catalog/plan/selection; edge ids include index. Idempotent select.

Round-1 TL-1 (CS 5011 in the no-prereq band) is **fixed** at `5943b04`: classifier `lib/graph.ts:139-144`; layout linked-set `:191-195`; dump `cs5011InNoPrereq: false`, `p5011.y=2688 < band 2896`, same `x=0` as `CS 5010`.

## Tests

New tests in `5943b04` (`tests/graph.test.ts:122-158`) honestly lock: CS 5011 not in either isolate band; CS 5011 above the no-prereq label and same x as CS 5010; synthetic coreq rank-share. They were added, not rewritten to go green. `skipped`/`todo` remain 0.

They still do **not** lock: `directedPrerequisiteRelations` dropping coreqs; drawing **all** 53 in-scope arrows vs selected-chain-only; MiniMap/tooltip absence; `courseStatus` muting; inspector description; an **unlinked** external. Title at `:111` plus `PHYS 5116` (`:119`) still overclaims the external guard — PHYS is in the connected tree. A regression that restores `drawn = selectedChainRelations(...)` would still pass `npm test`. Silent gap, not a skipped/loosened test. Not a high (TL-2).

## Operations

Rollback is revert of `bbaf742`+`d703339`+`60ec94e`+`5943b04`. No flags, no new network, no persistence. Program map mounts 53 edges + ~107 course nodes + 0–2 band nodes with `onlyRenderVisibleElements` (`course-graph.tsx:439`). Tree is one row taller (`CS 5011` at y=2688); band label moved from 2768 → 2896. Default viewport still centers `CS 5010` (`:428-430`).

## Security

No new trust boundary in `5943b04`. Descriptions, titles, and codes render as React text. Band ids are fixed. Edge `ariaLabel` interpolates catalog codes. No secrets, no path injection, no destructive commands.

## Code health

The linked-vs-arrow split is now explicit and cheaper to evolve than stuffing coreqs back into `directedPrerequisiteRelations`. `GraphWorkspace` remains a large client module. `programFlowPositions(..., [])` is still a footgun for the no-prereq band (TL-4). Dead `openCourse` on node data remains (TL-5).

## Findings

### TL-1 — closed (was medium) — core recitation in the startable band

Fixed in `5943b04`. Classifier counts coreq partners as linked (`lib/graph.ts:139-144`). Layout includes coreq endpoints in the connected set (`:191-195`) and shares rank (`:185-190`). Tests `tests/graph.test.ts:122-139`. Dump: `CS 5011` not in `noPrerequisite`/`unlinked`; x=0 with `CS 5010`; y=2688 < band label 2896. No coreq arrows (`course-graph.tsx:146`; dump `drawnHasCoreq: false`).

### TL-2 — medium — UI arrow/coreq/external contracts are untested; PHYS assert is vacuously true

No test imports `directedPrerequisiteRelations`. No test counts in-scope program prereq edges (53) or forbids a coreq `strokeDasharray` / missing `markerEnd` edge. `PHYS 5116` is a connected tree node (`unlocks` `CS 7332`; `data/catalog.json:4945-4963`), so `classified.noPrerequisite.includes("PHYS 5116") === false` (`tests/graph.test.ts:119`) does not execute `requirementType !== "external"` (`lib/graph.ts:151`). This snapshot has **zero** unlinked externals. Restoring selected-chain-only drawing (`components/course-graph.tsx:146,222`) would stay green. The new CS 5011 tests close banding, not the draw filter.

### TL-3 — low — inspector description is a 4-line clamp

`.inspector-description` uses `-webkit-line-clamp: 4` (`app/globals.css:404`; render `components/course-graph.tsx:472`). `CS 5010`’s catalog blurb is longer than four lines (`data/catalog.json:669`). Preview is readable; complete text requires “Full course details” (`:492-494`).

### TL-4 — low — `programFlowPositions` drops course metadata

Wrapper calls `layoutProgramFlow(codes, relations, [], …)` (`lib/graph.ts:297`). Empty `courses` sends every **unlinked** isolate to the `unlinked` pack (`:148-155`). UI is fine (`course-graph.tsx:189`). Future callers of the old name will silently lose the no-prereq band. Coreq-linked codes (CS 5011) now stay in the tree even through this wrapper.

### TL-5 — low — dead `openCourse` on node data

`makeNode` still passes `openCourse` (`components/course-graph.tsx:181`). `CourseNode` no longer has a details control (`:68-81`). Inspector still exposes the action. Harmless leftover.

### TL-6 — low — coreq `Math.min` rank-share can flatten a prereq column

`layoutProgramFlow` sets both coreq endpoints to `min(rank(source), rank(target))` (`lib/graph.ts:185-190`). The synthetic test locks `A.x === C.x` when `A→C` is a prereq and `B↔C` is a coreq (`tests/graph.test.ts:141-157`), i.e. a later course can share a column with its prerequisite. Seattle’s only in-scope coreq is `CS 5010↔CS 5011` at rank 0, so the fixture does not flatten an unlock arrow. Residual policy risk if more coreqs appear.

## Debate round 1

`artifacts/review-project_manager-skill-tree-map.md` was absent at TL round 1. No PM high/medium to concede or rebut.

## Debate round 2

Read `artifacts/review-project_manager-skill-tree-map.md` (still round 1 @ `60ec94e`). PM high/medium findings: **none**. PM-1 (eligible pill ellipsis, `app/globals.css:385`) is **low** — concede it is still true at HEAD; not a blocker.

PM trade-off 3 (`CS 5011` in the idle band as matching the written unlinked rule) is **superseded** by `5943b04`. I do not treat that leftover as open: AC5’s “unlinked none-prereq” now correctly excludes coreq-incident courses. Evidence: `lib/graph.ts:139-144`, `tests/graph.test.ts:122-139`, dump `cs5011InNoPrereq: false`. PM’s “no coreq lines” claim remains true (`course-graph.tsx:146`).

TL-1 closed. TL-2 restated (draw-filter / 53-arrow / vacuous PHYS still untested). No unrebutted **high** findings from either seat.
