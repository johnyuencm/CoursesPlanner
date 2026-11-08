# US catalog platforms: 9 colleges (T20, issue #64)

Date of research: 2026-11-07 and 2026-11-08.
Method: a few GET requests per college, user agent `CoursesPlanner-research/1.0`, about one request per second.
We did not crawl. We did not bypass any bot challenge.

## Result

| College | Catalog URL | Platform | Evidence | Robots notes | Code format | Credit unit |
|---|---|---|---|---|---|---|
| UC Berkeley | https://undergraduate.catalog.berkeley.edu/ | coursedog | Page loads scripts from `static.catalog.prod.coursedog.com`. Page text names Coursedog. | `Allow: /`. Sitemap listed. Program and course paths allowed. | `COMPSCI 61A` (from general knowledge, not read from a page) | Semester units |
| University of Washington | https://www.washington.edu/students/crscat/ | custom | Static HTML on Apache. No vendor marker found. | `Disallow: /?s=*`, `/search/`, `/graduation/?s=*`. Course pages `/students/crscat/` allowed. | `CSE 110` | Quarter credits, shown as `(5)` |
| Princeton | https://ua.princeton.edu/ | custom | Cloudflare challenge blocks page GET. `robots.txt` shows Drupal paths (`/core/`, `/profiles/`). Princeton pages say program data lives in Drupal. | `*` group: `Disallow: /core/`, `/profiles/`, `/admin/`, `/search/`. SemrushBot and SiteAuditBot: `Disallow: /`. Program pages not disallowed. | `COS 126` (from general knowledge) | Semester. No credit number in catalog. |
| UC San Diego | https://catalog.ucsd.edu/ | custom | Static HTML on Apache. UCSD CMS "decorator" assets. Course page `courses/CSE.html` lists all courses. | `robots.txt` returns 404. No rules published. | `CSE 3` | Quarter units, shown as `(4)` |
| University of Michigan | https://webapps.lsa.umich.edu/CrsMaint/Public/CB_PublicBulletin.aspx?crselevel=ug | custom | LSA course catalog is a custom ASP.NET web app (`CrsMaint`). Engineering bulletin is a separate site. | `lsa.umich.edu`: `Disallow: /etc/`, `/libs/`, `/tests/`. Engineering bulletin and registrar: Cloudflare challenge, robots not readable. | `EECS 280` (from general knowledge) | Semester credits |
| UCLA | https://catalog.registrar.ucla.edu/ | custom | Next.js app. Footer reads "Powered by CourseLoop". CourseLoop is a Modern Campus product, not Acalog. | `Allow: /`. Sitemap listed. | `COM SCI 31` (from general knowledge) | Quarter units |
| Caltech | https://catalog.caltech.edu/ | custom | Wagtail CMS (`/static/core/`, `wagtail` markers). | Empty `Disallow`. All paths allowed. | `CS 1` | Quarter units, shown as `9 units (3-0-6)` |
| Cornell | https://courses.cornell.edu/ (mirror: https://catalog.cornell.edu/) | courseleaf | Cornell Registrar page "CourseLeaf @ Cornell" says CourseLeaf CAT runs the University Catalog. | AWS WAF challenge (HTTP 202) blocks `courses.cornell.edu` and `catalog.cornell.edu`. Robots not readable. `classes.cornell.edu` (class roster) disallows `/api/`, `/search/`, `/browse/inbound/`, `/scheduler`. | `CS 2110` (from general knowledge) | Semester credits |
| Penn | https://catalog.upenn.edu/ | courseleaf | Web search result shows the hosted mirror `upenn-public.courseleaf.com/undergraduate/`. We could not GET it. | AWS WAF challenge (HTTP 202) blocks `catalog.upenn.edu`. Robots not readable. | `CIS 1100` (from general knowledge) | Course units (CU), semester |

## Directory changes

- Berkeley `catalogUrl` changed. The old URL was the registrar page. `guide.berkeley.edu` now redirects to that page. The real catalog is `undergraduate.catalog.berkeley.edu`. A graduate catalog also exists at `graduate.catalog.berkeley.edu`.
- Michigan `catalogUrl` changed. The old URL was an admissions page. It is not a catalog.
- The directory entries now have `platform` and `platformEvidence`.
- Platform values for earlier colleges: courseleaf for MIT, Carnegie Mellon, UIUC, Georgia Tech, UT Austin, Columbia, Yale and Northeastern. Coursedog for Stanford. Acalog for Purdue. We took these from the earlier check. We did not test them again.

## What we could not confirm

- Cornell and Penn: bot protection blocked every direct GET. The platform comes from first-party Cornell text and a search result for Penn. Robots rules for both are unknown. Do not work around the challenge. Ask the registrar offices for API access if needed.
- Princeton and Michigan Engineering: Cloudflare blocked page GETs. Princeton is `custom` by inference from Drupal paths. Michigan Engineering platform is unknown. The Michigan entry covers only the LSA catalog.
- UW, UCLA and Princeton are `custom`. No supported vendor marker was found. UCLA uses CourseLoop. A later ticket can add a CourseLoop value.
- Code formats marked "general knowledge" were not read from a fetched page. UW, UCSD and Caltech formats were read from fetched pages.
- Berkeley course page URL pattern was not confirmed. A guessed course URL returned 404.
