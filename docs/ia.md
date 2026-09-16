# Information architecture

CoursesPlanner is graph-first. The product promise is **understand what every course unlocks**, not “we also have a graph.”

## Primary navigation

| Label | Route | Page |
| --- | --- | --- |
| Explore | `/explore` | Prerequisite map (default workspace) |
| Plan | `/planner` | Semester plan builder |
| Courses | `/courses` | Catalog search and filters |
| Paths | `/pathways` | Suggested career directions |

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
