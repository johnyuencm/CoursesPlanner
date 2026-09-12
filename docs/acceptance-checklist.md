# Acceptance checklist

This is the independent verification checklist, not a claim of completion.

## Catalog fidelity and refresh
- Compare normalized total credits, required core (including CS 5011), three breadth categories and elective rules against the saved official program HTML.
- Compare at least five course records against official bulk HTML, including no prerequisites, OR alternatives, grouped AND/OR, reciprocal corequisites, and variable credits.
- Unknown expressions remain unknown. Missing course pages never become "no prerequisites". Relationship edges contain only extracted codes.
- Initial app loads normalized local JSON without fetching Northeastern. Refresh is explicit, bounded, same-origin, unauthorized without a local refresh token outside `next dev`, and retains the previous snapshot on failure.
- Cache records catalog edition, update timestamp and source URLs. Frontend cannot mutate scrape URLs or filesystem paths.

## Student flow
1. Open a fresh browser profile. No completed courses or fabricated progress appear. Read the degree overview and its core, breadth and elective sections.
2. Search CS 5180. Open details. Compare displayed prerequisites to the actual catalog, not the illustrative product brief. Follow a prerequisite chip and official source link.
3. Filter by core, breadth category, credits, prerequisites and topic. Reset filters. Verify empty results are recoverable.
4. Select a graph course. Identify upstream prerequisites and downstream unlocks. Check labels/legend and equivalent relationship table. Verify zoom, keyboard access and long titles.
5. Add courses to a term. Verify credit/core/breadth/elective progress changes. Schedule a dependent before its prerequisites and see an actionable warning. Move prerequisites earlier and see the warning clear.
6. Add CS 5010 without CS 5011 and see the corequisite warning; add both to the same term and see it clear. CS 5011 contributes zero credits.
7. Add, rename and reorder terms. Add an internship/co-op term. Move a course using drag-and-drop and the keyboard/native move alternative. Remove a course. Confirm before removing a populated term.
8. Mark a course completed and another waived. Completion contributes valid degree credit, waiver does not. Reload and confirm persistence. Reverse both statuses.
9. Compare eligibility for a target term before and after adding earlier prerequisites. No view says a course is actually offered in that term.
10. Open robotics recommendations. Edit and save the suggested list, reload, and verify persistence. Recommendations never alter degree rules.
11. Simulate malformed LocalStorage and a storage write failure. Original data is not silently destroyed. Error recovery remains possible.
12. Test narrow mobile viewport, desktop, keyboard focus, Escape dismissal, no horizontal page overflow and no runtime console errors.

## Degree invariants
- Count each course once; do not assign the same course to both breadth and electives.
- Breadth needs three qualifying courses covering at least two categories, not one course from every category.
- Only approved-list/breadth courses contribute to the standard degree credit audit. External prerequisites can unlock courses without adding degree credit.
- A waived core course does not lower the 32-credit minimum.
- Respect explicitly selected variable credits. Fixed-credit overrides cannot inflate totals.
- Same-semester prerequisites are not satisfied unless concurrency is explicitly cataloged. Corequisites allow the same semester.
- Unknown prerequisites, invalid credits and other errors cannot yield a satisfied plan.
- Completion attests the catalog's minimum course grade. GPA, permissions, residency/transfer rules and official offering data remain outside this planning audit and are clearly disclosed.

## Commands and evidence
- Run `npm test`, `npm run typecheck`, and `npm run build` independently and capture each exit status.
- Launch the actual application. Exercise browser flows above; capture desktop/mobile screenshots and inspect them.
- Return PASS/FAIL per criterion with command or file/line evidence. Unchecked criteria are not passes.
