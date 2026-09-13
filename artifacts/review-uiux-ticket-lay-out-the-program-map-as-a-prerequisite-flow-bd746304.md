# UI/UX review — ticket-lay-out-the-program-map-as-a-prerequisite-flow-bd746304

- Reviewer role: `uiux` (independent; not the implementer)
- Model note: agent contract requires `kimi-k3-high`. That slug is **not** in this
  session's Task allowlist, so this seat ran on `cursor-grok-4.6-xhigh`. The full
  Shneiderman + modern usability checklist was applied unchanged.
- Repo / branch / HEAD: `C:\Users\user\Desktop\github\CoursesPlanner`,
  `fix/complete-prereq-graph` @ `4ed94c1`
- Pairing: `user_advocate` owns job-to-be-done / live operator value. This seat
  owns interaction design only.
- Verdict: **PASS** (no finding meets the high bar: cannot complete the task,
  inaccessible primary flow, or trapped mode)

## Evidence basis

- Code: `components/course-graph.tsx`, `components/course-card.tsx`,
  `lib/graph.ts`, `app/globals.css`, `app/map/page.tsx`, `tests/graph.test.ts`.
- Commits in scope: `9deaf66` (flow layout) and `4ed94c1` (inspector pan + hint
  + `onInit` center).
- Layout oracle (same fixtures as `tests/graph.test.ts`): 107 program-map
  courses, **62 isolates**; flow bbox ≈ **1148×1424**; CS 5004 `(0,64)`,
  CS 5010 `(0,128)`, CS 5500 `(492,256)`, CS 6510 `(820,64)`; isolate band
  starts at `y=720`. Rank 0 wraps to three columns (10 / 10 / 2).
- Live: `GET http://localhost:3000/map` → **200**. `cursor-ide-browser` could
  not hold a tab in this seat (create → navigate/lock → "view not found"), so
  first-paint claims are from `onInit` + those coordinates, not a screenshot.

## Findings

### F12 — medium — Isolate band has no in-canvas name and dominates Fit to view
`programFlowPositions` packs unlinked courses `PROGRAM_ISOLATE_GAP` (80px) below
the flow (`lib/graph.ts:111`, `:173-179`). 62 of 107 nodes sit there. The gap is
≈1.25 row (`PROGRAM_ROW` 64). Isolates use the same compact chips and left/right
`Handle`s (`course-graph.tsx:37`, `:53`) as linked nodes, left-aligned under the
flow, so they read as more ranks. Legend has no "no arrows" swatch
(`course-graph.tsx:163`). The decoder is only
`graph-canvas-hint` (`:227`): "Courses with no arrows sit below."

"No parsed prerequisites" does not predict location: CS 5800 / CS 5100 have empty
prereq lists but sit in the connected column because they unlock others; CS 5150
is a true isolate at `y=720`. Inspector empty-state copy
("No parsed prerequisites.", `:240`) does not say which band the node is in.

Fit to view (`:59-60`, padding 0.12) must cover 1148×1424. Into a
`min-height: 580px` canvas (`app/globals.css:362`) that is ~0.4 zoom; compact
codes at `0.95rem` (`:370`) become unreadably small. Visual hierarchy.
Overlaps `user_advocate` if they score "can the student see the program flow?"

### F13 — medium — First paint at zoom 1 hides the left-to-right chain
Default selection is CS 5010 (`course-graph.tsx:82-83`). Entire-program `onInit`
centers that node at `READABLE_ZOOM` 1 (`:20`, `:192-195`), replacing the old
origin viewport. At zoom 1, CS 5500 (`x=492`) and CS 6510 (`x=820`) sit off the
typical canvas; isolates at `y≥720` are well below. Nearby nodes at that zoom
are other rank-0 sources (CS 5004, CS 5100, …), which does not demonstrate
"prerequisites to the left of what they unlock."

The hint that teaches LTR + isolates + chips (`:227`) is after the 580px canvas,
`0.65rem`, `--muted` (`app/globals.css:363`, `:10`). `.graph-panel-heading`
(`:360`) is `display:flex` without wrap; `.graph-panel` is `overflow:hidden`
(`:357`), so Map/Table and Show can clip before the hint is seen.

