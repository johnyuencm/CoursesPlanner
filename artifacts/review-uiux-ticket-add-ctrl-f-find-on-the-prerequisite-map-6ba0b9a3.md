# UI/UX review — ticket-add-ctrl-f-find-on-the-prerequisite-map-6ba0b9a3

- Reviewer role: `uiux` (independent; not the implementer)
- Model note: required `kimi-k3-high` is not in this session's allowlist, so this
  seat ran on `cursor-grok-4.6-xhigh`. Rule set applied unchanged
  (Shneiderman's Eight Golden Rules + modern usability).
- Repo / branch / product commit: `C:\Users\user\Desktop\github\CoursesPlanner`,
  `fix/complete-prereq-graph`, product `4a9be0d` (workspace HEAD `1d0a239` is
  harness ledger only).
- Pairing: `user_advocate` owns job-to-be-done / live operator value. This seat
  owns interaction design of the map find surface only.
- Verdict: **PASS** (no finding meets the high bar: cannot complete the task,
  irreversible action without confirmation, inaccessible primary flow, or
  trapped mode with no exit)

## Evidence basis

- Code: `components/course-graph.tsx`, `lib/graph.ts` (`findCourses`,
  `wrapFindIndex`, `shouldAutoLocateFind`), `app/globals.css`,
  `components/app-shell.tsx` (topbar search), `app/map/page.tsx`.
- Copy judged: placeholder `Find a course (Ctrl+F)`; live status
  `{n} of {N}` / `0 of {N}` / `No matches`; empty-state
  `No matching courses. Try another code or title.`; off-map row suffix
  ` · not on this view — opens neighborhood`; page description
  `Press Ctrl+F to find a course on the map.`; canvas
  `Press Control F to find a course, then Enter or F3 for the next match.`
- Live: `GET http://localhost:3000/map` → **200**. `cursor-ide-browser` could
  not hold a tab in this seat (create → navigate → "no browser tab" /
  "view not found"), so keyboard/visual claims are from source, not a
  screenshot or Tab pass.

## Findings

### F1 — medium — Status says `0 of N` and the map does not confirm a hit until Enter or auto-locate
`onChange` resets `findIndex` to `-1` (`course-graph.tsx:257`). Auto-locate
runs only when there is one match or the needle is ≥4 characters
(`lib/graph.ts:280-283`, `course-graph.tsx:163-171`). For everyday prefixes
(`cs`, `50`, `disc` with several hits) the live region is
`` `${findIndex >= 0 ? findIndex + 1 : 0} of ${matches.length}` `` (`:240`),
i.e. the exact string **`0 of 12`**. No row has `aria-current`
(`:288-289`). The canvas still shows the previous selection's blue ring
(`.graph-focused`, `app/globals.css:384`). Next/prev stay enabled (`:278-279`).
Enter does wrap to the first hit (`wrapFindIndex(-1, n, 1)` → `0`), so the
task is completable. The status the user is told to trust looks like failure.
Rules 3, 8 + accessibility (the only `role="status"` on the widget).

### F2 — medium — Locating an off-map course changes map mode; Escape does not undo it
`locate` sets `selectedCode` / `focusCode` and, when `!visible.has(code)`,
`setDepth("1")` (`course-graph.tsx:205-210`), remounting React Flow
(`key`, `:323`). Click path discloses ` · not on this view — opens neighborhood`
(`:293`). Auto-locate (`:168-170`) can take the same path without that click
when the top match is off the program set (unique catalog-only hit, or no
on-map scores). Escape only clears the query and blurs (`:262-266`); it does
not restore program scope or the prior selection. Recovery exists:
**Show entire program** (`:372`) and the depth `<select>` (`:312-318`). Not
trapped, not irreversible. Rules 4, 6, 7.
Overlap with `user_advocate` if they score "did find leave me on the program
map I was searching?"

### F3 — medium — Find is a browser-find chrome glued to a raw button list, not a combobox
The field is a labeled `type="search"` (`:246-255`) with next/prev
`aria-label`s (`:278-279`). It is not `role="combobox"`; the panel is a
`<div>` of `<button>`s with no `role="listbox"` / `option`, no
`aria-expanded`, no `aria-activedescendant`. `aria-controls` and
`aria-describedby` (`:253-254`) point at nodes that are unmounted while the
query is empty (`:276`, `:282`). Tab order after the field is Previous → Next
→ every hit (`:283-295`) → Fit to view (`:299`). A `cs` query can put dozens
of stops before the next toolbar control. ArrowUp/Down immediately `cycle`
and pan (`:267-272`) instead of moving a list highlight. Screen-reader users
still have Ctrl+F, the count live region, labeled next/prev, and Enter.
Not an inaccessible primary flow. Rules 2, 7, 8 + accessibility.

### F4 — medium — Two search pills on `/map` with different jobs
Topbar: `Search courses, topics, or keywords…`
(`components/app-shell.tsx:55-57`) opens a course dialog or `/courses?q=`.
Map heading: `Find a course (Ctrl+F)` (`course-graph.tsx:255`) pans the
graph. Same `Search` icon and pill shape (`.top-search` / `.search-field`).
Ctrl+F correctly targets the map field (`:181-186`) and skips dialogs
(`:179`). Beginners who use the always-visible topbar never pan. Rule 1, 8.

### F5 — medium — Match count, kbd hint, and empty copy sit on `--muted`; current row is fill-only
`.graph-find-count` is `var(--muted)` at `0.68rem` (`app/globals.css:347`);
`.graph-find-kbd` is `0.62rem` muted (`:348`); empty results `<p>` is muted
`0.72rem` (`:358`). `--muted: #8a93a0` on white (`:10`) is ~3.1:1, below AA
for the widget's status text. Current hit and hover share one rule
(`.graph-search-results button:hover, … .graph-find-current`, `:355`) —
red-soft fill, no extra mark for sighted users (`aria-current` is AT-only).
Crosshair icons on every row (`course-graph.tsx:294`) do not mark the
current match. Accessibility (contrast, not color/fill alone).

### F6 — medium — Canvas "find highlight" is only selection; a map click desyncs from the find cursor
Success on the graph is `.graph-focused` on `selectedCode`
(`course-graph.tsx:123`, `app/globals.css:384`), not a find-specific treatment.
`onNodeClick` only `setSelectedCode` (`course-graph.tsx:342`) and does not
clear search or move `findIndex`. After a hit, clicking another chip leaves
the dropdown `aria-current` on the find row while the inspector/ring follow
the click. Table reuses `.graph-find-current` for **selection**, not find
index (`:356`). Rules 1, 3.

### F7 — low — Escape is bound only on the field; close is not labeled while find is active
Window capture handles Ctrl/Cmd+F and F3 / Ctrl+G (`:176-193`), not Escape.
Escape is `input.onKeyDown` only (`:262-266`). While a query is present the
visible `Ctrl+F` `<kbd>` is replaced by the count (`:276`); there is no
Close/Clear control besides UA `type="search"` chrome. Placeholder and kbd
say **Ctrl+F** on a page that also binds Meta+F (`:185`, `:252`). Mobile has
no Escape key; the field itself remains the beginner path. Rules 4, 6.

### F8 — low — Find pan ignores `prefers-reduced-motion`
CSS transitions collapse (`app/globals.css:696-698`). `centerNode` still
animates `duration: 180` (`course-graph.tsx:33`) on every locate/cycle.
Accessibility.

### F9 — low — Results panel can cover the legend and the top of the canvas
`.graph-search-results` is `max-height: min(320px, 50vh)` (`app/globals.css:353`)
stacked from the heading field onto legend + canvas. On small viewports the
canvas is `min(62vh, 560px)` (`:677`), so the list can eat most of the
surface that is supposed to show the highlight. Dismiss is Escape or
clearing the query. Visual hierarchy / feedback.

## Shneiderman's Eight Golden Rules — one note each

1. **Consistency** — Reuses `.search-field`, heading actions, chevron next/prev
   like a browser find bar, and `aria-pressed` Map/Table. Breaks: topbar
   Search vs map Find (F4); map click vs find cursor (F6); table
   `.graph-find-current` means selected, dropdown means find index; kbd
   `Ctrl+F` vs working Cmd+F.
2. **Shortcuts for frequent users** — Ctrl/Cmd+F focuses and selects the
   query (`:181-186`); Enter / Shift+Enter, F3 / Shift+F3, Ctrl/Cmd+G, and
   ArrowUp/Down cycle (`:188-192`, `:258-272`). Visible next/prev and the
   field itself keep a beginner path. F3/G are only named on the canvas
   `aria-label` (`:344`), not on the field. Tab-through-all-hits (F3 finding)
   slows keyboard experts.
3. **Informative feedback** — Dropdown appears as soon as the query is
   non-empty; `role="status"` updates; empty state tells the user to try
   another code or title (`:296`). Auto-locate pans unique / long queries.
   Gap: `0 of N` plus no canvas change for short multi-match queries (F1);
   muted count (F5); no distinct find chrome on the node (F6).
4. **Closure** — Idle: empty field + `Ctrl+F` kbd. Middle: typing, list,
   count, next/prev. Done for the find session: Escape clears and blurs
   (`:262-266`). Done for "I am looking at that course": inspector heading
   + selected ring. Scope change from an off-map hit is a second, uncleared
   mode (F2).
5. **Simple error handling** — No matches: count `No matches` + recovery
   sentence (`:240`, `:296`); next/prev disabled (`:278`). Off-map rows warn
   before click (`:293`). Prefix typos that still match something fail open
   (list of near-hits) rather than a hard error. Contrast makes the recovery
   sentence easy to miss (F5).
6. **Easy reversal** — Find itself is non-destructive. Escape / UA search
   clear restores the empty field, not pan, selection, or depth (F2, F7).
   **Show entire program** reverses neighborhood. Nothing needs a confirm
   dialog.
7. **Internal locus of control** — User starts find (Ctrl+F or click field).
   Auto-locate at 4 characters or a unique match pans and may remount the
   graph without a further gesture (F2). Arrow keys on the field move the
   map, not just a list caret (F3). Canvas click does not take over the find
   session (query stays), which is good control, but then two currents
   compete (F6).
8. **Reduce short-term memory load** — Codes and titles stay visible in the
   list; off-map consequence is on the row; page description names Ctrl+F.
   Users must remember that `0 of N` still means "press Enter", that topbar
   search is not map find, and that Escape will not put them back on Entire
   program (F1, F4, F2).

## Modern usability — one note each

- **Clarity and simplicity** — Field, count, next/prev, and list each have a
  job. Decorative Crosshair on every row (`:294`) and the idle `Ctrl+F` kbd
  are extra but not noisy. Duplicate teaching (heading description +
  placeholder + kbd + canvas aria-label) is consistent, not conflicting,
  except Ctrl vs Cmd.
- **Visual hierarchy** — Find sits in `heading-actions` with Fit to view;
  toolbar is capped at `min(520px, 100%)` (`app/globals.css:543`). Primary
  action is the field. Count is the weakest text in the control (F5). Open
  list (shadow, z-index 25) correctly dominates, then risks hiding the
  canvas confirmation (F9). Selected-course ring remains the only in-map
  emphasis for a hit.
- **Accessibility** — Named field, `aria-keyshortcuts`, labeled prev/next,
  live count, `aria-current` on the active row, dialogs excluded from
  Ctrl+F, skip link unchanged. Remaining: invalid describedby/controls when
  idle (F3), `0 of N` announced as status (F1), sub-AA muted status (F5),
  hover==current fill (F5), long Tab list (F3), find pan not
  reduced-motion gated (F8), 28×28 prev/next (`:350`) pass WCAG 2.5.8 (24px)
  but sit under 44px. Primary keyboard flow (Ctrl+F → type → Enter → Escape
  with focus in the field) can complete the task.

## Notes on scope

- No product files were modified. Only this artifact was written.
- No numeric score assigned; no self-scoring.
- `ycm-harness review *` was not run; no harness review JSON written.
- Fix implementations are deliberately not proposed.
- `user_advocate` owns whether live Ctrl+F / cs5500 / PHYS 5116 / Escape
  solve the culled-node job. F2 is the one overlap (scope change vs staying
  on the map being searched).
