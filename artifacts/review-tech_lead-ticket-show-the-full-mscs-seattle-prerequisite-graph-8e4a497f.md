# tech_lead review — ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f

Verdict: **PASS** (round 3 of 3; no high findings)

Goal: Complete MSCS Seattle prerequisite graph vs the official catalog.
Reviewed state: branch `fix/complete-prereq-graph` @ `6caccf1` (`6273251` product + `6caccf1` harness submit).
Round-3 product diff: `git diff 2fd63b5..HEAD` = `app/globals.css` + `components/course-graph.tsx` only (`+11 / −7`). Tests unchanged.
Reviewer is not the implementer. No product file was modified by this review; the only file written is this artifact.

This round is the fix loop after uiux FAIL highs F1 (empty `.graph-emphasized`) and F2 (`tabIndex={-1}` on map nodes). Round-1/2 findings are retained and re-checked; no new high. I did **not** live-render `/map`.

## Evidence I ran myself (round 3)

| Command / check | Result |
| --- | --- |
| `git rev-parse HEAD` | `6caccf16eea121ad721bf38a0df6fcdd8e61c0a3` |
| `npm test` on `6caccf1` | **39 pass / 0 fail / 0 skipped / 0 todo** (1161 ms) |
| `npm run typecheck` (`tsc --noEmit`) | clean, exit 0 |
| Recompute `programMapCodes` / `visibleGraphDistances("program", …)` on published `data/catalog.json` | **114 nodes**; listed HTML **96 ≡ 96** published; `listedMissing: []` |
| Spot codes | `CS 5800` ✓ `CS 5100` ✓ `CS 5004` ✓ `CS 1800` absent from snapshot and from default map |
| `neighborhoodDistances("CS 5500", …, 1)` | exactly `["CS 5004","CS 5010","CS 5500","CS 6510"]` |
| Grade-floor tally on published snapshot | `{D-:28, C-:62, B-:2, D:2, C:23, C+:1}`; **hyphen-unknown tokens: 0** |
| Published `CS 6140` | two `minimumGrade: "C-"` course items (`data/catalog.json:1516-1528`) |
| `git diff 2fd63b5..HEAD -- tests/` | **empty** (no deletions, skips, or loosened asserts) |
| `.graph-emphasized` rule | `app/globals.css:376` now `border-color: #4b6cb3; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.28)` |
| `.graph-node-main` tabIndex | **removed** (`components/course-graph.tsx:40`). Remaining `-1` is Details (`:47`) and inspector (`:222`) |
| xyflow wrapper when `nodesFocusable={false}` | `tabIndex: undefined` (not `-1`); inner `<button>` stays in sequential tab order |

## Acceptance criteria

1. **met (node set).** Default scope is still `program` (`components/course-graph.tsx:88`) → `visibleGraphDistances` → `programMapCodes` (`lib/graph.ts:94-105`, `:15-26`). All 96 listed codes are nodes, including isolated `CS 5800` / `CS 5100`. Locked by `tests/graph.test.ts:31-40`. Round 3 did not change membership.
2. **met.** `CS 5004` is a default-map node; `CS 1800` is absent (`scraper/parser.ts:492-513`, snapshot grep empty). Explorer filter unchanged this round (`app/courses/page.tsx:38`).
3. **met.** All four Show options remain (`components/course-graph.tsx:169-172`). Depth-1 of `CS 5500` is the local 4-node set; program scope independently keeps isolated cores (`tests/graph.test.ts:43-52`). `fitView` is still scoped to `depth !== "program"` (`:182`).
4. **met.** No parser change this round; `scraper/parser.ts:63-67` still accepts a trailing minus and publishes `C-`. Gates: 39/39 and clean `tsc`.

## Disposition of prior tech_lead findings

