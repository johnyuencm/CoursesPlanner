# project_manager review — ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f

Verdict: **PASS** (fix-loop round 2; no high findings)

Goal: Complete MSCS Seattle prerequisite graph vs the official catalog page.
Reviewed state: branch `fix/complete-prereq-graph`, HEAD `2fd63b5`. Round-2 product
diff: `9ecd96e..HEAD` = `51ffb41` (readable map), `6b0961c` (explorer search),
`b26c0a2` (review artifacts), `2fd63b5` (submit). Reviewer is not the implementer.
The only file written by this review is this artifact. Harness status was **not**
treated as proof: ticket is `in_review`, `"checkpoints": {}`, and `evidence` holds
only two `submission-*` records — **no verify run exists**.

This is the independent PM pass after the `user_advocate` FAIL on UA-1 (unreadable
default map). `tech_lead` still has a round-1 artifact at `9ecd96e`; their
high/medium findings are debated below rather than re-litigated as a full re-review.
Same-HEAD artifacts from `spec_reviewer` (PASS) and `uiux` (FAIL, F1/F2 high) are
dispositioned as evidence, not as this seat's score.

## Evidence I ran myself

| Command / check | Result |
| --- | --- |
| `git rev-parse HEAD` | `2fd63b5e1ad7877b7876f25d106aac3186ae280a` |
| `npm test` | **39 pass / 0 fail / 0 skipped / 0 todo** (1246 ms) |
| `npm run typecheck` (`tsc --noEmit`) | exit 0, no output |
| `programMapCodes` / `visibleGraphDistances("program", …)` on published `data/catalog.json` | **114 nodes · 80 links**; `missingFromMap: []` |
| `listedProgramCodes` from `parseProgramRequirements(data/raw/mscs-sea-program.html)` vs `data/catalog.json` requirements | **96 ≡ 96**; `listedNotProgram: []` |
| Spot codes | `CS 5800` ✓ `CS 5100` ✓ `CS 5004` ✓ `CS 1800` absent from snapshot |
| `neighborhoodDistances("CS 5500", …, 1)` | exactly `["CS 5004","CS 5010","CS 5500","CS 6510"]` |
| `programGridDimensions(114, 164, 64)` | **8 cols × 15 rows = 1312 × 960 px** |
| Default viewport occupancy at `zoom: 1`, `x: 28, y: 20` | ~4–5 of 8 columns × ~9 of 15 rows ≈ **45/114** nodes in a 695×580 pane (1366×768); ~72/114 at 1004×760 |
| Unpadded `Fit to view` upper bound | `min(695/1312, 580/960) = 0.530` at 1366×768 |
| Compact code text | `.graph-compact .graph-node-main strong` = `0.95rem` ≈ **15.2 px at zoom 1** (`html` has no font-size; rem is 16px) vs body `14.5px` (`app/globals.css:40`) |
| `CS 6140` published expression | two `minimumGrade: "C-"` course items (`data/catalog.json:1516-1528`) |
| Grade-floor tally on snapshot | `{C-:62, D-:28, C:23, D-:28, D:2, B-:2, C+:1}` — no hyphen-only unknown token |
| Dangling chips on default map | still 4 external rows: `CS 5004`, `CS 3650`, `CY 2550`, `DADS 7275` |
| Explorer keyword spill after `app/courses/page.tsx:38` | `data` → 9 externals, `systems` → 3, `course` → 33, `external` → 27 |
| `TODO`/`FIXME`/`HACK` in changed `.ts`/`.tsx` | none |
| Tests diff `9ecd96e..HEAD -- tests/` | **+8 / −0** (addition, not a relaxation) |
| Live `/map` render | **not done** — `browser_navigate` returned "No browser tab available" |

## Per-criterion map

