# User advocate review: exit line-focus, inspect a course, add the line to a plan

**Seat:** user_advocate (independent; not the implementer)
**Ticket:** `ticket-exit-line-focus-show-course-details-add-line-to-plan-72333a75`
**Commit:** `e88c60f`
**Phase-1:** both PASS, no high (`artifacts/review-tech_lead-line-focus-details-plan.md`, `artifacts/review-project_manager-line-focus-details-plan.md`)
**Live:** exercised at `http://localhost:3000/map` (dev server) then confirmed insert on `/planner`
**Verdict:** **PASS** (no high / trapped-mode findings)

Did not modify product files. Did not run `ycm-harness review`. Did not write harness review JSON.

## Jobs to be done

1. Leave line-focus and return to the current map.
2. Add the selected line of courses to a semester.
3. Click a graph course and see details on the right.

All three completed live. Phase-1 acceptance matches what the operator sees; this seat does not re-open spec. Two tech-lead mediums were reproduced in the browser and stay **medium** (recoverable; none blocked the jobs).

## Live behavior

Starting state: CS 5010 inspector, Show = Entire program, zoom 100%, 114 courses. Selected inspector control `CS 5010 → CS 5500`.

**Job 1 — exit.** A blue **Line focus CS 5010 → CS 5500** banner appeared with **Exit line focus**, semester picker, and disabled **Add 0 courses** (those two codes were already planned). Status: `114 courses. 79 unlock arrows. Selected CS 5010 · CS 5010 unlocks CS 5500.` Dimmed cards: 112; emphasized: 2.

| Exit | Result |
| --- | --- |
| **Exit line focus** | Banner gone; Show still Entire program; zoom still 100%; dimmed count 0 |
| **Escape** with focus on the relationship button (inspector, inside `.graph-layout`) | Same restore; heading still CS 5010 |
| Empty `.react-flow__pane` click (~362,339 in the visible canvas) | Same restore |

None of those three switched Show to “This course’s full chain” or changed zoom. The operator who could not leave line-focus can leave it.

**Job 3 — inspect.** Re-entered line-focus, then clicked dimmed card **CS 6410** (Compilers). Inspector updated without Full course details: heading CS 6410, title Compilers, 4 credits, description starting “Expects each student to write a small compiler…”. Show stayed Entire program (114 courses), zoom 100%. Banner cleared (card click also exits line-focus; named in phase-1). Dimmed cards were clickable; they sit above selected-edge hit paths in source (`lib/graph.ts` dimmed z=5 > edge z=4) and that matched live.

**Job 2 — add line.** Selected `CS 5400 → CS 6410`. Banner: **Add 2 courses**, preview **Will add CS 5400, CS 6410.** Chose Spring 2027. Click **Add 2 courses**. Toast: `CS 5400, CS 6410 added to Spring 2027. Check the live audit for prerequisites and corequisites.` Cards flipped Locked → Planned. Button became **Add 0 courses** with “Every course on this line is already in your plan or history, or is an external catalog reference.” `/planner`: Fall 2026 still CS 5010 + CS 5500; Spring 2027 shows CS 5400 and CS 6410. Line-focus stayed up after a successful add.

**Already-recorded empty add** was live on CS 5010 → CS 5500: primary button disabled, same recovery sentence, no silent write.

**Tech-lead mediums, live (not escalated):**

- After inspect on Entire program, **Back** (`aria-label="Previous course"`) switched Show to **This course’s full chain** and collapsed the map to CS 5010’s neighborhood. Recoverable via Show → Entire program. Not data loss; not required to finish the three jobs.
- Focused `#line-focus-semester` and pressed Escape: banner disappeared; Show stayed `course`. Add was still possible after reselecting the line. Native `<select>` dropdown-open Escape was not separately opened in this session.

Fullscreen Escape was not live-tested (phase-1 names it as skipped so the Fullscreen API can keep Escape). Clicking a colored SVG edge (vs inspector relationship buttons) was not required for the three jobs; relationship buttons were enough to enter line-focus.

## Discoverability

Operators do not need source. Entering line-focus uses named inspector buttons (`CS 5010 → CS 5500`) and the canvas hint (`components/course-graph.tsx:537`). Once a line is selected, the inspector banner is the first thing on the right: **Line focus**, the endpoints, “The current map stays put,” **Exit line focus**, then **Add this line to a semester** with a term list and a count button. Status text in the map heading also names the selected relationship.

