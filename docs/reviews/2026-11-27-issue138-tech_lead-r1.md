---
reviewed_head_sha: 213ae73ea623b4699ddee79d9da4944fad09bcd2
---

# Tech lead review, round 1: issue #138

Range: `5feabe7..213ae73`. Branch `fix/138-map-tier-paths-text`. Master is still `5feabe7`.
Work ran in a throwaway worktree with a temp HOME. No main-clone file changed.

## Verdict: PASS

No high finding. No medium finding. Three low findings.

## Checks

| Area | Result |
|---|---|
| Tier flag `progress?.tier === "audit"` | Correct. `progress` is `validatePlan(plan, catalog)` when `catalog` exists, else null (`components/app-provider.tsx:326`). `tier` is set at `lib/requirements-v2.ts:532`. |
| Undefined `progress` | The component returns at `components/pathways-workspace.tsx:99` when `catalog` is null. So `progress` is never null at line 141. If it were, the text falls back to Map text. That is the safe side: it never claims an audit. |
| Audit-tier text | Unchanged. The Audit branch of each ternary is the same string as on master. Mutation M7 shows the test catches an edit. |
| Test on old source | Master `components/pathways-workspace.tsx` with the new test: Map test fails, Audit test passes. |
| JSX spacing | `{...} Confirm` keeps the space. The test asserts the full sentence, so it checks this. |

## Mutations (product file changed, then restored)

Base: 11 pass, 0 fail (new test file plus planner test file).

| Mutation | Result |
|---|---|
| M1 `audit = true` | Map test fails |
| M2 `audit = false` | Audit test fails |
| M3 flag inverted | Both fail |
| M4 Map banner says "credit audit" | Map test fails |
| M5 Map Validation card back to "modeled catalog audit" | Map test fails |
| M6 Map closing line back to "Degree validation..." | Map test fails |
| M7 Audit banner changed to Map text | Audit test fails |
| M8 `progress?.tier !== "map"` | Survives. Equivalent: `progress` is never undefined here. Not a gap. |
| M9 `aria-label="degree audit"` added on Map | Map test fails. The attribute step works. |

## Findings

### Low 1: the two remaining "not an official degree audit" lines do not break the acceptance
- `components/app-shell.tsx:110` and `app/[universityId]/[programId]/pathways/[id]/page.tsx:87`.
- The acceptance names "the Paths page" and the two lines at 143 and 170. The footer is a shell text on every page. The `[id]` page is another route.
- Both lines are true on both tiers. They negate an audit. Planner test #126 also does not render the shell.
- A strict reader can count the word "audit" in the footer. The implementer states this risk (verification record, Risk 1). Keep as is. The project manager should accept it in the done-state, or file a separate ticket.

### Low 2: closing-line change. Verdict: KEEP
- Master text "Degree validation stays grounded in official catalog rules" says the planner validates a degree. A Map-tier program has no degree validation (`lib/types.ts:100`). The line is the same false claim as the two lines of the issue.
- The change has its own commit pair (`79a96cd`, `f3c9691`), so it is easy to drop. The Audit text is unchanged. Risk is small.
- The test bans `/degree validation/i` on Map tier. That is a narrow, honest guard.

### Low 3: tests assert exact copy
- `tests/pathways-page.test.ts` asserts three full Map sentences. A copy edit needs a test edit. This is acceptable: the issue asks for text tests. No action.

## Other checks

- **Merge conflict risk, `tests/planner-page.test.ts`:** 8 changed lines (import, removed `MAP_KEY`, last lines of `plannerText`). Master has not moved from `5feabe7`. No conflict now. A later branch that edits `plannerText` or `MAP_KEY` would conflict in a trivial way. Low.
- **Accessibility:** The new strings are plain text in existing `<p>` elements. No new role, label or heading. Reading order is unchanged. Map sentences are short and use plain words. No finding.
- **Architecture:** One flag, three call sites in one component. No new abstraction. The shared `tests/page-text.ts` is small and has two users. It is sound. The helper keeps the attribute step, so no test coverage was lost in the move.
- **Tests weakened:** None. No test is skipped, deleted or loosened. The planner test moved code, not asserts. Planner file still passes (9 tests).
- **Operations, security:** No change to data, storage, network or paths. Rollback is a plain revert.

## Not checked
- No live site call and no deploy, by rule. The implementer's live walk was not repeated.
- No screen reader run.
