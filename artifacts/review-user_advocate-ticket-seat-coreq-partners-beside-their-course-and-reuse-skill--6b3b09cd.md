# user_advocate review — ticket-seat-coreq-partners-beside-their-course-and-reuse-skill--6b3b09cd

Verdict: **PASS** (last seat; no high or medium findings)

Job: a student on `/map` should see that CS 5011 is taken with CS 5010 (not a stray card far down the same column), and that CS 5500’s immediate neighborhood is a left-to-right skill tree, not a 4-row wrap pack.

Reviewer is not the implementer. Product files were not modified. This is the only file written by this seat. Phase-1 artifacts (`tech_lead`, `project_manager`) are both PASS with lows only; this seat does not re-score architecture.

Live session: `http://localhost:3000/map` in Cursor browser tab `a5dc4b`, branch `fix/complete-prereq-graph` @ `745a3b5`. Catalog loaded; Find + Show controls used as a student would.

## Live behavior (exercised)

### CS 5010 / CS 5011 (program map)

1. Opened `/map` (Entire program).
2. Find box → `CS 5011` → match `CS 5011 Recitation for CS 5010` (1 of 1). Camera panned; inspector opened on CS 5011.

DOM transforms on `.react-flow__node`:

| Course | `translate` | Viewport top |
| --- | --- | --- |
| CS 5010 | `(0px, 2304px)` | y ≈ 497 |
| CS 5011 | `(0px, 2432px)` | y ≈ 625 |

Same column (`x = 0`). `dy = 128` (`PROGRAM_ROW` in `lib/graph.ts:111`). Cards sit one row apart with no other course between them. CS 5004 starts the next row (`0, 2560`).

Inspector on CS 5011: heading CS 5011, **Corequisites 1** chip **CS 5010**, **Unlocks 0**. Inspector on CS 5010 (before the search click): **Corequisites 1** chip **CS 5011**.

Edges: 40 solid unlock arrows. **No** `CS 5010`–`CS 5011` edge id. **No** `stroke-dasharray` on any edge path. Ticket’s “chips, no dashed/coreq arrow” matches live.

### CS 5500 immediate neighborhood

1. Find `CS 5500` → selected Foundations of Software Engineering.
2. **Show** combobox → **Immediate neighborhood** (value `1`).
3. Status: `4 courses. 5 unlock arrows. Selected CS 5500 · focused on CS 5500.`
4. Zoomed out, then **Fit to view**. Viewport went `scale(1.38072)` → `scale(1.65686)`; all four nodes stayed in view.

Layout (not a 4-high wrap):

| Course | x | y |
| --- | --- | --- |
| CS 5010 | 0 | 0 |
| CS 5004 | 0 | 128 |
| CS 5500 | 208 | 0 |
| CS 6510 | 416 | 0 |

CS 5004 and CS 5010 are left of CS 5500; CS 5500 is left of CS 6510. Three columns, two stacked prereqs — skill-tree occupy, not `index % 4` wrapping. Wiring: `components/course-graph.tsx:185` always calls `layoutProgramFlow`.

Exit is obvious: Show dropdown still lists Entire program; inspector button switched to **Show entire program**.

## Problem solved?

Yes. The two named leftovers are visible without reading source:

1. Recitation sits immediately under the lecture in the same column; the pair no longer looks like unrelated rank-0 leftovers.
2. Neighborhood is a readable LTR chain (prereqs → course → unlock), with Fit-to-view still working.

## Discoverability

- **Find a course (Ctrl+F)** finds CS 5011 and CS 5500; match list names the recitation.
- **Show** is a labeled combobox with “Immediate neighborhood” in plain language.
- Inspector **Show neighborhood** / **Show entire program** is a second path (shortcut for frequent users).
- Take-together is on the canvas (adjacent cards + title “Recitation for CS 5010”) and in the inspector Corequisites list. No new flag or hidden command.

## Error messages / recovery

No student-caused error in this flow (wrong Show value is still a valid graph; empty Find just disables prev/next). Fit-to-view recovers a zoomed-out neighborhood. Switching Show back to Entire program exits the focused graph.

A Next.js **1 issue** hydration badge (`components/app-shell.tsx` overlay) is present in this `next dev` session. It does not block the map. Out of this ticket’s product surface; not scored.

## UX anti-patterns

No silent failure on the two ACs. No extra confirm. Neighborhood is not a trapped mode. Compact cards in neighborhood match the program map (consistent), which is the reuse the ticket asked for.

Residual (low, below): CS 5010’s unlock stroke to CS 7980 crosses at CS 5011’s row, so a glance can mis-attribute that arrow.

## Interaction design (Shneiderman + clarity / a11y)

- **Consistency:** Neighborhood uses the same compact skill-tree geometry as Entire program (`course-graph.tsx:175,185`), not a second wrap pack.
- **Shortcuts:** Ctrl+F, inspector Show neighborhood, Fit to view, zoom controls.
- **Informative feedback:** course count, arrow count, selected/focused line, Show value, highlighted search match, selected card chrome.
- **Closure:** Find match, Show change, and Fit each produce an immediate visible graph.
- **Simple error handling:** no new dead-ends in this slice; Fit and Show entire program reverse camera/scope.
- **Easy reversal:** Show entire program, Fit to view, search clear (× on match chip).
- **Internal locus of control:** student picks the course and the Show depth; layout does not auto-jump Show.
- **Short-term memory:** pairing is spatial + titled “Recitation for CS 5010”; neighborhood is four named cards in rank order instead of a wrap to remember.
- **Clarity / hierarchy:** type and status pills are text, not color alone; codes are the strongest label; legend remains above the canvas.
- **Accessibility:** Find and Show are named controls; course cards are buttons with `Select CS 5011, Recitation for CS 5010…`; skip-to-selected-course link present. Status is not color-only. Keyboard: combobox and search are operable. (Dev overlay pollutes the a11y tree with hydration copy; not this ticket.)

## Findings

### UA-1 (low) — CS 5010 unlock arrow can look like it leaves CS 5011

Live `/map` after focusing CS 5011: CS 5011 sits at `(0, 2432)` directly under CS 5010 at `(0, 2304)`. CS 5010’s solid unlock edges include `CS 5010-CS 7980-51` (and other 5010 unlocks). CS 7980 sits to the right of the 5011 row, so the stroke meets the partner card’s height. Inspector truthfully says CS 5011 **Unlocks 0** and **Corequisites CS 5010**. The ticket asked for no dashed coreq arrow; this is leftover routing, not a missing take-together cue. A hurried glance at the canvas can still misread 5011 as a prereq for 7980.

## Areas live-checked and clean

- CS 5011 immediately under CS 5010, same column, one `PROGRAM_ROW`.
- Corequisites chips both directions; no dashed/coreq edge.
- CS 5500 neighborhood is exactly four cards in LTR skill-tree columns, not a 4-high wrap.
- Fit to view after zoom-out still frames all four.
- Show entire program remains available (not trapped).

## Not done

- Did not re-litigate TL-1/TL-2 or PM-1.
- Did not run `ycm-harness review *` or write harness review JSON.
- Did not propose a fix implementation.
