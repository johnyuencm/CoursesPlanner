---
ticket: 126
role: user_advocate
phase: 2
reviewed_head_sha: e7b07b2cb7d1e7821b04bfeee5a6a647e1191287
base_sha: 04e51ff
verdict: PASS
---

# User advocate review: #126 Map-tier planner text

## Verdict

PASS for the scope of #126. The Map-tier copy is true and does not claim an audit. The Seattle (Audit tier) copy is unchanged. One `high` finding exists on the walked screen, but it is old code outside the diff (F1). Fix it in a separate ticket.

## How I tested (live)

- `npm run build` (vinext, exit 0). Then `wrangler dev --config dist/server/wrangler.json --port 3000 --ip 127.0.0.1`. No deploy.
- Playwright 1.x (global install), Chromium, 1280x900. Scripts and screenshots stayed in the session scratchpad.
- Boston: `/northeastern/computer-science-mscs-976b977119/planner` (Map tier).
- Seattle: `/northeastern/computer-science-mscs-sea-8b0d00dbda/planner` (Audit tier).
- I stopped the server after the walk. The repo has no new files except this review.

```
planner page ──► heading + "Review ..." button ──► focus moves to #plan-issue-rail
     │                                                   └─ notes summary
     ├─► Add course dialog ──► CS 2000 / CS 2100 ──► corequisite + eligibility text
     ├─► My Target = CS 6510 ──► Path to target card ──► "Add prerequisite chain" ──► toast
     └─► status cards
```

## What the live app shows

| Surface | Boston (Map) | Seattle (Audit) |
|---|---|---|
| Meta description | "...The planner checks prerequisites and term order, and saves the plan only in your browser." | "...checks prerequisites and degree rules..." (unchanged) |
| Heading text | "Arrange semesters. The planner checks prerequisites and term order as you go." | "Arrange semesters, test prerequisites, and see every degree requirement update as you go." |
| Rail button | "Review plan checks" | "Review audit" |
| Button result | Focus moves to `ASIDE#plan-issue-rail` ("Why is this blocked?") | Same |
| Notes summary | "What the plan checks cannot verify" | "What this audit cannot verify" |
| Status card | "Requirements (map tier) / No degree audit / ...Plan checks prerequisites and term order only." | "Requirement groups met 0 / 3" |
| About text | No "counts your credits against the degree rules" sentence | Sentence kept |
| Picker, CS 2100 | "...Corequisite checked separately: CS 2101. You can still add this course and resolve the plan check warnings." | "...Corequisite checked separately: CS 2101. ...resolve the audit warnings." |
| Picker, CS 2000 | Corequisite callout "CS 2000 must be taken with CS 2001." No eligibility line (course is eligible, so the reason list does not show) | Same |
| Target card, CS 6510 | No audit wording. Same text on both tiers | Same |
| Chain toast | "...Review the plan checks for prerequisites and corequisites." | "...Check the live audit for prerequisites and corequisites." |

Result: no Map-tier surface says "audit" except the true "No degree audit". No Map-tier surface says that the planner counts credits against degree rules. Seattle keeps its audit meaning on every surface.

## Findings

### F1 `high` (old code, outside the diff): the loading state says the catalog is unavailable

- Evidence: `components/planner-board.tsx:251` (also line 250 at base `04e51ff`). The prerendered HTML and the first paint show "Your local plan remains available for backup while the catalog is unavailable." The text stays until `/api/catalog` answers.
- Stress walk D1 FAILs on Boston and on Seattle with a 2.5 s API delay.
- Impact: the student sees false information on every slow load. This is the same class of problem as #126 (planner text that is not true).
- #126 did not cause it and does not touch it. Track it in a new ticket. It does not block #126.

### F2 `low`: the Map-tier checks list is shorter than what the planner checks

- `MAP_TIER_CHECKS = "prerequisites and term order"` (`lib/requirements-v2.ts:105`). The status card adds "only" (`components/planner-board.tsx:313`).
- On the same page, other text names more checks:
  - Rail: "No prerequisite, corequisite, duplicate, or credit issues found."
  - About text: "checks each course against its prerequisites and corequisites".
  - Chain toast: "Review the plan checks for prerequisites and corequisites."
  - Picker: "Corequisite checked separately: X."
  - `lib/requirements-v2.ts:515`: Map tier gets "prerequisites, corequisites, term order, duplicates, credits".
