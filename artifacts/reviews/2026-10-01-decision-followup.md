# 2026-10-01 Decision follow-up — CoursesPlanner section 2 (packaged roadmap snapshot)

Scope: implement the owner's approved decision to **ship a real committed roadmap snapshot**
(approved plan section 2). Candidate: Northeastern Computer Science, MSCS (Seattle),
`northeastern` / `computer-science-mscs-sea-8b0d00dbda`.

Branch: `fix/2026-10-01-review-decisions` (base `380f273`).
This file is appended incrementally; prior verifier reports are not modified.

## Settled owner decisions (from the approved plan)

- Commit exactly the matching `data/catalogs/northeastern/programs.json` and
  `data/catalogs/northeastern/roadmaps/computer-science-mscs-sea-8b0d00dbda.json`, plus provenance.
- Generate through existing parsers from authentic cached sources; preserve original source dates
  (cached September data must not be labelled freshly scraped).
- Do not copy the owner's uncommitted directory wholesale or invent degree requirements, credit
  counts or missing courses. Do not fabricate or copy uncommitted state.
- Narrow `.gitignore` exceptions and `next.config.ts` route tracing includes; keep raw caches and
  scrapers out of the serverless reader bundle.
- Reuse `validateProgramRoadmap` / directory validation and `readProgramRoadmap` registry checks.
- Partial-crawl selectability rule must be preserved.
- No new dependencies. No production requests/deploy. Production availability needs a later deploy.

## Approach

- Program identity verified against the official discovery sitemap
  `https://catalog.northeastern.edu/sitemap.xml` (bounded single GET, 2026-10-01). The existing
  `northeastern-acalog` adapter `discoverPrograms` returns exactly one `mscs-sea` link:
  id `computer-science-mscs-sea-8b0d00dbda`, url
  `.../computer-science-mscs-sea/`, kind `degree` — matches the dispatch id.
- Snapshot content generated **offline** from the tracked cached sources via the existing
  `parseProgramScope` / `courseSources` / `parseCourses` / `buildRoadmapGraph` path, reusing
  `data/raw/mscs-sea-program.html` + `cs/cy/dads/ds.html`.
- Roadmap `lastUpdated` keeps the true cached source date (`2026-09-12T01:09:37.140Z` from
  `data/raw/.catalog-cache.json`); a provenance warning records the offline regeneration.
- No degree requirements, credit counts or missing courses are invented: the roadmap carries only
  program-scope course codes plus their real parsed course metadata and external placeholders.

## Before/after checks

- Failing-before: on a clean repository with no `data/catalogs/`, `readProgramDirectory`
  ("northeastern") returns no ready program and the selector is hidden. New
  `tests/packaged-snapshot.test.ts` fails before the snapshot is committed.
- Passing-after: the committed snapshot validates through `readProgramDirectory` /
  `readReadyRoadmap` and the selector is selectable.

## Per-change evidence

### Change 1 — committed snapshot (`7abb4a3`)

Files: `data/catalogs/northeastern/programs.json`,
`data/catalogs/northeastern/roadmaps/computer-science-mscs-sea-8b0d00dbda.json`,
`.gitignore`, `next.config.ts`, `tests/packaged-snapshot.test.ts`, this log.

- Snapshot regenerated offline from the tracked cache: 96 program course codes, 142 courses
  (33 with uncertainty warnings preserved, no invented credits/requirements).
- `programs.json` records one `ready` program; `roadmap.lastUpdated` stays
  `2026-09-12T01:09:37.140Z` (true cache date).
- Failing-before (snapshot moved aside): `npx tsx --test tests/packaged-snapshot.test.ts`
  → 3 failed / 1 passed, exit 1 (`Unknown roadmap program`, selector not selectable).
- Passing-after: 4 passed / 0 failed, exit 0.

### Change 2 — README production table + generated files (`this commit`)

- Corrects the production column: the selector is no longer "Hidden"; the committed MSCS Seattle
  roadmap makes `northeastern` selectable, other universities stay hidden until crawled.
- Documents the narrow `data/catalogs/` exceptions and the traced files.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Failing-before | `npx tsx --test tests/packaged-snapshot.test.ts` (no snapshot) | 3 fail / 1 pass, exit 1 |
| Snapshot tests | `npx tsx --test tests/packaged-snapshot.test.ts` | 4 pass, exit 0 |
| Full tests | `npm test` | 254 pass / 0 fail, exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Build | `npm run build` | exit 0 |
| Audit | `npm audit --omit=dev` | 0 vulnerabilities, exit 0 |
| Trace | `node -e` over `.next/server/app/api/roadmaps/route.js.nft.json` | both snapshot files present; 0 cheerio/scraper/adapters/crawler/data-raw entries |
| Local preview | `next start` + `curl` directory/program | HTTP 200/200; program `ready`, roadmap 142 courses, date preserved |
| Registry validation | `readProgramDirectory` / `readReadyRoadmap` | `ready`; selectable true |
| Deps | `git diff` package.json/package-lock.json | unchanged |

Selector/browser: no Playwright/Chromium/puppeteer installed, so the interactive selector was
verified through the rendered-view tests plus the live `GET /api/roadmaps` directory (which is what
feeds it). Interactive browser evidence is a remaining gap, not claimed.

## Remaining release gates

- **Deploy required.** The snapshot is committed and build-verified, but production availability
  needs a later Vercel deploy; no production request or deploy was performed here.
- The committed snapshot goes stale until `npm run catalog:refresh -- --crawl-roadmaps` re-runs;
  the provenance warning states this.
- Interactive browser click-through of the selector was not run (no browser tooling available).
