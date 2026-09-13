# project_manager review — ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f

Verdict: **PASS** (fix-loop round 3 of 3; no high findings)

Goal: Complete MSCS Seattle prerequisite graph vs the official catalog page.
Reviewed state: branch `fix/complete-prereq-graph`, HEAD `6caccf1` (submit). Latest
product: `6273251` (`git diff 2fd63b5..6273251` = 2 files, +11/−7). Reviewer is not
the implementer. The only file written by this review is this artifact. Harness
status was **not** treated as proof: ticket is `in_review`, `"checkpoints": {}`,
and `evidence` holds three `submission-*` records — **no verify run exists**.

This is the independent PM pass after the `uiux` FAIL on F1 (empty
`.graph-emphasized`) and F2 (keyboard opt-out of map nodes). `tech_lead` still
has a round-2 artifact at `2fd63b5`; their high/medium findings are debated
below. Same-HEAD-as-round-2 artifacts from `spec_reviewer` (PASS) and
`user_advocate` (PASS, UA-1 closed live) are not re-scored; round 3 did not
change the node set.

## Evidence I ran myself

| Command / check | Result |
| --- | --- |
| `git rev-parse HEAD` | `6caccf16eea121ad721bf38a0df6fcdd8e61c0a3` |
| `git merge-base --is-ancestor 6273251 HEAD` | yes |
| `git diff --numstat 2fd63b5..6273251` | `app/globals.css` 1/1; `components/course-graph.tsx` 10/6; **tests untouched** |
| `npm test` | **39 pass / 0 fail / 0 skipped / 0 todo** (1248 ms) |
| `npm run typecheck` (`tsc --noEmit`) | exit 0 |
| `programMapCodes` / `visibleGraphDistances("program", …)` on published `data/catalog.json` | **114 nodes · 80 links**; `listedNotMap: []` |
| `listedProgramCodes` from `parseProgramRequirements(data/raw/mscs-sea-program.html)` vs `data/catalog.json` | **96 ≡ 96**; both set-differences empty |
| Spot codes | `CS 5800` ✓ `CS 5100` ✓ `CS 5004` ✓ `CS 1800` absent from snapshot |
| `neighborhoodDistances("CS 5500", …, 1)` | exactly `["CS 5004","CS 5010","CS 5500","CS 6510"]` |
| `programGridDimensions(114, 164, 64)` | **8 cols × 15 rows** (unchanged) |
| Grade-floor tally on snapshot | `{C-:62, D-:28, C:23, B-:2, D:2, C+:1}`; hyphen-unknown `0` |
| Dangling chips on default map | still 4 external rows: `CS 5004`, `CS 3650`, `CY 2550`, `DADS 7275` |
| Explorer keyword spill (`app/courses/page.tsx:38`) | `data` 9, `systems` 3, `course` 33, `external` 27; `CS 5004` 2; `CS 1800` 0 |
| `.graph-emphasized` | **non-empty**: `border-color: #4b6cb3; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.28)` (`app/globals.css:376`) |
| Main node button `tabIndex` | **removed** (`components/course-graph.tsx:40`); Details still `tabIndex={-1}` (`:47`); `nodesFocusable={false}` remains (`:193`) |
| `TODO`/`FIXME`/`HACK` in `lib/` `components/` `scraper/` `.ts`/`.tsx` | none |
| Tests diff `2fd63b5..6273251 -- tests/` | **empty** (no deletion, no addition) |
| Live `/map` keyboard/visual pass | **not done** |

## Per-criterion map

| # | Acceptance criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `/map` with untouched filters shows every core/breadth/elective course on the official page as a node, incl. `CS 5800` and `CS 5100` | **met** | Default scope is `"program"` (`components/course-graph.tsx:87`) → `visibleGraphDistances` (`:95-98`) → `programMapCodes` (`lib/graph.ts:15-26`) seeded from `listedProgramCodes` (`:5-12`). Recomputed on published snapshot: 114 nodes, all 96 HTML-parsed listed codes present. Locked by `tests/graph.test.ts:30-41`. Round 3 did not change membership, packing, or default zoom. Read **PM-6**: "as a node" is the map contents, not the first viewport. |
| 2 | Direct externals such as `CS 5004` stay visible; `CS 1800` is not in the published snapshot | **met** | `CS 5004` is a default-map node; `"code": "CS 1800"` has no match in `data/catalog.json`. Closure at `scraper/parser.ts:492-513`; asserted `tests/scraper.test.ts:128-131` and `tests/graph.test.ts:39-40`. Explorer still finds `CS 5004` (`app/courses/page.tsx:38`) — extra vs the written AC; see **PM-8**. |
| 3 | `Show` still offers Immediate neighborhood and `CS 5500`'s view stays local | **met** | All four options remain (`components/course-graph.tsx:167-173`). Depth-1 of `CS 5500` recomputed to exactly 4 nodes; `CS 5800` stays out of that set (`tests/graph.test.ts:44-53`). `fitView` is still scoped to `depth !== "program"` (`:182`). |
| 4 | `C-` parses as `minimumGrade C-`; `npm test` and `npm run typecheck` pass | **met** | Parser at `scraper/parser.ts:63-67`; published `CS 6140` is two `C-` items (`data/catalog.json:1516-1528`). This reviewer ran both gates on `6caccf1`: 39/39 and clean `tsc`. |

