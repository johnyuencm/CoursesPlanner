# Tech-lead review — ticket-select-university-roadmaps-on-graph-1a5c1c70

Range `236738f..fb1642a`, branch `goal/multi-university-roadmaps`, Next 16.3.4.

## Verdict

PASS (no high findings).

## Evidence run

- `tsx --test tests/*.test.ts`: 61/61 pass, 0 skipped.
- `tsc --noEmit`: exit 0.
- `node node_modules/next/dist/bin/next build`: exit 0; `/api/roadmaps` emitted as `ƒ (Dynamic) server-rendered on demand`.
- Read route, `lib/roadmaps.ts`, `lib/graph.ts`, `components/course-graph.tsx`, `components/roadmap-selector.tsx`, `catalog-service/roadmaps.ts`, `catalog-service/registry.ts`, `lib/catalog.ts` validators.
- `catalog-service/universities.json` holds exactly 20 `us` + 20 `world` entries; `data/catalogs/` is gitignored (crawler output, not committed).

## Coverage by area

- **Architecture** — sound. Read-only same-origin route layered over the existing `catalog-service` read helpers (`findUniversity`, `listRoadmapUniversities`, `readProgramDirectory`, `readReadyRoadmap`); no crawl path invoked. The graph reuses `mapScene`/`visibleGraphDistances` via an explicit `programCodes` override instead of forking layout. `resolveGraphCourses`/`resolveProgramScope` cleanly swap `courses`/`programCodes` while leaving NEU `catalog` as default.
- **Correctness** — route re-validates ids (`SAFE_ID` at `app/api/roadmaps/route.ts:12`) and the helpers re-validate (`validId` in `catalog-service/roadmaps.ts:23`, `universityDir:30`, `findUniversity:45`, `readReadyRoadmap:130`), so traversal is blocked twice. `mapScene` builds `relations` from `input.courses` (`lib/graph.ts:433`), so roadmap relations derive from roadmap courses, not NEU; the always-supplied `programCodes` means `requirements` is only a fallback. 404 vs 503 mapping matches error-prefix contract. Not-ready → 503 by design (accepted). Focus/selected reset on roadmap change restores `depth`, `zoom`, `viewStack`, `search`, `findIndex`, `selectedRelationship`.
- **Tests** — route modes (list/program/ready-roadmap), no-store header, 400 traversal/malformed, 404 unknown, 503 not-ready, 400 program-without-university are all asserted with a real tmpdir fixture through `handleRoadmapsRequest`. Graph override covered by one added `visibleGraphDistances` test. Pure helpers (`groupUniversities`, status text, selectability, scope fallback) covered. No skipped/disabled tests.
- **Operations** — `runtime = "nodejs"`, `dynamic = "force-dynamic"` (valid in 16.3.4 without `cacheComponents`) plus explicit `Cache-Control: no-store` on every response; build confirms dynamic. Read-only, idempotent. `listRoadmapUniversities` does ~40×2 file reads per call — fine for local-first/serverless.
- **Security** — path traversal blocked at two layers; ids restricted to `[a-z0-9][a-z0-9-]{0,80}`; `readBoundedFile` used for snapshots; `validateProgramRoadmap`/`validateDiscoveredPrograms` re-validate on read. No remote fetch in the route (crawler imported but never invoked; only `crawlRoadmaps` triggers network).
- **Code health** — read path shares `catalog-service/roadmaps.ts` with the crawler, so the route bundle carries the crawler/adapter modules (cheerio is already `serverExternalPackages`); acceptable, noted only.

## Findings

### Medium

- **M1 — no stale-response guard in the selector** (`components/roadmap-selector.tsx:51-91`). `selectUniversity`/`selectProgram` fire `fetch` with no AbortController or request token. Failure scenario: pick university A (slow), then B (fast); A resolves last → `setPrograms(A.programs)` while `universityId === B`, so choosing a program then requests `?university=B&program=<A-program>` → 404. Same class for `selectProgram`: reset during an in-flight roadmap fetch re-applies `onRoadmapChange(data)` after reset, re-showing a roadmap the user just cleared.

- **M2 — headline UI acceptance has no render-level test** (`tests/roadmaps-selector.test.ts`). Only pure helpers are unit-tested. Nothing asserts the rendered `<optgroup>` US/world grouping, the `disabled` attributes on non-selectable options, the reset button behavior, or that `!overrideActive` actually hides inspector actions / line-focus plan (`components/course-graph.tsx:610,653`). "Visible disabled statuses" and "mismatched plan/dialog actions hidden" are implemented but unverified at the component level.

### Low

- **L1 — error passthrough leaks internals** (`app/api/roadmaps/route.ts:63-66`). The catch returns the raw `error.message` for 503/404; a malformed snapshot yields validator labels / filesystem-path-bearing messages (e.g. `readBoundedFile` ENOENT) to unauthenticated clients.

- **L2 — one-frame stale render on roadmap switch** (`components/course-graph.tsx:132-143`). The reset effect runs after paint, so the first render after selecting a roadmap still uses the old `focusCode`/`selectedCode` ("CS 5010"), producing a transient "CS 5010 / Metadata not in this catalog" node/inspector before the effect resets to `programCourseCodes[0]`.

- **L3 — reset effect omits `view` and `lineSemesterId`** (`components/course-graph.tsx:132-143`). Table/graph view and the line-semester selection survive a roadmap switch/reset; minor UX inconsistency, not a data bug.

- **L4 — no retry on university-load failure** (`components/roadmap-selector.tsx:116`). `disabled={loading || Boolean(error)}` with no retry button locks the selector after a transient fetch failure until page reload.