| # | Acceptance criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `/map` with untouched filters shows every core/breadth/elective course on the official page as a node, incl. `CS 5800` and `CS 5100` | **met** | Default scope is `"program"` (`components/course-graph.tsx:86`) → `visibleGraphDistances` (`:94-97`) → `programMapCodes` (`lib/graph.ts:15-26`) seeded from `listedProgramCodes` (`:5-12`). Recomputed: 114 nodes, all 96 HTML-parsed listed codes present, isolated cores in the first row of the sort (`CS 5010`, `CS 5011`, `CS 5800`, `CS 5100`). Locked by `tests/graph.test.ts:30-41`. Round 2 did not change the node **set**. Read **PM-6**: "as a node" is the map contents, not the first viewport. |
| 2 | Direct externals such as `CS 5004` stay visible; `CS 1800` is not in the published snapshot | **met** | `CS 5004` is a default-map node; `CS 1800` is absent from `data/catalog.json` (grep: no match). Closure at `scraper/parser.ts:492-513`; asserted `tests/scraper.test.ts:128-131` and `tests/graph.test.ts:39-40`. Explorer now also finds `CS 5004` (`app/courses/page.tsx:38`) — extra vs the written AC; see **PM-8**. |
| 3 | `Show` still offers Immediate neighborhood and `CS 5500`'s view stays local | **met** | All four options remain (`components/course-graph.tsx:164-169`). Depth-1 of `CS 5500` recomputed to exactly 4 nodes; `CS 5800` stays out of that set and in program scope (`tests/graph.test.ts:44-53`). `fitView` is scoped to `depth !== "program"` (`:178`), so neighborhood views keep auto-fit. |
| 4 | `C-` parses as `minimumGrade C-`; `npm test` and `npm run typecheck` pass | **met** | Parser at `scraper/parser.ts:63-67`; published `CS 6140` is two `C-` items; new pin `tests/scraper.test.ts:84-91`. This reviewer ran both gates on `2fd63b5`: 39/39 and clean `tsc`. |

## Design alignment

Round 2 stays inside the round-1 shape: one listed-set traversal (`lib/graph.ts`), program scope as default, neighborhood as a separate `Show` value. Layout math moved next to that traversal (`programGridDimensions`, `:108-118`) and is unit-tested (`tests/graph.test.ts:56-61`). `fitView` was narrowed, not deleted. No new dependency, schema, or parallel course list. The explorer filter change (`6b0961c`) is outside the ticket's four criteria (spec_reviewer medium #1); it is a same-complaint fix for UA-4, not a fork of the graph design.

## Goal alignment

Correct target. Round 1 already put every official listed course on the default map (96 ≡ 96, independently reproduced here). Round 2 spends the diff on making that completeness *perceivable* after UA-1, which is the goal's actual promise ("must show every course"), plus a one-page-over reachability fix for `CS 5004` in Course Explorer. Cheaper alternatives exist and were partly taken: the Table view remains the complete legible overview; packing + fixed zoom is ~tens of lines. Not a side-quest.

## Scope honesty

- No test deleted, skipped, or weakened. No mock standing in for graph behavior. No TODO in the product diff.
- Commit messages match the diffs (`51ffb41` packing/zoom/minimap; `6b0961c` explorer search). They do **not** mention `nodesFocusable={false}` or the empty `.graph-emphasized` rule.
- `"checkpoints": {}` — no deferral is named in harness state. UA-7, UA-8, TL-1, and TL-4 live only in committed review artifacts.
- `docs/acceptance-checklist.md:17` still says "Verify zoom, **keyboard access** and long titles" on the map — the instruction round 2 invalidated (PM-7).
- `README.md:12` still advertises "upstream/downstream emphasis" while the default compact canvas has no working emphasis channel (PM-11).

## Findings

### PM-6 (medium) — criterion 1 is met as "on the map", not "on the first screen"; no view is a legible whole-program map at 13″

