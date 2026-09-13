# user_advocate review — ticket-lay-out-the-program-map-as-a-prerequisite-flow-bd746304

Verdict: **PASS** (no high findings; the student can finish the job live)

Goal / job: a student opening Prerequisite Graph should see a left-to-right
prerequisite flow (CS 5004 / CS 5010 before CS 5500 before CS 6510), keep
no-arrow courses on the map, and use inspector code chips to jump the camera
instead of landing in a course-details dialog.
Reviewed state: branch `fix/complete-prereq-graph`, HEAD `4ed94c1`
(`Pan the program map from inspector chips and render the prerequisite flow.`).
Reviewer is not the implementer. No product file was modified. The only file
written is this artifact.

`cursor-ide-browser` did not stay alive (create tab → `Browser view not found`
on navigate). Live evidence is Chrome 152.0.7977.83 Headless over DevTools
Protocol against `http://localhost:3000` (driver outside the repo at
`%TEMP%\ua-live-4ed94c1\`; screenshots `01`–`07`). Viewport override 1680×1100.
Numbers below are `getBoundingClientRect` / `getComputedStyle` × viewport
`scale` on `.graph-course-node .graph-node-main strong`, plus React Flow
`style.transform` (graph space).

Phase-1 `tech_lead` / `project_manager` artifacts at this HEAD are PASSes with
no unresolved high. This seat does not re-litigate spec or architecture. Live
UI did not contradict their layout or neighborhood membership claims. Visual /
Shneiderman checklist lives in
`artifacts/review-uiux-ticket-lay-out-the-program-map-as-a-prerequisite-flow-bd746304.md`;
this seat does not restage F12–F14.

## How this was exercised — live

| Step | What happened |
| --- | --- |
| Default `/map` | Heading `Entire MSCS Seattle program`. Status `114 courses · 80 links. Selected CS 5010.` Viewport `translate(426px, 382px) scale(1)` (onInit centers CS 5010). Course-code text **15.2 CSS px**. First-paint DOM includes `CS 5010`, `CS 5004`, `CS 5800`, `CS 5100`. `CS 5500` and `CS 6510` are **not** in the first-paint node list (`onlyRenderVisibleElements`). Canvas hint names left-to-right chains, the below-flow pack, and inspector-chip jump. `01-default-map.png`. |
| Unlock chip `CS 5500` (from CS 5010 inspector) | Selected `CS 5500`. Viewport panned to `translate(-230px, 254px) scale(1)`. `dialog.open === false`. Graph-space transforms: CS 5004 `translate(164px, 384px)`, CS 5500 `translate(656px, 128px)`, CS 6510 `translate(1148px, 64px)` → 164 < 656 < 1148. Screenshot shows CS 5500 with CS 6510 to its right; no details drawer. `02-chip-cs5500.png`. |
| Prereq chip `CS 5004` (from CS 5500 inspector) | Selected `CS 5004`, viewport changed again, `dialog.open === false`. |
| Show neighborhood of CS 5500 | Heading `Focused on CS 5500`. Status `4 courses · 5 links`. Node ids exactly `CS 5010`, `CS 5004`, `CS 5500`, `CS 6510`. CS 5004 and CS 5010 sit left of CS 5500; CS 6510 sits right. **Show entire program** present. `03-neighborhood-5500.png`. |
| Off-view chip `CS 5400` (CS 5010 inspector while still on the CS 5500 neighborhood) | Heading becomes `Focused on CS 5400`. Status `5 courses · 4 links`. Nodes `CS 5010`, `CS 5004`, `CS 5400`, `CS 6410`, `CS 7470`. `dialog.open === false`. Recovery: **Show entire program**. `04-chip-offview-5400.png`. |
| Full course details | Drawer opens. Eyebrow `CS 5400`, title `Principles of Programming Language`. `05-full-course-details.png`. |
| Fit to view (reload default program map) | All **114** nodes in the DOM. Isolates pack below the connected flow (`CS 5150` `translate(0px, 720px)` vs CS 5500 `y=128`). `CS 5800` `translate(0px, 128px)`, `CS 5100` `translate(0px, 192px)` stay in the connected column. `06-fit-to-view.png`. |
| Course Explorer `/courses?q=CS 5500` | Status `1 course`. **Details** opens the same course-details drawer (eyebrow `CS 5500`). `07-catalog-details.png`. |

## Re-check list (requested)

| Check | Live result |
| --- | --- |
| Default `/map`: CS 5004 and CS 5010 left of CS 5500; CS 5500 left of CS 6510; codes ~15px | **met in layout and after one chip pan.** Default zoom is 15.2px. Graph-space x-order is 0 / 164 / 656 / 1148. First paint does not put CS 5500 / CS 6510 on the canvas (camera on CS 5010); clicking the CS 5500 unlock chip pans to that order without a dialog. Immediate neighborhood shows the four-course story on one screen. |
| No-arrow courses still on the map, packed below; CS 5800 and CS 5100 present | **met.** Fit-to-view shows the connected flow on top and a packed isolate grid below. `CS 5150` at y=720. `CS 5800` and `CS 5100` are on the default map in the connected column (they unlock others). |
| Inspector chips: select+pan if on this view; else open that neighborhood; must not open details. Explorer / Full course details still open details | **met.** On-view CS 5500 / CS 5004 chips pan and select. Off-view CS 5400 chip remounts that neighborhood. No chip opened `dialog`. Full course details and Course Explorer Details still open the drawer. |
| CS 5500 Immediate neighborhood still 4 courses | **met.** Exact set CS 5004, CS 5010, CS 5500, CS 6510. |

## Findings

None at `high` or `medium`.

`ack_zero_findings_reason`: Live clicks at `4ed94c1` let a student finish the stated job: the program map is no longer a type/code grid (5004/5010 sit left of 5500, 5500 left of 6510 in graph space), no-arrow courses remain packed below, inspector chips pan or open a neighborhood instead of a dialog, the CS 5500 neighborhood stays four courses, and Explorer / Full course details still open details. Nobody gets stuck, loses data, or hits an irreversible action.

### Live nits (not scored; do not reopen as high)

These overlap uiux F12–F14. Point there for visual hierarchy / consistency. Operator impact only:

- **First paint does not show the 5004 → 5500 → 6510 chain.** `onInit` centers CS 5010 at zoom 1 (`components/course-graph.tsx:191-195`). CS 5500 / CS 6510 start off-canvas. The student reads unlock chips and the muted canvas hint, then clicks once to see the flow. Neighborhood is the view where the relationship is obvious. Not a trap.
- **Off-view inspector chips change Show scope without the search-result warning** (`· not on this view — opens neighborhood` exists on search, not on chips). Live path: CS 5500 neighborhood → select CS 5010 → chip CS 5400 → `Focused on CS 5400`. Heading and **Show entire program** recover. Dialog does not open.
- **Fit to view** of the whole program drops codes to ~7.9 CSS px (`scale(0.520198)`). Default map stays 15.2px. Isolates then dominate the frame (uiux F12).
- MiniMap in these 1680×1100 captures is a mostly empty white square; pan / Fit to view / chips still work.
- Map **Table** chips were not clicked this pass (code still uses default `openCourse`). Explorer and Full course details were.

## Discoverability / errors / anti-patterns

- **Discoverability:** Prerequisite Graph is a left-nav item. The page heading, `role="status"` count, Show control, and canvas hint (`components/course-graph.tsx:227`) name the entire MSCS Seattle program, left-to-right chains, the below-flow pack, and inspector-chip jump without reading source. Unlock chips on the default-selected CS 5010 include CS 5500 / CS 6510. **Show neighborhood** is in the inspector.
- **Error messages:** No new failure path was hit. Graph search empty copy was not re-typed this pass. Course Explorer still returns a real CS 5500 card.
- **Anti-patterns checked:** the old chip→dialog footgun is gone on the inspector. Full course details remains an explicit second control. Off-view chips remount neighborhood (surprising, recoverable). Neighborhood is opt-in from the program map via Show neighborhood / off-view chip. No blocking prompt, no data loss, no confirm-to-continue.
- **Accessibility of the change:** ordinary local web app at `localhost:3000`. No extra TTY, admin, or network rights. `cursor-ide-browser` is not required for a human student.

## Problem solved?

Yes. The type/code grid no longer places CS 5004 / CS 5010 without a left-of-CS-5500 relationship, inspector chips jump the camera (or open a neighborhood) instead of a dialog, isolated official courses still exist below the flow, and CS 5800 / CS 5100 remain on the map. The place a student *sees* 5004 and 5010 left of 5500 left of 6510 on one screen is Immediate neighborhood (and, after a pan, fragments of the program map). That is enough to complete the job.

## Not done by this review

- `cursor-ide-browser` was unavailable; live pass used standalone Chrome CDP, not the IDE tab.
- No 1366×768, mobile, or screen-reader pass.
- Map Table chips and graph search for an off-map code were not clicked.
- Did not re-run `npm test` / typecheck — phase 1 covered those; live UI did not contradict them.
- `ycm-harness review *` was not run. No harness review JSON was written.
- Fix implementations are not proposed.
