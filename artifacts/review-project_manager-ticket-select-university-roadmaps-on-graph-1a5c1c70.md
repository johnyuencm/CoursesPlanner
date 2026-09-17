# Project-manager review — ticket-select-university-roadmaps-on-graph-1a5c1c70

Range `236738f..fb1642a`, branch `goal/multi-university-roadmaps`, Next 16.3.4.
Verdict: **PASS** (no high findings).

## Per-criterion map

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | `/api/roadmaps` list/program/roadmap modes, validated IDs, never crawls | MET | Live curl: list `200` + `cache-control: no-store` + 40 unis US-first; `?university=northeastern` `200`/1340 programs; queued program `503`; unknown `404`; traversal/uppercase/program-without-university `400`. Route only calls read helpers (`findUniversity`/`listRoadmapUniversities`/`readProgramDirectory`/`readReadyRoadmap`); no fetch. `app/api/roadmaps/route.ts:12-70`. |
| 2 | US-before-world, all statuses, disable unavailable, load ready | MET | `components/roadmap-selector.tsx:117-140` (`<optgroup>` US then World; `disabled={!isUniversitySelectable}`/`!isProgramSelectable`). `lib/roadmaps.ts:8-40` covers unverified/unsupported/ready/error/queued. No render-level test (see M2). |
| 3 | Override resets focus, keeps search/table/trace/inspector | MET | Reset effect `components/course-graph.tsx:132-143`; `courses`/`programCodes` swap at `:105-107`; relations derive from roadmap courses (`lib/graph.ts:433`). |
| 4 | Roadmap-only hides NEU plan/dialog actions, uses program labels | MET | `!overrideActive &&` guards hide inspector actions `:653` and line-focus plan `:610`; table `CodeLinks onSelect={focus}` `:595-596`; `programLabel` in header `:549` + footnote. |
| 5 | NEU MSCS stays default | MET | `app/map/page.tsx` default `roadmap=null`; `roadmapProgramLabel(null)==="MSCS Seattle"`. |
| 6 | tests/typecheck/build/smoke | MET | Fresh run: `npm test` 123 pass; `tsc --noEmit` exit 0; `node node_modules/next/dist/bin/next build` exit 0 with `ƒ /api/roadmaps`. Live smoke of list/program/error modes done. No ready local roadmap (0 ready in `data/catalogs/northeastern/programs.json`) — acceptable per rule since fixture tests prove happy path (`tests/roadmaps-route.test.ts` ready-roadmap; `tests/roadmaps-selector.test.ts` scope/courses/focus/label). |

## Findings

### Medium (concede tech_lead, non-blocking)

- **M1 — selector stale-response race** (`components/roadmap-selector.tsx:51-91`): no AbortController/request token; a slow earlier fetch can clobber a later selection (wrong `programs` shown, then a `?university=B&program=<A-id>` 404). Real defect; recoverable; no acceptance criterion fails.
- **M2 — headline UI acceptance untested at render level**: US/world grouping, `disabled` attributes, hidden inspector/plan actions verified only by code inspection + pure-helper units, not a component test.

### Low

- **L1** `npm run build` fails in this worktree solely because `node_modules/.bin/next` is missing (env); the build itself is green via `node node_modules/next/dist/bin/next build`. Not a code defect.
- **L2** one-frame stale render before reset effect (`course-graph.tsx:132-143`).
- **L3** reset effect omits `view` and `lineSemesterId`.
- **L4** no retry after university-load failure locks selector (`roadmap-selector.tsx:116`).
- **L5** route catch returns raw `error.message` (internal/ENOENT paths can leak) `app/api/roadmaps/route.ts:63-66`.

## Scope honesty / design alignment

No TODOs/FIXMEs/mocks/placeholders in changed files. Design matches brief (one same-origin read-only route + accessible selector + graph override via `programCodes` without forking layout). `data/` is gitignored (crawler output not committed). No gold-plating spotted.
