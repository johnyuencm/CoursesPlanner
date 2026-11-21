# Activity log

- 2026-09-12 | decision | [[work-lite-2026-09-12-plan-backup]] | Added and verified local plan backup/restore on `codex/plan-backup`.
- 2026-11-19 | root-cause | [[work-lite-2026-11-19-127-build-tracked-only]] | Build read the ignored crawl status file; now only tracked files (PR #137).
- 2026-11-20 | decision | [[work-lite-2026-11-20-126-map-tier-text]] | Map-tier planner copy is tier-gated; corequisite note says "checked" (PR #142).
- 2026-11-19 | root-cause | [[work-lite-2026-11-19-140-catalog-loading]] | Planner showed the failure text during a normal load; now catalogBusy drives a loading state (PR #146).
- 2026-11-20 | root-cause | [[work-lite-2026-11-20-144-planner-cls]] | The board landed above the page text; a 100vh placeholder holds its space (PR #148).
- 2026-11-20 | decision | [[work-lite-2026-11-20-145-failure-state]] | Failure card: one plain sentence, role=alert, focus to h1 after Try again.
- 2026-11-21 | root-cause | [[work-lite-2026-11-21-147-load-scroll-focus]] | Focus left with the removed backup panel; a body overflow-x clip made scroll anchoring score as CLS.
