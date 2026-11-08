# #72 verification: program picker, generic branding, favicon

Date: 2026-11-08. Branch: `feat/72-picker-branding`. Runtime: the built Worker (`npx wrangler dev --config dist/server/wrangler.json --port 3191`).

## Commands

| Check | Result |
| --- | --- |
| `npm run typecheck` | Clean |
| `npm test` | 330 pass, 0 fail |
| `npm run build` | 127 routes prerendered (126 before, plus `/`) |

## Routes on the built Worker

| Request | Result |
| --- | --- |
| `/` | `200`, `X-Vinext-Cache: HIT`, title `Course Map · Pick your college and program`, canonical `https://coursesplanner.johnyc.com` |
| `/favicon.ico`, `/icon.svg` | `200` (static assets) |
| `/sitemap.xml` | `200`, 125 URLs. The first URL is `https://coursesplanner.johnyc.com/` |
| `<program>`, `explore`, `courses`, `courses/cs-5800`, `pathways`, `pathways/systems`, `planner` | `200`, `HIT` |
| `/courses`, `/map` | `308` to the program path (vinext `redirects()`) |
| `/courses/`, `/explore/`, `/map/`, `/courses/cs-5800/`, `/explore/?focus=CS%205800` | `308` to the program path in one hop (`worker.ts`). The query string stays. The target answers `200` |
| `/nothing`, `<program>/courses/zz-9999` | `404`, title `Page not found · Course Map` |

Titles of program pages: `<page> · Northeastern University Computer Science, MSCS—Seattle · Course Map`. The overview title is `Northeastern University Computer Science, MSCS—Seattle · Course Map`.

## Browser (own tab, `http://127.0.0.1:3191` only)

| Case | Result |
| --- | --- |
| Search `carn` | 0 programs, 1 college (Carnegie Mellon, "Not supported yet") |
| Search `northeastern computer` | 1 program. Click opens the overview. `coursesplanner:catalog-key` holds the key |
| Back to `/` | "Continue with your last program" shows the program first |
| Sidebar (1400 px) | `Course Map`, `Northeastern University`, `Computer Science, MSCS—Seattle`, link **Change college or program** |
| Console | No errors. No `/favicon.ico` 404 |
