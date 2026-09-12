# tech_lead review — ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f

Verdict: **PASS** (round 2; no high findings)

Goal: Complete MSCS Seattle prerequisite graph vs the official catalog.
Reviewed state: branch `fix/complete-prereq-graph` @ `2fd63b5` (`git diff cc7993e...HEAD`).
Round-2 product diff additionally inspected: `git diff 9ecd96e..HEAD` (`51ffb41` readable map, `6b0961c` explorer search, plus harness/artifact commits).
Reviewer is not the implementer. No product file was modified by this review; the only file written is this artifact.

This round is the fix loop after the `user_advocate` FAIL on UA-1 (unreadable default map). Round-1 findings are retained and re-checked; TL-8 and TL-9 are new. I did **not** live-render `/map`; UA-1 remains UA's re-score.

## Evidence I ran myself (round 2)

| Command / check | Result |
| --- | --- |
| `npm test` on `2fd63b5` | **39 pass / 0 fail / 0 skipped / 0 todo** (1313 ms) |
| `npm run typecheck` (`tsc --noEmit`) | clean, exit 0 |
| Recompute `programMapCodes` / `visibleGraphDistances("program", …)` on published `data/catalog.json` | **114 nodes · 80 edges**; listed set **96 ≡ 96**; `listedMissing: []` |
| Spot codes | `CS 5800` ✓ `CS 5100` ✓ `CS 5004` ✓ `CS 1800` ✗ (absent from 142-course snapshot) |
| `visibleGraphDistances("1", "CS 5500", …)` | exactly `["CS 5004","CS 5010","CS 5500","CS 6510"]` |
| `programGridDimensions(114, 164, 64)` | **8 × 15**; default sort index 0 is `CS 5010` |
| Default-viewport occupancy at `zoom: 1`, `x: 28, y: 20` | 45/114 at 695×580 (1366), 72/114 at 1004×760, 84/114 at 1134×760 |
| Grade-floor tally on published snapshot | `{D-:28, C-:62, B-:2, D:2, C:23, C+:1}`; **hyphen-unknown tokens: 0** |
| Explorer filter `app/courses/page.tsx:38` vs keyword haystack | externals admitted: `data` 9, `systems` 3, `course` 33, `external` 27; `CS 5004` findable; `CS 1800` 0 |
| `git diff cc7993e...HEAD --numstat -- tests/` | `61/0` + `29/0`; **zero deletions**; no `.skip` / `todo` |
| Parser this round | `git diff --numstat 9ecd96e..HEAD` has no `scraper/parser.ts` |

## Acceptance criteria

1. **met (node set).** Default scope is still `program` (`components/course-graph.tsx:86`) → `visibleGraphDistances` → `programMapCodes` (`lib/graph.ts:94-105`, `:15-26`). All 96 listed codes are nodes, including isolated `CS 5800` / `CS 5100`. Locked by `tests/graph.test.ts:31-40`. Round 2 did not change membership; it changed packing, zoom, chrome, and DOM culling (`onlyRenderVisibleElements` at `:192`). See debate on PM-6: first paint is a subset.
2. **met.** `CS 5004` is a default-map node; `CS 1800` is absent (`scraper/parser.ts:492-513`, `tests/scraper.test.ts:128-137`). Explorer now finds `CS 5004`; that fix overshoots (PM-8 / debate).
3. **met.** All four Show options remain (`components/course-graph.tsx:164-169`). Depth-1 of `CS 5500` is the local 4-node set; program scope independently keeps isolated cores (`tests/graph.test.ts:43-52`). `fitView` is scoped to `depth !== "program"` (`:178`), so neighborhood views keep the old fit behavior.
4. **met.** No parser change this round; `scraper/parser.ts:63-67` still accepts a trailing minus and publishes `C-`. Gates: 39/39 and clean `tsc`. New packing test is an addition, not a relaxation (`tests/graph.test.ts:56-61`).

## Disposition of round-1 tech_lead findings

