# UI/UX review — ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f

- Reviewer role: `uiux` (independent; not the implementer)
- Model note: required `kimi-k3-high` is not in this session's allowlist, so this
  seat ran on Claude. Rule set applied unchanged (Shneiderman's Eight Golden
  Rules + modern usability).
- Repo / HEAD: `C:\Users\user\Desktop\github\CoursesPlanner`, branch
  `fix/complete-prereq-graph` @ `2fd63b5`
- Verdict: **FAIL** (2 high findings)

## Evidence basis

- Code read: `components/course-graph.tsx`, `app/map/page.tsx`,
  `app/courses/page.tsx`, `app/globals.css`, `components/ui.tsx`.
- Visual: user-supplied screenshot `map-filled-readable.png` of
  `http://localhost:3000/map` default state ("Entire program", 114 courses ·
  80 links, `CS 5010` selected).
- Live browser inspection: **not available** — `cursor-ide-browser` returned
  "No browser tab available" on both reuse and `newTab` attempts, although the
  dev server answers `200` on `/map`. Findings below are therefore grounded in
  source + the provided screenshot, and each cites file:line. Two findings
  (F3 focus loss, F6 minimap below fold) are code/CSS-derived and would benefit
  from a live keyboard pass by whoever can drive a real browser.

## Findings

### F1 — high — Selecting a node produces no visible chain feedback in the default view
`components/course-graph.tsx:240` promises "Select a node to emphasize its
upstream and downstream chain". `course-graph.tsx:101` computes `relation`
("Upstream prerequisite" / "Downstream connection") and `:103` sets
`emphasized: !!relation`, but the CSS hook is an **empty rule**:
`app/globals.css:376` → `.graph-course-node.graph-emphasized { }`. The only
place `relation` is rendered is `.graph-node-bottom`
(`course-graph.tsx:46`), and compact mode hides that element outright
(`app/globals.css:368`). Compact is the default (`course-graph.tsx:103`,
`compact: depth === "program"`), and the hover tooltip does not carry relation
either (`course-graph.tsx:49-53` shows code · credits · prereqs · coreqs).

Net effect on the default surface: clicking a course changes the right-hand
inspector and adds a blue ring to the clicked node
(`app/globals.css:377`), while the ~4 upstream/downstream chips it is supposed
to emphasize look identical to the other 110. In the screenshot, `CS 5010` is
selected with 4 listed unlocks (`CS 5400`, `CS 5500`, `CS 6510`, `CS 7980`) and
none of those four chips is visually distinguished. Rule 3 (informative
feedback — silent success) and rule 8 (recognition over recall: the user must
read four codes in the sidebar and hunt them in a 7-column grid) both break on
the page's core interaction.

### F2 — high — Map nodes are keyboard-unreachable and node prerequisite detail is pointer-only
`components/course-graph.tsx:189` sets `nodesFocusable={false}`, and both
in-node buttons opt out of the tab order: `:40`
(`tabIndex={-1}` on `.graph-node-main`) and `:47` (`tabIndex={-1}` on
"Details"). So no keyboard or switch user can select, traverse, or activate any
of the 114 nodes on the primary canvas.

This also disables the intended non-pointer escape hatch: the tooltip that
carries "Prerequisites:" / "Corequisites:" is revealed by
`.graph-course-node:hover .graph-node-tooltip, ... :focus-within ...`
(`app/globals.css:386`) — `:focus-within` can never fire, because nothing inside
the node is focusable. In compact/default mode, where titles and the relation
row are hidden (`app/globals.css:367-368`), that tooltip is the **only**
on-canvas source of prerequisite text, and it is hover-only. `role="tooltip"`
at `course-graph.tsx:49` is never wired to an `aria-describedby`, so assistive
tech does not get it either.

Mitigations exist and were clearly designed for (skip link `:154`, Table toggle
`:161`, search-to-focus `:151`), which is why this is not "no path at all" — but
the primary interactive surface itself is pointer-exclusive, which is an
inaccessible primary flow under this review's `high` bar. Rules 5 and 7 plus
accessibility.

### F3 — medium — Search-result activation destroys focus and announces nothing
`focus()` at `components/course-graph.tsx:139-149` calls `setSearch("")`, which
unmounts the `.graph-search-results` buttons rendered at `:151`. The button the
user just activated is removed from the DOM, so focus falls to `<body>` and a
keyboard user restarts tabbing from the top of the app shell. Nothing is
announced: the `role="status"` live region at `:158` carries only
`{nodes} courses · {edges} links`, and for an on-map course in program scope the
counts are unchanged, so activation is completely silent while the viewport
silently recenters (`:148` → `centerNode`, `:34`). Rules 3 and 7. Since search is
the only keyboard-usable route to selecting a course (see F2), this compounds.

