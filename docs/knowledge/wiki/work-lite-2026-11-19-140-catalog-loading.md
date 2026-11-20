# work-lite 2026-11-19: #140 the planner shows a loading state, not "catalog is unavailable"

- **Goal:** fix johnyuencm/CoursesPlanner#140. Every planner load showed "...while the catalog is unavailable." until `/api/catalog` answered.
- **Shipped:** branch `fix/140-catalog-loading`, PR johnyuencm/CoursesPlanner#146.
  - `002ee3c`, `0da2928`: the planner reads the provider's `catalogBusy`; loading and failure tests.
  - `4bb3951`, `5c76868`, `6f91581`, `80e9a69`: provider fetch-failure test; assert message; comments on the always-present live regions; `quiet` doc.
- **Verify:** `npm run typecheck` 0; `npm test` 0 (365 pass, 0 fail); `npm run build` 0. Live wrangler dev + Playwright: no "unavailable" during a 2.5 s delay; failure card and Try again work; D1 passes.
- **Review:** tech_lead, project_manager, user_advocate PASS at `a0b581b` (`docs/reviews/2026-11-19-140-*.md`). Later test and comment commits were not reviewed.
- **CPU:** +4-6 µs per board render (0.05% of 10 ms); AC4 met in spirit, named in the PR body.
- **Architecture:** `artifacts/architecture-140-catalog-loading.html`. Implemented C2 (provider test seam) and C3 (doc). Top recommendation C1 (one catalog status owned by the provider) goes with #145.
- **Leftovers:** #144 (CLS), #145 (failure-state UX).
- **Note:** work ran in the submodule clone, not a new worktree (WIKI.md header asks for one).