- **TL-1 (medium) — open.** Direct vs transitive closure still disagrees by 28 courses. Unchanged (`scraper/parser.ts:494-507` vs `lib/graph.ts:19-24`).
- **TL-2 (medium) — still fixed** from round 2. Refocus gate `depth !== "program" && focusCode !== selectedCode` (`components/course-graph.tsx:225` area; inspector actions unchanged in spirit).
- **TL-3 (low) — still fixed**, plus round-3 focus restore: `focus()` now always moves programmatic focus to `#graph-inspector` (`:150-152`) after search activation.
- **TL-4 (medium) — open.** Snapshot still has no upper bound. Unchanged.
- **TL-5 (low) — open.** Grade regex still unanchored. Unchanged.
- **TL-6 (low) — open.** `.ycm-harness/state.json` and `events.jsonl` remain tracked (`6caccf1`).
- **TL-7 (low) — open.** `topologicalRanks` still returns `0` on cycle revisit (`lib/graph.ts:82`). Program layout still ignores ranks.
- **TL-8 (medium, round 2) — fixed.** `.graph-course-node.graph-emphasized` is no longer empty (`app/globals.css:376`). Compact still hides `.graph-node-bottom` (`:367-368`), but the node itself now carries a blue border + 2px ring. Tooltip also prints `relation` (`components/course-graph.tsx:51`). Selected node is both `emphasized` and `focused`; `:377` overrides so the clicked chip stays the stronger ring.
- **TL-9 (medium) — open.** Viewport/zoom/`fitView` contract remains untested. Round 3 adds another untested UI contract (emphasis CSS + main-button tab order) with **zero** test diff.

## Findings (round 3)

### TL-1 (medium, carried) — two competing program closures; default-map chips without nodes

Unchanged. `scraper/parser.ts:494-507` keeps the **transitive** listed-set closure (142 published courses). `lib/graph.ts:19-24` admits only **direct** dependencies (114 default-map nodes). Default-map dangling chips remain the four external rows (`CS 5004`, `CS 3650`, `CY 2550`, `DADS 7275`). Confined to the external fringe; no official listed course is missing as a node.

### TL-4 (medium, carried) — nothing bounds the snapshot against re-inflating

The `while (growing)` loop is unchanged. Guards remain `CS 1800 === false` and `visible.size >= core + 20`. A refresh that adds one edge into the undergraduate core still re-inflates with tests green.

### TL-9 (medium, carried / widened) — advertised default-map interactions are still unlocked by tests

Round 2: packing test (`tests/graph.test.ts:56-61`) does not lock `fitView={depth !== "program"}` or `defaultViewport.zoom === 1`. Round 3: `6273251` is CSS + JSX only; nothing asserts `.graph-emphasized` is non-empty, that `.graph-node-main` lacks `tabIndex={-1}`, or that search activation focuses `#graph-inspector`. Reverting those two lines would restore the uiux F1/F2 highs with every test still green. Not a false-green (no skip/delete/loosen); it is an unguarded regression surface.

### TL-10 (low, new) — keyboard reachability is only as wide as the culled DOM

`nodesFocusable={false}` remains (`components/course-graph.tsx:193`). xyflow then omits wrapper `tabIndex` (`NodeWrapper`: `tabIndex: isFocusable ? 0 : undefined`), which is what lets the inner `.graph-node-main` button take sequential focus. `onlyRenderVisibleElements` (`:196`) still unmounts off-canvas chips, so Tab cannot reach official courses outside the current pane; search (`:155`) plus inspector focus (`:150-152`) is the remaining keyboard path to those nodes. Details stays `tabIndex={-1}` (`:47`). Not an AC miss and not the prior F2 defect (main select is back in tab order, and `button:focus-visible` at `app/globals.css:50-52` plus `:focus-within` tooltip at `:386` now apply).

## Areas inspected and found clean (round-3 delta)

