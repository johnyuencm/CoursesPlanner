# tech_lead review — ticket-add-ctrl-f-find-on-the-prerequisite-map-6ba0b9a3

Verdict: **PASS** (round 1; no high findings)

Goal: Add in-page Ctrl+F find on `/map` because native browser find cannot see React Flow nodes culled by `onlyRenderVisibleElements`.
Reviewed state: branch `fix/complete-prereq-graph`; product commit `4a9be0d10acb7b2e47d2dd73fcfa003d946953d8`; HEAD `1d0a239476cf985dd832b4e020218c5100917f7c` (harness start after product).
Diff inspected: `git show 4a9be0d -- lib/graph.ts tests/graph.test.ts components/course-graph.tsx app/globals.css` (`+235 / −18` across those four files).
Reviewer is not the implementer. No product file was modified. This is the only file written.
`artifacts/review-project_manager-ticket-add-ctrl-f-find-on-the-prerequisite-map-6ba0b9a3.md` was **absent** at review time; this is an independent first pass (no debate round 2).

I did **not** live-drive `/map` in a browser. Keyboard intercept and pan behavior are judged from the committed source plus helper tests, not from a UI run.

## Evidence I ran myself

| Command / check | Result |
| --- | --- |
| `git show 4a9be0d --stat` on the four scoped files | `app/globals.css` +12; `components/course-graph.tsx` +156/−18; `lib/graph.ts` +45; `tests/graph.test.ts` +40 |
| `npm test` on current tree | **45 pass / 0 fail / 0 skipped / 0 todo** |
| `npm run typecheck` (`tsc --noEmit`) | clean, exit 0 |
| `.ycm-harness/smoke-logs/evidence-40652cb9.log` | same gate (45 pass + `tsc --noEmit`, exit 0); matches my rerun |
| `git show 4a9be0d -- tests/graph.test.ts` | **additions only**; no deleted, skipped, or loosened asserts |
| Modal markup vs find-guard selector | `<dialog>` in `components/ui.tsx:20` has **no** `role` attribute; guard is `[role='dialog']` |
| xyflow `onlyRenderVisibleElements` | culls **render** via visible node/edge ids; node store / `getNode` is not the cull list. `panTo` still has a laid-position fallback |

## Acceptance criteria

1. **met in source (not UI-locked).** `/map` mounts `CourseGraph` (`app/map/page.tsx:8-9`). `GraphWorkspace` registers a capture-phase `window` `keydown` listener (`components/course-graph.tsx:176-196`) that `preventDefault`s Ctrl/Cmd+F (not Alt) and `focus`+`select`s `#graph-find` (`:246-256`). The listener is created only while this client tree is mounted, so other routes do not inherit it. No component test proves the browser find bar stays closed.
2. **met in source.** `findCourses` drives the result list (`:158-161`, `:282-296`). Enter / ArrowUp / ArrowDown on the field call `cycle` (`:258-273`). F3 and Ctrl/Cmd+G (Shift reverses) call `cycleRef` when matches exist (`:188-192`). `cycle` uses `wrapFindIndex` then `locate(..., true)` (`:227-233`). If the match is in the current scope (`visible.has`), graph view `panTo`s (`:197-215`); table view scrolls the row (`:211-212`). Auto-locate to match 0 when the query is unique or compacted length ≥ 4 (`lib/graph.ts:280-283`, effect `:163-171`) is consistent with “type then Enter goes to the **next** hit.”
3. **met in source.** Compacted needles match `cs5500` and `PHYS 5116` (`lib/graph.ts:240-242, 255-258`; locked by `tests/graph.test.ts:118-119, 128-130`). Off-screen nodes on the current view still have layout positions; `panTo` uses `getNode` when present, else `graph.nodes` + `setCenter` (`components/course-graph.tsx:197-204`) so culling does not block the jump. Escape on the find field clears `search` / `findIndex` and blurs (`:262-266`).
4. **met.** Independent `npm test` 45/45 and clean `tsc --noEmit`.

## Architecture

The change fits the existing `/map` shape instead of adding a second graph stack.

- Matching, ranking, wrap, and auto-locate live in `lib/graph.ts` (`:240-283`) next to the other graph helpers. `GraphWorkspace` owns keyboard, pan, and the result list. That split is the right cohesion: the pure functions are what tests can actually pin.
- Replacing the old inline compact-includes filter + `.slice(0, 8)` with unbounded scored `findCourses` is required for F3 cycling through every hit, not a drive-by abstraction.
- Capture-phase `window` listener + `locateRef` / `cycleRef` / `matchesRef` (`components/course-graph.tsx:100-102, 162, 234-235`) keeps the shortcut stable across `selectedCode` / graph rebuilds without re-subscribing. Appropriate for beating the browser find bar.
- Ranking uses `programMapCodes` (`:154-157`), while “on this view” / pan vs neighborhood uses current `visible` (`:206-210, 293`). Those are different sets (program membership vs current depth). Slight coupling, but it matches the copy “not on this view — opens neighborhood.”
- CSS (`app/globals.css:346-355, 420`) only styles the find chrome and current-hit highlight. No new layout system.

No architectural debt that will force a later rewrite. The dialog-guard miss (below) is a selector/trust-boundary bug, not a wrong layer.

