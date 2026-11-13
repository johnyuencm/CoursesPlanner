# Information architecture

CoursesPlanner is graph-first. The product promise is **understand what every course unlocks**, not “we also have a graph.”

## Program picker (#72)

`/` is the college and program picker. It is the only page outside the program paths.

```mermaid
flowchart TD
  P["/ (prerendered)"] --> S[Search box: filters in the browser]
  P --> R{Remembered program<br/>in LocalStorage?}
  R -->|yes| C[Continue with your last program]
  P --> L[Supported programs, by college:<br/>tier and catalog year]
  P --> U[Other directory colleges:<br/>Not supported yet + official catalog]
  C --> O["&lt;program&gt; overview"]
  L --> O
```

- `app/page.tsx` reads `CATALOGS` (published programs) and `catalog-service/universities.json` (the college directory) at build time. The page is static: `X-Vinext-Cache: HIT`, no Worker render.
- Under the heading, a short intro says what the site does: the prerequisite map, the planner, the Audit tier and the local plan (#117).
- `components/program-picker.tsx` filters both lists in the browser. Each word of the query must be in the college or program name.
- The tier is Audit or Map (`requirementTier`). The catalog year is `requirements.catalogYear`.
- The shortcut reads `coursesplanner:catalog-key`. A program page writes it. The picker only reads it.
- Each program page has the link **Change college or program** to `/`: in the sidebar on wide screens, and in the **Local plan** menu on every screen width.

## Branding (#72, #117)

The product name is **Course Map**. The college and program names come from the snapshot (`Catalog.university`, `Catalog.program`). Titles use the short name from the snapshot (`Catalog.shortName`, for example `NEU MSCS Seattle`), so that search results show the full title.

| Place | Text |
| --- | --- |
| `/` title | `Course Map · Pick your college and program` |
| Program overview title | `<short name> · Course Map` |
| Other program page titles | `<page> · <short name>` |
| Course page title | `<code> <course title> · <short name>`, 60 characters or less. A long course title stops after a whole word and ends with "…". |
| Course page description | 160 characters or less, clipped the same way |
| Sidebar | `Course Map`, the university, the program |
| Header, 1180 px or less | One line above the search box: `<university> · <program>`, and the short name at 620 px or less. The sidebar hides the names at these widths. |
| Icons | `public/icon.svg`, `public/favicon.ico` |

- `data/catalog.json` gets the short name from `catalog-service/sources/neu-mscs-seattle.json` at each refresh. A Map-tier roadmap gets it from `crawl.shortNames` in `catalog-service/universities.json` (key: program id): the crawl writes it into the roadmap. Do not edit the short name in a roadmap file. `tests/published-programs.test.ts` fails when the two differ.
- Cost: a long course name is clipped in the title tag, so the title has fewer words of the course name. The page `<h1>` and the description keep the full name.
- A program with no short name, or a short name of more than 27 characters, gets a clipped name in its titles. Thus the page part keeps 30 characters, and titles stay unique and at 60 characters or less.
- `tests/ia.test.ts` fails when `app/` or `components/` has a hardcoded "NEU MSCS", "Northeastern" or "MSCS Seattle" string.
- `tests/sitemap-metadata.test.ts` merges the metadata of every sitemap page as vinext does. It fails when two titles are the same, when fewer than 90% of titles have 60 characters or less, when a program title does not have the short name, or when a course page description has more than 160 characters.

## Program paths (#71)

Every page is under the catalog key of its program: `/<universityId>/<programId>/...`. The URL selects the catalog. In the tables below, `<program>` is that path. For MSCS Seattle it is `/northeastern/computer-science-mscs-sea-8b0d00dbda`.

```mermaid
flowchart LR
  R[Request] --> W{worker.ts:<br/>program path?}
  W -->|no| V[vinext]
  W -->|yes, known page| V
  W -->|yes, no page| N[global-not-found 404]
  V -->|old top-level URL| X[308 to the program path]
  V -->|program page| H[prerendered HTML]
```

- `app/[universityId]/[programId]/layout.tsx` lists the published programs (`generateStaticParams`, `dynamicParams = false`). It gives the catalog key to `AppProvider`.
- `AppProvider` loads `/api/catalog?key=<catalog key>` and stores the key as the remembered program (`coursesplanner:catalog-key`).
- Each program has its own provider. A move to another program starts with fresh state, so a plan never goes to the wrong program.
- The page tier comes from the catalog (#70). A Map-tier program gets Explore, Courses and Plan checks, but no degree audit.

## Primary navigation

| Label | Route | Page |
| --- | --- | --- |
| Explore | `<program>/explore` | Prerequisite map (default workspace) |
| Plan | `<program>/planner` | Semester plan builder |
| Courses | `<program>/courses` | Catalog search and filters |
| Paths | `<program>/pathways` | Persona targets (“What are you trying to become?”) |

The brand mark also goes to **Explore**. Overview is not a primary nav item.

## Overview

`<program>` is a slim status doorway: credits, target, critical prereq, next unlock, and a CTA **Explore my course map**. It is not a degree-audit dashboard. A **Status overview** link in the sidebar footer still reaches it.

## Redirects and old bookmarks

The old top-level URLs go to the default program. The query string stays (for example `/courses?q=data`).

| Old path | New path | Status |
| --- | --- | --- |
| `/explore` | `<program>/explore` | `308` |
| `/map` | `<program>/explore` | `308` |
| `/planner` | `<program>/planner` | `308` |
| `/courses` | `<program>/courses` | `308` |
| `/courses/<slug>` | `<program>/courses/<slug>` | `308` |
| `/pathways` | `<program>/pathways` | `308` |
| `<program>/pathways/<id>` | `<program>/pathways/<id>` | `308` |

- `/` is the program picker. It does not redirect.
- `legacyRedirects` in `lib/routes.ts` is the list. `next.config.ts` serves it as `redirects()`.
- An old path with a trailing slash (`/courses/`, `/explore/`, `/map/`, `/courses/<slug>/`) also goes to the new path in one hop. `worker.ts` answers it with `legacyDestination` before vinext. Else vinext removes the slash first, and that is a second hop.
- The old paths have no page, so they never answer `200`. The sitemap and the canonical URLs list only the program paths.
- Page paths come from `programRoutes(catalogKey)` in `lib/routes.ts`. Client components get them from `useRoutes()` in `components/app-provider.tsx`.

Local setup: open [http://localhost:3000/northeastern/computer-science-mscs-sea-8b0d00dbda/explore](http://localhost:3000/northeastern/computer-science-mscs-sea-8b0d00dbda/explore) for the default workspace. [http://localhost:3000](http://localhost:3000) is the program picker.

## Server-rendered pages (2026-11-06)

The app pages load the catalog in the browser, so a crawler sees little text on them. These pages are plain HTML, prerendered at build time from `data/catalog.json` and `config/pathways.json`:

| Route | Content |
| --- | --- |
| `<program>/courses` (bottom) | Course index: every course with catalog text, linked to its page |
| `<program>/courses/<slug>` (for example `<program>/courses/cs-5010`) | What the course unlocks (direct and through a chain), prerequisites, the fewest courses in a row to reach it, paths that use it, catalog description |
| `<program>/pathways/<id>` | The path's courses with credits, degree role and prerequisites (and/or kept), prerequisites the path does not cover, other paths |
| `/sitemap.xml`, `/robots.txt` | The program picker (`/`), and the overview, Explore, Courses, Paths, course and path pages of each published program, on `https://coursesplanner.johnyc.com`. Plan is not listed. |

- Placeholder courses (the scraper's "unavailable in the cached department sources" text) get no page. An unknown program, course or path is a small 404: `worker.ts` sends it to `app/global-not-found.tsx`.
- Helpers and tests: `lib/course-pages.ts`, `tests/course-pages.test.ts`.
- `metadataBase` in `app/layout.tsx` sets canonical URLs to `coursesplanner.johnyc.com`, so the old `courses-planner.vercel.app` copy does not count as a duplicate.
- Reason: AdSense rejected `johnyc.com` for "Low value content" (plan: `johnyuencm/johnyc-infra` `docs/adsense-value-plan.md`). This site counts in that review, even with no ads on it.
