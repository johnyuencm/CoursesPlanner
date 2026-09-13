# user_advocate review — ticket-clear-remaining-map-leftovers-before-closing-the-mscs-gr-a27930d6

Verdict: **PASS** (last seat; no high or medium findings)

Job: a student on `/map` can read startable-course status on compact cards without a clipped “Prerequisite el…”, can Ctrl+F the syllabus while Full course details is open, and can Escape-clear map find after clicking a card without trapping Escape inside that dialog.

Reviewer is not the implementer (`d085fad0`). Product files were not modified. This is the only file written by this seat. Phase-1 (`tech_lead`, `project_manager`) both PASS with no highs; this seat does not re-score architecture. Live behavior matched those artifacts.

Reviewed state: branch `fix/complete-prereq-graph` @ `e06810ae4b456bf1c82b9bdc041f7223decbc9dd`. Target `http://localhost:3000/map`.

`cursor-ide-browser` did not stay alive (new tab → navigate → view not found). Live evidence is Chrome Headless (`--headless=new`) over DevTools Protocol, driver outside the repo at `%TEMP%\ua-live-map-leftovers\` (`probe.mjs`, `results.json`, screenshots `00`–`05`). Viewport 1680×1100. Keys used CDP `Input.dispatchKeyEvent` (real keydown, not only React `input` events). Native browser-find chrome is not visible in this headless session; skip/steal is judged from `defaultPrevented`, focus, and dialog open state.

## How this was exercised — live

| Step | What happened |
| --- | --- |
| Default `/map` | Heading **Prerequisite Graph**. Inspector **CS 5010**. Compact CS 5010 / 5011 / 7400 pills read **Eligible** in full. Crop `00b-cs5010-card.png`. Inspector heading pill **Prerequisite eligible** (full string; `00-default-map.png`). Legend still **Prerequisite eligible**. Card `aria-label` still “Prerequisite eligible.” CS 5010 pill metrics: text `Eligible`, `clientWidth === scrollWidth === 50`, `overflow: visible`, `maxWidth: none`, `textOverflow` not ellipsis, `clipped: false`. All 3 in-DOM eligible compact pills: `clippedEligible: []`. |
| Full course details → Ctrl+F | Opened **Full course details** (`openedDetails: true`). Native `<dialog open role="dialog">`, title Programming Design Paradigm, focus on Close. Ctrl+F: `lastKey.prevented: false`, `closestDialog: true`, `closestRoleDialog: true`, `#graph-find` **not** focused, `findValue` still empty. Map did not steal. `01-dialog-ctrl-f.png`. Headless does not show the browser find bar. |
| Close dialog → Ctrl+F | Close button dismissed the drawer (`dialogOpen: false`). Body-focused Ctrl+F: `prevented: true`, `findFocused: true`, `activeId: graph-find`. `02-ctrl-f-after-close.png`. |
| Type find, click card, Escape | Typed `5010` (`1 of 4`). Clicked CS 5010 card: focus `graph-node-main` inside `.flow-canvas`, find still `5010`. Escape: `prevented: true`, `closestCanvas: true`, `findValue: ""`, kbd hint **Ctrl+F** restored. Inspector stayed CS 5010. `04-escape-clears-find.png`. |
| Find text + details + Escape | Re-typed `5010`, opened details (`dialogOpen: true`, find still `5010`). Escape: `prevented: false`, `closestDialog: true`. After: **dialog closed**, find still `5010`, focus restored to `#graph-find` (`1 of 4` list back). Not a wipe-first trap. `05-escape-in-dialog.png`. |

## Re-check list (requested)

