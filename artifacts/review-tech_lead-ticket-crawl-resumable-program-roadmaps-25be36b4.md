# Tech-lead review — ticket-crawl-resumable-program-roadmaps-25be36b4

Verdict: PASS

Range: `1d82031..ffb19f3` (bb6f8f0, 3340718, ffb19f3), branch `goal/multi-university-roadmaps`.

## Scope inspected

Full diff of `lib/types.ts`, `lib/catalog.ts`, `scraper/parser.ts`, `catalog-service/{roadmaps,adapters,crawler,refresh,cli,server,registry,source-types}.ts`, `catalog-service/universities.json`, `tests/roadmaps.test.ts`, `tests/catalog-service.test.ts`, `tests/fixtures/northeastern-programs.xml`, plus surrounding unchanged code (`robots.ts`, `scheduler.ts`, `lib/graph.ts`, app consumers of `requirementType`). Ran `tsc --noEmit` (exit 0), `tsx --test tests/*.test.ts` (111/111 pass, 0 skipped/todo), and `tsx catalog-service/cli.ts --list-universities --university=northeastern` (read-only, returns persisted queue). Verified `data/catalogs/northeastern/*` crawl artifacts are gitignored (not tracked).

## Architecture

Sound. Roadmaps are a parallel, independent model (`ProgramRoadmap` / `DiscoveredPrograms` / `RoadmapCrawlStatus`) cleanly separated from `Catalog`/`DegreeRequirement`; the `Course.requirementType` union gains only `"program"`, and catalog validation explicitly restricts to `core|breadth|elective|external` while roadmap validation restricts to `program|external`, so no degree classification leaks into a roadmap (`lib/catalog.ts:388-394`, `409-417`). `programs.json` is the single commit point; the `.roadmap-crawl-status.json` sidecar is rebuilt from it on read (`roadmaps.ts:79-105`), and writes are ordered roadmap-file-then-status so an interrupted run is idempotently resumable. `buildCourseGraph` was refactored into a shared `buildScopedCourseGraph` with a classification callback; the catalog path is behavior-preserving (full suite + real-catalog build confirm). The one-writer CLI limitation is honestly named (`roadmaps.ts:171`).

## Correctness

Bounded/atomic resume, deterministic US-before-world ordering, robots+origin enforcement, and metadata-only no-fetch are all verified by tests and manual trace. Redirects are re-checked against the origin allowlist each hop (`crawler.ts:121-124`), and discovered URLs are re-validated against `allowedOrigins` before persist (`roadmaps.ts:255-275`, `lib/catalog.ts:442-510`). No data-loss, race, or false-green test paths found.

## Findings (all low)

- low — `tests/catalog-service.test.ts:505` passes `rootDir: process.cwd()` and the reworked `/universities` handler now reads+validates `data/catalogs/northeastern/programs.json` (`server.ts:75` → `roadmaps.ts:115-122`). A stale/corrupt local (gitignored) crawl artifact would make that test fail with a 503 while CI stays green. Not a product bug; test fragility coupling to local state.
- low — `roadmaps.ts:119-122` (`listRoadmapUniversities` uses `Promise.all`) means one unreadable university state 503s the entire `/universities` response instead of degrading per-entry. Only reachable for the single crawlable `northeastern` entry; acceptable, but error isolation would be more robust.
- low — discovery leaf heuristic (`adapters.ts:59-107`) includes non-program administrative pages under the program roots (e.g. the live crawl discovered `one-year-program-*`, `three-year-program-*`, `postsecondary-teaching-graduate-certificate`), which consume bounded `--limit` queue steps and are individually fetched before being marked `unsupported`. Self-heals and stays bounded; only queue efficiency.
- low — `roadmaps.ts:241` overrides caller `key`/`fileName` with `page.url`/`digest(page.url)`, making the registry-validated `discoverySource.key`/`fileName` (and `courseSources` `fileName`) dead for the roadmap crawl. Cosmetic (matches project_manager's finding).

No high or medium findings.

## Debate round 1

project_manager's four low findings (no direct test for `readReadyRoadmap`, `runCatalogCli`, and the per-university route regex; `loadPage` key/fileName redundancy) — concede all as low; the last is my `roadmaps.ts:241` finding above. My additional lows (test coupling to ignored local state, whole-response 503 granularity, discovery breadth) are additive and not rebutted by project_manager. Both seats can PASS: no unrebutted high/medium findings.
