# Cloudflare Workers port evaluation (vinext)

- Subject: the move from Vercel to Cloudflare Workers with vinext. Branch `feat/cloudflare-workers`, worktree `.worktrees/cf-workers`.
- Base: `origin/master` `6c8277a`. The port was **not committed** at review time. The review used a copy of the working tree from 2026-11-06 23:24 PST.
- Changed files: `.gitignore`, `app/api/catalog/route.ts`, `app/api/roadmaps/route.ts`, `lib/catalog.ts`, `lib/roadmap-reader.ts`, `lib/university-directory.ts`, `next.config.ts`, `package.json`, `package-lock.json`, `tests/packaged-snapshot.test.ts`. New files: `lib/embedded-snapshot.ts`, `tests/embedded-snapshot.test.ts`, `vite.config.ts`, `wrangler.jsonc`.
- Reviewer: independent agent (Claude Opus 5.5), 2026-11-06. Read-only on the port. Nothing was deployed.
- Verdict: **ship after the cutover tasks below**. The build, tests and local `workerd` run pass. No blocking code defect was found.

```mermaid
flowchart LR
  B[Browser] --> D["coursesplanner.johnyc.com<br/>(Worker custom domain)"]
  D --> S["/_next/static/*<br/>static assets, no Worker CPU"]
  D --> P["pages<br/>prerendered HTML from cache"]
  D --> A["/api/catalog, /api/roadmaps"]
  A --> E["lib/embedded-snapshot.ts<br/>bundled JSON, memoized body per isolate"]
```

## Evidence

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | Pass, 261 of 261 |
| `npm run build` (`vite build`) | Pass. 126 routes prerendered, 3 skipped (API routes and `/map`) |
| `wrangler deploy --dry-run` | Total upload 4809.71 KiB, gzip 614.54 KiB. The Workers Free limit is 3 MiB gzip |
| `wrangler dev`, every sitemap URL | 124 of 124 return 200 |
| `wrangler dev`, other routes | `/map` 308, unknown course or page 404, `/robots.txt` 200, `/api/catalog` 200 (149 KB, `no-store`), `/api/roadmaps` directory, program list and roadmap all 200 |
| `POST /api/catalog` in production | 401 "Catalog refresh is not authorized." (correct) |
| Crawler code in the Worker | Not present. `cheerio` appears only in a source map |
| Crawler-visible text | `/courses/cs-5800` has a server-rendered `<h1>`, description paragraphs, `<title>`, meta description and canonical `https://coursesplanner.johnyc.com/courses/cs-5800`. Response header `X-Vinext-Cache: HIT` |
| Cost | $0. Workers Free. `wrangler.jsonc` has no `observability` block, so the 2026-12-01 Observability pricing does not apply |

CPU timing in Node 24 (`NODE_ENV=production`), as a stand-in for Workers V8. Local `workerd` trace queries failed with an internal error, so real Workers CPU is **not measured**.

| Work | Time |
|---|---|
| `validateCatalog`, first call / second call | 2.08 ms / 1.12 ms |
| `JSON.stringify` of the catalog | 0.62 ms |
| `/api/roadmaps` directory, first call | 12.67 ms wall (includes disk read in Node) |
| `/api/roadmaps` one roadmap, first call / memoized | 6.13 ms / 0.68 ms wall |

## Findings

| # | Severity | Area | Finding | Action |
|---|---|---|---|---|
| 1 | High (cutover) | DNS | The `coursesplanner` CNAME still points to Vercel (`johnyc-infra` README). A Worker custom domain cannot attach while that record exists. Merged work is not live until the switch. | Delete the CNAME, then run `npm run deploy`. Expect a few minutes of downtime. Update the `johnyc-infra` subdomain map. |
| 2 | Medium | CPU | The first API call in a new isolate costs about 6 to 13 ms. The memoized calls cost under 1 ms. Workers Free allows 10 ms, but does not cut off each request at that point, and gives no guarantee. Pages come from the prerender cache and use little CPU. | After the first deploy, read CPU time per route in the dashboard. If it is high, move validation to module scope (startup limit) or serve the JSON as static assets. |
| 3 | Medium | Runtime drift | `npm run dev` still runs Next/Turbopack. Production runs vinext 1.4.4, which is new. A change can pass in dev and fail in production. | Use `npm run dev:vinext`, or `npm run build` and `npm start`, before you accept a UI or route change. Say this in `AGENTS.md`. |
| 4 | Medium | Docs and CI | `docs/deploy.md` mentions Vercel 31 times and the README 4 times. `.github/workflows/ci.yml` keeps the Vercel deploy job and has no Workers deploy. GitHub Actions on the org is blocked by billing. | Rewrite `docs/deploy.md` for Workers. Delete the Vercel job. Deploy by hand with `npm run deploy` until Actions works. |
| 5 | Low | Scale | `lib/embedded-snapshot.ts` lists each snapshot file by hand. Each new program needs a code change and makes the bundle larger. | Accept for 1 program. For more programs, put roadmaps in static assets and read them through the `ASSETS` binding. |
| 6 | Low | Cache | HTML responses send `Cache-Control: s-maxage=31536000, stale-while-revalidate`. | After the first redeploy, confirm that the live pages show the new build. |
| 7 | Info | Fallback | `readCatalog` falls back to the bundled JSON on any `statSync` error, also in Node. The bundled JSON is the same file at build time, so the effect is nil now. | No action. |

## Cutover order

```mermaid
flowchart LR
  A["Workers session commits<br/>and merges the port"] --> B["Delete Vercel CNAME,<br/>npm run deploy"]
  B --> C["Open 3 live pages,<br/>check CPU per route"]
  C --> D["Update docs/deploy.md,<br/>ci.yml, johnyc-infra map"]
```