- **TL-1 (medium) — open.** Direct vs transitive closure still disagrees by 28 courses. Default-map dangling chips still exactly four external rows (`CS 5004`, `CS 3650`, `CY 2550`, `DADS 7275`). Unchanged this round.
- **TL-2 (medium) — fixed.** Refocus is now `depth !== "program" && focusCode !== selectedCode` (`components/course-graph.tsx:225`), so depth 2 and full regain "Focus map here".
- **TL-3 (low) — fixed.** `focus()` branches on `visible.has(code)` and switches off-map hits to neighborhood (`:139-148`); the result row discloses it (`:151`).
- **TL-4 (medium) — open.** Snapshot still has no upper bound; `CS 1800 === false` remains incidental. Unchanged.
- **TL-5 (low) — open.** Grade regex still unanchored. Unchanged.
- **TL-6 (low) — open.** `.ycm-harness/state.json` and `events.jsonl` remain tracked; round 2 commits more ledger noise (`2/0` events, `29/4` state).
- **TL-7 (low) — open.** `topologicalRanks` still returns `0` on cycle revisit without memoizing (`lib/graph.ts:82`). Program scope now **ignores ranks for layout** (alphabetical grid at `components/course-graph.tsx:107-109`) and only uses the Map as a node set, so live impact on the default view is even lower. Neighborhood layout is unchanged.

## Findings (round 2)

### TL-1 (medium, carried) — two competing program closures; default-map chips without nodes

`scraper/parser.ts:494-507` keeps the **transitive** listed-set closure (142 published courses). `lib/graph.ts:19-24` admits only **direct** dependencies (114 default-map nodes). The 28-course gap is the same set as round 1 (`CS 5001`, `CS 5002`, `CS 5005`, `CS 2500`, `MATH 3081`, …). `CS 5004` still prints `prerequisiteCodes` / `corequisiteCodes` the edge filter drops (`visible.has(source) && visible.has(target)` at `components/course-graph.tsx:128`). Same shape as the ticket, confined to the external fringe.

### TL-4 (medium, carried) — nothing bounds the snapshot against re-inflating

The `while (growing)` loop is unchanged. Guards remain `CS 1800 === false` and `visible.size >= core + 20`. A refresh that adds one edge into the undergraduate core still re-inflates with tests green.

### TL-8 (medium, new) — compact default mode makes advertised chain emphasis a no-op on nodes

Round 2 sets `compact: depth === "program"` (`components/course-graph.tsx:103`) and hides `.graph-node-title` / `.graph-node-bottom` (`app/globals.css:367-368`). `.graph-node-bottom` was the only place `relation` ("Upstream prerequisite" / "Downstream connection") rendered (`components/course-graph.tsx:46`). `.graph-course-node.graph-emphasized` is still an **empty rule** (`app/globals.css:376`); that emptiness is pre-existing, but compact newly removes the remaining node-level channel on the default surface. What remains is a 0.6px / mid-grey edge stroke (`:130`) plus a focused ring on the clicked node (`:377`). The footnote still promises "Select a node to emphasize its upstream and downstream chain" (`:240`). Inspector lists still work, so this is not data loss — it is a dead advertised interaction introduced by the UA-1 packing/compact change. Neighborhood scopes are unaffected (`compact` is false there).

### TL-9 (medium, new) — the UA-1 viewport contract is untested; packing test asserts the wrong layer

The readability fix is `fitView={depth !== "program"}` plus a hard `zoom: 1` viewport (`components/course-graph.tsx:178-184`). The only new test (`tests/graph.test.ts:56-61`) calls `programGridDimensions(114, 164, 64)` and checks `rows >= 8` / `columns <= 12`. Re-enabling `fitView` on program scope, or dropping `defaultViewport` / `onInit`, would restore the UA-1 crush and every test would still pass, packing included. `onlyRenderVisibleElements` (`:192`) is also unasserted; a DOM node-count of 45–84 is now the expected first paint, not a regression, and nothing in-repo documents that for a later verifier.

## Areas inspected and found clean (round-2 delta)

