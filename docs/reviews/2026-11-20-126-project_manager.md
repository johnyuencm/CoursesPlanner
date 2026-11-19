---
ticket: "johnyuencm/CoursesPlanner#126"
seat: project_manager
round: 1
branch: fix/126-map-tier-text
base_sha: 04e51ff
reviewed_head_sha: 0ab3218cb1228590cd3badebdc3862a45d8cb65a
verdict: FAIL
---

# Review #126, round 1: project manager

Verdict: **FAIL**. One high finding. The fix for it is small.

```
Map-tier planner surfaces
  heading / button / notes / meta / about  -> fixed, tested
  picker warning tail / path toast         -> fixed (picker tested, toast not tested)
  eligibility reasons (lib/validation.ts:130)
     -> picker warning (course-dialogs.tsx:87)   -> "Corequisite audited separately"  [NOT fixed]
     -> CourseDetail   (course-dialogs.tsx:41)   -> "Corequisite audited separately"  [NOT fixed]
     -> TargetPathCard (plan.ts:233 -> target-path.tsx:107) -> same text            [NOT fixed]
```

## Evidence that I ran

- `git diff 04e51ff...HEAD`: 5 files, +78 / -11.
- `npx tsx --test tests/planner-page.test.ts`: 2 pass, 0 fail.
- `getEligibility(CS 2000, {})` on Map key `northeastern/computer-science-mscs-976b977119`
  returns `eligible ['Corequisite audited separately: CS 2001.']`.
- Map-tier roadmaps with courses that have corequisites: MSCS Boston 32, Align 34, Seattle roadmap 39,
  Cybersecurity 17, Data Science PTL 20.
- I did not re-run the full suite or typecheck. I accept the orchestrator results (typecheck 0, 357 pass) as reported.

## Per-criterion map

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Map tier: the planner text does not say "audit" and does not say it counts credits against degree rules | **partial** | The three lines from the issue are fixed: `components/planner-board.tsx:212`, `:305`, `app/[universityId]/[programId]/planner/page.tsx:27`. Credits claim is gone (`page.tsx:27`). But `lib/validation.ts:130` still puts "Corequisite audited separately" into eligibility reasons. The Map-tier planner shows it in the Add course dialog (`components/course-dialogs.tsx:87`, locked or uncertain course), in the course detail dialog (`components/course-dialogs.tsx:41`, always, mounted globally at `components/app-shell.tsx:112`) and in the target path card (`lib/plan.ts:233` -> `components/target-path.tsx:107`). |
| 2 | Audit tier (MSCS Seattle) keeps its text | met | Every change gates on tier "audit" and keeps the old string. `tests/planner-page.test.ts:39-50` pins six Audit strings. |
| 3 | A test renders the planner text for one Map-tier key and one Audit-tier key | met, with a gap | `tests/planner-page.test.ts:39` and `:52`. The Map test asserts no `/audit/i` (`:56`), but it opens the picker on CS 5500 (`:29`), which has no corequisite. So the test cannot see the residual text. The path toast (`components/app-provider.tsx:495`) is not tested. |

## Findings

### High

**H1. AC1 is not met for courses with corequisites.** The AC says the Map-tier planner text "does not say audit".
The implementer names "Corequisite audited separately" as "not changed" but files no follow-up and does not
change the AC. The new test asserts the strict rule (`tests/planner-page.test.ts:56`), so the team reads AC1
strictly too. The test passes only because CS 5500 has no corequisite.
Fix (cheap): reword the shared string at `lib/validation.ts:130` to a tier-neutral form, for example
"Corequisite checked separately". This is true for both tiers. Update `tests/validation.test.ts:142`.
Add one Map-tier render of a course with a corequisite (for example CS 2000 in `CourseDetail`) to
`tests/planner-page.test.ts`. AC2 does not block this: AC2 is about the planner text named in the issue,
and the new word keeps the same meaning on Audit tier. If the team keeps the string, it must file a follow-up
and say so in the PR body. Today neither is done.

### Medium

None.

### Low

**L1. Tier is computed in three ways.** `page.tsx:11` and `:27` call `requirementTier` twice in one file.
`app-provider.tsx:495` calls `requirementTier` again. The board and picker use `progress?.tier`.
Results are the same, but a later change can drift. Not blocking.

**L2. `AppContext` is now exported for tests only** (`components/app-provider.tsx:99`). The comment names the reason.
Acceptable. It widens the module surface a little.

**L3. Toast text is not tested.** `components/app-provider.tsx:374` and `:495` changed without a test.
The change is small and gated. Not blocking.

## Design and goal alignment

- The change follows the issue: copy only, gated on the existing `SupportTier`. No design fork.
- It moves the goal (honest Map-tier copy). No side-quest.

## Scope

- Dialog warning tail (`course-dialogs.tsx:87`), meta description (`page.tsx:11-14`) and the two toasts
  (`app-provider.tsx:374`, `:495`) are beyond the three named lines. They are justified: each said "audit"
  or "degree rules" on a Map-tier planner, so AC1 covers them. No gold-plating.
- Toast at `app-provider.tsx:374`: the no-catalog branch drops the "Check the live audit" hint for both tiers.
  Before the catalog loads, no audit exists, so this is correct.
- No deleted tests, no TODOs, no mocks in product code.

## Trade-offs and done-state honesty

- Paths page bug is filed as #138 (open). Good.
- "Corequisite audited separately" is a known residual but has no issue and no note in the AC map. That is
  hidden incompleteness on a ticket that claims done (H1).

## Risk surface

- Low. Copy only. Wrong tier detection would show the wrong copy, but tier logic is unchanged
  (`lib/requirements-v2.ts:116`).
