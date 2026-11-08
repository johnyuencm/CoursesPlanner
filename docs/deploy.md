# Deployment

Production: [https://coursesplanner.johnyc.com](https://coursesplanner.johnyc.com). It is the Cloudflare Worker `coursesplanner` on the Workers Free plan ($0).

This file is operator notes. Students who use the planner do not need it.

## Project

| Item | Value |
| --- | --- |
| Production URL | https://coursesplanner.johnyc.com |
| Runtime | Cloudflare Worker `coursesplanner`, Workers Free plan, no paid add-ons |
| Build | [vinext](https://github.com/cloudflare/vinext) 1.4.4 (Vite version of the Next.js API), `@vinext/cloudflare` 1.3.3 |
| Config | [`wrangler.jsonc`](../wrangler.jsonc) (routes, assets), [`vite.config.ts`](../vite.config.ts) (vinext, static-assets cache) |
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
  B --> M[validate data/published.json snapshots]
  M --> A
  B --> W[dist/server: Worker code]
  A --> D[npm run deploy]
  W --> D
  D --> CF[Worker coursesplanner]
  R[Request] --> CF
  CF -->|prerendered page| A
  CF -->|/api/*, /sitemap.xml, 404| S[server code]
  S -->|ASSETS binding| A
```

- `npm run build` runs `vite build`. vinext prerenders every static page at build time: `/`, `/explore`, `/planner`, `/courses`, all `/courses/<slug>`, all `/pathways/<id>`. The Worker serves them from static assets (`X-Vinext-Cache: HIT`).
- `/api/catalog`, `/api/roadmaps`, `/sitemap.xml`, `/robots.txt` and 404 pages run in the Worker.
- Workers has no project filesystem. The Worker reads the published snapshots from static assets. See [Published snapshots](#published-snapshots).
- `POST /api/catalog` (refresh) stays off in production: it answers 401. Refresh the catalog with `npm run catalog:refresh`, commit `data/`, then deploy.
- `app/global-not-found.tsx` renders route misses without the root layout, because a full layout render costs more CPU than the Free plan allows.
- `/`, `/explore`, `/pathways`, `/planner` and `/courses` put server-rendered catalog text in the prerendered HTML ([`components/program-summary.tsx`](../components/program-summary.tsx)). Crawlers read it without JavaScript. The interactive views load after it.

## Published snapshots

```mermaid
flowchart LR
  L[data/published.json<br/>catalog keys] --> V[build: validate]
  F[data/catalog.json<br/>universities.json<br/>data/catalogs/...] --> V
  V -->|missing or invalid| X[build fails]
  V --> A[dist/client/_snapshots/<br/>manifest.json + files]
  A -->|ASSETS binding| W[Worker readers]
```

- [`data/published.json`](../data/published.json) is the allowlist. Each entry is a catalog key, `<university-id>/<program-id>`, for one ready roadmap.
- `npm run build` runs [`lib/snapshot-manifest.ts`](../lib/snapshot-manifest.ts) from a plugin in [`vite.config.ts`](../vite.config.ts). It validates each listed roadmap, its `programs.json`, `data/catalog.json` and `catalog-service/universities.json`.
- The build fails when a listed roadmap is missing, invalid or not `ready`. The Worker never lists a program that answers 503.
- The build writes the files to `dist/client/_snapshots/<repo path>`. It also writes `_snapshots/manifest.json`. Each manifest entry has a catalog key, a tier (`audit` or `map`), an edition (the snapshot `lastUpdated`) and a file.
- The shipped `programs.json` keeps only the published programs. To unpublish a program, remove its key and deploy. You do not change code.
- To publish a new program, commit its roadmap and `programs.json` (see `.gitignore`), then add its key.
- The readers try disk first (dev, tests, CLI, prerender). When a file is missing (`ENOENT`), the Worker reads it through the `ASSETS` binding ([`lib/snapshot-assets.ts`](../lib/snapshot-assets.ts)), from `import { env } from "cloudflare:workers"`. It reads only files that the manifest lists. A corrupt disk file gives an error.
- The Worker does not validate the files again, because the build did. It parses each file once per isolate. The API routes keep the serialized body in memory, as before.
- `npm run dev:vinext` also runs in workerd without project files. There, a virtual module from `vite.config.ts` gives the same files.
- The files are public at `/_snapshots/...`. They hold the same data that `/api/catalog` and `/api/roadmaps` return.
- Node tools import no snapshot file. The CLI still works when you delete a `data/catalogs/<id>/` folder.

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
- Known ceiling: an unknown `/courses/<slug>` still renders the root layout (it is a `notFound()` inside the route, not a route miss). Only typos and bots ask for these URLs.
- Do not fix this with a `proxy.ts` on `/courses/:slug`. Version `11fcae7b` tried it on 2026-11-07 (60 warm requests per route). Unknown course 404 went to p50 7 ms, p90 13 ms. But every real course page paid for the proxy: p50 5 ms, p90 9 ms, 4 of 60 over 10 ms. A page without the proxy (`/explore`) had p50 4 ms, p90 6 ms. Course pages are the pages that crawlers read, so the proxy was removed.

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
| 3 MB Worker size (gzip) | 583 KiB gzip (2026-11-08, after the snapshots moved to static assets) |

Over the daily request limit, Cloudflare returns errors until the next day. It does not bill. Do not turn on Workers Paid, Cloudflare Images or other paid add-ons without the owner's explicit yes.