- **Architecture.** `programGridDimensions` lives next to traversal in `lib/graph.ts:108-118`. One node-set source of truth is unchanged. `fitView` was narrowed, not removed. Explorer search is a one-line predicate change, not a second catalog. No new dependency or schema.
- **Correctness / data integrity.** 0 dangling relation *endpoints* in the snapshot; 96 ≡ 96 listed; neighborhood locality unchanged; `C-` tally unchanged and hyphen-unknown still 0. `focus()` off-map remounts via `key={`${focusCode}-${depth}`}` (`:174`) with `fitView` on, so the skipped `centerNode` in the `!onMap` branch (`:144-146`) is not a lost camera update. On-map search keeps the `program` key and pans via `centerNode` (`:24-35`).
- **Tests.** Additions only this round (`8/0` on `tests/graph.test.ts`). Nothing skipped, disabled, mocked, or loosened. Gaps are TL-4 / TL-9, not false greens.
- **Operations.** Rollback is still revert + snapshot regenerate. 114 compact nodes + MiniMap is inside budget. `minZoom={0.15}` (`:185`) still lets a user crush the view on purpose; default no longer does it for them.
- **Security.** No new network, filesystem, credential, or URL surface. Explorer now *displays* more placeholder rows; Add-to-plan on those cards is pre-existing `CourseCard` behavior (`components/course-card.tsx:46`) and the picker already warns. Credit audit still excludes externals (existing test remains green).
- **Code health.** Grid math is unit-testable. Default nodeWidth/nodeHeight in `programGridDimensions` (`176`, `92`) do not match the call site (`164`, `64`); only one caller, so not a defect, just a footgun.

## Debate round 2 — response to project_manager

Their round-2 artifact is a PASS with medium PM-6, PM-7, PM-8. I independently reproduced their occupancy (45 / 72 / 84), packing (8×15), fit scale (~0.530 at 695×580), keyword-spill counts, and gate runs (39/39, clean `tsc`). No unrebutted high from either seat.

- **PM-6 (medium, first paint is a subset):** concede the geometry; **rebut as an AC-1 miss.** Criterion 1 is default-filter membership of every official core/breadth/elective as a **node**, which still holds (`listedMissing: []`, tests at `tests/graph.test.ts:31-40`). `onlyRenderVisibleElements` (`components/course-graph.tsx:192`) plus `zoom: 1` (`:180-184`) means first paint is 45–84 nodes by design; the hint at `:216` and the count live region at `:158` disclose the rest. I will not fail the ticket on viewport occupancy. I restated the durable part as **TL-9**: nothing locks the zoom/`fitView` contract, so UA-1 can return with tests green.

- **PM-7 (medium, map nodes are mouse-only; checklist stale):** **concede.** `nodesFocusable={false}` (`:189`) plus `tabIndex={-1}` on both node buttons (`:40`, `:47`) removes keyboard operation of the canvas. Search (`:151`), skip link (`:155`), and Table (`:208`) remain. `docs/acceptance-checklist.md:17` still says "Verify zoom, keyboard access and long titles" and compact mode additionally hides long titles (`app/globals.css:367`). I do **not** elevate to high: this is not data loss, a security hole, or a false-green test. UIUX F2 is the a11y-bar high; this seat's high bar is not met.

- **PM-8 (medium, any non-empty search admits externals):** **concede**, with one extra file:line. `app/courses/page.tsx:38` is `external && !normalized`, while `:63` promises a **course-code** search. Independent haystack counts match theirs (`course` → 33 externals because titles are "External course (…)"). `CourseCard` still offers Add to Plan for those rows (`components/course-card.tsx:46`) even though the graph inspector hides it (`components/course-graph.tsx:234`). No explorer test covers `looksLikeCode` / the new branch. Not high: picker already allowed externals with a warning, and degree credit still does not count them.

Round-1 agreements stand: PM-2 / PM-3 (intended semantics), PM-4 ≡ TL-5, PM-5 ≡ TL-6. UA-7 duplicate OR text and UA-8 dangling chips remain deferred (TL-1).

No unrebutted high findings. I can PASS.

## Not done by this review

- No live browser of `/map`. Readability numbers are recomputed from committed layout constants and CSS (`8×15`, `zoom: 1`, `0.95rem` code). UA-1 is not closed by this seat.
- No live catalog fetch; fidelity is the committed `data/raw/mscs-sea-program.html`.
- No screen reader session; PM-7 / TL-8 are DOM/CSS reasoning.
- Did not run `ycm-harness review *`; no harness review JSON written.