## Correctness

Happy path on the default program map is coherent: compact match → optional auto-pan to index 0 → Enter/F3 wrap → `setCenter` even when the node DOM is culled.

`locate` when `keepFind` is false still clears the query (inspector / “focus map here”). When `keepFind` is true it rAF-focuses the find field so cycling does not dump the user into the inspector.

`wrapFindIndex(-1, n, +1) === 0` (`lib/graph.ts:274-278`) matches Enter before any auto-locate (short needles such as `cs`).

No races that look like data loss. Auto-locate effect depends on `[search, matches]` (`components/course-graph.tsx:163-171`); `locate` mutates selection/depth/viewport, not `search`, so it should not loop. React Strict Mode would locate twice; both calls are idempotent pans.

Hooks run before `if (!catalog)` (`:237`), which is required and correct.

## Tests

New tests (`tests/graph.test.ts:109-144`) honestly lock `findCourses` / `wrapFindIndex` / `shouldAutoLocateFind` and the MSCS snapshot hits for `cs5500` / `5500` / `PHYS 5116`. They were added, not rewritten to go green. `skipped`/`todo` remain 0.

They do **not** exercise the behavior the ticket exists for: capture-phase `preventDefault`, `#graph-find` focus, `panTo` / laid-position fallback, Escape clear, or the dialog exception. The test title at `:133` (“match Ctrl+F next/previous behavior”) overclaims; it only checks wrap/auto-locate arithmetic.

This is a silent gap, not a false-green skip. Not a high.

## Operations

Rollback is revert of `4a9be0d`. No flags, no persistence, no new network. Find scans the in-memory catalog per keystroke; catalog scale is hundreds of courses, and the result list is capped in CSS (`max-height: min(320px, 50vh)`, `app/globals.css:353`), not in JS. Auto-locate may `setCenter` on each extra character once length ≥ 4; noisy but cheap.

When catalog is still loading, the keydown listener is already attached (`components/course-graph.tsx:176-196`) while `findInputRef` is unmounted (`:237`). Ctrl+F is swallowed with nowhere to focus. Brief and low.

## Security

No new trust boundary. The query is local string matching; results render `course.code` / `course.title` as React text. `getElementById` ids are numeric find indexes or space-stripped course codes. Shortcuts do not run privileged commands. The capture listener is the only new global input path; it is scoped to the map tree and cleaned up on unmount (`:194-195`).

The failed dialog exclusion (finding TL-1) is the security/a11y-adjacent issue: a page-level shortcut vs modal focus.

## Code health

Easier to evolve than the previous 8-hit inline filter: ranking and wrap are named and tested. `GraphWorkspace` is still a large client module; this ticket added a well-bounded island (search state, three effects, locate/cycle) rather than a new file. Acceptable.

## Findings

### TL-1 — medium — dialog skip never matches native `<dialog>`

`components/course-graph.tsx:179` returns early only for `target.closest("[role='dialog']")`.
`components/ui.tsx:20` renders `<dialog … className="modal">` with **no** `role` attribute. CSS/DOM `[role='dialog']` does not see the implicit ARIA role of HTML `<dialog>`.
Course detail and picker are still mounted on `/map` (`components/app-shell.tsx:86-87`). Picker has its own search field (`components/course-dialogs.tsx:78`).
Consequence: with a modal open, Ctrl/Cmd+F and F3/Ctrl+G still `preventDefault` (`:181-192`). Script `focus()` on the map field then either no-ops (background is inert under `showModal()`) or pulls focus out of the modal. Either way the intended exception is dead. Not AC-blocking for the empty-map happy path; it is a real shortcut vs modal defect.

### TL-2 — medium — suite never exercises in-page find chrome

`tests/graph.test.ts:109-144` covers helpers only.
No test dispatches Ctrl+F / F3 / Enter / Escape against `GraphWorkspace`, or asserts `setCenter` when `getNode` is missing (the `onlyRenderVisibleElements` reason for the ticket).
AC1–3 can regress without a red test. No skips or loosened asserts were introduced.

### TL-3 — low — described-by / controls ids are conditional

`aria-describedby="graph-find-status"` and `aria-controls="graph-find-results"` (`components/course-graph.tsx:253-254`) point at nodes that exist only when `search.trim()` (`:276`, `:282`). Empty-field state references missing ids.

### TL-4 — low — Escape does not undo a neighborhood hop

A hit not in `visible` sets `depth` to `"1"` (`:209-210`). Escape only clears the field (`:262-266`). The user can remain on neighborhood view after “clear find.” AC3 only requires clearing the field; restorable via “Show entire program” (`:372`).

## Debate round 1

`project_manager` review for this ticket was not present. No concessions or rebuttals. Independent pass: **no high findings**.

## Verdict rationale

Architecture matches the existing map. Matching for `cs5500` / `PHYS 5116`, wrap/cycle, culled-node pan fallback, and Ctrl/Cmd+F `preventDefault` are present in the submitted source. Gates are green on a fresh `npm test` + `tsc`. Residual issues are a dead modal guard and missing UI tests — medium, not blockers under the high bar (data loss, security, irreversible bugs, false-green skips).
