---
reviewed_head_sha: 213ae73ea623b4699ddee79d9da4944fad09bcd2
seat: project_manager
round: 1
verdict: PASS
---

# Issue #138 project_manager review, round 1

Scope: goal alignment and honest done-state. Base `5feabe7`, head as above. Context read: issue #138, issue #126, PR #142, the verification record and the wiki run record.

## Verdict: PASS

No high finding. Two medium findings need a named decision in the PR body. Neither blocks.

## Per-criterion map

| # | Acceptance line of #138 | State | Evidence |
|---|---|---|---|
| 1 | Map tier: the Paths page does not say "audit", except "no degree audit" or "official university audit" | met for the Paths page content. Partial on a strict reading of the shell footer (finding M1) | `components/pathways-workspace.tsx:141,145,172,181`. Test: `tests/pathways-page.test.ts` strips the two allowed phrases, then asserts no `/audit/i`. |
| 2 | Audit tier (MSCS Seattle) keeps its text | met | Same file, the `audit ?` branches keep the old strings. Test "keeps its degree audit text" checks all three sentences verbatim. |
| 3 | A test renders the Paths text for one Map key and one Audit key, reusing the #126 helpers | met | `tests/pathways-page.test.ts` uses `MAP_KEY`, `pageText` (moved to `tests/page-text.ts`), `AppContext`, `DEFAULT_CATALOG_KEY`. `tests/planner-page.test.ts` imports the same helpers. |

## Commands run by this seat (clean worktree at head)

- `npx tsx --test tests/pathways-page.test.ts tests/planner-page.test.ts`: 11 pass, 0 fail.
- `npm test`: 372 pass, 0 fail. This matches the record.
- `npm run typecheck`: exit 0.
- Not run: build, live walk, mutation checks. The record claims them. I did not re-prove them.

## Findings

### M1 (medium): the shell footer still says "not an official degree audit" on every Map-tier Paths page

- `components/app-shell.tsx:110` is rendered around the Paths page. Its text is "A planning companion, not an official degree audit."
- Strict reading: the allowed exceptions are the exact phrases "no degree audit" and "official university audit". "not an official degree audit" matches neither. So criterion 1 is not literal-met for the full page.
- Intent reading: the sentence denies an audit. It is true on both tiers. The #126 PM round 2 and the #126 test also left the footer alone, because the planner test does not render the shell either. The test here does not render the shell, so the test cannot see it.
- Decision: do not block. The change is global (every page of every program) and the issue title and body name only two lines in `pathways-workspace.tsx`. But the PR body must say it plainly: "the footer disclaimer is a denial, kept on purpose". The verification record already says this (section "Not changed on purpose" and Risk 1). Copy it into the PR body so the owner can overrule it.
- Cheapest fix if the owner overrules: change the footer to "A planning companion, not an official degree record." on both tiers. One line. It needs its own ticket.

### M2 (medium): the closing-line change goes beyond the issue

- Commit pair `79a96cd` (red) and `f3c9691` (green). The old line "Degree validation stays grounded in official catalog rules." has no "audit" word. So acceptance line 1 does not require this change.
- Goal alignment: in scope. The issue goal is "a Map-tier program has no degree audit, and the Paths page still says there is one". "Degree validation" claims the same thing in other words. A reader who sees "validation stays grounded" on a Map program believes that a check exists. The #126 PM round 1 already rejected the same class of leak ("Corequisite audited separately"). Leaving it would fail the same review.
- Honesty: good. The pair is separate, the run record and the verification record name it as beyond the issue, and both say how to revert it. The cost is one sentence of new copy: "Check degree rules in the official catalog."
- Residual risk: the Map-tier test now also asserts `/degree validation/i` is absent. A later copy change on any Map page that uses that phrase fails this test. This is acceptable and is the intent.
- Decision: in scope as a same-claim neighbor. Name it in the PR body as "beyond the literal acceptance, same claim, revertable pair".

### L1 (low): other "audit" text near the Paths page

- `app/[universityId]/[programId]/pathways/[id]/page.tsx:87` ("not an official degree audit") is on the per-path pages, not the Paths page. Same denial, same decision as M1. Not in the issue.
- `components/program-summary.tsx:39` ("It is not an official degree audit") is in the Audit-tier branch only. The Map branch (line 32) says "gives no degree audit", which is an allowed phrase. `DegreeRules` is not on the Paths page. No action.
- The test does not cover text after a click (edit mode, toasts), the per-path pages or the shell. The record lists this under "Not checked". The statement is honest.

### L2 (low): shared test file touched

- `tests/planner-page.test.ts` changed 8 lines. The record names it as a merge-conflict risk (Risk 4). The planner test output is unchanged (9 pass in the record; 11 pass here with the 2 new tests).

## Design and scope check

- Design: one flag `audit = progress?.tier === "audit"`, three tier-gated sentences, same tier source as the planner (#126). No fork. No new abstraction.
- Cheaper option: none. Three inline ternaries are the smallest change. The record's "no tier-text table until a third tier" is sound.
- No TODOs, no mocked behavior, no deleted tests. The only test lines removed are the two moved helpers (`MAP_KEY`, the text step), which now live in `tests/page-text.ts`.
- Line numbers in the records (145, 172, 181 after; `app-shell.tsx:110`; `[id]/page.tsx:87`) match the code at head.

## Run record versus code

- Wiki run record: matches. "Review: not done" is true at write time. "No PR yet": true at pinned head. The "not a new worktree" note is honest.
- Verification record: the checks that I re-ran match (372 pass, typecheck 0). The mutation and live-walk claims are the implementer's own and unproven by this seat. They are plausible: the test assertions are specific.
- Wiki log and index lines: added. Not checked in depth.

## Deferrals named

- #139, #141: named in the run record. Footer and per-path disclaimers: named. Post-click text and screen reader pass: named.

## Required before merge (for the PR body, not for code)

1. State the footer decision (M1) in the PR body.
2. State that the closing-line pair is beyond the literal issue and is revertable (M2).
