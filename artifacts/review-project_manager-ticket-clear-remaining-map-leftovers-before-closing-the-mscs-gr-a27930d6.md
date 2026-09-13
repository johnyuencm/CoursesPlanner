# project_manager review — ticket-clear-remaining-map-leftovers-before-closing-the-mscs-gr-a27930d6

Verdict: **PASS** (phase 1 round 1; no high findings)

Goal: Complete MSCS Seattle prerequisite graph (still **active**). This ticket is
the bounded leftover batch: compact eligible-pill clipping, course-details
dialog stealing Ctrl+F, and Escape not clearing map find after a canvas click —
plus the post-fix rule that Escape must not steal from header catalog search or
the Show depth select. Reviewer is **not** the implementer (`d085fad0`). Product
commits in range: `9592f85`, `1a2f19b`, `786c360`, `c528140`, `e06810a`. The
only file written by this review is this artifact. Do **not** complete
`goal_complete-mscs-seattle-prerequisite-graph_5f65` from this pass. MiniMap,
merge to main, and parent-goal close are **out of this ticket** and were **not**
silently marked done.

No `design.md` / `implementation-plan.md` / `prd.md` under the goal directory.
Acceptance is the ticket text plus the stated TL-1 follow-through on AC3.
On-disk `artifacts/review-tech_lead-…a27930d6.md` is for prior HEAD `c528140`
and is **not** this round’s debate partner.

## Evidence I inspected

| Check | Result |
| --- | --- |
| Branch / HEAD | `fix/complete-prereq-graph` @ `e06810a` (`e06810ae4b456bf1c82b9bdc041f7223decbc9dd`) |
| Range | `git diff 9c4e5a1..HEAD` → 5 files, **+140 / −4**. No test deleted. Latest commit `e06810a` scopes Escape to map find chrome / canvas / panel, excluding form controls. |
| Ticket status | harness `in_progress`; `code_changed: true`. Status is not treated as proof. No harness verify evidence key for this ticket yet. |
| `TODO`/`FIXME` in this diff | none |
| MiniMap | still absent. Not this ticket. |
| `npm test` (this review) | **61 pass / 0 fail / 0 skipped / 0 todo**, ~1.08 s, exit 0 |
| `npm run typecheck` (this review) | **exit 0** (`tsc --noEmit`) |
| Live `/map` | **not clicked in this review.** Source, CSS, helper tests, and this review’s `npm test` / typecheck are the proof used. |

## Per-criterion map

| # | Acceptance criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Compact graph course cards show eligible status in full with no CSS ellipsis clipping. Inspector may keep long wording. Short "Eligible" on compact is OK | **met** | Compact nodes always set `compact: true` (`components/course-graph.tsx:180`). Card pill uses `compactGraphStatusLabel` (`:74`). Helper maps exact `"Prerequisite eligible"` → `"Eligible"` and leaves other statuses (`lib/graph.ts:416-418`; `tests/graph.test.ts:357-361`). Source label is `"Prerequisite eligible"` (`components/course-card.tsx:26`) via `graphStatus` → `courseStatus` (`course-graph.tsx:113-115`). CSS clipping rule removed: `.graph-node-meta .status-pill` is `flex: 0 0 auto; white-space: nowrap` with **no** `max-width: 58%` / `overflow: hidden` / `text-overflow: ellipsis` (`app/globals.css:385`). Remaining ellipsis rules are titles/nav, not this pill (`globals.css:244,448,462,501,537,628`). Inspector keeps the long label (`course-graph.tsx:458`); legend still says `Prerequisite eligible` (`:385`). Compact card width 196px (`globals.css:374`) is enough for "Eligible" without ellipsis. |
| 2 | Map Ctrl+F skipped while a native course-details dialog is open (closest `dialog` or `role=dialog`). Modal is discoverable as a dialog to that skip | **met** | Capture-phase window listener returns before preventDefault when `isGraphFindSkipTarget(target)` (`course-graph.tsx:247-250,271`). Helper is `element.closest("dialog, [role='dialog']")` (`lib/graph.ts:384-387`). Native dialog (no role) locked by `tests/graph.test.ts:313-318`. `role=dialog` ancestor locked by `:321-323`. Course details render `Modal` (`components/course-dialogs.tsx:23,28`; mounted from `components/app-shell.tsx:86`). `Modal` is a native `<dialog>` **and** has `role="dialog"` (`components/ui.tsx:20`) opened with `showModal()` (`:17`). Both skip selectors match. |
| 3 | Escape clears graph find when it has text even if canvas focused; Escape inside dialog not stolen; after TL-1 also must not steal from header search / Show select | **met** | Stale-closure avoided via `searchRef` (`course-graph.tsx:128-129`). Capture listener calls `shouldClearGraphFindOnEscape` then `preventDefault` + `setSearch("")` (`:259-263`). Helper: Escape + trimmed query + **not** skip target + **in** find-escape scope (`lib/graph.ts:405-413`). Scope is `.graph-search-wrap` / `#graph-find` / `.flow-canvas`, else **not** `input`/`select`/`textarea`/`option`, else `.graph-panel` (`:396-402`). Canvas-focused clear: `tests/graph.test.ts:326-331`. Dialog not stolen: `:334-336` and early skip return (`course-graph.tsx:250`) so the window handler does not `preventDefault` Escape inside a dialog. Native `Modal` still closes via `onCancel` (`components/ui.tsx:20`). Header catalog search (`app-shell.tsx:57`, `type="search"`) is an `input` outside skip/scope → helper false (`tests/graph.test.ts:339-342`). Show depth `<select>` (`course-graph.tsx:401-407`) is `select` even though it sits in `.graph-panel` → helper false (`tests/graph.test.ts:345-347`). Find field and panel chrome still clear (`:350-354`). Find-input Escape blur path remains (`course-graph.tsx:341-345`). |
| 4 | `npm test` (61) and `npm run typecheck` both exit 0 | **met** | This review: `tsx --test tests/*.test.ts` → tests **61** / pass **61** / fail 0 / skipped 0 / todo 0; `tsc --noEmit` exit 0. |

