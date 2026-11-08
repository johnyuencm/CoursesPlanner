# Issue #71 verification: program-scoped routes

Date: 2026-11-08. Branch `feat/71-program-routes`.

## Method

1. Run `npm run typecheck`: no errors.
2. Run `npm test`: 320 of 320 pass.
3. Run `npm run build`: 126 routes prerendered, 2 skipped (the API routes).
4. Run the built Worker: `npx wrangler dev --config dist/server/wrangler.json --port 3171 --ip 127.0.0.1`.
5. Send each request with `curl`. Read the status, `Location`, `X-Vinext-Cache` and body size.
6. Open a new browser tab on `http://127.0.0.1:3171` only. Check client navigation and storage.

`<program>` is `/northeastern/computer-science-mscs-sea-8b0d00dbda`.

## Route table

| Request | Status | Location | Cache | Bytes |
| --- | --- | --- | --- | --- |
| `<program>` | 200 | - | HIT | 59,483 |
| `<program>/explore` | 200 | - | HIT | 31,760 |
| `<program>/explore?focus=CS%205800` | 200 | - | HIT | 31,760 |
| `<program>/planner` | 200 | - | HIT | 38,499 |
| `<program>/courses` | 200 | - | HIT | 90,528 |
| `<program>/courses/cs-5800` | 200 | - | HIT | 29,808 |
| `<program>/pathways` | 200 | - | HIT | 39,056 |
| `<program>/pathways/systems` | 200 | - | HIT | 28,631 |
| `/` | 307 | `<program>` | - | 0 |
| `/explore` | 308 | `<program>/explore` | - | 0 |
| `/explore?focus=CS%205800` | 308 | `<program>/explore?focus=CS%205800` | - | 0 |
| `/map?focus=CS%205800` | 308 | `<program>/explore?focus=CS%205800` | - | 0 |
| `/planner` | 308 | `<program>/planner` | - | 0 |
| `/courses?q=data` | 308 | `<program>/courses?q=data` | - | 0 |
| `/courses/cs-5800` | 308 | `<program>/courses/cs-5800` | - | 0 |
| `/pathways/systems` | 308 | `<program>/pathways/systems` | - | 0 |
| `<program>/courses/zz-9999` | 404 | - | - | 6,463 |
| `<program>/courses/cis-200m` (placeholder) | 404 | - | - | 6,463 |
| `<program>/pathways/zz` | 404 | - | - | 6,463 |
| `/northeastern/no-such-program` | 404 | - | - | 6,463 |
| `/zz/yy/courses/cs-5800` | 404 | - | - | 6,463 |
| `/nothing` | 404 | - | - | 6,428 |
| `<program>/courses/cs-5800/` | 308 | `<program>/courses/cs-5800` | - | 0 |
| `/sitemap.xml` | 200 | - | - | 20,973 |
| `/robots.txt` | 200 | - | - | 95 |

- Each 404 body is `app/global-not-found.tsx` ("Page not found", no app shell). Its size is the same as the route miss `/nothing`.
- Each page has a canonical tag on `https://coursesplanner.johnyc.com<program>/...`.
- The sitemap has 124 URLs. All are under `<program>`. It has no old top-level URL and no Plan page.

## Browser check

- `/courses?q=data` ends on `<program>/courses?q=data` with 18 matching course cards.
- The app requests `/api/catalog?key=northeastern%2Fcomputer-science-mscs-sea-8b0d00dbda`.
- LocalStorage `coursesplanner:catalog-key` holds the program key. The plan is in `coursesplanner:v2:<key>:plan`.
- Client navigation Courses → Explore → Courses → CS 5800 works. All RSC requests answer 200. The console has no errors.

## Not measured

- Live CPU time on Workers for the new paths. Measure after the next deploy (see `docs/deploy.md`).
