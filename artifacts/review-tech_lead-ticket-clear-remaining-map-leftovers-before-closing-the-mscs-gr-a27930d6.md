# tech_lead review — ticket-clear-remaining-map-leftovers-before-closing-the-mscs-gr-a27930d6

Verdict: **PASS** (phase 1 round 1; no high findings)

Goal: Clear remaining `/map` leftovers before closing the MSCS graph work — compact eligible pills must render in full (short "Eligible" allowed; inspector may keep "Prerequisite eligible"), map Ctrl+F must not steal while the native course-details dialog is open, Escape must clear graph find from the canvas without stealing dialog close or header search, and `npm test` / typecheck must exit 0.

Reviewed state: branch `fix/complete-prereq-graph` @ `e06810ae4b456bf1c82b9bdc041f7223decbc9dd` (not `c528140`). Range `git diff 9c4e5a1..HEAD` (`+140 / −4` across 5 files). Commits: `9592f85`, `1a2f19b`, `786c360`, `c528140`, `e06810a`.
Reviewer is not implementer `d085fad0`. No product file was modified. This is the only file written.
This is an independent first pass after the Escape-scope fix. A parallel `review-project_manager-*` path may exist; it was **not** read and no `## Debate round N` is appended.

I did **not** live-drive `/map`. Keyboard skip/clear and pill clipping are judged from committed source, helper tests, and an independent `npm test` / `typecheck` rerun.

## Evidence I ran myself

| Command / check | Result |
| --- | --- |
| `git rev-parse HEAD` | `e06810ae4b456bf1c82b9bdc041f7223decbc9dd` |
| `git diff --stat 9c4e5a1..HEAD` | `app/globals.css` +1/−1; `components/course-graph.tsx` +15/−2; `components/ui.tsx` +1/−1; `lib/graph.ts` +42; `tests/graph.test.ts` +83 |
| `git show e06810a --stat` | `lib/graph.ts` +18/−1; `tests/graph.test.ts` +24/−2 — Escape scope only |
| `npm test` | **61 pass / 0 fail / 0 skipped / 0 todo** |
| `npm run typecheck` (`tsc --noEmit`) | clean, exit 0 |
| Test diff vs `9c4e5a1` | **additions only**; no deleted, skipped, disabled, or loosened asserts |
| Compact pill path | `CourseNode` compact branch `components/course-graph.tsx:74`; `compact: true` always `:180`; inspector full label `:458`; legend still "Prerequisite eligible" `:385`; CSS ellipsis/`max-width: 58%` removed `app/globals.css:385` |
| Dialog skip | `isGraphFindSkipTarget` `lib/graph.ts:384-388`; wired capture listener `components/course-graph.tsx:250`; `<dialog role="dialog">` `components/ui.tsx:20`; `showModal()` `:17` |
| Escape scope (this HEAD) | `isGraphFindEscapeScope` `lib/graph.ts:396-403`; `shouldClearGraphFindOnEscape` `:405-413`; window handler `components/course-graph.tsx:259-263`; skip still returns before any `preventDefault` `:250` |

## Acceptance criteria

1. **met in source.** Compact map cards always set `compact: true` (`components/course-graph.tsx:180`) and render `compactGraphStatusLabel(data.statusLabel)` (`:74`, `lib/graph.ts:416-418`), which maps only `"Prerequisite eligible"` → `"Eligible"`. CSS no longer clips `.graph-node-meta .status-pill` (`app/globals.css:385` dropped `max-width: 58%`, `overflow: hidden`, `text-overflow: ellipsis`). Inspector keeps the full `selectedStatus.label` (`components/course-graph.tsx:458`). Node `aria-label` still uses the full `data.statusLabel` (`:71`). I did not measure live layout; source has no remaining ellipsis on that pill.
2. **met in source.** Capture-phase Ctrl/Cmd+F returns before `preventDefault` when `closest("dialog, [role='dialog']")` matches (`lib/graph.ts:387`, `components/course-graph.tsx:250-257`). Course details and the picker both mount `Modal`, a native `<dialog>` with explicit `role="dialog"` (`components/ui.tsx:20`) opened via `showModal()` (`:17`). Helper tests lock both the tag and the role (`tests/graph.test.ts:313-324`).
3. **met in source for the stated cases, including the prior over-broad preventDefault.** Escape with a non-empty trimmed query clears only when `isGraphFindEscapeScope` is true (`lib/graph.ts:396-403`, `components/course-graph.tsx:259-263`): find chrome (`.graph-search-wrap` / `#graph-find`), canvas (`.flow-canvas`), or other non-field nodes inside `.graph-panel`. Inside a dialog the listener returns at `:250` and does not `preventDefault`, so `onCancel` (`components/ui.tsx:20`) can still close. Header search and the Show `<select>` are out of scope (see Prior TL-1).
4. **met.** Independent `npm test` 61/61 and clean `tsc --noEmit`.

