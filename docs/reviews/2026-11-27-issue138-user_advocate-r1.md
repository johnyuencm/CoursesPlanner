---
reviewed_head_sha: 59c40b09f7e6a1b66e0d4bfe6c7f31bf081b1ebf
ticket: 138
role: user_advocate
round: 1
verdict: PASS
---

# Issue #138 user advocate r1: Paths page text, Map tier

Verdict: PASS. No high or medium finding.

## Method (live)

- Worktree `.worktrees/ua-r1` at `59c40b0`. `npm run build`, then `wrangler dev` on `127.0.0.1:3138`.
- Chrome through Playwright 1.63. Every request to a host other than `127.0.0.1` was aborted. Blocked count: 0 in all runs.
- Programs: MSCS Boston (Map) and MSCS Seattle (Audit). Widths 1280 and 390, deviceScaleFactor 2.
- I read the rendered text and every `aria-label`, `title` and `alt`. I did not attach screenshots (kept in the scratchpad only).
- This change is page text only. No new control, flow or state. Shneiderman rules: no change, so no new finding. 390 px: no horizontal overflow on either tier.
- Not run: `stress-walk.mjs`. No screen mechanics changed.

## What a student reads

| Place | Map (Boston) | Audit (Seattle) |
|---|---|---|
| Banner | "Recommendations never change your official degree requirements." | "...core, breadth, elective, or credit audit." (as before) |
| Validation card | "The planner gives no degree audit for this program, so graduation status comes only from your official university audit." | "Graduation status still comes only from the modeled catalog audit." (as before) |
| Closing line | "Check degree rules in the official catalog." | "Degree validation stays grounded in official catalog rules." (as before) |
| aria-label / title / alt with "audit" | none | none |

- Truth: each tier now says what is true. The Map text does not claim an audit. The Audit text is unchanged.
- Early load: the banner appears only after the tier is known. Sampled every 50 ms: one text only, no Map text flash on the Audit page.
- Map text uses "degree audit" only as "no degree audit" and "official university audit", as the issue allows.

## Footer disclaimer: not a contradiction

`components/app-shell.tsx:110` says "A planning companion, not an official degree audit." For a Map student it agrees with the card: the planner is not an audit. For an Audit student it says the modeled audit is not the official one. Both are true. Keep it.

## Other pages (Map program)

- Per-path page: "This planner is an advising aid, not an official degree audit." True. "It never changes the degree requirements." True.
- Planner page: "No degree audit"; "gives no degree audit." True (fixed by #126).

## Findings

| Rank | Finding | Evidence |
|---|---|---|
| low | Card heading "Validation" sits over a Map sentence that says there is no degree audit. A student may read "Validation" as a promise. The body text corrects it. | `components/pathways-workspace.tsx:170` |
| low | "your official university audit" assumes the student has one. The text does not say where to get it. Advisor wording is in the banner, so acceptable. | `components/pathways-workspace.tsx:172` |
| low | Audit tier still uses the jargon "credit audit" and "modeled catalog audit". It is true and out of scope for #138. | lines 145, 172 |

No finding blocks the issue. Acceptance is met live: Map has no wrong "audit" text; Audit text is kept.
