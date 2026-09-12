# user_advocate review — ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f

Verdict: **PASS** (no high findings; UA-1 remains closed; chain rings and node tab stops work live)

Goal / job: a student opening Prerequisite Graph sees the full official MSCS Seattle
program, can read course codes, and can see the selected course's linked nodes.
Reviewed state: branch `fix/complete-prereq-graph`, HEAD `6caccf16eea121ad721bf38a0df6fcdd8e61c0a3`
(`Submit the chain-emphasis map fix for independent review.`). Reviewer is not the
implementer. No product file was modified. The only file written is this artifact.

`cursor-ide-browser` did not stay alive (`browser_tabs` created `viewId`s that vanished
before `browser_navigate`). Live evidence is Chrome 152.0.7977.83 over DevTools Protocol
against `http://localhost:3000` (driver outside the repo at `%TEMP%\ua-live-6caccf1\`;
screenshots `01`–`05`). Viewport override 1680×1100. Numbers below are
`getComputedStyle` × viewport `scale` on `.graph-course-node.graph-compact
.graph-node-main strong`, plus DOM class / `tabIndex` probes.

Phase-1 `tech_lead` / `project_manager` artifacts at this HEAD are PASSes with no
unresolved high. This seat does not re-litigate spec or architecture. Live UI did
not contradict them.

## How this was exercised — live

| Step | What happened |
| --- | --- |
| Default `/map` | Heading `Entire MSCS Seattle program`. Status `114 courses · 80 links. Selected CS 5010.` Viewport `translate(28px, 20px) scale(1)`. Course-code text **15.2 CSS px** (computed 15.2 × scale 1; sample `CS 5010` box height 21.27px). `CS 5800` ✓ `CS 5100` ✓ in the first row. 78 compact node buttons in the DOM (`onlyRenderVisibleElements`). MiniMap and canvas hint visible at this pane. `01-default-map.png`. |
| CS 5010 selected (default + re-click) | Inspector `CS 5010`, unlocks chips `CS 5400` `CS 5500` `CS 6510` `CS 7980`. `.graph-emphasized` nodes in the DOM: `CS 5010`, `CS 5011`, `CS 5500`, `CS 6410`, `CS 6510`, `CS 7470`, `CS 7980`. Sample `CS 5500` border `rgb(75, 108, 179)`, box-shadow `rgba(37, 99, 235, 0.28) 0px 0px 0px 2px` (the filled CSS rule at `app/globals.css:376`). `CS 5400` itself is **not** in the first-paint DOM (culled / off-canvas); inspector still names it. `02-cs5010-emphasis.png`. |
| Keyboard tab order | Every `button.graph-node-main` has `tabIndex === 0` and no `tabindex="-1"` (`negativeTabCount: 0`). Programmatic `focus()` lands on the first select button. Sequential walk from graph search: Fit to view → skip link → Map/Table → Show `<select>` → **Select CS 5010** → CS 5011 → CS 5800 → CS 5100 … **74 node-select stops** in 80 recorded tabs. First node label: `Select CS 5010, Programming Design Paradigm. Required. Selected course.` |
| Show neighborhood of CS 5500 | Click CS 5500 → inspector **Show neighborhood**. Heading `Focused on CS 5500`. Status `4 courses · 5 links`. Node codes exactly `CS 5010`, `CS 5004`, `CS 5500`, `CS 6510`. Relation rows visible (`Upstream prerequisite` / `Selected course` / `Downstream connection`). **Show entire program** present. `03-neighborhood-5500.png`. |
| `/courses?q=CS 5004` | Status `2 courses`. First card **CS 5004 Object-Oriented Design** (external); second is recitation CS 5005. `04-courses-5004.png`. |
| `/courses?q=CS 1800` | Status `0 courses`. Empty title **CS 1800 is not in this catalog.** Body: official MSCS Seattle + cataloged prerequisites; undergraduate listings omitted. **Does not** say "try fewer filters". Reset offered. `05-courses-1800.png`. |

## Re-check list (requested)

| Check | Live result |
| --- | --- |
| Default `/map` code font-size must not be ~2px | **met.** 15.2 CSS px at `scale(1)`. UA-1 stays closed. |
| `CS 5800` `CS 5100` present; heading 114 courses | **met.** First-row cores; status `114 courses · 80 links`. |
| CS 5010 selected: CS 5500 / 6510 / etc have `.graph-emphasized` ring | **met.** Those chips (plus CS 7980 and the downstream chain CS 6410 / CS 7470) carry the blue ring. Legend includes **Linked to selected**. |
| Node select buttons in tab order (no `tabIndex=-1` on `.graph-node-main`) | **met.** `tabIndex` 0; 74 sequential select stops. Details buttons still use `tabIndex={-1}` (`components/course-graph.tsx:47`) and are hidden in compact program mode. |
| Neighborhood CS 5500 still 4 nodes | **met.** Exact four-course local view. |
| `/courses` CS 5004 found; CS 1800 not-in-catalog copy | **met.** |

## Findings

None at `high` or `medium`.

`ack_zero_findings_reason`: Live re-measure at `6caccf1` keeps UA-1 closed (15.2px codes, not ~2px), shows 114-course MSCS Seattle default with isolated cores, paints a real emphasis ring on CS 5010's visible linked chips, puts `.graph-node-main` select buttons in the tab order, keeps CS 5500's neighborhood at four nodes, and gives Course Explorer an honest CS 5004 hit plus CS 1800 miss. A mouse or keyboard student can finish the job without a trap, a silent failure, or an irreversible action.

### Live nits (not scored; do not reopen UA-1)

- **CS 5400** is one of four inspector unlocks for the default-selected CS 5010 but is absent from the first-paint node DOM (`has5400: false`). Clicking the inspector chip opens the details dialog (`components/course-card.tsx:11`, `openCourse`), it does not pan the map. Fit to view / search still recover. Transitive ringed nodes CS 6410 / CS 7470 (depend on CS 5400) are on-screen.
- Compact program view still hides titles; neighborhood view restores them. Search and inspector compensate on the default grid.
- Sequential tab walks every on-screen node (74 stops here). Skip-to-inspector exists (`components/course-graph.tsx:159`). Exhausting, not blocking.
- Did not re-run 1366×768; prior UA noted MiniMap clip there. At 1680×1100 MiniMap and the canvas hint are in view.

## Discoverability / errors / anti-patterns

- **Discoverability:** Prerequisite Graph is a left-nav item. The page names official MSCS Seattle courses. The panel heading and `role="status"` count say Entire program / 114 courses without opening source. Legend swatch **Linked to selected** matches the live rings. Graph search, Show, Fit to view, Map/Table are in the first screen.
- **Error messages:** `/courses` miss for CS 1800 names the code, explains the catalog boundary, and offers Reset. Graph search with no hits still says "Try another code or title." (`components/course-graph.tsx:155`). Recovery is obvious.
- **Anti-patterns checked:** default zoom does not silently thumbnail the program; neighborhood is opt-in and stays local; CS 1800 does not lie about filters; selecting a node now paints linked chips instead of a silent inspector-only update. No blocking prompt, no data loss, no confirm-to-continue footgun. Search activation still moves focus to `#graph-inspector` (`:150-152`) — that is a jump, not a trap (inspector is focusable at `:222`).

## Problem solved?

Yes. A student who opens Prerequisite Graph to understand the official MSCS Seattle program gets a readable default grid that includes isolated cores, a count that matches the program-sized map, visible rings on the selected course's on-screen linked nodes, a local CS 5500 neighborhood that does not swallow the program, Course Explorer access to CS 5004, and an honest empty state for CS 1800.

## Shneiderman (brief; visual/a11y checklist lives in `artifacts/review-uiux-…md`)

1. **Consistency** — Map, table, inspector, and explorer share "MSCS Seattle" / official-program language. Legend "Linked to selected" now matches live rings. Map-click still selects; table-click still opens details (prior uiux F10).
2. **Shortcuts** — Graph search, Show select, header Fit to view, skip-to-inspector. Node select is now a sequential tab stop, so the canvas is no longer mouse-only for the primary action.
3. **Informative feedback** — `role="status"` count is accurate. Selecting CS 5010 rings visible upstream/downstream chips (`app/globals.css:376`). Prior dead `.graph-emphasized {}` is gone live.
4. **Closure** — Neighborhood ↔ Entire program, details dialog, Add to Plan all terminate. Neighborhood screenshot shows **Show entire program**.
5. **Simple error handling** — CS 1800 empty state names the miss, explains why, offers reset.
6. **Easy reversal** — Show entire program, scope select, nothing destructive. Viewport still remounts on scope change (`components/course-graph.tsx:178`).
7. **Internal locus of control** — Neighborhood is a deliberate Show / inspector click. Off-map search copy from prior round was not re-clicked this pass.
8. **Reduced memory load** — Rings let the student recognize linked nodes on the grid instead of hunting four inspector codes. Compact mode still hides titles.

**Clarity / hierarchy / accessibility:** first-paint codes are readable; linked chips use a ring + shadow, not color fill alone, and the legend names the state. Keyboard can select nodes (`tabIndex` 0 on `.graph-node-main`). No NVDA/JAWS session was run.

## Not done by this review

- `cursor-ide-browser` was unavailable; live pass used standalone Chrome CDP, not the IDE tab.
- No 1366×768, mobile, or screen-reader pass this round.
- Graph search for off-map CS 2500 was not re-clicked (prior UA closed that silent-select).
- Did not re-run `npm test` / scraper fidelity — phase 1 covered those; live UI did not contradict them.
- `ycm-harness review *` was not run. No harness review JSON was written.
- Fix implementations are not proposed.
