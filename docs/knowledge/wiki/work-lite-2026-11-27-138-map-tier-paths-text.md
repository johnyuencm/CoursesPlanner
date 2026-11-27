# work-lite 2026-11-27: #138 Map-tier Paths page no longer claims a degree audit

- **Goal:** fix johnyuencm/CoursesPlanner#138. The Paths page of a Map-tier program said "credit audit" and "modeled catalog audit". A Map-tier program has no degree audit.
- **Shipped:** branch `fix/138-map-tier-paths-text`. No PR yet.
  - `a2c47c9`: `tests/page-text.ts` holds `MAP_KEY` and the text step. The planner test (#126) and the new Paths test share it.
  - `26f32fc`, `bab23bb`: red test, then the tier-gated banner and Validation card in `components/pathways-workspace.tsx`. Map tier says "The planner gives no degree audit for this program, so graduation status comes only from your official university audit."
  - `79a96cd`, `f3c9691`: red test, then the closing line. "Degree validation stays grounded in official catalog rules." makes the same claim. Revert this pair to keep only the two lines of the issue.
- **Verify:** `npm run typecheck` 0; `npm test` 0 (372 pass, 0 fail; base 370); `npm run build` 0. Live walk of 5 programs at 2 widths: Seattle text unchanged, each Map program says "no degree audit". The repo has no lint script. Record: `docs/reviews/2026-11-27-issue138-verification.md`.
- **Review:** not done. The implementer does not review its own change.
- **Architecture:** no new pass. The change adds three tier branches with one call site each. So candidate 4 of `artifacts/architecture-126-map-tier-text.html` (one tier-text table) stays "revisit when a third tier appears".
- **Leftovers:** #139 ("sources.."), not touched. #141 (one plan-check name). Two disclaimers say "not an official degree audit" (`components/app-shell.tsx:110`, `app/[universityId]/[programId]/pathways/[id]/page.tsx:87`). They are true on both tiers, so they stay.
- **Note:** work ran in the clone that the task named, not a new worktree (WIKI.md header asks for one). The clone was clean on master.
