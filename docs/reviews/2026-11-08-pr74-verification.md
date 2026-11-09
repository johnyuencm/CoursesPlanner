# #74 verification: 4 more Northeastern programs at Map tier

Date: 2026-11-08. Branch: `feat/74-more-neu-programs`. Not deployed.

## Programs

| Catalog key | Program | Courses | Course pages | Program courses | Unknown clauses | Tier |
|---|---|---|---|---|---|---|
| `northeastern/computer-science-mscs-976b977119` | Computer Science, MSCS (Boston) | 84 | 62 | 41 | 3 | map |
| `northeastern/computer-science-mscs-align-a4f8db6b17` | Computer Science, MSCS—Align (Boston) | 86 | 64 | 46 | 3 | map |
| `northeastern/cybersecurity-ms-429a5fa183` | Cybersecurity, MS (Boston) | 50 | 43 | 30 | 3 | map |
| `northeastern/data-science-ms-ptl-0da0db71be` | Data Science, MS (Portland) | 71 | 51 | 43 | 9 | map |

The parse reports are in `data/catalogs/northeastern/reports/`. Unknown clauses are "graduate program admission" and minimum-grade text that the parser cannot attach to a course.

Artificial Intelligence, MS (Boston) was checked and left out. Its program page lists 134 courses from 29 subjects, so a crawl needs 29 more subject requests.

## Crawl requests

```text
manual: robots.txt (1) + sitemap.xml (1) + 5 program pages (5)   =  7
crawler: robots.txt (1) + 10 subject pages                        = 11
total                                                             = 18
```

- The 4 program pages from the manual check were put in the crawler cache, so the crawler did not fetch them again.
- Subjects: ARTG, CRIM, CS, CY, DADS, DS, EEAM, EECE, POLS, PPUA.
- `--crawl-roadmaps --limit=4 --university=northeastern`. Only the 4 queued programs were in the queue.
- Request spacing: 750 ms (crawler), 1 s (manual). No path that `robots.txt` disallows.
- A second crawler run wrote the parse reports from the cache, with 0 requests.

## Built Worker (`wrangler dev`, 127.0.0.1:3211)

```text
GET /<program>, /explore, /planner, /courses, /courses/<code>   200  X-Vinext-Cache: HIT  (all 5 programs)
GET /                                                           200  X-Vinext-Cache: HIT
GET /<program>/courses/zz-9999, /northeastern/no-such-program   404  6,729 bytes (cheap 404)
GET /nothing                                                    404  6,694 bytes
GET /courses/cs-5800                                            308  -> /northeastern/computer-science-mscs-sea-8b0d00dbda/courses/cs-5800
GET /sitemap.xml                                                381 URLs (all 5 programs)
GET /api/catalog?key=northeastern/nope                          404
```

Every canonical URL is the program path of its own page.

Browser (own tab, 127.0.0.1:3211 only):

- The picker lists 5 programs: 1 Audit, 4 Map.
- Plan on Cybersecurity shows "Requirements status · Map tier, No degree audit" and the Map-tier degree rules text.
- Explore on Data Science starts at ARTG 5100. Before the fix it started at CS 5010, which is not in that catalog.

## Worker limits

| Measure | Master `8332b37` | This branch |
|---|---|---|
| Prerendered routes | 127 | 387 |
| Static asset files | 315 | 839 |
| Worker upload (gzip) | 611 KiB | 918 KiB |

Limits on Workers Free: 3 MB gzip, 20,000 asset files. The prerendered HTML also ships in the Worker bundle, so each Map-tier program adds about 77 KiB gzip.

## Open

- Live check after `npm run deploy` is not done. Deploy needs the owner.
- Pathway pages of the new programs show the shared personas of `config/pathways.json`. Courses that a program does not have show as bare codes. Issue #73 keys pathways by program.