- The copy under-claims, so it is not harmful. But "term order only" can make a student think that corequisites are not checked. The word "only" was there before; #126 now repeats the short list in the heading and the meta.

### F3 `low` (old): the button label and its target heading differ

- "Review plan checks" moves focus to a rail whose heading is "Why is this blocked?". This label is still clear because the rail's first lines say "No blocking issues" and "Modeled plan checks are clear." The Seattle button "Review audit" has the same mismatch.

## Interaction design (Shneiderman rules, changed surfaces)

| Rule | Note |
|---|---|
| Consistency | Good. "plan checks" is used in the button, notes summary, picker warning and toast. "audit" appears on Map tier only as "No degree audit". F2 is the one gap. |
| Shortcuts | No change. The button gives a quick jump to the rail. |
| Informative feedback | Good. The toast names the added courses and the next step for each tier. |
| Closure | Good. The chain toast closes the add action. |
| Simple error handling | Picker warnings say what is missing and that the student can still add the course. |
| Easy reversal | No change. Undo for plan edits is outside this diff. |
| Internal locus of control | No change. |
| Short-term memory load | Better. The heading now tells the student what the planner checks on this tier. |
| Clarity and hierarchy | Clear. The heading is one plain sentence. |
| Accessibility | Text only. No color-only meaning added. The button is a real `<button>` and works with Enter (tested). |

## App UI mechanics: stress walk

Config: Boston planner as home. Screens: Add course dialog and Review plan checks. Lists: Boston and Seattle catalog load (`/api/catalog`, 2500 ms delay). No send actions: the planner saves only in the browser.

| # | Check | Target | Result | Detail |
|---|---|---|---|---|
| N2 | Back (system) reaches home within 2 presses | Boston Add course dialog | PASS | 0 press(es) |
| N2 | Back (on-screen) reaches home within 2 presses | Boston Add course dialog | PASS | 0 press(es) |
| N2 | Back (system) reaches home within 2 presses | Boston Review plan checks | PASS | 0 press(es) |
| N2 | Back (on-screen) reaches home within 2 presses | Boston Review plan checks | PASS | 0 press(es) |
| D1 | No empty state before the first answer | Boston planner catalog | FAIL | "text=while the catalog is unavailable" visible while loading |
| M1 | No layout shift when data lands (CLS ≤ 0.1) | Boston planner catalog | PASS | CLS 0.000 |
| D1 | No empty state before the first answer | Seattle planner catalog | FAIL | "text=while the catalog is unavailable" visible while loading |
| M1 | No layout shift when data lands (CLS ≤ 0.1) | Seattle planner catalog | PASS | CLS 0.000 |
| L1 | At most one layer over a screen | all walked steps | PASS | never more than one |

N2 shows 0 presses because the dialog and the rail stay on the planner URL.

## Manual checklist items

| # | Result | Reason |
|---|---|---|
| N1 | PASS | Dialog and rail do not push history. Back stays on the planner. |
| N3 | NOT TESTED | No send flow on this screen. |
| N4–N6 | NOT TESTED | Not changed by #126. |
| L2 | PASS (Escape only) | Escape closed the Add course dialog. Backdrop and close button not tested. |
| L3 | NOT TESTED | Focus return after close not measured. |
| L4 | PASS | No confirm dialog on the walked path. |
| D1 | FAIL | See F1. Old code. |
| D2–D5 | NOT TESTED | Not changed by #126. |
| A1, A3–A6 | NOT TESTED | No network send. Plan edits are local. |
| A2 | NOT TESTED | No send button. The chain add was clicked once. |
| M1 | PASS | CLS 0.000. |
| M2–M5 | NOT TESTED | No motion change in #126. |

## Problem solved?

Yes. The three wrong strings named in the issue are gone on Map tier. The status card, heading, button, notes and meta now agree that Map tier has plan checks and no degree audit. Seattle keeps the audit text. F2 is a small wording gap. F1 is old and needs its own ticket.
