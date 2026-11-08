# Deployment

Production: [https://coursesplanner.johnyc.com](https://coursesplanner.johnyc.com). It is the Cloudflare Worker `coursesplanner` on the Workers Free plan ($0).

This file is operator notes. Students who use the planner do not need it.

## Project

| Item | Value |
| --- | --- |
| Production URL | https://coursesplanner.johnyc.com |
| Runtime | Cloudflare Worker `coursesplanner`, Workers Free plan, no paid add-ons |
| Build | [vinext](https://github.com/cloudflare/vinext) 1.4.4 (Vite version of the Next.js API), `@vinext/cloudflare` 1.3.3 |
| Config | [`wrangler.jsonc`](../wrangler.jsonc) (routes, assets, Worker entry [`worker.ts`](../worker.ts)), [`vite.config.ts`](../vite.config.ts) (vinext, static-assets cache) |
| Custom domain | `routes: [{ pattern: "coursesplanner.johnyc.com", custom_domain: true }]`. `workers_dev` and `preview_urls` are off (house rule for every app under `johnyc.com`) |
| DNS | Cloudflare zone `johnyc.com`. The Worker custom domain made the record (AAAA `100::`, proxied) on 2026-11-07. It replaced the DNS-only CNAME to Vercel (`e0273d0e708952dd.vercel-dns-017.com`). Shared map: [johnyuencm/johnyc-infra](https://github.com/johnyuencm/johnyc-infra) |
| Cloudflare account | `99ea46219cc098a0c9db852d9e1fd0f6` |
| Production Git branch | `master` (this repo does not use `main`) |
| Old host | Vercel Hobby project `courses-planner` (team `johnyuen97gmailcoms-projects`). Git deploys are disconnected since 2026-11-06. It still holds the 2026-10-30 build. The owner decides when to delete it |

## How it works

```mermaid
flowchart LR
  B[npm run build] --> P[vinext prerenders 126 routes]
  P --> A[dist/client: static assets]
  B --> W[dist/server: Worker code]
  A --> D[npm run deploy]
  W --> D
  D --> CF[Worker coursesplanner]
  R[Request] --> CF
  CF -->|prerendered page| A
  CF -->|/api/*, /sitemap.xml, 404| S[server code + bundled snapshot]
```

- `npm run build` runs `vite build`. vinext prerenders every static page at build time: `/`, `/explore`, `/planner`, `/courses`, all `/courses/<slug>`, all `/pathways/<id>`. The Worker serves them from static assets (`X-Vinext-Cache: HIT`).
- `/api/catalog`, `/api/roadmaps`, `/sitemap.xml`, `/robots.txt` and 404 pages run in the Worker.
- Workers has no project filesystem. [`lib/embedded-snapshot.ts`](../lib/embedded-snapshot.ts) bundles the committed JSON (`data/catalog.json`, `catalog-service/universities.json`, the Northeastern programs and roadmap). The readers try disk first (dev, tests, CLI). They use the bundle only when the file is missing (`ENOENT`). A corrupt disk file gives an error.
- When you commit a new `programs.json` or a new ready roadmap, add it to `FILES` in `lib/embedded-snapshot.ts`. `tests/embedded-snapshot.test.ts` fails if a committed ready roadmap is not in `FILES`.
- `POST /api/catalog` (refresh) stays off in production: it answers 401. Refresh the catalog with `npm run catalog:refresh`, commit `data/`, then deploy.
- `app/global-not-found.tsx` renders route misses without the root layout, because a full layout render costs more CPU than the Free plan allows.
- [`worker.ts`](../worker.ts) is the Worker entry (`main` in `wrangler.jsonc`). It changes an unknown `/courses/<slug>` request to a route miss, then calls vinext. All other requests go to vinext unchanged.
- `/`, `/explore`, `/pathways`, `/planner` and `/courses` put server-rendered catalog text in the prerendered HTML ([`components/program-summary.tsx`](../components/program-summary.tsx)). Crawlers read it without JavaScript. The interactive views load after it.

## Deploy

Deploy is manual. CI does not deploy, because a deploy job needs a Cloudflare API token as a GitHub secret.

```bash
npm ci
npm run typecheck
npm test
npm run deploy
```

`npm run deploy` runs `vinext-cloudflare deploy`: it builds, then uploads with Wrangler. It needs a Wrangler login (`npx wrangler login`) with Workers write access on the account above.

If the upload fails with `fetch failed` (network), the build in `dist/` is still good. Run the upload again:

```bash
npx wrangler deploy --config dist/server/wrangler.json
```

Run the production Worker on your PC (workerd, port 3000):

```bash
npm run build
npm run start
```

## Rollback

- Worker version: `npx wrangler rollback` (pick the earlier version), or `npx wrangler deployments list` to see versions.
- Full rollback to Vercel (only while the Vercel project exists): remove the Worker custom domain, then create the DNS-only CNAME `coursesplanner` → `e0273d0e708952dd.vercel-dns-017.com` again with the `cf` CLI. Vercel serves the frozen 2026-10-30 build.

## CPU per request (Workers Free limit: 10 ms)

Measured on 2026-11-07 with `wrangler tail --format json` (field `cpuTime`) on a temporary custom domain. Each route got 30 sequential requests from Seattle. Worker startup time: 11-22 ms (limit 1 s).

| Route | p50 | p90 | Over 10 ms |
| --- | --- | --- | --- |
| Prerendered pages (`/`, `/explore`, `/planner`, `/courses`, `/courses/cs-5010`, `/pathways/systems`) | 2-4 ms | 4-6 ms | 0 of 30 per route, after warm-up |
| `/sitemap.xml` | 3 ms | 8 ms | 0 of 30 |
| `/robots.txt` | 1 ms | 2 ms | 0 of 30 |
| `/api/catalog` | 5 ms | 10 ms | 1 of 29 |
| `/api/roadmaps` | 4 ms | 8 ms | 1 of 30 |
| `/api/roadmaps?university=…&program=…` | 4 ms | 10 ms | 5 of 60 |
| Route miss 404 (`/nothing`, `/favicon.ico`) | 6 ms | 10-28 ms | 2-3 of 30 |
| Unknown course 404 (`/courses/zz-9999`) | 10 ms | 28 ms | 13 of 28 |

- The first requests on a new isolate cost more (up to about 30 ms on `/`). The p90 values include them.
- The two API routes keep the serialized JSON body in memory for each isolate. Before that change, `/api/roadmaps?…&program=…` had p50 8 ms and p90 21 ms.
- Before `app/global-not-found.tsx`, every 404 rendered the full layout at p50 14 ms and p90 45-70 ms. Browsers ask for `/favicon.ico` on each visit, and the app has no favicon, so that cost hit every visit.
- Every request in these runs had outcome `ok`. Cloudflare did not stop any request that went over 10 ms. Do not rely on this: an over-limit request can fail with error 1102.
- An unknown `/courses/<slug>` renders the root layout when vinext handles it. `dynamicParams = false` makes it a 404, but vinext renders that 404 inside the layout. See the 2026-11-08 numbers below.
- Do not fix this with a `proxy.ts` on `/courses/:slug`. Version `11fcae7b` tried it on 2026-11-07 (60 warm requests per route). Unknown course 404 went to p50 7 ms, p90 13 ms. But every real course page paid for the proxy: p50 5 ms, p90 9 ms, 4 of 60 over 10 ms. A page without the proxy (`/explore`) had p50 4 ms, p90 6 ms. Course pages are the pages that crawlers read, so the proxy was removed.

### Unknown course 404, 2026-11-08 (issue #65)

Live Worker version `dfbdf20b` (no proxy, no `worker.ts`). Method: `wrangler tail --format json`, field `cpuTime`. GET requests from Seattle, one after the other, with a marked user agent. Course requests alternate with unknown-course requests.

| Route | Requests | p50 | p90 | Max | Over 10 ms |
| --- | --- | --- | --- | --- | --- |
| Unknown course 404 (`/courses/zz-9001` … `zz-9130`) | 57 | 15 ms | 68 ms | 119 ms | 47 of 57 |
| Real course page (`/courses/cs-5800`) | 58 | 4 ms | 7 ms | 32 ms | 4 of 58 |
| Route miss 404 (`/nothing-1` … `/nothing-30`) | 27 | 6 ms | 31 ms | 40 ms | 3 of 27 |

The unknown-course 404 is over the limit. The tail lost a few events, so some counts are under 30 per run.

Fix: [`worker.ts`](../worker.ts) wraps the vinext Worker.

```mermaid
flowchart LR
  R[GET /courses/slug] --> K{slug has a course page?}
  K -->|yes| V[vinext: prerendered HTML]
  K -->|no| M[vinext: /__unknown-course]
  M --> G[global-not-found 404, no layout]
```

- The check is one `URL` parse and one `Set` lookup. The slug `Set` comes from the bundled `data/catalog.json`, once for each isolate.
- vinext middleware does not run, so real course pages do not pay for the check. The old `proxy.ts` used vinext middleware.
- `tests/course-pages.test.ts` pins the rule: unknown slugs and placeholder courses go to the 404, real course pages do not.

Local check (`npm run build`, then `wrangler dev` on `127.0.0.1`). This is not a CPU measurement. Local wall time had too much noise from other processes, so the response body is the evidence:

| Build | `/courses/zz-9999` | `/courses/cs-5800` |
| --- | --- | --- |
| Before (`main`: `vinext/server/fetch-handler`) | 404, 17,678 bytes (root layout) | 200, `X-Vinext-Cache: HIT` |
| After (`main`: `./worker.ts`) | 404, 6,026 bytes (`global-not-found`, as `/nothing` with 5,981 bytes) | 200, `X-Vinext-Cache: HIT` |

After the next deploy, measure again with the method above. Expect the unknown-course 404 near the route miss 404 (p50 about 6 ms). Expect no change on real course pages. Add the live numbers to this section.

Measure again after a large change:

```bash
npx wrangler tail coursesplanner --format json > tail.jsonl
```

Send requests in a second terminal, then read `cpuTime` for each event.

## Free plan limits that matter

| Limit (Workers Free) | This app |
| --- | --- |
| 100,000 requests per day | Each page view is 1 request, plus `/api/catalog` and `/api/roadmaps` on Explore and Planner. Static `/_next/static/*` files do not count, because they skip the Worker |
| 10 ms CPU per request | See the table above |
| 3 MB Worker size (gzip) | 614 KiB gzip |

Over the daily request limit, Cloudflare returns errors until the next day. It does not bill. Do not turn on Workers Paid, Cloudflare Images or other paid add-ons without the owner's explicit yes.