- **Architecture.** No new abstraction, schema, or catalog path. Emphasis still uses existing `dependencyClosure` / `relation` / `emphasized` flags (`components/course-graph.tsx:102-104`). Keyboard restore is removing a prior `tabIndex={-1}`, not a second focus manager. Inspector `tabIndex={-1}` (`:222`) is the skip-link / search-focus target; it lives outside the React Flow `key`, so neighborhood remounts do not drop it.
- **Correctness / data integrity.** Node set, neighborhood locality, and `C-` tally unchanged from round 2 (recomputed above). `focus()` still switches off-map hits to depth `"1"` (`:145-146`) and only `centerNode`s when `visible.has(code)` (`:147-148`); the old early `return` is gone so inspector focus also runs for neighborhood opens — inspector is not inside the remounting canvas. `emphasized: !!relation` includes the selected chip; `.graph-focused` (`app/globals.css:377`) wins on that node so neighbors keep the weaker ring. Live region now includes `Selected {selectedCode}` (`components/course-graph.tsx:162`), so search activation is no longer silent in the status node.
- **Tests.** No skip, todo, mock-out, or deletion this round. Gaps are TL-4 / TL-9, not false greens.
- **Operations.** Rollback is revert of `6273251` (two files). No new runtime, network, or snapshot write. 2px ring + tab stops on visible compact nodes are inside the same 114-node budget.
- **Security.** `document.getElementById("graph-inspector")` is a hardcoded id. No new URL, filesystem, or credential surface. `preventScroll: true` avoids hijacking page scroll.
- **Code health.** Legend swatch `.legend-node.emphasis` (`app/globals.css:395`, `components/course-graph.tsx:156`) matches the new CSS hook. Default-map compact still hides titles; that is unchanged presentation, not a new fork.

## Debate round 3 — response to project_manager

`artifacts/review-project_manager-ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f.md` is still the round-2 PASS of `2fd63b5`. No high findings there. Their mediums against **new** evidence at `6273251` / `6caccf1`:

- **PM-6 (medium, first paint is a subset):** concede; **unchanged** this round. Still not an AC-1 miss (`listedMissing: []`). Restated durable gap remains **TL-9**.
- **PM-7 (medium, map nodes mouse-only / `tabIndex={-1}`):** **rebut — the stated defect is fixed.** `.graph-node-main` no longer sets `tabIndex={-1}` (`components/course-graph.tsx:40`). With `nodesFocusable={false}` (`:193`), xyflow does not put `-1` on the wrapper either (`tabIndex: undefined`), so the native select button is in tab order. `aria-label` now includes `relation` (`:40`). `:focus-within` tooltip (`app/globals.css:386`) can fire. `docs/acceptance-checklist.md:17` still says "keyboard access"; that sentence is less false than at `2fd63b5`. Residual (Details `-1`, culled off-canvas nodes) is **TL-10**, not the F2 high as written.
- **PM-8 (medium, explorer admits externals on any non-empty search):** concede; **unchanged** (`app/courses/page.tsx:38`). Out of this round's two-file diff.
- **PM-11 (medium, empty emphasis rule / dead chain promise):** **rebut — fixed.** `app/globals.css:376` is a real border + ring. Legend documents it (`components/course-graph.tsx:156`). Compact still hides the relation row (`app/globals.css:367-368`), which is why F1 was high; the node chrome is now the channel the footnote at `components/course-graph.tsx:240` (footnote still present) can point at. Edge stroke contrast is still two greys (`:130`); that is hierarchy, not a dead CSS hook.

Round-1/2 agreements stand: PM-2 / PM-3 (intended semantics), PM-4 ≡ TL-5, PM-5 ≡ TL-6, UA-7 / UA-8 deferred via TL-1.

No unrebutted high findings from either seat. I can PASS.

## Not done by this review

- No live browser of `/map`. Emphasis visibility and actual Tab order are DOM/CSS/xyflow reasoning, not a keyboard session.
- No live catalog fetch; fidelity is the committed `data/raw/mscs-sea-program.html`.
- Did not run `ycm-harness review *`; no harness review JSON written.
