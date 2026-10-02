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

(filled in as changes land)
