# work-lite 2026-11-20: #145 planner catalog failure state

- **Goal:** fix johnyuencm/CoursesPlanner#145. The failure card showed raw error text, Try again sat below the fold at 390 px, "unavailable" appeared three times, focus was lost after Try again, and the Restore reason was a tooltip.
- **Shipped:** branch `fix/145-failure-state`, PR on base `fix/144-planner-cls` (stack #146 → #148 → this). `58eb056`..`5083cd6`: plain card copy with `role="alert"`, raw error to the console; the card before the backup panel; a visible Restore reason; failure said once; focus to `main h1` after Try again; one shared 15rem wrapper. `50488c2`, `c803a7b`, `fae0878`: copy "Check your connection, or try later." (one line ≥360 px); a true focus comment with a shortcut to #149; a stricter fake DOM.
- **Verify:** `npm run typecheck` 0; `npm test` 0 (370 pass, 0 fail); `npm run build` 0. Live (16 runs): Try again in the first screen at 360-1280 px; failure CLS 0.018-0.025 on phones, 0.084 at 1280.
- **Review:** tech_lead and project_manager PASS at `85e07b3`; fix pass; user_advocate PASS at `fae0878`. Records: `docs/reviews/2026-11-20-145-*.md`, `docs/reviews/2026-11-20-issue145-verification.md`.
- **Architecture:** no new pass; the #140 report covers this module, and its C1 (one catalog status) did not make any #145 edit smaller.
- **Trade-off:** at 360x640 and 375x667, Download backup needs a scroll while loading (the other layout gave CLS 0.235).
- **Leftovers:** #149 (Courses/Explore focus, refresh-banner raw error, hidden Restore reason while not hydrated); #147.