## Architecture

Fits the existing `/map` shape. Matching, skip, Escape scope, and compact copy live next to the other graph-find helpers in `lib/graph.ts`; `GraphWorkspace` only wires the capture listener. Pulling `closest` behind named helpers keeps the prior dialog-selector bug and this Escape-scope rule testable without jsdom.

`role="dialog"` on the shared `Modal` is a one-line, app-wide discoverability fix, not a second modal stack. Map shortcuts now depend on overlays being `dialog` and/or `[role='dialog']`; that is the correct contract.

`isGraphFindEscapeScope` is an allowlist (find chrome / canvas / panel) plus a form-field denylist (`input` / `select` / `textarea` / `option`). That is the right split: the Show control sits *inside* `.graph-panel` (`components/course-graph.tsx:392-408`), so a panel-only allowlist would still steal native select Escape. The tag denylist is load-bearing and is covered by `tests/graph.test.ts:345-348`.

`compactGraphStatusLabel` is still UI copy inside the graph helper module (`lib/graph.ts:416-418`). Mild layering smell; not a rewrite risk at this size.

`searchRef.current = search` during render (`components/course-graph.tsx:128-129`) plus a `[]`-deps capture listener (`:247-273`) is the stable way to read latest find text without re-subscribing.

## Correctness

Happy path is coherent: compact eligible text shortens and is not CSS-clipped; inspector/legend/table keep the long phrase (`:385`, `:446`, `:458`); Ctrl+F/F3/Ctrl+G are skipped when the event target is inside a dialog; Escape on canvas, find chrome, and non-field panel chrome clears a non-empty query; Escape inside dialog is not `preventDefault`ed.

`shouldClearGraphFindOnEscape` re-checks skip even though the listener already returned (`lib/graph.ts:412`). Defense in depth; the unit tests would still be honest if call order changed.

Find-field Escape still runs after capture (no `stopPropagation`) and additionally blurs (`components/course-graph.tsx:341-345`). Duplicate `setSearch("")` is idempotent. Capture still `preventDefault`s there because `#graph-find` is in scope; that is intended.

No data-loss races. Auto-locate effect is unchanged. `showModal()` focus-trap is what makes skip `closest` equivalent to “dialog is open” in this app; a future non-modal overlay would not be skipped. Current `Modal` is modal.

Native `<dialog>` already has an implicit dialog role; adding `role="dialog"` is redundant but matches the old `[role='dialog']` guard. Not a correctness defect.

Escape with a `null` target still clears (`lib/graph.ts:397-398`, asserted `tests/graph.test.ts:331`). Window `keydown` targets the focused node (or `body`), not `null`, so this is a helper default rather than a live steal path.

Inspector (`aside.graph-inspector`, `components/course-graph.tsx:455`) is a sibling of `.graph-panel`, not a descendant. Escape there no longer clears find. That is a narrowing versus `c528140`, aligned with AC3’s canvas/dialog/header wording, not a steal.

## Tests

New tests (`tests/graph.test.ts:284-362`) honestly lock helper behavior with a local `FakeElement.closest` that implements the same comma/class/id selectors the production helpers pass. They were added, not rewritten to go green. `skipped`/`todo` remain 0.

