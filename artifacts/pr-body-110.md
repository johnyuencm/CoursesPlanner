Refs #110

## What
`worker.ts` answers an unknown program or course path with a static 404 string (`lib/not-found.ts`). It no longer calls vinext for these paths. Issue #110 said the rest of the cost was the shared `global-not-found` render.

## Verify
- `npm test`: 371 pass, exit 0 (new test pins the static 404 path)
- `npm run typecheck`: exit 0
- `npm run build`: exit 0
- Local `wrangler dev`: unknown course and `/zz/yy` give 404, 481 bytes; real course page 200; `/nothing` 404 (`global-not-found`). See `artifacts/local-check-110.txt`.
- Reviews: `artifacts/review-tech_lead-project_manager-110.md` (PASS), `artifacts/review-user_advocate-110.md` (PASS).

## Not done (owner step, after deploy)
Live CPU is not measured. Deploy, run the `wrangler tail` steps in `docs/deploy.md` (40 warm rounds), and record the numbers. Pass: unknown-course 404 p50 6 ms or lower, course page p50 4 ms or lower. This PR says "Refs", not "Closes", so #110 stays open until then (PR #118 closed it early once).

Known limits (in `docs/deploy.md`): the static page has inline style only; `cache-control: public, max-age=300` can keep a stale 404 for 5 minutes after a deploy.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
