---
ticket: "johnyuencm/CoursesPlanner#126"
seat: project_manager
round: 2
branch: fix/126-map-tier-text
base_sha: 04e51ff
reviewed_head_sha: e7b07b2cb7d1e7821b04bfeee5a6a647e1191287
verdict: PASS
---

# Review #126, round 2: project manager

Verdict: **PASS**. H1 from round 1 is closed. No high or medium findings.

```
lib/validation.ts:130  "Corequisite checked separately: X."   (shared, both tiers)
   -> picker warning   (course-dialogs.tsx:87)   tested: CS 5004 -> "CS 5005"
   -> CourseDetail     (course-dialogs.tsx:41)   tested: CS 2000 -> "CS 2001"
   -> TargetPathCard   (plan.ts -> target-path)  tested: CS 2500 -> "unverified requirement ..."
Map test: no /audit/i after removing "no degree audit" and "official university audit"
```

## Evidence that I ran

- `git diff 0ab3218..HEAD` (code and tests, not docs): 7 files.
- `npx tsx --test tests/planner-page.test.ts tests/validation.test.ts`: 15 pass, 0 fail.
- `npx tsc --noEmit -p .`: exit 0.
- `grep -rn "audited separately"` in code, tests and non-review docs: no hits.
- `grep` of quoted strings with "audit" in `lib/ components/ app/`: only `lib/validation.ts:407-408`
  ("official university audit", a pointer to the school, not a claim) and `components/program-picker.tsx:14-15`
  (program picker, not the planner; Map line says "no degree audit").
- I did not re-run the full `npm test` or `npm run build`. I accept the implementer results (358 pass, build 0).

## Per-criterion map

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Map tier: planner text does not say "audit" and does not claim to count credits against degree rules | met | Heading, button, notes, meta and about text: `components/planner-board.tsx:213`, `:306`, `:313`; `app/[universityId]/[programId]/planner/page.tsx:11`, `:27`. Corequisite note: `lib/validation.ts:130`. Chain toast: `components/app-provider.tsx:158-161`. The remaining words are "No degree audit" (the status card the issue calls correct) and "official university audit" (`lib/validation.ts:407`). Both say that this app gives no audit. |
| 2 | Audit tier (MSCS Seattle) keeps its text | met | All tier-gated strings keep the old Audit text. `tests/planner-page.test.ts:42-53` pins six of them. `tests/planner-page.test.ts:74-84` pins the Audit toast. The shared corequisite note changes on Seattle too ("audited" -> "checked"). The meaning stays the same, and it is not one of the lines named in the issue. See L1. |
| 3 | A test renders planner text for one Map key and one Audit key | met | `tests/planner-page.test.ts:42` (Seattle) and `:55` (Map). The Map render now includes a course with a corequisite on all three surfaces (`:31-32`, `:69-71`). It also reads screen-reader and tooltip attributes (`:37-39`). |

## Round 1 findings

- H1 (corequisite text on three surfaces): **closed**. Fixed once in the shared string, tested per surface.
- L1 round 1 (tier computed three ways): reduced. `MAP_TIER_CHECKS` (`lib/requirements-v2.ts:105`) removes the copied phrase. The three tier calls stay. Not blocking.
- L3 round 1 (toast not tested): **closed** by `chainAddedNotice` and its test.

## New findings

### High

None.

### Medium

None.

### Low

**L1. Seattle corequisite note changes.** AC2 says Seattle "keeps its text". The word "audited" becomes
"checked" in a note that both tiers share. This is a deliberate change that keeps the same meaning.
Round 1 accepted it as the fix. State it in the PR body so the AC2 reader sees it.

**L2. `chainAddedNotice` is exported for tests only** (`components/app-provider.tsx:158`). Same pattern
as `AppContext`. Acceptable.

## Design, goal and scope

- Copy only, gated on the existing `SupportTier`. No design fork. No change to tier logic.
- `MAP_TIER_CHECKS` is a small refactor inside scope: it keeps three Map strings the same.
- No TODOs, no deleted tests, no mocks in product code. Test rename in `tests/validation.test.ts:138`
  follows the word change and makes the assert stricter (`deepEqual`).
- Deferred work: Paths page bug stays in #138. Named.

## Risk surface

- Low. Text only. A screen reader user on Seattle hears "checked" in place of "audited".