## Design alignment

Round 3 stays inside the listed-set + program-default + neighborhood-`Show` shape. The diff only fills the emphasis CSS hook, restores the in-node Select control to the tab order, announces selection in the live region, moves search focus onto the inspector, and adds a legend swatch. No new dependency, schema, traversal, or parallel course list. No design.md / implementation-plan.md / prd.md exists under the goal directory.

## Goal alignment

Correct target. Completeness of the official listed set was already landed in round 1 and made perceivable in round 2. Round 3 spends the last fix loop on the two `uiux` highs that made the primary surface's advertised chain-emphasis and keyboard selection false. That is the goal's remaining user-facing honesty, not a side-quest. Cheaper alternatives (leave F1/F2 as named deferrals) were not taken; the chosen patch is two files.

## Scope honesty

- No test deleted, skipped, or weakened. Round 3 also added **no** test for the CSS ring or the restored tab stop (**PM-12**).
- No mock standing in for graph behavior. No TODO in the product diff.
- Commit `6273251` matches the diff (emphasis + keyboard). It does **not** mention that `nodesFocusable={false}` and `onlyRenderVisibleElements` remain, or that Details stays `tabIndex={-1}`.
- `"checkpoints": {}` — no deferral is named in harness state. Remaining items live only in review artifacts (this file included).
- `docs/acceptance-checklist.md:17` still asks a verifier to check "keyboard access **and long titles**"; compact mode still `display:none`s `.graph-node-title` (`app/globals.css:367-368`).

## Findings

### PM-6 (medium, carried) — criterion 1 is met as "on the map", not "on the first screen"

Unchanged this round. Default viewport is still hard-coded `zoom: 1` at `{x:28,y:20}` (`components/course-graph.tsx:184-188`). Packed grid is still 8×15 at 164×64 (`lib/graph.ts:108-118`). `onlyRenderVisibleElements` (`:196`) still keeps off-pane nodes out of the DOM. Table / Fit-to-view remain the complete-overview surfaces. Copy still discloses the trade (`:220`). Not high: the written AC says "as a node".

### PM-7 (closed this round) — map-node Select is back in the tab order

Round 2's `tabIndex={-1}` on `.graph-node-main` is gone (`components/course-graph.tsx:40`). Native `<button>` is focusable; `:focus-within` can show the tooltip (`app/globals.css:386`); `aria-label` now includes `relation` (`:40`). Search activation focuses `#graph-inspector` (`:150-152`, `:222`) and the live region names the selected code (`:162`). Residual limits are **PM-13**, not a leftover F2 high.

### PM-8 (medium, carried) — explorer admits every external placeholder on *any* non-empty search

Unchanged. `app/courses/page.tsx:38` is still `requirementType === "external" && !normalized`. Heading (`:63`) still promises a **course-code** search. Recomputed spill matches round 2. Out of ticket scope; still unverified (no explorer test).

### PM-9 (low, carried) — deferred: UA-7 duplicate `X OR X` text

`data/catalog.json:585-593` (`CS 5004` ORs `CS 5001` with itself; same for `CS 5002`). Upstream catalog text. No checkpoint names it.

### PM-10 (low, carried) — deferred: UA-8 / TL-1 dangling chips and two closure rules

Default map still has exactly four external rows whose printed chips have no node/edge. `scraper/parser.ts:492-507` is **transitive**; `lib/graph.ts:19-24` is **direct**. Low because no official listed course has a dangling chip.

### PM-11 (closed this round) — empty emphasis rule is filled; compact chain is a ring

`app/globals.css:376` is no longer `{}`. Compact still hides `.graph-node-bottom` (`:368`), so the relation **word** is not on the chip; the ring, legend swatch (`components/course-graph.tsx:156`, `app/globals.css:395`), tooltip (`:51`), and inspector lists (`:230-235`) are the channels. Selected node also has `.graph-focused` (`:377`), which wins on the clicked chip (`#2563eb` / 3px vs chain `#4b6cb3` / 2px). Footnote still promises the interaction (`:244`); README.md:12 still advertises it. Residual contrast/hierarchy is uiux F4, not an empty hook.

### PM-12 (medium, new) — round-3 visual/keyboard contract is untested, same class as TL-9

`6273251` adds zero tests. Emptying `.graph-emphasized` again, or restoring `tabIndex={-1}` on `.graph-node-main`, would revive F1/F2 with `npm test` green. Packing test still only asserts `rows >= 8` / `columns <= 12` (`tests/graph.test.ts:56-61`). Not high: not an unmet written AC.

### PM-13 (low, new) — off-canvas nodes stay search-only; Details stays pointer-only