Default viewport is a hard-coded `zoom: 1` at `{x:28,y:20}` (`components/course-graph.tsx:180-184`). The packed grid is 1312 × 960 px (`lib/graph.ts:108-118` with `PROGRAM_COL=164`, `PROGRAM_ROW=64`). At a 695 × 580 pane that puts **~45 of 114** nodes in view; `onlyRenderVisibleElements` (`:192`) keeps the rest out of the DOM until pan. `Fit to view` can show the whole set at ≤0.53 scale on 1366×768, which is ~8 px code text against a 14.5 px body. The Table view remains the only fully legible complete surface. Copy discloses the trade (`:216`, `:158`). Ranked medium, not high: the written AC says "as a node", and UA-1's 1.6 px codes are gone in the committed geometry. This seat did **not** re-render pixels (see "Not done").

### PM-7 (medium) — the tab-stop fix removes keyboard operation of map nodes, and the repo checklist still asks a verifier to test it

`nodesFocusable={false}` (`components/course-graph.tsx:189`) plus `tabIndex={-1}` on both in-node buttons (`:40`, `:47`) eliminates UA-5's 346 extra tab stops by making every map node unreachable from the keyboard. Search (`:151`), skip link (`:154`), and Table code buttons (`:208`) remain. That is a redesign, not a dead end. It is undeclared: `docs/acceptance-checklist.md:17` still requires "keyboard access" on the map; `51ffb41` does not mention the focus change; no checkpoint records it. `uiux` F2 raises the same facts to **high** on an accessibility bar this ticket did not write into acceptance. I keep **medium**: not an unmet written AC, but hidden incompleteness of the UA-5 "fix" and a trap for the independent verifier.

### PM-8 (medium) — explorer admits every external placeholder on *any* non-empty search, not the code search its heading promises

`app/courses/page.tsx:38` is `requirementType === "external" && !normalized`. Heading (`:63`) promises "Search a **course code** to also find cataloged prerequisites". Measured: keyword `data` → 9 external cards, `systems` → 3, `course` → 33, `external` → 27. Popular-search pills set `search` directly (`:100`). Result `role="status"` (`:83`) can count externals while the rail's eligible/locked counts exclude them (`:54-56`). A code-gated filter would have closed UA-4 without the spill. Out of ticket scope; shipped unverified (no explorer test). Same as spec_reviewer medium #1.

### PM-9 (low) — deferred: UA-7 duplicate `X OR X` text still sits on a default-map node

`data/catalog.json:585-593` and `:617`: `CS 5004` still ORs `CS 5001` with itself (and `CS 5002` with itself). Upstream catalog text, not caused by this branch; the branch improved the old `C` + hyphen-token parse. No checkpoint names the deferral.

### PM-10 (low) — deferred: UA-8 / TL-1 dangling chips and two closure rules are unchanged

Default map still has exactly four external rows whose printed chips have no node/edge (`CS 5004` → `CS 5001/5002/5005`; plus `CS 3650`, `CY 2550`, `DADS 7275`). `scraper/parser.ts:492-507` is **transitive**; `lib/graph.ts:19-24` is **direct**. Round 2 made the 28 transitive-only courses searchable in Explorer; the map inconsistency remains. Low because no official listed course has a dangling chip.

### PM-11 (medium) — round-2 compact default plus an empty emphasis rule makes the page's own chain-emphasis promise false

`emphasized: !!relation` is still computed (`components/course-graph.tsx:101-103`) and the footnote still says "Select a node to emphasize its upstream and downstream chain" (`:240`); `README.md:12` still advertises the same. The CSS hook is empty: `app/globals.css:376` → `.graph-course-node.graph-emphasized { }`. Compact mode (`:103`, default for program scope) also `display:none`s `.graph-node-bottom` (`app/globals.css:367-368`), which was the only place `relation` rendered. Edges shift `#98a2b3`/`1.2` → `#64748b`/`1.8` (`course-graph.tsx:130`) — two mid-greys. This is `uiux` F1; I do not promote it to high because chain emphasis is not a written AC and the inspector still lists prerequisites/unlocks (`:226-231`). It is a round-2 regression of a promised interaction on the surface this ticket just made primary.

## Trade-offs and deferrals (explicit for the finish report)