### F4 — medium — Default layout is a grid, not a dependency layering, so the links are unreadable
In program scope, positions are assigned by list index —
`course-graph.tsx:107-109` sorts by requirement type then course code and lays
out at `(index % columns, floor(index / columns))`. Nodes are therefore ordered
alphabetically, not topologically, so the 80 edges cross the whole grid and pass
behind unrelated chips (visible throughout the screenshot). Active vs inactive
edges differ only by `#64748b` vs `#98a2b3` stroke and `1.8` vs `1.2` width
(`course-graph.tsx:130`) — two mid-greys, no shape or dash difference — so
tracing a chain by eye is not practical at the default zoom. Modern usability:
visual hierarchy. This overlaps `user_advocate`'s job-to-be-done question (can
an operator actually read a prerequisite chain here); I am scoring only the
hierarchy/encoding break, not their live verdict.

### F5 — medium — Completion status is carried by colour alone
`nodeClassFor` (`course-graph.tsx:64-66`) returns `graph-completed` when the
course is in history, which changes only the background
(`app/globals.css:374`, `--green-soft #e9f5ed`). The `kind` string still reads
"Required"/"Breadth"/"Elective" (`course-graph.tsx:102`), the node `aria-label`
(`:40`) and `ariaLabel` (`:103`) never mention completion, and the tooltip does
not either. Against the neighbouring pastels — `--blue-soft #eef4ff`,
`--purple-soft #f3eefc`, `#eef0f3` (`app/globals.css:372-375`) — "completed"
versus "breadth" is a near-invisible hue shift on a 152px chip, and it is
invisible to colour-blind and screen-reader users. WCAG 1.4.1. The legend at
`course-graph.tsx:152` cannot compensate: its swatches are 16×10px
(`app/globals.css:389`) of the same pastels.

