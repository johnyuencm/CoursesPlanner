# user_advocate review — skill-tree-map

Verdict: **PASS** (no high findings; the five jobs are completable live)

Goal / jobs: (1) directed unlock arrows, not undirected lines; (2) readable catalog
description without cards/MiniMap covering a tooltip; (3) graph nodes that look
like catalog CourseCards; (4) RPG lock/eligible/completed; (5) idle no-prereq
courses in a labeled band, not a junk pile. Follow-up `5943b04` also wanted
CS 5011 kept with CS 5010 (linked, no undirected line).
Reviewed state: branch `fix/complete-prereq-graph`, HEAD `5943b04`
(`Keep corequisite partners in the skill tree instead of the no-prereq band.`).
Reviewer is not the implementer. No product file was modified. The only file
written is this artifact. Lite phase 2: no `uiux` seat, so Shneiderman /
interaction-design notes live here.

`cursor-ide-browser` did not stay alive (`browser_tabs` created `viewId`s that
vanished before `browser_navigate` / `browser_lock`). Live evidence is
Chrome 152.0.7977.83 Headless over DevTools Protocol against
`http://localhost:3000/map` (driver outside the repo at
`%TEMP%\ua-live-5943b04\`; screenshots `01`–`12`). Viewport override 1680×1100.

Phase-1 `tech_lead` / `project_manager` artifacts are PASSes with no unrebutted
high. This seat does not re-litigate spec or architecture. Live UI matches their
arrow / inspector / banding claims. PM-2 is confirmed live (UA-1). PM-1 (eligible
pill ellipsis) is **not** confirmed as unreadable at this viewport — compact cards
show the full phrase “Prerequisite eligible”.

## How this was exercised — live

| Step | What happened |
| --- | --- |
| Default `/map` (empty plan) | Heading `Entire MSCS Seattle program`. Status `114 courses. 79 unlock arrows. Selected CS 5010.` Inspector: CS 5010, **Prerequisite eligible**, 4-line clamped description, Unlocks chips CS 5400/5500/6510/7980, Corequisites CS 5011. MiniMap **0**. Hover tooltip DOM **0**. Description vs cards `descOverlap: []`. Visible edges use `marker-end` `arrowclosed`, `stroke-dasharray: none`, aria `X unlocks Y`. No `CS 5010`–`CS 5011` edge. Camera on CS 5010 (`translate(411.5px, -1954px) scale(1)`). Idle band **not** on first paint. `01-default-map.png`. |
| Find `zzzznomatch` | Status `No matches`. Copy `No matching courses. Try another code or title.` Escape clears. `02-find-nomatch.png`. |
| Inspector chip CS 5500 | Selected CS 5500. Inspector **Locked**. Description readable, no overlay. Arrow `CS 5010 unlocks CS 5500` emphasized. `dialog.open === false`. `03-select-5500.png`. |
| Show neighborhood | `Focused on CS 5500`. `4 courses. 5 unlock arrows.` Nodes CS 5010 / CS 5004 / CS 5500 / CS 6510. Five directed arrows, no coreq stroke. CS 5010 Eligible; 5500/6510/5004 Locked. **Show entire program** present. `04-neighborhood-5500.png`. |
| Fit to view | Scale **0.15**. 114 nodes, **79** directed edges, **0** dashed, MiniMap 0. One band label `No prerequisite required`. CS 5011 `translate(0px, 3840px)` above the band; CS 5150 `translate(0px, 4088px)` in the band. `pair5010_5011: []`. Codes thumbnail-sized. `05-fit-to-view.png`. |
| Find CS 5150 | Lands on the labeled idle grid (5150 / 5520 / 5610 / …), all **Prerequisite eligible**, no prereq/unlock chips. CS 5011 sits **above** the band, not in it. `06-find-5150.png`. |
| Find CS 5011 | Card title `Recitation for CS 5010`, Core, Eligible, **0 cr**. Inspector Corequisites chip `CS 5010`. `edges5011: []`. Immediately above `NO PREREQUISITE REQUIRED`. Nearby: CS 5600 above, idle band below. `07-find-5011.png`. |
| Full course details | Drawer opens. Full blurb + “Take together · corequisites CS 5010”. Map stays behind the overlay (no tooltip fight). `08-details-5011.png`. |
| Mark CS 5010 completed (drawer) | Toast `CS 5010 marked completed…`. Node aria `… Core. Completed.` Inspector Completed. Add to Plan gone. `10-completed-5010.png`. |
| Chip CS 5500 after that | Inspector **Prerequisite eligible**. Node not `graph-locked`. MiniMap 0, descOverlap []. `11-5500-after-complete.png`. |
| Neighborhood after complete | CS 5010 **Completed** → CS 5500 **Prerequisite eligible** → CS 6510 **Locked**. Five unlock arrows. `12-neigh-after-complete.png`. |

## The five jobs

| # | Job | Live result |
| --- | --- | --- |
| 1 | Directed unlocks, not undirected lines | **met.** 79 closed-arrow unlock strokes; selected chain darker; legend “Unlocks after this course”; no 5010–5011 line (`07-5011.json` `edges5011: []`). Coreq is inspector/table copy only (`components/course-graph.tsx:146,222-235`). |
| 2 | Read description (cards/MiniMap covering tooltip) | **met.** Description is the inspector rail (`:472`), 4-line clamp (`app/globals.css:404`), never overlapping canvas cards. MiniMap and `.graph-node-tooltip` absent. Hover probe 0 tooltips. Full text is **Full course details**. |
| 3 | Graph looks like catalog CourseCards | **met.** Compact nodes: requirement badge, status pill, `.course-code`, title, credits, core red top border (`course-graph.tsx:68-78`, `app/globals.css:372-377`). Not `<CourseCard compact />`; chrome matches. |
| 4 | RPG locked / eligible / completed | **met.** Empty plan: 5010 Eligible, 5500 Locked. After **Mark completed** on 5010, 5500 becomes Eligible and 6510 stays Locked. Locked cards remain on the map (grey mute `app/globals.css:378-379`). Legend names all three states. |
| 5 | Idle no-prereq categorized | **met.** Labeled `No prerequisite required` / legend “Startable, unlinked”. CS 5150 and peers pack as a startable grid. CS 5010 stays a tree root. CS 5011 is **not** in that band after `5943b04`. |

## Findings

### UA-1 (medium) Recitation still reads as a leftover at the idle-band seam

`5943b04` correctly pulled CS 5011 out of “No prerequisite required”, but live Find CS 5011 (`07-find-5011.png`) still shows a **Core / Prerequisite eligible** card with **no unlock arrow**, parked immediately above the idle-band label, with CS 5600 above and CS 5150 below. Graph-space y: CS 5010 `2304`, CS 5011 `3840`, CS 5150 `4088` (`05-fit.json`). Test title “beside CS 5010” only asserts same column (`tests/graph.test.ts:130-139`). Inspector Corequisites and the card title recover the pairing; the map itself does not. Same operator miss as PM-2. Not a high: the student is not stuck, the five jobs still complete, and 5011 is no longer labeled startable-unlinked.

No other `high` / `medium`.

### Live nits (not scored)

- **First paint** centers CS 5010 at zoom 1 (`course-graph.tsx:428-430`). The idle band and 5010→5500→6510 chain are off-canvas until Fit, Find, or an Unlocks chip. Neighborhood is where the RPG story is obvious on one screen.
- **Fit to view** of the whole program is `scale(0.15)` — codes ~29×14 CSS px (`05-fit-to-view.png`). Recover with zoom or Find. Named leftover.
- Inspector description is still 4-line clamped (TL-3). Job 2 was coverage, not clamp; **Full course details** shows the rest.
- Eligible pill `max-width: 58%` (`app/globals.css:385`) measures 108 vs 103 px (~5 px). At 1680×1100 the phrase still reads in screenshots. Not filed.
- Completing from the map requires **Full course details → Mark completed**. The inspector does not mark complete. Toast + pill update are enough once you take that step.
- Map Table was not clicked this pass.

## Discoverability / errors / anti-patterns

- **Discoverability:** Prerequisite Graph is a left-nav item. Page copy, `role="status"` (`114 courses. 79 unlock arrows`), legend (Core/Breadth/Elective, Completed/Eligible/Planned/Locked, unlock arrow, idle band), Find (Ctrl+F), Fit to view, and the canvas hint (`course-graph.tsx:462`) name the new behavior without reading source. Default-selected CS 5010 already lists Unlocks and Corequisites.
- **Error messages:** Empty find says what to do (`Try another code or title.`). Catalog-not-ready was not hit (catalog loaded). No new dead-end.
- **Anti-patterns checked:** MiniMap/tooltip covering is gone. Completing 5010 is confirmed with a toast, not silent. Chip CS 5500 pans/selects; it does not steal focus into a dialog. Neighborhood is opt-in. No blocking prompt, no irreversible action without an explicit Mark completed. First-paint hiding the band is a hunt, not a trap (Find CS 5150 / Fit recover).
- **Accessibility of the change:** ordinary local web app at `localhost:3000`. No extra TTY, admin, or network rights. `cursor-ide-browser` is not required for a human student. Skip-to-inspector exists (`course-graph.tsx:402`). Node select buttons expose `aria-label` with code, title, badge, and status. React Flow `nodesFocusable={false}` (`:436`) still leaves the inner `<button class="graph-node-main">` as the control (not re-tab-walked this pass). Pills use text + color, not color alone.

## Problem solved?

Yes. A student who was confused by undirected lines can follow closed **unlock** arrows (and a selected chain). The catalog blurb is in the right-hand inspector, not under a MiniMap or node tooltip. Compact nodes read as CourseCards. Completing CS 5010 visibly unlocks CS 5500 and leaves CS 6510 locked. Startable electives sit under **No prerequisite required** instead of mixing into the tree. The remaining operator bruise is CS 5011’s seat at the band lip (UA-1), not a return of the five original failures.

## Shneiderman / usability (lite; no uiux seat)

1. **Consistency** — Map nodes reuse CourseCard tokens (badge, pill, code, title, credits, core top bar). Status words match the legend and inspector. Table was not clicked; Map-click selects, inspector **Full course details** opens the same drawer as catalog.
2. **Shortcuts for frequent users** — Ctrl+F / F3 find, Fit to view, Show scope, skip-to-inspector, Unlocks/Corequisite chips. Completing a course is still a details-drawer action, not a map shortcut.
3. **Informative feedback** — `role="status"` counts courses and unlock arrows. Selected chain thickens; focused node gets a blue ring. Mark completed toasts. Locked cards mute.
4. **Closure** — Neighborhood ↔ Entire program; details drawer open/close; find Escape. Completing 5010 is a finished action with a toast.
5. **Simple error handling** — No-match find names the miss and what to try. Locked CS 5500 still shows why (prereq expression + chips), not a dead card.
6. **Easy reversal** — Show entire program, Escape find, drawer close. Mark completed is reversible in the same drawer (not clicked this pass). Viewport remounts on scope change (`course-graph.tsx:421`).
7. **Internal locus of control** — Neighborhood / Fit / Find / chips are deliberate. First-paint camera on CS 5010 chooses a root for the student; the rest of the program is one Fit away.
8. **Reduced short-term memory load** — Inspector holds description and rules so the student need not hover. RPG states are on the card. CS 5011 pairing is the memory-load miss (UA-1): take-together is in the inspector, not next to CS 5010 on the canvas.

**Clarity / hierarchy / accessibility:** legend + pills + card titles carry status; locked mute is extra to the red Locked pill (not color-only). Inspector is a right rail at 1680px (`inspectorLeft: 1325`), not covering the canvas. Keyboard: find, skip link, node buttons; no NVDA/JAWS or 390px mobile pass. At `max-width: 1180px` CSS stacks the inspector under the map (`app/globals.css:613-617`) — not live-driven this pass.

## Not done by this review

- `cursor-ide-browser` unavailable; live pass used standalone Chrome CDP.
- No 1366×768, 390px, or screen-reader pass. Map Table not clicked.
- Did not re-run `npm test` / typecheck — phase 1 covered those; live UI did not contradict them.
- `ycm-harness review *` was not run. No harness review JSON was written.
- Fix implementations are not proposed.