## Design alignment

Matches the named leftovers; does not fork them. Prior Ctrl+F skip was
`closest("[role='dialog']")` only, which missed native `<dialog>` without an
explicit role. This slice adds the `dialog` selector **and** puts
`role="dialog"` on `Modal`. Compact eligible clip is fixed by shortening the
compact label (ticket-allowed) **and** removing the ellipsis CSS, not by
growing cards past `PROGRAM_ROW`. Inspector wording is unchanged.

`e06810a` narrows Escape `preventDefault` so header search and Show select keep
their native Escape actions while canvas / find UI still clear. That is the
agreed TL-1 follow-through, not a silent product fork. No catalog, layout, or
find-ranking rewrite.

## Goal alignment

Correct next slice, not a side-quest. Parent goal is a usable official MSCS
Seattle map; clipped "Eligi…" pills and find keys stolen by the course-details
drawer (then by page chrome) were the named leftovers after coreq seating.
Cheaper alternatives (leave ellipsis, tell users to click the find field,
document the Ctrl+F dead-zone, leave Escape over-broad) were **not** taken.
MiniMap, merge, and closing the parent goal remain **later work**. **This
ticket is not that job.**

## Scope honesty

- No product TODO standing in for a met criterion. No test skipped, deleted, or
  weakened. Eight helper tests in this range (`tests/graph.test.ts:313-361`);
  three of them (`:339-354`) were added in `e06810a` for the TL-1 chrome cases.
- Wiring is in the same range: CourseNode compact label, capture skip, Escape
  clear, Modal `role="dialog"`, CSS ellipsis removal, Escape scope helper.
  Helpers are not dead: `course-graph.tsx:8-16,74,250,259`.
- Gold-plating: `role="dialog"` on a native `<dialog>` is redundant with the
  `dialog` selector but is the written "discoverable" requirement. Tagging
  `select`/`input` out of Escape-clear is the required TL-1 fix, not extra
  surface.
- Find still intercepts Ctrl+F on `/map` when no dialog is open (prior ticket).
  Table view still shows the long status string (`course-graph.tsx:446`).
- Harness ticket remains `in_progress`; this review does not treat that as
  submitted/verified.

## Trade-offs (named)

1. Compact eligible copy is **Eligible**, not the inspector’s
   **Prerequisite eligible**. Ticket-allowed.
2. Ellipsis CSS removed; `white-space: nowrap` kept. "Needs review" can still
   overflow a 196px card instead of clipping. Out of AC (eligible only).
3. Escape-to-clear is window capture-phase, but only when
   `isGraphFindEscapeScope` is true. Dialogs, header search, Show select, and
   other `input`/`select`/`textarea` (e.g. Career Target) are excluded.
   Map/Table segmented buttons inside `.graph-panel` still clear find.
   Inspector (`aside.graph-inspector`) is outside `.graph-panel` / `.flow-canvas`,
   so Escape there does not clear find. Canvas AC still holds.
4. Tests lock helpers + FakeElement `closest`, not a React/browser keydown or
   computed pill overflow.
5. Parent MSCS graph goal left active. MiniMap / merge not in this diff.

## Risk surface

- Capture-phase Ctrl+F/F3 still run on `/map` only (listener unmounts with
  GraphWorkspace). Other routes keep browser find. Header search Ctrl+F on
  `/map` still focuses graph find (prior ticket, not this AC).
- If a future overlay is neither `dialog` nor `[role=dialog]`, skip will fail
  again. Course-details `Modal` is both.
- `elementWithClosest` ignores targets without `closest` (e.g. `document`);
  `isGraphFindEscapeScope` then treats them as in-scope (`lib/graph.ts:397-398`).
  Canvas clicks land on pane/node elements that have `closest`. Residual.
- Show select exclusion depends on `tagName === "select"` **before** the
  `.graph-panel` fallback (`lib/graph.ts:400-402`). Order is load-bearing and
  tested.
- Live pixel proof of "Eligible" unclipped was **not** collected in this
  review. CSS + short label make clipping of that word implausible at 196px.

## Findings

None high or medium.

- **PM-1 (low)** — New tests assert helpers (`tests/graph.test.ts:313-361`), not
  the capture listener (`components/course-graph.tsx:247-272`) or computed
  pill overflow. Wiring is in the same diff; AC is still met from source + this
  review’s `npm test` 61/61 and clean typecheck. Independent live `/map` click
  was not done here.

## Debate round 1

Independent first pass on **new HEAD `e06810a`**. Did not treat the stale
`c528140` tech_lead artifact as a debate partner. The TL-1 Escape-steal case
from that prior HEAD is now an explicit AC3 requirement and is met in source
and tests at this HEAD.