### F6 — medium — The recovery affordances the copy points at are below the fold
`.flow-canvas` is `min(78vh, 820px)` (`app/globals.css:362`), and `MiniMap` /
`Controls` render at the canvas edges (`course-graph.tsx:198-199`). At default
scroll on the screenshot's viewport the canvas bottom — and with it the minimap
and zoom controls — is cut off; only React Flow's attribution is partly visible.
The hint that tells the user what to do about the crowding ("use the minimap or
Fit to view", `course-graph.tsx:216`) is itself rendered *after* the canvas
(`app/globals.css:363`), i.e. also below the fold, so the guidance and the
controls it names are both invisible at the moment of confusion. "Fit to view"
in the header (`:151` → `FitToViewButton`, `:59-62`) is the one on-screen
recovery, which is good, and is why this is medium rather than high.

### F7 — medium — Small text sits below AA contrast, and node meta text is ~8.5px
`--muted: #8a93a0` (`app/globals.css:10`) on white is ≈3.1:1 — under the 4.5:1
AA floor for normal-size text — and it colours several strings this ticket
added or relies on: the `role="status"` count and panel heading
(`app/globals.css:360`, `course-graph.tsx:158`), the canvas hint
(`app/globals.css:363`), the "No matching courses" message
(`app/globals.css:351`), and `.graph-node-bottom` (`:382`). Separately, node
meta ("REQUIRED", "4 CR") renders at `0.53rem` ≈ 8.5px uppercase with
letter-spacing (`app/globals.css:379`) and the bottom row at `0.55rem`
(`:382`); root stays at the 16px default (`body` sets `14.5px`,
`app/globals.css:40`, but `rem` resolves against `html`). The chosen course code
at `0.95rem` (`:370`) is fine — the surrounding metadata is the problem. This is
an objective accessibility floor, not an aesthetic preference.

### F8 — low — Scope round-trip discards the user's pan/zoom work
`components/course-graph.tsx:174` keys `<ReactFlow>` on
`depth === "program" ? "program" : "${focusCode}-${depth}"`, so every scope or
focus change remounts the canvas and resets the viewport
(`:180-184`). Returning from "Immediate neighborhood" to "Entire program"
restores the *mode* but not the position the user had panned/zoomed to. Reversal
of state is incomplete (rule 6).

### F9 — low — `aria-label` on role-less containers, and a skip target that is not focusable
`aria-label="Map legend"` on a plain `<div>` (`course-graph.tsx:152`) and
`aria-label="Map display"` on the `.segmented-control` `<div>` (`:159`) are
dropped by assistive tech, since ARIA does not expose `aria-label` on generic
elements. The skip link `:154` targets `#graph-inspector`, which is an `<aside>`
with no `tabIndex={-1}` (`:218`), so activation moves the sequential-navigation
point but does not focus or announce the destination.

### F10 — low — Map click and Table click do different things with the same-looking affordance
On the canvas, clicking a course selects it into the inspector
(`course-graph.tsx:193`, `onNodeClick` → `setSelectedCode`). In Table view, the
course-code button opens the full-details modal instead
(`:208`, `openCourse(node.id)`). Same object, same visual language, two
different outcomes across the toggle — a consistency wobble (rule 1) and a small
surprise for anyone switching views mid-task.

### F11 — low — `setCenter` animation is not gated on reduced-motion
`app/globals.css:688` zeroes CSS transitions under
`prefers-reduced-motion: reduce`, but the JS-driven viewport glide at
`course-graph.tsx:34` (`duration: 180`) is outside that scope. Short, hence low.

## Shneiderman's Eight Golden Rules — one note each

1. **Consistency** — Mostly held: shared `PageHeading`, `search-field`, badge and
   `text-button` vocabulary carry over from Course Explorer, and
   `aria-pressed` is used correctly on the Map/Table toggle
   (`course-graph.tsx:160-161`). Two breaks: identical-looking course affordances
   behave differently across Map vs Table (F10), and two adjacent scope controls
   use two different widgets — a segmented control for view (`:159`) beside a
   `<select>` for depth (`:164`).
2. **Shortcuts for frequent users** — Reasonably served: in-graph search jumps
   straight to a course (`:151`), the depth `<select>` is a one-action scope
   switch, and "Fit to view" is duplicated in the header for reach
   (`:59-62`). No hotkey to focus the search field, and no keyboard equivalent
   for node traversal at all (F2), so the expert path is pointer-biased.
3. **Informative feedback** — Weakest rule here. The `role="status"` count
   (`:158`) is a genuinely good addition and does announce scope changes, and
   `LoadingState` covers the dynamic import (`app/map/page.tsx:5`). But the
   headline interaction is silent (F1) and search activation confirms nothing
   (F3).
4. **Closure** — Flows do terminate: select → inspector → "Add to Plan"
   (`:234`, routed through `openPicker` so there is a confirm step) or "Full
   course details" (`:235`). Scope changes restate where you are ("Entire …
   program" / "Focused on **X**", `:156`). Acceptable.
5. **Simple error handling** — Prevention is good: `nodesDraggable={false}` and
   `nodesConnectable={false}` (`:187-188`) remove the classic
   accidental-graph-edit mistakes; unknown courses degrade to explicit copy
   rather than blanks ("Metadata not in this catalog", `:103`; "External course
   reference", `:221`). The Course Explorer empty state is the strongest piece of
   error copy in the change: `app/courses/page.tsx:85` names the exact rejected
   code (`${search} is not in this catalog.`, gated by `looksLikeCode &&
   !knownCode` at `:60-61`), explains the catalog's scope, and offers "Reset all
   filters" — recognition, reason, and recovery in one block. Minor nit: that
   reset label is filter-shaped even when the only input was a typo'd code.
6. **Easy reversal** — Nothing on this page is destructive; scope, view, and
   selection are all freely reversible, and the inspector surfaces explicit
   returns ("Show entire program", `:223`). Incomplete only in that reversal
   loses viewport state (F8).
7. **Internal locus of control** — Mostly user-initiated, and the off-map
   disclosure is a real courtesy: search results append "· not on this view —
   opens neighborhood" *before* the click (`:151`), so the scope switch at
   `:143-146` is disclosed rather than sprung. Undercut by focus being taken
   away from the user on that same activation (F3).
8. **Reduce short-term memory load** — The persistent inspector, legend, and
   scope heading are the right instincts. But compact mode hides every course
   title on the canvas (`app/globals.css:367`) while the tooltip does not carry
   the title either (`course-graph.tsx:50-52`), so the default map is 114 bare
   codes; and the unlocks list gives codes the user must then find by eye (F1).
   Recall is doing work that recognition should do.

## Modern usability — one note each

- **Clarity and simplicity** — Copy is careful and non-overclaiming ("Each arrow
  is a parsed reference, not an AND rule", `:237`; "A connection does not verify
  course availability", `:240`), which is a real strength. Noise: the node count
  is stated twice (`:158` and `:216`), and a page-level search sits directly
  under a global topbar search with a different scope.
- **Visual hierarchy** — The primary action ("Add to Plan") is correctly the only
  filled red button on screen, and the inspector reads cleanly. The canvas does
  not: alphabetical grid placement plus two near-identical edge greys means the
  eye gets no help finding structure (F4), and the emphasis channel that should
  provide it is dead (F1).
- **Accessibility** — Good bones: skip link (`:154`), `sr-only` table caption
  (`:203`), `scope` attributes on table headers, per-node `aria-label`s, a live
  count region, and `edgesFocusable={false}` to keep 80 edges out of the tab
  order. Blocked by pointer-only node interaction (F2), colour-only completion
  (F5), sub-AA muted text and ~8.5px meta labels (F7), and dropped
  container labels (F9).

## Notes on scope

- No product files were modified. Only this artifact was written.
- No numeric score assigned; no self-scoring.
- `ycm-harness review *` was not run; no harness review JSON written.
- Fix implementations are deliberately not proposed.
- `user_advocate` owns the live-flow / problem-solved verdict; F4 is flagged as
  the single point of overlap.