Not high: inspector chips, search, minimap, and Fit to view still reach the
chain. The new spatial encoding is not on the default screen.

### F14 — medium — Inspector chips look like dialog chips; off-view chips change scope without the search warning
Inspector Prerequisites / Unlocks pass `onSelect={focus}`
(`course-graph.tsx:240`, `:242`). Same `.code-chip` widget
(`course-card.tsx:9-11`, `app/globals.css:150`) still calls `openCourse` on
Courses, dialogs, and **this page's Table** (`course-graph.tsx:221-222`). No
`aria-label` beyond the code. Hint `:227` says "click an inspector chip to jump";
the inspector itself does not.

Search discloses "· not on this view — opens neighborhood" (`:162`). Inspector
chips do not. `focus` (`:147-156`) silently `setDepth("1")` when `!visible.has`.
Concrete path: Immediate neighborhood of CS 5500 is four courses; select CS 5010
and chips CS 5400 / CS 7980 are off-view → remount to that neighborhood
(`key` `:185`). Recovery exists: **Show entire program** (`:234`). Not trapped,
but the system initiates a scope change the chip did not announce.
Rules 1, 3, 7.

`panTo` / `centerNode` always pass `zoom: READABLE_ZOOM` and `duration: 180`
(`:32`, `:139-145`). A user who fitted the program is yanked to zoom 1. Intended
for readability (F13); still a zoom override, not a pan at current scale.

### F2 — medium — Canvas keyboard path remains sequential; node Details stays pointer-only
Unchanged from the prior map ticket: `nodesFocusable={false}` (`:200`),
`onlyRenderVisibleElements` (`:203`), Details `tabIndex={-1}` (`:45`). Compact
program mode hides Details anyway (`app/globals.css:367-368`). Inspector
**Full course details** (`course-graph.tsx:246`) and in-graph search remain
keyboard recovery. Not high.

### F5 — medium — Completion status is still colour-only
`nodeClassFor` (`:63-68`) → `.graph-completed` background only
(`app/globals.css:374`). `aria-label` (`course-graph.tsx:38`) never says
completed. WCAG 1.4.1. Unchanged by this ticket.

### F6 — medium — Minimap and the new layout hint stay below a tall canvas
`.flow-canvas` `min(78vh, 820px)` / `min-height: 580px` (`app/globals.css:362`).
Hint is after the canvas (`course-graph.tsx:227`). This is worse than last
round because the hint is now the only prose that explains LTR, isolates, and
chip-jump. Header **Fit to view** (`:59-62`, `:162`) is on-screen recovery.

### F7 — medium — Muted copy is under AA; node meta is ~8.5px
`--muted: #8a93a0` on white ≈3.1:1 (`app/globals.css:10`). Colours the
`role="status"` heading (`:360`, `course-graph.tsx:169`), hint (`:227`), and
inspector rule text (`app/globals.css:405`). Node meta `0.53rem` (`:379`).
Objective contrast/size, not taste.

### F16 — low — Rank wrap makes "left = earlier" a three-column smear
`PROGRAM_WRAP_ROWS = 10` (`lib/graph.ts:110`, `:166-171`). Rank 0 is 22 courses
in columns at x=0 / 164 / 328 before rank 1 at x=492. A student can read the
middle column as a distinct prerequisite stage. Rule 8 / hierarchy. Tests only
assert CS 5004/5010 left of 5500 left of 6510 (`tests/graph.test.ts:72-74`).

### F8 — low — Scope change still remounts and drops pan
`<ReactFlow key={...}>` (`course-graph.tsx:185`). Neighborhood → Entire program
does not restore the previous viewport. Rule 6.

### F9 — low — `aria-label` on generic containers
Legend and Map display labels remain on `<div>`s (`:163`, `:170`), not exposed
as names.

### F10 — low — Same object, three click outcomes on one page
Canvas click selects (`:204`). Table code opens the details modal (`:219`).
Inspector chip pans or opens a neighborhood (`:240-242`). Rule 1. This ticket
added the third outcome.

