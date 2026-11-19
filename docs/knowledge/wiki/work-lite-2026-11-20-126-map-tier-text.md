# work-lite 2026-11-20: #126 Map-tier planner text no longer claims a degree audit

- **Goal:** fix johnyuencm/CoursesPlanner#126. The Map-tier planner said it ran an audit and counted credits against degree rules.
- **Shipped:** branch `fix/126-map-tier-text`, PR johnyuencm/CoursesPlanner#142.
  - `75a6e03`..`0ab3218`: tier-gated copy in the planner page, board, Add course dialog and toasts; test for Boston (Map) and Seattle (Audit).
  - `e33b2d1` (PM H1): shared corequisite note "checked separately" on both tiers; Map test on 3 surfaces.
  - `c0bfe4c`, `2a81541`, `e7b07b2`: attribute check, `chainAddedNotice`, `MAP_TIER_CHECKS`.
  - `0befb34` (architecture C2): test renders a plan with all 5 issue kinds.
- **Verify:** `npm run typecheck` 0; `npm test` 0 (358 pass, 0 fail); `npm run build` 0.
- **Review:** round 1: tech_lead PASS, project_manager FAIL (H1). Round 2 at `e7b07b2`: tech_lead, project_manager PASS; user_advocate PASS (wrangler dev + Playwright). `0befb34` is test-only. Records: `docs/reviews/2026-11-20-126-*.md`.
- **Architecture:** `artifacts/architecture-126-map-tier-text.html`. Implemented C2. Top recommendation C1 (one plan-check name) is out of scope: filed as #141.
- **Leftovers:** #138 Paths page "credit audit"; #139 "sources.."; #140 "catalog is unavailable" while loading (high, older); #141 plan-check name; C3 glossary; C4-C6 speculative.
- **Note:** work ran in the submodule clone, not a new worktree (WIKI.md header asks for one).
