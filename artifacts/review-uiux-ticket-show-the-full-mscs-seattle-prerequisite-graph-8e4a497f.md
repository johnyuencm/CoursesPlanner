# UI/UX review — ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f

- Reviewer role: `uiux` (independent; not the implementer)
- Model note: required `kimi-k3-high` is not in this session's allowlist, so this
  seat ran independently on the available model. Rule set applied unchanged
  (Shneiderman's Eight Golden Rules + modern usability).
- Repo / HEAD: `C:\Users\user\Desktop\github\CoursesPlanner` @ `6caccf1`
- Verdict: **PASS** (prior highs F1 and F2 no longer meet the high bar)

## Evidence basis

- Code read: `components/course-graph.tsx`, `app/map/page.tsx`,
  `app/courses/page.tsx`, `app/globals.css`, `components/ui.tsx`,
  `node_modules/@xyflow/react/dist/esm/index.js` (NodeWrapper `tabIndex` /
  `role="application"`).
- Visual: user-supplied screenshot `map-chain-emphasis.png` of `/map` default
  ("Entire program", `114 courses · 80 links. Selected CS 5010`, inspector
  unlocks `CS 5400` / `CS 5500` / `CS 6510` / `CS 7980`). Blue rings are
  visible on at least `CS 5011`, `CS 5500`, `CS 6410`, `CS 6510`; legend
  includes **Linked to selected**.
- Live browser: `cursor-ide-browser` still cannot hold a tab in this seat.
  Keyboard claims below are from source (inner `<button>` tab order + skip
  target), not a live Tab pass.

## Prior highs — re-judged

### F1 (was high) — closed
`app/globals.css:376` now paints `.graph-course-node.graph-emphasized` with
`border-color: #4b6cb3` and `box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.28)`.
`course-graph.tsx:40` appends `Upstream prerequisite` / `Downstream connection`
/ `Selected course` to the node `aria-label`; `:51` puts the same string in the
tooltip; `:156` adds a **Linked to selected** legend swatch
(`.legend-node.emphasis` at `app/globals.css:395`). Compact mode still hides
`.graph-node-bottom` (`:367-368`), but the chain is no longer silent: the
screenshot shows rings on linked chips, and the inspector still lists unlocks.
Selecting a node is visible success. Not high: the user can complete "see
what this course connects to" without recalling four codes.

Residual (not reopened as high): selected (`graph-focused`, `:377`, 3px
`--blue` ring) and linked (`graph-emphasized`, 2px `#4b6cb3` ring) share one
visual language. The inspector heading is what names the selection. Encoding
is a ring (shape) plus legend text, not colour alone.

### F2 (was high) — no longer high; remainder tracked as F2 below
`tabIndex={-1}` was removed from `.graph-node-main` (`course-graph.tsx:40`).
`nodesFocusable={false}` (`:193`) is the correct pairing: xyflow's
`NodeWrapper` sets `tabIndex` only when `isFocusable` is true (`index.js`
around the NodeWrapper `tabIndex: isFocusable ? 0 : undefined` branch), so
the wrapper is not a second tab stop. Native `<button>` descendants stay in
the sequential order. Skip link `:159` still exists; `#graph-inspector` is
now `tabIndex={-1}` (`:222`). Table view and in-graph search remain
keyboard paths to every course.

That is no longer an inaccessible primary flow or a trapped mode. Keyboard
users can select a visible node with Tab/Enter, skip to the inspector, or use
search/table. High bar not met.

Details remains `tabIndex={-1}` (`:47`) and is `display: none` in compact
default (`app/globals.css:367-368`). That is a secondary action; inspector
**Full course details** (`course-graph.tsx:239`) is the recovery. See F2
medium.

## Findings

### F2 — medium — Canvas keyboard path is sequential and Details stays pointer-only
Primary select is now a real button, but:

- **Details** is still `tabIndex={-1}` (`course-graph.tsx:47`). In
  neighborhood scope, where `.graph-node-bottom` is shown, that control is
  pointer-only. Recovery is the inspector secondary button, so not high.
- `onlyRenderVisibleElements` (`:196`) unmounts off-screen chips, so Tab
  cannot reach the rest of the 114-course grid. Search (`:155`) and Table
  (`:165`) cover that; Fit to view then Tab is a third, poorer path.
- The hover tooltip (`app/globals.css:386`, `:focus-within` now can fire) is
  still not `aria-describedby` on the select button; `role="tooltip"` at
  `course-graph.tsx:49` is unnamed. Screen readers get code, title, kind, and
  relation from `:40`, not the prerequisite/corequisite lines.
- React Flow's root is `role="application"` (library default). Arrow-key
  node-to-node movement is off because `nodesFocusable={false}`. Users must
  Tab through every visible chip or leave the canvas.

Rules 2, 5, 7 + accessibility. Not high: task completion is possible.

### F4 — medium — Default layout is a type/code grid, so edges stay hard to read
Program positions are still
`(index % columns, floor(index / columns))` after sort by requirement type
then code (`course-graph.tsx:107-110`). Active vs inactive edges still differ
only by `#64748b` vs `#98a2b3` and `1.8` vs `1.2` width (`:130`). Rings now
mark the selected chain, which is why this is not high, but tracing an
arbitrary arrow across the screenshot grid is still impractical. Visual
hierarchy. Overlaps `user_advocate`'s job-to-be-done question; scored here
only as an encoding/hierarchy break.

### F5 — medium — Completion status is still colour-only
`nodeClassFor` (`course-graph.tsx:65-70`) maps history to
`graph-completed`, which only changes background (`app/globals.css:374`,
`--green-soft #e9f5ed`). `kind`, `aria-label` (`:40`), node `ariaLabel`
(`:104`), and the tooltip (`:49-53`) never say "completed". Adjacent pastels
(`:371-375`) are a small hue shift on a 152px chip. WCAG 1.4.1. Legend
swatches are 16×10px (`:389`).

### F6 — medium — Minimap and canvas hint remain below the fold on short viewports
`.flow-canvas` is `min(78vh, 820px)` with `min-height: 580px`
(`app/globals.css:362`). `MiniMap` / `Controls` sit on the canvas
(`course-graph.tsx:202-203`); the hint that names them is after the canvas
(`:220`, `app/globals.css:363`). Header **Fit to view** (`:59-62`, `:155`)
is the on-screen recovery, which keeps this medium. Prior `user_advocate`
live pass at 1366×768 already measured the minimap clipped.

### F7 — medium — Muted copy is under AA; node meta is ~8.5px
`--muted: #8a93a0` (`app/globals.css:10`) on white is ≈3.1:1. It colours the
`role="status"` heading (`:360`, `course-graph.tsx:162`), canvas hint
(`:363`), empty search (`:351`), and `.graph-node-bottom` (`:382`). Node
meta is `0.53rem` ≈ 8.5px (`:379`). Course codes at `0.95rem` (`:370`) are
fine. Objective contrast/size floor, not taste.

### F8 — low — Scope change discards pan/zoom
`<ReactFlow>` is keyed on program vs `${focusCode}-${depth}`
(`course-graph.tsx:178`), remounting and resetting the viewport (`:180-184`).
**Show entire program** restores mode, not the user's last pan. Rule 6.

### F9 — low — `aria-label` on generic containers
`aria-label="Map legend"` on a `<div>` (`course-graph.tsx:156`) and
`aria-label="Map display"` on the segmented-control `<div>` (`:163`) are
not exposed on nameless elements. The skip-target half of old F9 is
**closed**: `#graph-inspector` has `tabIndex={-1}` (`:222`).

### F10 — low — Map click vs Table click
Canvas click selects (`:197`). Table course-code button opens the details
modal (`:212`). Same object, two outcomes. Rule 1.

### F11 — low — `setCenter` is not reduced-motion gated
CSS transitions zero under `prefers-reduced-motion` (`app/globals.css:688-690`);
`centerNode` still animates `duration: 180` (`course-graph.tsx:34`).

### F3 (was medium) — closed
Search activation now focuses `#graph-inspector`
(`course-graph.tsx:150-152`) after clearing the query, and the live region
includes `Selected {code}` (`:162`). Focus is not dumped on `<body>`.
`preventScroll: true` may skip bringing the aside on-screen in a stacked
layout; not scored separately.

## Shneiderman's Eight Golden Rules — one note each

1. **Consistency** — Shared `PageHeading`, `search-field`, badges, and
   `aria-pressed` Map/Table toggle (`course-graph.tsx:164-165`). Breaks: Map
   vs Table click (F10); segmented control beside a `<select>` for depth
   (`:163` vs `:168`). Legend now matches the emphasis ring.
2. **Shortcuts for frequent users** — In-graph search, depth `<select>`,
   header Fit to view, skip link. Visible node select is now a Tab target.
   No search hotkey; no arrow-key traversal of the 114-chip grid (F2).
3. **Informative feedback** — Stronger than last round: rings (F1 closed),
   `role="status"` names the selected code (`:162`), `LoadingState` on
   dynamic import (`app/map/page.tsx:5`). Search no longer silently recenters
   (F3 closed). Remaining: colour-only completion (F5).
4. **Closure** — Select → inspector → Add to Plan (`:238`, via picker) or
   Full course details (`:239`). Scope copy restates Entire program vs
   Focused on **X** (`:161`). Acceptable.
5. **Simple error handling** — `nodesDraggable` / `nodesConnectable` false
   (`:191-192`); unknown courses say "Metadata not in this catalog" (`:104`)
   and "External course reference" (`:225`). Explorer empty state names the
   rejected code (`app/courses/page.tsx:85`). Graph search miss: "No matching
   courses. Try another code or title." (`course-graph.tsx:155`). Off-canvas
   courses are a prevention gap, not a recovery-copy gap (F2).
6. **Easy reversal** — Nothing destructive; **Show entire program** (`:227`)
   and the depth `<select>` reverse scope. Viewport pan is lost on remount
   (F8).
7. **Internal locus of control** — Off-map search still discloses
   "· not on this view — opens neighborhood" before click (`:155`). Search
   now hands focus to the inspector instead of stealing it. `role="application"`
   plus `nodesFocusable={false}` still means the canvas does not behave like
   a user-steered node list with arrows (F2).
8. **Reduce short-term memory load** — Inspector, legend (including Linked
   to selected), and status line keep selection and chain meaning visible.
   Compact mode still hides titles (`app/globals.css:367`); tooltip now
   carries relation (`course-graph.tsx:51`). Rings remove the old "hunt four
   codes in a grid" recall tax (F1 closed). Codes-only chips still require
   hover or inspector for the course name.

## Modern usability — one note each

- **Clarity and simplicity** — Honest copy remains a strength ("Each arrow
  is a parsed reference, not an AND rule", `:241`; "A connection does not
  verify course availability", `:244`). Status line now states selection, so
  the duplicate count on the canvas hint (`:220`) is less useful but not
  harmful. Two search fields (topbar vs in-graph) still differ in scope.
- **Visual hierarchy** — **Add to Plan** is the only filled red button.
  Emphasis rings now give the canvas a selected-chain channel (F1 closed).
  Alphabetical/type grid plus near-identical edge greys still hide structure
  for unselected links (F4). Selected vs linked rings are close cousins.
- **Accessibility** — Skip link, focusable inspector, `sr-only` table
  caption (`:207`), per-node `aria-label` with relation, live selected-code
  region, `edgesFocusable={false}`. Remaining: sequential canvas Tab (F2),
  colour-only completion (F5), sub-AA muted text and ~8.5px meta (F7),
  dropped container labels (F9). Primary flow is completable from the
  keyboard; it is not elegant.

## Notes on scope

- No product files were modified. Only this artifact was overwritten.
- No numeric score assigned; no self-scoring.
- `ycm-harness review *` was not run; no harness review JSON written.
- Fix implementations are deliberately not proposed.
- `user_advocate` owns the live-flow / problem-solved verdict; F4 is the
  remaining overlap (readable chain vs type/code grid).