Exit is not hidden behind a keyboard-only trick: visible button, hint copy (“click empty map / Exit line focus”), and Escape from the graph layout including the inspector.

Course details are the same inspector the map already uses (heading, title, credits, clamped description). **Full course details** remains a secondary action (`:590`).

## Error messages and recovery

| Situation | What the operator gets |
| --- | --- |
| Line already in plan | Disabled **Add 0 courses** plus “Every course on this line is already in your plan or history, or is an external catalog reference.” (`course-graph.tsx:552-554`) |
| Successful add | Live region toast naming codes and term (`app-provider.tsx:249`; `app-shell.tsx:88`) |
| No remainder / missing term / catalog still loading | `announce(...)` recovery copy (`app-provider.tsx:237-245`). Capacity and missing-term paths were not live-filled. |
| No semesters | Copy points to Build My Plan (`course-graph.tsx:555`). Not live-tested (this plan had terms). |

No silent add. Capacity refusal is all-or-nothing; overflow copy was not exercised here.

## UX anti-patterns

No trapped mode: three exits plus card inspect all returned a usable map. No extra confirm on add; undo is the existing planner remove controls. Inspecting a card drops the add banner (phase-1 named trade-off); operators who want both inspect and add reselect the line. Surprising defaults that are not blockers: Back after inspect still calls `locate` and forces depth `"course"`; Escape on the new semester select clears line-focus.

## Interaction design (Shneiderman)

| Rule | Note |
| --- | --- |
| Consistency | Banner uses existing button / field-label / `input-action-row` patterns; success uses the same announcement toast as other plan writes. |
| Shortcuts | Escape clears line-focus from the graph layout; Ctrl+F find still wins when find is occupied (`lib/graph.ts:704`). |
| Informative feedback | Banner title, status line, add preview, disabled count, and toast all name what happened. |
| Closure | Selecting a line, exiting, inspecting, and adding each have a visible end state (banner on/off, inspector fields, Planned badges, planner cards). |
| Simple error handling | Empty remainder is explained in-place; success toast tells the operator to check the audit. |
| Easy reversal | Exit / Escape / pane click restore the prior map; planner Remove undoes an add. Back after inspect is the weak reversal (it also changes Show). |
| Internal locus of control | Operator chooses term and explicit **Add N courses**; map scope is not rewritten by the three exits or by inspect. |
| Reduced short-term memory | Endpoints, addable codes, current Show, and selected course stay on screen during line-focus. |

**Clarity / hierarchy:** Banner is visually first in the inspector (blue panel, `app/globals.css:425`). Course identity remains below it. Line meaning is not color-only: pressed relationship buttons, banner text, and catalog-rule copy accompany destination color.

**Accessibility:** Exit and Add are named buttons; semester control has `htmlFor="line-focus-semester"`. Course cards keep `aria-label` including code and title; dimmed state is opacity, not removed hit targets (`app/globals.css:391-393`). Skip-map link still jumps to the inspector. Contrast of dimmed cards was readable in screenshot; no instrumented contrast measurement.

## Problem solved

The prior operator failure — stuck in line-focus with no return to the current map — is gone. Clicking a (including dimmed) card fills the right-hand details without opening Full course details and without switching Entire program to a full chain. Adding the focused line writes the remaining catalog courses into a chosen term and shows them on Plan Builder.

## Findings

**medium — Back after `inspectCourse` still runs `locate`, which collapses Entire program to “This course’s full chain”.**
Live: Entire program → line-focus → click CS 6410 (inspect, Show stayed Entire program) → **Back** set Show to This course’s full chain and hid the program map. `inspectCourse` records history (`components/course-graph.tsx:349-351`) but Back/Forward call `locate` (`:482-483`), and `locate` always `setDepth("course")` (`:335`). Recoverable via the Show control. Matches tech-lead; not a high (jobs still complete; no data loss).

**medium — Escape on the line-focus semester `<select>` dismisses line-focus.**
Live: focused `#line-focus-semester` (`components/course-graph.tsx:549`) and pressed Escape; banner vanished while Show stayed put. Capture-phase handler (`:319-323`) plus `shouldClearLineFocusOnEscape` treating any `.graph-layout` descendant as in-scope (`lib/graph.ts:696-707`). Find already opts `select` out of find-clear (`:681`); this control does not. Operator can reselect the line. Not a high.

No high findings. Capacity overflow copy and native open-dropdown Escape were not live-filled.
