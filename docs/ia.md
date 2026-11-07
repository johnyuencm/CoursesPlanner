# Information architecture

CoursesPlanner is graph-first. The product promise is **understand what every course unlocks**, not “we also have a graph.”

## Primary navigation

| Label | Route | Page |
| --- | --- | --- |
| Explore | `/explore` | Prerequisite map (default workspace) |
| Plan | `/planner` | Semester plan builder |
| Courses | `/courses` | Catalog search and filters |
| Paths | `/pathways` | Persona targets (“What are you trying to become?”) |

The brand mark also goes to **Explore**. Overview is not a primary nav item.

## Overview

`/` is a slim status doorway: credits, target, critical prereq, next unlock, and a CTA **Explore my course map**. It is not a degree-audit dashboard. A **Status overview** link in the sidebar footer still reaches it.

## Redirects and old bookmarks

| Old path | New path | Behavior |
| --- | --- | --- |
| `/map` | `/explore` | Permanent redirect (`308` via `next.config.ts`; `app/map/page.tsx` also `redirect()`s) |
| `/` | `/` | Still the slim Overview. Not redirected, so existing `/` bookmarks keep working. |
| `/courses` | `/courses` | Unchanged. Nav label is **Courses** (was Catalog). |
| `/planner` | `/planner` | Unchanged. Nav label is **Plan**. |
| `/pathways` | `/pathways` | Unchanged. Nav label is **Paths**. |

Constants live in `lib/routes.ts` (`primaryNav`, `legacyRedirects`). Keep `next.config.ts` redirects in sync with `legacyRedirects`.

Local setup: open [http://localhost:3000/explore](http://localhost:3000/explore) for the default workspace, or [http://localhost:3000](http://localhost:3000) for the slim Overview.

## Server-rendered pages (2026-11-06)

The app pages load the catalog in the browser, so a crawler sees little text on them. These pages are plain HTML, prerendered at build time from `data/catalog.json` and `config/pathways.json`:

| Route | Content |
| --- | --- |
| `/courses` (bottom) | Course index: every course with catalog text, linked to its page |
| `/courses/<slug>` (for example `/courses/cs-5010`) | What the course unlocks (direct and through a chain), prerequisites, the fewest courses in a row to reach it, paths that use it, catalog description |
| `/pathways/<id>` | The path's courses with credits, degree role and prerequisites (and/or kept), prerequisites the path does not cover, other paths |
| `/sitemap.xml`, `/robots.txt` | All the routes above, on `https://coursesplanner.johnyc.com` |

- Placeholder courses (the scraper's "unavailable in the cached department sources" text) get no page. Unknown slugs are 404 (`dynamicParams = false`).
- Helpers and tests: `lib/course-pages.ts`, `tests/course-pages.test.ts`.
- `metadataBase` in `app/layout.tsx` sets canonical URLs to `coursesplanner.johnyc.com`, so the old `courses-planner.vercel.app` copy does not count as a duplicate.
- Reason: AdSense rejected `johnyc.com` for "Low value content" (plan: `johnyuencm/johnyc-infra` `docs/adsense-value-plan.md`). This site counts in that review, even with no ads on it.