| Check | Live result |
| --- | --- |
| Compact CS 5010 (or other eligible) shows **Eligible** fully, not “Prerequisite el…” | **met.** Visible on CS 5010/5011/7400. DOM text `Eligible`. No CSS ellipsis on `.graph-node-meta .status-pill` (`app/globals.css:385`). Compact mapper `lib/graph.ts:416-418` via `components/course-graph.tsx:74`. |
| Inspector heading may still say Prerequisite eligible | **met.** Inspector pill text **Prerequisite eligible** (`components/course-graph.tsx:458`). Full word visible in `00-default-map.png`. |
| Ctrl+F in Full course details does not move focus to map find | **met.** `prevented: false`; find not focused. Skip `lib/graph.ts:384-387` + `components/course-graph.tsx:250`; modal `role="dialog"` `components/ui.tsx:20`. |
| After close, Ctrl+F focuses map find | **met.** |
| Type find, click graph card, Escape clears find | **met.** |
| Open details with find text, Escape closes dialog (does not wipe find first) | **met.** Dialog gone; query `5010` kept. |

## Discoverability

No source reading required. Compact **Eligible** is on the card next to Core/Elective. Page copy already says **Press Ctrl+F**. Find placeholder `Find a course (Ctrl+F)` plus kbd chip. **Full course details** is a labeled inspector button. Escape after a card click clears find without a hidden mode. Dialog close is the visible X, backdrop, and Escape.

## Error messages / recovery

No student-caused error in these leftovers. Empty find after Escape is an obvious empty field plus the Ctrl+F hint, not an error string. Wrong find query is unchanged from prior find work (status + list). Dialog close restores prior focus so the student is not stuck in a blank map with a vanished query.

## UX anti-patterns

None of the named leftovers remain as silent failures, stolen shortcuts, or trapped Escape. No extra confirm. Compact short label is the ticket-allowed default, not a surprise once the inspector/legend still say the long phrase. Clearing find does not undo the selected course (easy reversal of search only).

Residual observation, not scored: native find UI was not photographed in headless Chrome; steal is disproven, appearance of the browser bar is not.

## Problem solved?

Yes. The three leftover jobs a student actually hits on `/map` work:

1. Startable cards are readable (**Eligible**, not clipped).
2. Reading a syllabus with Ctrl+F is no longer a dead shortcut.
3. After hunting a course and clicking its card, Escape clears find; if details are open, Escape closes the drawer first and leaves the query intact.

## Interaction design (Shneiderman + clarity / a11y)

- **Consistency:** Compact cards use short **Eligible**; inspector, legend, and `aria-label` keep **Prerequisite eligible** (`course-graph.tsx:71,74,385,458`). Ticket-allowed. Same green `status-pill eligible` class (`app/globals.css:160`).
- **Shortcuts:** Ctrl+F focuses map find when the canvas is up; skipped inside the details dialog. Escape clears find from a focused graph card; Escape closes the dialog when it is open.
- **Informative feedback:** Find shows `1 of 4` while querying; after clear, the Ctrl+F kbd hint returns. Dialog title names the course.
- **Closure:** Details open/close is obvious (drawer + X). Escape-clear empties the field in one step from the canvas.
- **Simple error handling:** No new error path. Failed find remains the existing “No matches” copy (not re-exercised this seat).
- **Easy reversal:** Escape clears find, not the selection. Dialog Escape does not first destroy the query. Close restores focus to find when that was previous (`components/ui.tsx:18`).
- **Internal locus of control:** Student is not trapped in dialog or find. Close and Escape both exit details.
- **Reduced short-term memory:** Short **Eligible** fits the 196px compact card (`app/globals.css:374`) so the student does not decode an ellipsis.
- **Clarity / hierarchy:** Status sits in the card meta row; inspector heading repeats the long phrase for the selected course.
- **Accessibility:** Status is text, not color alone. Card button `aria-label` includes the full status. Dialog is `role="dialog"` with labelled title and Close. Find has `aria-label` / `aria-keyshortcuts`. Keyboard: Ctrl+F, Escape, and the details Close button. Contrast of the green Eligible pill on the compact card is readable in `00b-cs5010-card.png`.

## Findings

None.

`ack_zero_findings_reason`: Live Chrome CDP against `/map` showed unclipped compact **Eligible** on CS 5010 (and 5011, 7400), inspector still **Prerequisite eligible**, dialog Ctrl+F did not focus map find (`prevented: false`), post-close Ctrl+F did focus `#graph-find`, canvas Escape after a card click cleared find, and Escape in details closed the dialog without wiping the find query first.
