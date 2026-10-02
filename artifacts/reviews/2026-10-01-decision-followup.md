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

## Independent verification (2026-10-01)

Verdict: **ACCEPT** for range `380f273..cf7572c` (local verification only; not pushed, not deployed). The reviewer ran every check below and did not rely on the author's report. Source diff covers 7 files: `.gitignore`, `README.md`, `next.config.ts`, `tests/packaged-snapshot.test.ts`, this log and the two snapshot JSONs. `package.json` and `package-lock.json` are unchanged. The diff removes no test lines and adds no `.skip`/`.only`. `.gitignore`, `README.md` and `next.config.ts` remain LF, as at the base.

- **Provenance.** The reviewer used a scratch `git clone` at `cf7572c` and ran a fresh `npx tsx` regeneration through `getAdapter("northeastern-acalog")`: `parseProgramScope`, `courseSources`, `parseCourses` and `buildRoadmapGraph` over the tracked `data/raw/mscs-sea-program.html`, `cs.html`, `cy.html`, `dads.html` and `ds.html`. Output: name `Computer Science, MSCS (Seattle)`, 96 codes and 142 courses, 33 of them uncertain. `programCourseCodes` and the whole `courses` array are byte-identical (JSON) to the snapshot.
  - Seeded random sample of 10 courses, all equal to the parser output: CS 7470/7180/6760/7675/8982/7770/5200/7810/6640 and external CS 2001. Titles and hours cross-checked against `data/raw/cs.html`, e.g. `CS 6640. Operating Systems Implementation. (4 Hours)` and `CS 8982. Readings. (1-8 Hours)`.
  - 46 external rows. 27 are unavailable-detail placeholders with `credits: 0` and an explicit "must not be counted" uncertainty. No `requirements` key.
  - `lastUpdated`, `discoveredAt` and `statusUpdatedAt` are all `2026-09-12T01:09:37.140Z`, which is `.catalog-cache.json` `program.fetchedAt`.
- **Identity.** `sha256(officialUrl)[0..10]` gives `8b0d00dbda`. A bounded live GET of `https://catalog.northeastern.edu/sitemap.xml` returned 200. Running `discoverPrograms` over it yields 1340 links, exactly one of them `mscs-sea`: `{id: computer-science-mscs-sea-8b0d00dbda, officialUrl: .../computer-science-mscs-sea/, kind: degree}`. The cached page title is `Computer Science, MSCS (Seattle)`. `readReadyRoadmap` enforces matching id, name, officialUrl and adapter, and it passes.
- **Clean checkout.**
  - Scratch clone: no untracked files; `npm ci` exit 0; `npm test` 254/254 exit 0; `npm run typecheck` 0; `npm audit --omit=dev` 0 (0 vulnerabilities); `npm run build` 0.
  - `.next/server/app/api/roadmaps/route.js.nft.json` has 126 entries and includes `catalog-service/universities.json`, `data/catalogs/northeastern/programs.json` and `data/catalogs/northeastern/roadmaps/computer-science-mscs-sea-8b0d00dbda.json`, as `../../../../../`-relative paths resolving to the project root. It has 0 cheerio/scraper/adapters/crawler/`data/raw` entries.
  - `next start` on a unique port: `GET /api/roadmaps?university=northeastern` 200 with program `ready`; `&program=computer-science-mscs-sea-8b0d00dbda` 200 with 142 courses and the preserved date; `/api/roadmaps` 200 with `northeastern:ready`; `/` 200.
- **Baseline and regression.** At `380f273`: `npm ci` 0, `npm test` 250/250 exit 0, typecheck 0. With `data/catalogs` moved aside in the scratch copy: `tests/packaged-snapshot.test.ts` gives 3 fail / 1 pass, exit 1, and the full suite gives 251 pass / 3 fail, exit 1. Prior selector/partial-crawl tests still pass, including "a partly crawled university is selectable once it has a ready program (D1)" and "the real shipped university list has no selectable university without catalogs (D1)", which uses a temp root.
- **Ignore scope.** `git check-ignore` still ignores `data/catalogs/northeastern/raw/**`, `.roadmap-crawl-status.json`, `roadmaps/other.json`, `data/catalogs/other/programs.json` and `northeastern/catalog.json`. Only the two snapshot files are tracked. The original checkout `/mnt/c/.../CoursesPlanner` was untouched: HEAD is still `4c41ebf`, with no working files newer than 2026-10-01 outside the shared `.git` object store.
- **Tracing observations (non-blocking).**
  - Rebuilding without `outputFileTracingIncludes` still traced all three files, because the reader's `path.join(process.cwd(), ...)` reads are traced by NFT. The explicit include is belt-and-braces only.
  - The same tracer also widens: in a scratch build with dummy *ignored* files present (`data/catalogs/northeastern/raw/dummy.html`, `data/catalogs/other/programs.json`, `roadmaps/dummy.json`), those files and `data/catalog.json` were also traced. A deploy from a clean checkout, which Vercel Git deploys are, ships only the committed files. A `vercel deploy` from a dirty owner tree could bundle ignored local catalogs. Consider `outputFileTracingExcludes` for `data/catalogs/*/raw/**` if CLI deploys from local trees are used.
- **Not performed.** No interactive browser click-through of the selector. No production deploy or production request. Snapshot production availability still requires a later deploy.
