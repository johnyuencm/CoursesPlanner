# Project-manager review — ticket-crawl-resumable-program-roadmaps-25be36b4

Verdict: PASS

Range reviewed: `1d82031..ffb19f3` (bb6f8f0, 3340718, ffb19f3), branch `goal/multi-university-roadmaps`.
Blocker `ticket-add-ordered-university-directory-c84028b8` is done (events.jsonl line 90).

## Evidence run (fresh)

- `tsx --test tests/roadmaps.test.ts` -> 8/8 pass.
- `tsx --test tests/*.test.ts` -> 111/111 pass.
- `tsc --noEmit` -> exit 0.
- `next build` -> exit 0 (all routes compiled, /planner + /map prerendered static, meaning the real `data/catalogs/neu-mscs-seattle/catalog.json` still passes `validateCatalog`).
- `git diff --check` -> exit 0.
- CLI smoke: `--list-universities` returns 40 (us then world), northeastern `status=queued, discoveryStatus=ready`; `--list-programs --university=northeastern` returns 1340 programs/queue.

## Per-criterion map

| Criterion | Verdict | Evidence |
|---|---|---|
| Adapters discover official program links + extract course-based scope | MET | `adapters.ts:62-137` (sitemap leaf filtering, `#programrequirementstextcontainer` scope); registry enforces crawl config `registry.ts:65-86`; discovery path `roadmaps.ts:255-275`. Test `roadmaps.test.ts:247-264`. |
| Bounded `--crawl-roadmaps --limit` US-before-world, persists, deterministic resume, never fetches metadata-only | MET | limit guard `roadmaps.ts:160-162`; US-first sort `registry.ts:143-145`; resume via `readState`/`summarize` `roadmaps.ts:79-105`; metadata filtered by `crawlable` `roadmaps.ts:27-28,168`. Tests `roadmaps.test.ts:310-414`. |
| Snapshots validate intl-safe course IDs, official sources, complete prereq/coreq refs | MET | `isRoadmapCourseCode` `lib/catalog.ts:32-43`; `validateProgramRoadmap` `lib/catalog.ts:343-440` (origin allowlist, refs-metadata, unlock index). Test `roadmaps.test.ts:164-202`. |
| Northeastern fixture proves discovery + known prereq/unlock edge | MET | `tests/fixtures/northeastern-programs.xml`; CS 5010 unlocks CS 5500 `roadmaps.test.ts:266-308`. |
| CLI + service list programs/status/roadmaps, existing commands/endpoints preserved | MET | CLI modes `cli.ts:34-59`, refresh preserved `cli.ts:60-74`; GET endpoints `server.ts:71-83`; existing `/catalogs` + refresh unchanged. Smoke + `catalog-service.test.ts:501-572`. |
| Focused node:test coverage passes | MET | 8/8 roadmap tests, 111/111 full suite. |
| Strict validation without fabricated degree requirements | MET | `validateProgramRoadmap` rejects `requirements` field `lib/catalog.ts:348-350`; only program/external types, `electiveEligible` false `lib/catalog.ts:409-417`. |
| Atomic required persistence files | MET | `atomicWrite` temp+rename `refresh.ts`; programs/status/roadmaps written atomically `roadmaps.ts:185-188,310`. |
| Read-only service program/status/roadmap endpoints | MET | GET-only with 405+Allow for others `server.ts:72-83`. |
| Existing Northeastern full planning unchanged | MET | `buildCourseGraph` refactor is behavior-preserving (`parser.ts`); full suite + build pass against real catalog. |

## Findings

- low: `readReadyRoadmap` (`roadmaps.ts:125-143`) has no direct test; no test reaches a `ready` program. Sibling `validateProgramRoadmap` is tested and crawl writes validated files, so risk is small.
- low: `runCatalogCli` (`cli.ts:15-82`) has no automated test (flag parsing / mode-combination errors). Smoke-tested manually; underlying functions are tested.
- low: per-university GET route regex `/universities/:id/(programs|status|roadmaps/:id)` (`server.ts:71`) is not asserted; only `/universities` and `/catalogs` are. Routing is trivial and read-only by construction.
- low: `loadPage` overrides caller `key`/`fileName` with URL digests (`roadmaps.ts:241`), making those fields on `discoverySource`/`courseSources` redundant. Cosmetic, not a bug.

No high or medium findings. The single `ponytail:` comment (`roadmaps.ts:171`) honestly names the one-writer limitation — a named deferral, acceptable.