1. Legible partial default view instead of a complete illegible one (PM-6). Disclosed in-product (`:216`).
2. Map nodes are mouse-only; search / table / skip-link are the keyboard paths (PM-7). **Not disclosed; contradicts `docs/acceptance-checklist.md:17`.**
3. UA-7 duplicate OR text (PM-9) — upstream data, no fix.
4. UA-8 / TL-1 dangling external chips and two closure rules (PM-10) — no fix.
5. TL-4 (nothing caps snapshot size; a refresh can re-inflate with tests green), TL-5 (grade regex boundary), TL-7 (`topologicalRanks` on cycles) — carried; recorded only in the committed tech_lead artifact.
6. Round-1 PM-2 (fresh `/map` Immediate neighborhood is `CS 5010`, not `CS 5500`) and PM-3 (`Full connected component` ⊅ `Entire program`) — carried as intended semantics.
7. Chain emphasis on the compact canvas (PM-11) — copy claims it; CSS does not.

## Risk surface

- **Hint vs viewport (low).** "The map starts at a readable zoom around the selected course" (`:216`) is true only because `CS 5010` sorts to grid index 0. `centerNode` (`:24-35`) runs on search-focus, not on load. Change the default selection or the sort (`:107`) and the sentence is false with no test.
- **Layout heuristic is data-dependent (low).** The committed packing test only asserts `rows >= 8` and `columns <= 12` for n=114 (`tests/graph.test.ts:56-61`).
- **No harness verify yet (process).** Gates I ran are implementer-independent but are *this reviewer's* runs, not a recorded `verify run`.

## User impact

Visible value, not plumbing: default codes go from ~2 px to body-adjacent size; a minimap and an honest count exist; graph search no longer fails silently; `/courses` can find `CS 5004`. Cost: "whole program at a glance" lives in Table / Fit-to-view; map nodes are pointer-only; selecting a node does not visually mark its chain on the default canvas.

## Debate round 2 — response to tech_lead

`artifacts/review-tech_lead-ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f.md` is still the round-1 review of `9ecd96e`. No high findings then; none now. Per their medium/high items:

- **TL-1 (medium, two closures / dangling chips):** concede, still open. Restated as **PM-10**. Round 2 did not touch `scraper/parser.ts:492-507` or `lib/graph.ts:19-24`. Explorer search is a reachability patch, not a closure unification.
- **TL-2 (medium, Focus map here gated on depth 1):** **rebut — fixed.** Gate is now `depth !== "program" && focusCode !== selectedCode` (`components/course-graph.tsx:225`). Depth 2 and `full` regain refocus without forcing neighborhood.
- **TL-3 (low, search selects a course with no node):** **rebut — fixed.** `focus()` branches on `visible.has(code)` and switches to neighborhood when off-map (`:139-148`); the result row discloses it (`:151`).
- **TL-4 (medium, unbounded snapshot):** concede, still open. Guards remain `CS 1800 === false` and a **lower** bound (`tests/graph.test.ts:39-41`). No size cap. Named in the deferral list.
- **TL-5 / TL-6 / TL-7:** agree as written; none are ticket ACs. TL-6 (tracked harness ledgers) is unchanged process debt.

No unrebutted **high** finding from tech_lead. I can PASS with them.

Disposition of parallel same-HEAD seats (not a score of their work): spec_reviewer 4/4 met matches my table. `uiux` F1 maps to PM-11 (medium here). `uiux` F2 maps to PM-7 (medium here). I do not adopt their high bar because those defects are not written acceptance criteria and do not hide an unmet official-page node. `user_advocate` has **not** re-rendered `2fd63b5`; this PASS does not close UA-1.

## Not done by this review

- **No live page.** Browser tools returned "No browser tab available". Readability numbers are layout/CSS arithmetic, not screenshots. UA-1 remains for the `user_advocate` seat to re-check at 1366×768.
- No live fetch of the official catalog; fidelity is only as fresh as `data/raw/mscs-sea-program.html`.
- I did not exercise `Full connected component`, minimap drag, or a mobile viewport.
- No screen reader was run; PM-7 / PM-11 are DOM/CSS reasoning.
