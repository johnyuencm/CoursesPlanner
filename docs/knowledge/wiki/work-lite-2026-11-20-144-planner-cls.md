# work-lite 2026-11-20: #144 reserve the board's space while the catalog loads

- **Goal:** fix johnyuencm/CoursesPlanner#144. The planner page jumped (CLS 0.20-0.51) when the semester board arrived.
- **Shipped:** branch `fix/144-planner-cls`, PR johnyuencm/CoursesPlanner#148, stacked on #146. `51a0879`, `b24d599`: `div.board-placeholder` with `min-height: 100vh` while `catalogBusy`; test.
- **Verify:** `npm run typecheck` 0; `npm test` 0 (366 pass, 0 fail); `npm run build` 0. CLS (2.5 s API delay, 3 loads each): Boston 0.027/0.004, Seattle 0.024/0.004 at 1280/390 px; record `docs/reviews/2026-11-20-issue144-verification.md`.
- **Review:** tech_lead, project_manager, user_advocate PASS (`docs/reviews/2026-11-20-144-*.md`); user_advocate re-measured live. No architecture pass (one CSS rule and one wrapper).
- **Leftovers:** #147 (390 px scroll and focus jump when the student scrolls during the load; also on the base); heading shift 0.024-0.041 left on purpose; #145 (failure-state UX).
- **Note:** work ran in the submodule clone, not a new worktree (WIKI.md header asks for one).