`e06810a` added the two cases that closed TL-1 (`:339-348`) plus an in-scope positive (`:350-355`). Header search is modeled as a bare `input` (matches `components/app-shell.tsx:57`). Show is modeled as `select` under `.graph-panel` (matches `:401-408`). The denylist is what makes the Show fixture fail-closed.

They do **not** exercise: the window capture listener, live `preventDefault`, native `<dialog>` cancel, native search-clear / select-dismiss, `<details class="profile-menu">`, the topbar career `<select>` (`components/app-shell.tsx:63`), or the CSS ellipsis removal. The compact-pill title at `:357` overclaims “without clipping other statuses”; it only asserts string mapping. Silent gaps, not false-green skips. Career-target select is the same `select` tag as Show, so that gap is coverage, not an open steal.

## Operations

Rollback is revert of `9592f85..e06810a`. No flags, persistence, or network. Shortcut work stays on the existing capture listener; Escape clear is O(1) state reset. Compact labels are a cheap string swap. No new unsafe defaults.

## Security

No new trust boundary. Query and status strings remain React text. Duck-typed `closest` (`lib/graph.ts:378-382`) only reads a method on the browser `EventTarget`; it is not attacker-controlled input. Capture listener is still scoped to the mounted map tree and removed on unmount (`components/course-graph.tsx:271-272`). Expanding skip to native `dialog` and narrowing Escape `preventDefault` to graph chrome **narrows** the privilege of that global shortcut, which is the right direction.

## Code health

Easier to evolve than an inline `[role='dialog']` check or a boolean “not a dialog” Escape. Skip, scope, and clear are named and tested. `FakeElement` is test-local, not a second DOM. Acceptable.

## Findings

### Prior TL-1 — closed at this HEAD

Previous medium: `shouldClearGraphFindOnEscape` was true for any non-dialog target, so capture `preventDefault` (`components/course-graph.tsx:259-263`) could swallow Escape on topbar search, the Show select, and the profile menu while map find text was still in `searchRef`.

`e06810a` introduced `isGraphFindEscapeScope` (`lib/graph.ts:396-403`). Re-checked against the three named controls:

| Control | Why Escape is no longer stolen | Test |
| --- | --- | --- |
| Topbar `type="search"` (`components/app-shell.tsx:55-57`) | `tagNameOf` is `input` after the allowlist miss → `false` (`lib/graph.ts:400-401`) | `tests/graph.test.ts:339-342` |
| Show `<select>` inside `.graph-panel` (`components/course-graph.tsx:401-408`) | Allowlist misses (not find/canvas); `select` denylist returns before `.graph-panel` (`:401-402`) | `tests/graph.test.ts:345-348` |
| Profile `<details>` (`components/app-shell.tsx:70-77`) | Not find/canvas; tag is `summary`/`button`; not under `.graph-panel` → `false` (`:403`) | source-only; no dedicated helper test |

`preventDefault` still runs only when `shouldClearGraphFindOnEscape` is true (`components/course-graph.tsx:259-260`). AC3’s canvas-clear path remains true for `.flow-canvas` (`tests/graph.test.ts:326-328`) and find chrome (`:350-353`). Not a residual medium.

### TL-2 — low — CSS no-ellipsis is untested; compact test title overclaims

`tests/graph.test.ts:357-362` only checks `compactGraphStatusLabel`. A future restore of `text-overflow: ellipsis` / `max-width: 58%` on `app/globals.css:385` would still pass. Not a loosened test.

### TL-3 — low — compact copy lives in the graph domain module

`lib/graph.ts:416-418` hard-codes planner status prose. If `courseStatus` (`components/course-card.tsx:21`) ever changes the eligible string, compact cards show the long phrase again with no ellipsis. Coupling, not a current miss.

## Debate

Round 1 independent pass on HEAD `e06810a`. No project_manager findings incorporated. Prior TL-1 is closed; remaining findings are low only.