### F11 — low — `setCenter` is not reduced-motion gated
CSS transitions zero under `prefers-reduced-motion` (`app/globals.css:688-690`);
`centerNode` still animates `duration: 180` (`course-graph.tsx:32`).

## Shneiderman's Eight Golden Rules — one note each

1. **Consistency** — Shared `PageHeading`, badges, Map/Table `aria-pressed`,
   compact chips, left/right handles matching LTR. Break: identical `.code-chip`
   now pans in the inspector and opens a dialog in Table and the rest of the
   app (F14, F10).
2. **Shortcuts for frequent users** — Search, depth `<select>`, Fit to view,
   skip link, inspector chips as a jump list. No search hotkey; no arrow-key
   node walk (F2). Chip jump always resets zoom to 1 (F14).
3. **Informative feedback** — `role="status"` names selection (`:169`);
   emphasis rings unchanged; LoadingState on dynamic import
   (`app/map/page.tsx:5`). Chip jump updates the inspector heading. Gap:
   off-view chips do not preview the neighborhood switch (F14); first paint
   does not show the new LTR layout (F13).
4. **Closure** — Select → inspector → Add to Plan / Full course details.
   Neighborhood heading "Focused on **X**" (`:168`) plus **Show entire
   program** (`:234`) close the focus flow. Acceptable.
5. **Simple error handling** — Nodes not draggable/connectable (`:198-199`);
   search miss copy (`:162`); empty prereq/unlock lines (`:240-242`). Prevention
   gap: unlabeled isolate band (F12); silent scope change (F14).
6. **Easy reversal** — Nothing destructive. **Show entire program** returns
   from neighborhood. No back-stack of prior neighborhoods; viewport pan is
   lost on remount (F8); Fit-to-view zoom is lost on the next chip (F14).
7. **Internal locus of control** — User still initiates select/search/chip
   click. Off-map search warns; inspector chips do not (F14). `onInit`
   recenters without a user pan (F13). Canvas `role="application"` plus
   `nodesFocusable={false}` still blocks arrow steering (F2).
8. **Reduce short-term memory load** — Inspector lists prereqs/unlocks as
   chips (recognition). Compact program chips still hide titles
   (`app/globals.css:367`). Isolate vs connected location is not named on
   the node (F12). Rank wrap asks the user to remember that two extra columns
   are still rank 0 (F16).

## Modern usability — one note each

- **Clarity and simplicity** — Hint copy is the right idea ("Prerequisite
  chains run left to right. Courses with no arrows sit below. … click an
  inspector chip to jump"). It is muted, below a 580px canvas, and absent in
  neighborhood scope. Handles on isolates imply edges that are not there.
  Honest catalog caveats in the inspector tip (`course-graph.tsx:248`) remain.
- **Visual hierarchy** — **Add to Plan** is still the only filled red button.
  Connected ranks are now spatially ordered, which closes the old type/code
  grid for linked courses. Isolates (majority of nodes) and zoom-1 first paint
  undo that hierarchy in the viewport the user actually gets (F12, F13).
  Rank wrap smears stages (F16). Selected vs linked rings unchanged.
- **Accessibility** — Skip link, focusable inspector, `sr-only` table caption,
  per-node `aria-label`, live selected-code region, native chip `<button>`s,
  `type="button"` on chips. Remaining: sequential canvas Tab (F2), colour-only
  completion (F5), sub-AA muted text (F7), chip name is only the code (F14),
  animated `setCenter` vs reduced motion (F11). Primary flow is completable
  from the keyboard via search + inspector; the canvas is not an accessible
  graph widget.

## Notes on scope

- No product files were modified. Only this artifact was written.
- No numeric score assigned; no self-scoring.
- `ycm-harness review *` was not run; no harness review JSON written.
- Fix implementations are deliberately not proposed.
- Do not restyle the design system for taste; residuals above are rule breaks
  (contrast, disclosure, spatial decoder), not palette preference.
- `user_advocate` owns whether the live flow solves the stated problem. F12/F13
  are the overlap: the layout exists in coordinates, not in the default view.