`nodesFocusable={false}` (`components/course-graph.tsx:193`) still disables React Flow's own Tab/Enter node cycle (JSDoc: tab between nodes + Enter to select). Combined with `onlyRenderVisibleElements` (`:196`), nodes not in the current pane are not in the DOM and cannot be tabbed to. Details remains `tabIndex={-1}` (`:47`) and is hidden in compact mode anyway. Search, skip link (`:159`), Table (`:212`), and inspector "Full course details" (`:239`) remain. Named so the last-round keyboard claim is not over-read as "all 114 chips are tab stops".

## Trade-offs and deferrals (explicit for the finish report)

1. Legible partial default view instead of a complete illegible one (PM-6). Disclosed in-product (`:220`).
2. Keyboard Select on **rendered** nodes; off-canvas chips and in-node Details are not tab stops (PM-13). Search / inspector / Table are the jump paths. **Partially disclosed** by the React Flow `aria-label` (`:199`); checklist `:17` still also asks for long titles, which compact hides.
3. UA-7 duplicate OR text (PM-9) — upstream data, no fix.
4. UA-8 / TL-1 dangling external chips and two closure rules (PM-10) — no fix.
5. TL-4 (nothing caps snapshot size; a refresh can re-inflate with tests green), TL-5 (grade regex boundary), TL-7 (`topologicalRanks` on cycles) — carried; recorded only in the committed tech_lead artifact.
6. Round-1 PM-2 (fresh `/map` Immediate neighborhood is `CS 5010`, not `CS 5500`) and PM-3 (`Full connected component` ⊅ `Entire program`) — carried as intended semantics.
7. Explorer keyword spill (PM-8) — extra vs AC; still ships.
8. Chain emphasis is a compact ring + tooltip + legend, not on-chip relation text (PM-11 closed as empty-CSS; remaining encoding is uiux F4/F5/F7).
9. Viewport, emphasis, and keyboard contracts are untested (TL-9 / PM-12).
10. No harness `verify run` and empty `checkpoints` — process, not product.

## Risk surface

- **Hint vs viewport (low).** Unchanged: the "readable zoom around the selected course" sentence (`:220`) is true because `CS 5010` sorts to grid index 0. `centerNode` on load is still not called.
- **Regression of F1/F2 with tests green (medium process).** PM-12.
- **No harness verify yet (process).** Gates I ran are implementer-independent but are *this reviewer's* runs, not a recorded `verify run`.

## User impact

Visible value: selecting a course now paints a ring on its chain on the compact default map, and a keyboard user can Select a node that is actually in the pane (and hear which course is selected after search). Cost unchanged from round 2: whole-program glance lives in Table / Fit-to-view; explorer search still over-admits externals.

## Debate round 3 — response to tech_lead

`artifacts/review-tech_lead-ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f.md` is still the round-2 review of `2fd63b5`. No high findings then. Per their medium items against `6273251`:

- **TL-1 (medium, two closures / dangling chips):** concede, still open. Restated as **PM-10**. Round 3 did not touch `scraper/parser.ts` or `lib/graph.ts`.
- **TL-4 (medium, unbounded snapshot):** concede, still open. Guards remain `CS 1800 === false` and a **lower** bound (`tests/graph.test.ts:39-41`). Named in the deferral list.
- **TL-8 (medium, empty emphasis on compact default):** **rebut — fixed in product.** `app/globals.css:376` now sets border + ring; legend includes "Linked to selected" (`components/course-graph.tsx:156`); tooltip carries `relation` (`:51`). Compact still hides the relation row; that is no longer a no-op hook. Residual encoding is not TL-8.
- **TL-9 (medium, viewport contract untested):** concede, still open, and **widened** as **PM-12** (emphasis CSS and restored tab stop are also untested).
- **PM-6:** prior agreement stands (geometry conceded; not an AC-1 miss).
- **PM-7:** prior concession is **stale**. Inner Select is focusable. I do not put a new high on the remaining `nodesFocusable={false}` wrapper flag.
- **PM-8:** concede, still open.

No unrebutted **high** finding from tech_lead's last written artifact. I can PASS with them. If a round-3 tech_lead artifact lands later with new highs, this seat has not seen it.

Disposition of parallel seats (not a score of their work): spec_reviewer 4/4 met still matches my table (node set unchanged). `uiux` F1 maps to closed PM-11. `uiux` F2 maps to closed PM-7 plus residual PM-13. I do not adopt a leftover high: the written ACs are met, and the two review-blocking interaction lies from round 2 are contradicted by committed CSS/DOM. `user_advocate` closed UA-1 live at `2fd63b5`; round 3 did not change zoom.

## Not done by this review

- **No live page.** No keyboard Tab pass, no screenshot of the emphasis ring, no screen reader. F1/F2 closure is source-level (non-empty CSS, restored button tabIndex, `:focus-within` now reachable). `uiux` should re-score pixels if they require a live pass.
- No live fetch of the official catalog; fidelity is only as fresh as `data/raw/mscs-sea-program.html`.
- I did not exercise `Full connected component`, minimap drag, or a mobile viewport.
- Did not run `ycm-harness review *`; no harness review JSON written.
