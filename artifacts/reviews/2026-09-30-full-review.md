# Full review — CoursesPlanner — 2026-09-30

## Summary

Health: **fair**. The code is careful and well tested (typecheck, 233/233 tests and build all pass at `8605d24`, with validated trust boundaries). The process around it is weak: no branch protection, self-approved PRs, large direct-to-master merges, and features that cannot work on the production deploy.

Findings: P0 0, P1 1, P2 15, P3 17.

Severity note (verification 2026-09-30): the self-review finding (PR1) was **lowered from P1 to P2**, to match the severity this sweep assigns the same solo-maintainer pattern in other repos. The finding about unprotected `master` plus direct-to-master merges (C1) stays P1: it is the mechanical gap, not the review culture.

Top 5 by severity:

1. **P1 (C1)** `master` is unprotected (`gh api .../branches/master/protection` returns 404). About 5k lines of crawler and roadmap code landed without a PR: `6f1cc1c` (+3048/-271) and `4a8c732` (+1970/-93).
2. **P2 (D1/A1)** The multi-university roadmap selector is mounted on Explore (`app/explore/page.tsx:18`), but production can never have a ready roadmap because `data/catalogs/` is git-ignored (`.gitignore:11`). Live `/api/roadmaps?university=northeastern` returns `programs: []`.
3. **P2 (CR3)** "Refresh catalog" / "Load official catalog" (`components/app-shell.tsx:79`, `components/catalog-state.tsx:9`) always get a 401 on production. `curl -X POST https://courses-planner.vercel.app/api/catalog` returned 401 (`app/api/catalog/route.ts:41-45`).
4. **P2 (CR1)** `next@16.3.4` has a critical advisory (GHSA-vcvr-r3jv-pc5j, fixed in 16.3.8). The `next/og` path is unused (grep finds nothing), so it is not reachable from this app. There is no Dependabot config.
5. **P2 (PR1)** All 29 PRs were authored and "reviewed" by the same account (`TheNewBee`), so `reviewDecision` is empty on every one. Eleven merged PRs, including the security change #2 and the 40k-line sweep #7, had no review at all.

Also P2: cross-tab LocalStorage overwrite (CR2), crawler code bundled into the Next route (A2), stale in-repo ticket ledger (T1), oversized `course-graph.tsx` / `graph.ts` (CR8), no browser tests (CR9).

## Scope and method

- Reviewed SHA: `8605d24` (origin/master tip, "Merge pull request #36"). Worktree branch `review/2026-09-30-full-review`.
- Commit range: the whole history, `03abd39` (2026-09-11, root) .. `8605d24` (2026-09-28). 211 commits (181 non-merge, 30 merge). All of them fall inside the 30-day window (since 2026-08-31). The task brief estimated ~126; `git rev-list --count HEAD` reports 211.
- PRs covered: all 29 (#1-#36, numbers shared with issues): 26 merged, 3 closed unmerged (#1, #6, #9), 0 open.
- Tickets: 7 GitHub issues (#4, #5, #12, #13, #26, #27, #30), all closed. In-repo: `.ycm-harness/state.json` goals/tickets, `artifacts/review-*.md` (52 review records), `docs/acceptance-checklist.md`, `docs/JOURNAL.md`.
- Remote branches: 21 feature branches plus `master`; `git branch -r --no-merged origin/master` returns none (all merged or superseded). All 21 are merged into `master` and none were deleted after merge.
- Checks run (Node v24.20.0 locally; CI uses Node 22; `node_modules` was already present and is git-ignored):
  - `npm run typecheck` (tsc --noEmit): exit 0.
  - `npm test` (tsx --test tests/*.test.ts): exit 0, 233 tests, 233 pass, 0 fail.
  - `npm run build` (next build): exit 0, 9 routes. Side effect: the build rewrote the tracked `next-env.d.ts` (see Code review); I reverted it with `git checkout -- next-env.d.ts`.
  - Not run: Playwright/browser checks (none configured in package.json); live catalog refresh (would hit remote university sites); Vercel deploy (needs secrets).
- Method: `git log --stat`, `gh.exe pr view/diff`, `gh.exe issue view`, reading source at `8605d24`, comparing to README.md, AGENTS.md, docs/*.md and the harness ledger.

## Recent commits

Window: all 211 commits (`03abd39`..`8605d24`, 2026-09-11 to 2026-09-28). Authors: John Yuen 130, Cursor Agent 56, JY (GitHub web merges) 19, Chung Man Yuen 6. CI (`.github/workflows/ci.yml`) ran on every PR and master push since #14; only two PR-tip runs failed (`38259ff` on #21, `3472088` on #23, a TS2339 in `tests/target-path.test.ts:170`), both fixed before merge (`d29dd7e`, `72f44fc`). No reverts.

Findings:

- **C1 (P1) Large feature work landed on master without a PR.** `master` has no branch protection (`gh api .../branches/master/protection` returns 404 "Branch not protected"). First-parent commits that are not PR merges include:
  - `6f1cc1c` "Merge goal/multi-university-roadmaps into master" (2026-09-22): 14 commits, 32 files, +3048/-271. It added the whole roadmap crawler (`ffb19f3`, +783), the roadmap models (`bb6f8f0`, +586), the NEU discovery adapter (`3340718`) and the Explore roadmap selector (`fb1642a`, +753).
  - `4a8c732` (2026-09-15): 15 commits, 20 files, +1970/-93, including the 777-line university directory (`b6bf863`) and the layout change `b1825c1`.
  - `c01c837` "rigid graph" (2026-09-13): +205/-53 across `components/course-graph.tsx`, `components/graph-canvas.tsx`, `lib/graph.ts`.
  - Also `65ffc2c`, `6f5121e`, `a76bd87`, and the bootstrap/catalog-service commits `97f0dff`, `3fece2c`, `cc7993e`, `11b4447`.

  The harness wrote in-repo review records for some of this (`236738f`, `266ea44`), but no GitHub review or PR-time CI ran on it. The crawler makes outbound requests and writes to disk, which is the riskiest code in the repo.
- **C2 (P2) Duplicate commits from re-landing.** Five pairs have identical `git patch-id --stable`: `c6353f4`/`0b4731c` (plan backup), `57cf587`/`c7c4fed`, `334e2dc`/`3ef25b6`, `92479b9`/`02311d9`, `f7a5dc9`/`2931499`. The docs commits `b575b97`/`6997de3`, `8521a3d`/`668df0a` and `cab7399`/`2632b3f` are also duplicated. PRs #11 and #15 are empty "record merge ancestry" merges (+0/-0), and `a76bd87` is another one. Laptop-master and remote-master diverged and were reconciled by cherry-pick plus ancestry merges, which makes `git blame`/`bisect` noisy.
- **C3 (P3) Commit messages do not describe the change.** `c01c837` "rigid graph" (205 lines, no body). `57cf587`/`c7c4fed` "fix on course directed graph" (also PR #8 title). Neither says what behaviour changed.
- **C4 (P2) Many harness bookkeeping commits.** About 50 commits only touch `.ycm-harness/*`, `artifacts/review-*.md` or wiki pages (e.g. `49b5689`, `b2b1d86`, `286e392`, `130cc45`, `3034574`, `3344b8d`, `3a1f538` for one drill-in ticket, `520fab8`). That is 8 ledger commits for one +146-line feature. `.ycm-harness/events.jsonl` and `state.json` change in almost every ticket, so concurrent branches conflict on them.
- **C5 (P3) Generated file churn.** `next-env.d.ts` is tracked. `next build` rewrites it from `.next/dev/types/...` to `.next/types/...` (reproduced in this review; reverted). Commit `a705e84` exists only to flip it back. Untrack it or accept one form.
- **C6 (P3) Large generated data commits.** `bf4e78e` is +5643/-28577 on `data/catalog.json`/`data/courses.json`, and `2b183f7` added 40k lines. These are expected for a snapshot cache. `data/catalog.json` (200 KB) and `data/courses.json` (186 KB) both hold course data (see A3).
- No secrets found: `git log --all -p` grep for key/secret/token/password literals only matches the test fixture `"test-catalog-refresh-token"`. `.env*` is git-ignored.

## Pull requests

All 29 PRs. Every PR was authored by `TheNewBee`, the same GitHub account that wrote every "Staff review". GitHub's `reviewDecision` is empty on all of them because a self-review can only be COMMENTED, never APPROVED. "Review quality" below rates the content of those self-reviews, which come from a separate agent role; no second human reviewed anything. Open PRs: none.
| PR | Purpose | Size | Review | Notes |
| --- | --- | --- | --- | --- |
| #36 | Catalog dependency-first cards, can-take-now filters, `?focus=` | +479/-56 | 1 agent review, substantive | See D2 (filters computed per render). |
| #35 | Persona picker + Explore pathway overlay | +293/-32 | 1 agent review | ok |
| #34 | AND/OR/coreq join groups on graph edges | +773/-82 | 1 agent review, "no findings" | Large graph change; review mentions external tooling (`ocr delegate`) but cites no checks beyond CI. |
| #33 | Critical-path / delay-impact | +740/-21 | 1 agent review, cites 214 local tests | ok |
| #32 | Why-blocked chain + one-click add | +638/-58 | 1 agent review | ok |
| #31 | Ignore NEU plan on foreign roadmaps (fixes #30) | +122/-37 | 1 agent review, checks AC | ok |
| #29 | Coop-planned prereq off-by-one (fixes #26) | +40/-8 | HOLD, then APPROVE | Real review: the HOLD caught a concurrent-partner regression, fixed in `ebc543e`. |
| #28 | Functional `setPlan` for Apply/move (fixes #27) | +101/-7 | 1 agent review | ok |
| #25 | Fail closed past MAX_SEMESTERS | +55/-9 | 1 agent review | ok |
| #24 | Graph-planner integration | +492/-58 | HOLD, then APPROVE | HOLD caught dropped `.plan-course` CSS (fixed `3c58842`). |
| #23 | Target prereq path + earliest term | +1277/-18 | 3 rounds (HOLD x2) | Real review, 4 blocking bugs found and fixed. CI failed once on `3472088`. |
| #22 | Course focus inspector | +508/-44 | HOLD, then APPROVE | ok |
| #21 | Explore-first IA | +405/-120 | 1 agent review | CI failed once on `38259ff`, fixed `d29dd7e`. |
| #20 | Cloud Agent env config (`.cursor/environment.json`) | +20/-0 | none | Merged locally via `6f5121e`, not through GitHub. |
| #19 | Blocked backup export / outage restore (fixes #12, #13) | +355/-21 | HOLD, then APPROVE | ok |
| #18 | Merge land/local-graph-focus (line-focus + zoom) | +1247/-136 | HOLD, then APPROVE | Combines about 20 commits of local work; review covered only the delta. |
| #17 | Colocate bus metadata | +145/-39 | none (0 reviews) | Merged without review. |
| #16 | Land 3 local-only commits | +461/-40 | none | Merged without review; its test plan checkboxes are unticked. |
| #15, #11 | Record merge ancestry | +0/-0 | none | Empty merges that only exist to rewire history (C2). |
| #14 | Vercel docs + CI | +170/-1 | none | Squash-merged as `2be2da5`; #15 then re-merged its ancestry. |
| #10 | Land plan-backup restore after #8 | +411/-8 | none | Duplicate of `c6353f4` (C2). |
| #9 | Plan backup (closed) | +409/-5 | n/a | Superseded by #10. |
| #8 | "fix on course directed graph" | +20/-45 | none | Vague title/body (C3). |
| #7 | Branch-tip sweep | +11145/-28721 | none | Too large to review. Carries `bf4e78e` regenerated data. |
| #6 | Complete prereq graph (closed) | same as #7 | n/a | Superseded by #7. |
| #3 / #1 | Security audit report | +306 | none | #1 closed, re-landed as #3 (`cbae486`). |
| #2 | Gate POST /api/catalog with token | +106/-4 | none | Security change merged without review. |

Findings:

- **PR1 (P2, lowered from P1 in verification) Review is self-approval with no enforcement.** Author and reviewer are the same account (`TheNewBee`) on every PR. `master` is unprotected (C1). Eleven merged PRs have zero reviews: #2, #3, #7, #8, #10, #11, #14, #15, #16, #17, #20, including the security change #2 and the 40k-line sweep #7. The agent reviews on #18-#29 found real bugs, so they are useful, but nothing requires them. Lowered from P1: other repos in this sweep rate the same solo-maintainer self-review pattern P2; the mechanical gap that actually lets unreviewed code land is C1, which stays P1.
- **PR2 (P2) Squash merges broke ancestry and needed no-op fixes.** #14 was squash-merged (`2be2da5`) while every other PR used merge commits, and later PR bodies (#16, #18) state a "merge commit only" rule. Re-linking ancestry took the no-op PR #15; PR #11 did the same for the earlier sweep. This overlaps C2; keep both, but treat C2 as the canonical description of the ancestry churn.

## Tickets

Counts:

- GitHub issues in this repo: 7, all closed. #4 and #5 are harness goal mirrors. #12, #13, #26 and #27 are bugbot findings. #30 is a foreign-roadmap display bug.
- In-repo harness ledger (`.ycm-harness/state.json`): 4 goals and 9 local tickets, all `done`. Its `updated_at` is `2026-09-16T03:00:53Z`.
- Most work since 2026-09-16 is tracked in the separate `johnyuencm/harness` repo (read-only check). harness#47-#57, #63, #65, #66 and #95 are closed. harness#27 (maintain goal), #48 (dependency-engine goal) and #58 (P3 backlog) are open.

Acceptance spot-checks at `8605d24` (all 233 tests pass, so test-backed criteria hold):

| Ticket | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| seat-unlock-targets (`ae8bdb7f`, marked done in `4c41ebf`) | CS 6220 right of CS 5800/CS 7800, between their rows, sources on consecutive rows | Met (test) | `tests/graph.test.ts:373-384` |
| same | 5-source target on median row, sources on 5 consecutive rows | Met (synthetic test) | `tests/graph.test.ts:386-397` |
| same | Sole-prereq pairs share a row; 5004/5010 left of 5500 | Met (test) | `tests/graph.test.ts:~350-370` |
| same | Visual result on the real map | UNVERIFIED (no browser run) | none |
| full graph (`8e4a497f`) | CS 5800/5100 present, CS 1800 absent | Met | `data/catalog.json`: 142 courses, CS 5800 and CS 5100 present, CS 1800 absent |
| same | `C-` parses as minimumGrade | Met | `tests/scraper.test.ts:71-76` |
| Ctrl+F (`6ba0b9a3`) | Ctrl/Cmd+F, F3 next | Met | `lib/graph.ts:1126-1129` |
| line focus (`72333a75`) | Exit line focus control; 32-course cap | Met | `components/course-graph.tsx:886`, `lib/plan.ts:12` |
| double-click (`aca8f5a1`) | Double-click enters connections | Met | `components/course-graph.tsx:108,868` |
| #12 | Refuse empty export while storage blocked | Met per PR #19 review; regression tests in `tests/plan.test.ts` | PR #19 |
| #30 | Foreign roadmap ignores NEU plan | Met per PR #31 | `385ace8` |
| harness#57 | Card shows "Terms" | Shows a field that is always "Unknown" | see T3 |

Findings:

- **T1 (P2) The in-repo ledger stopped being updated.** `.ycm-harness/state.json` was last updated 2026-09-16, and `grep -c roadmap .ycm-harness/state.json` returns 0. The multi-university tickets `ticket-select-university-roadmaps-on-graph-1a5c1c70` and `ticket-crawl-resumable-program-roadmaps-25be36b4` have review records in `artifacts/` but no ledger entry and no GitHub issue. The harness#47-#95 tickets are not mirrored here either. A later agent reading only this repo sees an incomplete backlog.
- **T2 (P3) Issue status markers do not match.** #5 is closed, but its body marker still says `status=todo` (the closing comment says "merged via CoursesPlanner#7 (0ce420a)"). Several ticket criteria still name `/map`, which is now a redirect (`app/map/page.tsx`). The behaviour still holds, but the wording is stale.
- **T3 (P3) harness#57 "Terms" criterion met in form only.** `components/course-card.tsx:53` renders `Terms: Unknown` for every course, because no course has `termOfferings` (`grep -c termOfferings data/catalog.json` = 0) and the parser states the catalog has none (`scraper/parser.ts:421`). This is honest but takes up card space. Hide the row when empty, or record that the field is a placeholder.
- **T4 (P3) Goals that can be closed.** All P0-P2 children of harness#48 are closed (#49-#57). Only P3 backlog harness#58 remains, so #48 can be closed or narrowed to #58.
- Ticket-close evidence: each in-repo ticket has 4 role reviews under `artifacts/review-*-<ticket>.md` and a `ticket.done` event in `.ycm-harness/events.jsonl`. I found no ticket marked done whose test-backed criterion fails.
- **T5 (P2) No PASS/FAIL record for the acceptance checklist.** `docs/acceptance-checklist.md` lists 12 browser flows and ends with "Unchecked criteria are not passes". No artifact records a full pass of flows 1-12 at a recent SHA. The browser flows (mobile viewport, drag-and-drop, storage-failure recovery) remain UNVERIFIED by this review.

## Code review

Structure: Next.js 16.3.4 App Router (`app/`), React 19 client components (`components/`), and pure domain logic in `lib/`. The largest files are `lib/graph.ts` (1317 lines), `lib/plan.ts` (788), `lib/target-path.ts` (634), `lib/catalog.ts` (576) and `lib/validation.ts` (546). The standalone crawler (`catalog-service/`, plain Node `http`) and parser (`scraper/parser.ts`) are separate. Tests are 18 `node:test` files over `lib/`, `catalog-service/` and server-rendered components. There are no browser tests.

Findings:

- **CR1 (P2) Production dependency has a critical advisory.** `npm audit --omit=dev` reports 1 critical: `next 16.2.0 - 16.3.5`, GHSA-vcvr-r3jv-pc5j (RCE in `next/og` ImageResponse); fixed in 16.3.8 (re-confirmed in verification; `package-lock.json` pins 16.3.4). `grep -rn "next/og\|ImageResponse" app components lib` finds nothing, so the vulnerable path is unreachable from this app: no route imports `next/og` or constructs an `ImageResponse`. That keeps it at P2 rather than P0. There is no `.github/dependabot.yml`, so nothing will flag the next advisory.
- **CR2 (P2) Two open tabs can silently overwrite each other's plan.** `components/app-provider.tsx:221-232` writes the whole plan to `localStorage[STORAGE_KEY]` on every change. The plan is read once on mount (`:156-158`), and there is no `storage` event listener (grep for `addEventListener("storage"` finds nothing). With two tabs open, the last tab to save overwrites the other tab's edits, and nothing tells the user. Fix: listen for `storage` events and reload or warn, or compare a revision stamp before writing.
- **CR3 (P2) The refresh controls in the production UI always fail.** `components/app-shell.tsx:79` ("Refresh catalog") and `components/catalog-state.tsx:9` ("Load official catalog") both call `POST /api/catalog`. Outside `NODE_ENV=development` that route returns 401 unless `CATALOG_REFRESH_TOKEN` is set (`app/api/catalog/route.ts:41-45`), and the browser never sends a token. Live check: `curl -X POST https://courses-planner.vercel.app/api/catalog` returned `401`. So on production the button can only show "Catalog refresh is not authorized." If a token were configured on Vercel, the in-process fallback (`route.ts:79-80`) would try to write `data/` on a read-only serverless filesystem (UNVERIFIED). Hide both controls unless refresh is actually available, e.g. with a `GET` capability flag.
- **CR4 (P3) catalog-service POST refresh has no auth, Origin check or cooldown.** In `catalog-service/server.ts:113-119`, any local process can force a full refresh, and so can a web page that issues a simple cross-origin POST. A forced refresh means outbound fetches to the university and writes to `data/`. The service binds to loopback by default (`:42-46`). Whether a browser's Private Network Access rules block the cross-site POST is UNVERIFIED. The Next route has a 30 s cooldown and a `sec-fetch-site`/`origin` cross-site guard (`app/api/catalog/route.ts:11,107,22-31`), but the service has neither. Add the same token or Origin check and a cooldown.
- **CR5 (P3) Catalog-service errors expose raw messages.** `catalog-service/server.ts:24-26,82,110` (the refresh handler's `catch` at `:118-122`) returns `error.message` verbatim, including filesystem paths from `readBoundedFile` or ENOENT. This is loopback only. The Next roadmaps route already maps errors to safe text (`app/api/roadmaps/route.ts:19-24`); do the same here.
- **CR6 (P3) Refresh writes are not atomic as a set.** `catalog-service/refresh.ts:245-253` writes `courses.json`, `requirements.json`, `catalog.json`, then the mirror copies (`:322-334`), then the raw HTML, then `.catalog-cache.json`. Each write is atomic (`:92-97`), but a crash between them leaves the files mismatched. Only `catalog.json` is read at runtime (`lib/catalog.ts:560-562`), so this matters little; see A3.
- **CR7 (P3) Dead code and unvalidated state.**
  - `catalog-service/refresh.ts:78-81` has an empty `if` that swallows every error, malformed JSON included, with a comment where the code should be.
  - `catalog-service/scheduler.ts:35-36` casts persisted state to `SchedulerState` with only an `in` check.
- **CR8 (P2) The two central modules have grown too large.**
  - `components/course-graph.tsx` is 985 lines with 39 hook calls and 13 lines over 300 characters (e.g. `:108` with inline handlers and aria text, `:868`/`:876` help paragraphs).
  - `lib/graph.ts` is 1317 lines with 86 exported declarations (88 `export` lines), covering layout, find, key handling, overlays, bus geometry and arrow policy.
  - The context value in `components/app-provider.tsx:401` is one line with about 35 fields, recreated every render, so every `useApp()` consumer re-renders on any state change.

  These are the files every recent feature PR touched (#18, #22, #24, #32-#36), and they are where the merge conflicts happened (#33 rebase comment lists `app/globals.css` conflicts).
- **CR9 (P2) Test gaps.** Tests run against pure helpers plus `react-dom/server` rendering (5 files). Nothing exercises the drag-and-drop planner, LocalStorage failure paths in a real browser, the roadmap selector's interactive behaviour, or keyboard flows. The selector gap was raised in the in-repo review `artifacts/review-tech_lead-ticket-select-university-roadmaps-on-graph-1a5c1c70.md` (M2) and is still open. `docs/acceptance-checklist.md` flows 1-12 have no automated equivalent.
- **CR10 (P3) Tracked generated file.** `next-env.d.ts` is rewritten by `next build` (reproduced; see C5).
- Checked and fine:
  - Path traversal on `/api/roadmaps` is rejected twice (`app/api/roadmaps/route.ts:14,42-47`, `catalog-service/roadmaps.ts:30-32`).
  - Source `storage` paths reject `..` and absolute paths (`catalog-service/registry.ts:184-190`).
  - The crawler uses manual redirects, an origin allowlist, timeouts and a size cap (`catalog-service/crawler.ts:41-46,66-70,83,120-153`).
  - The refresh token compare is constant-time (`app/api/catalog/route.ts:34-39`).
  - Unknown prerequisite expressions stay "uncertain" and never become "eligible" (`lib/validation.ts:50-54,90,107`).

## Design review

- **D1 (P2) The multi-university roadmap feature ships empty in production.** Crawler output goes to `data/catalogs/`, which is git-ignored (`.gitignore:11`). `docs/deploy.md:40` says "Production serves the committed snapshot under `data/`", so no roadmap can ever be ready on Vercel. Live check: `GET https://courses-planner.vercel.app/api/roadmaps` returns 40 universities, 39 `unverified/disabled` and Northeastern `supported/queued`. `GET ?university=northeastern` returns `"programs": []`. Explore still mounts the selector above the graph (`app/explore/page.tsx:18`), so users get a control that leads nowhere. Fix it one of three ways:
  - commit one or more validated roadmap snapshots;
  - hide the selector when no university has a ready program;
  - document that the feature is local-only.
- **D2 (P3) Catalog filters re-run eligibility on every render.** `app/courses/page.tsx:63-64` calls `catalogTakeStatus` over every course twice per render outside `useMemo`, and `components/course-card.tsx:33` calls it again per card. With 142 courses this is cheap; it only matters if catalogs grow.
- **D3 (P3) Planned courses get an inconsistent take-status.** `lib/catalog-view.ts:63-71` checks eligibility before plan membership. A planned course whose prerequisites are met shows as `recorded`, but a planned course with missing prerequisites shows as `blocked` (`tests/catalog-view.test.ts:111-112`). So "Blocked" mixes unplanned and already-planned courses, and the filter label does not say so.
- **D4 (P3) Plan schema has no migration path.** `lib/plan.ts:6` uses key `neu-mscs-planner-plan-v1`, and `parsePlan` rejects anything with `version !== 1` (`lib/plan.ts:617`). The first schema change will therefore throw the user's saved plan into the "blocked/unreadable" path rather than migrating it. A recovery export does exist (`lib/plan.ts:652`, PR #19). Add a `migratePlan(vN -> v1)` step before the first schema bump.
- **D5 (P3) The plan is keyed by course code only.** `StudentPlan.completedCourses` and semester courses are bare codes with no catalog id. #30/PR #31 patched the foreign-roadmap display collision with an `overrideActive` flag in the graph, but any future multi-catalog plan would hit the same collision. Record this limit next to the roadmap feature.
- Product scope matches the stated intent: README and harness#48 call the app "graph-first, not a degree audit", and harness#58 fences off degree-audit work. The offerings disclaimer is consistent (`scraper/parser.ts:421`, `lib/validation.ts:508`, README:5,36).

## Architecture review

Documented architecture (README "Architecture"): official pages, then `catalog-service` (poll or explicit refresh), then the adapter, then `data/catalogs/<id>/*.json` plus `data/catalog.json`. `GET /api/catalog` reads only from disk, the `AppProvider` holds state, the plan lives in LocalStorage, and `lib/validation.ts` audits it. There is no `docs/adr/`.

What matches the docs:

- Page loads never scrape. `GET /api/catalog` reads disk through `readCatalog` (`lib/catalog.ts:567-572`) with an mtime cache.
- The crawler does not import Next (`grep 'from "next' catalog-service scraper` returns nothing).
- The roadmaps route only reads (`app/api/roadmaps/route.ts:29-32`).
- The persistence boundary (`lib/plan.ts:parsePlan`) validates untrusted LocalStorage and backup input, with size caps (`MAX_PLAN_BACKUP_BYTES`, `MAX_SEMESTERS`).

Findings:

- **A1 (P2) The deploy model and the crawler model contradict each other.** The README architecture centres on a polling `catalog-service` that writes `data/catalogs/`. Production is Vercel serverless, which serves only committed files (`docs/deploy.md:40`), and `data/catalogs/` is git-ignored. In production, therefore, the "service" half of the diagram does not exist: there is no poller, no roadmaps (D1) and no refresh (CR3). The docs describe both models but never say which features are local-only. Add a "Production vs local" table to README, and make the UI check what the server can do instead of assuming.
- **A2 (P2) Layering leaks in both directions between `lib/` and `catalog-service/`.**
  - `catalog-service/*` imports `../lib/catalog` and `../lib/types`, which is fine as a shared model.
  - `lib/roadmaps.ts:3` and `components/roadmap-selector.tsx:6` import types from `@/catalog-service/source-types`.
  - `app/api/roadmaps/route.ts:3-9` imports `catalog-service/registry` and `catalog-service/roadmaps`. The latter also imports the crawler (`catalog-service/roadmaps.ts:16-17`) and cheerio adapters, so the Next server bundle carries crawler code (also noted in `artifacts/review-tech_lead-ticket-select-university-roadmaps-on-graph-1a5c1c70.md`).

  Move the read-only snapshot readers and shared types into `lib/`, so `catalog-service` depends on `lib` and never the other way.
- **A3 (P3) The snapshot is stored three times.** A refresh writes `catalog.json`, `courses.json` and `requirements.json` (`catalog-service/refresh.ts:245-247`), then mirrors all three to `data/` for the default id (`:329-334`). Only `catalog.json` is read at runtime (`lib/catalog.ts:560-562`); `data/courses.json` (142 courses) duplicates `catalog.json.courses`. README:153-154 documents the two extra files, but no code reads them. Drop them, or mark them as export-only.
- **A4 (P2) Process artifacts outweigh the code and live in three places.** Review and wiki records are spread over `artifacts/` (52 files, 552 KB), `.ycm-harness/wiki/pages/` (7), `docs/knowledge/wiki/` (3) and `docs/JOURNAL.md`. The ledger is also stale (T1). `UI/` holds 7 MB of reference PNGs that no doc links to. A later agent cannot tell which of these is authoritative. Pick one ticket/review home, and move binary references out of the repo or into LFS.
- **A5 (P3) Single shared state context.** All app state goes through one `AppContext` (`components/app-provider.tsx:401`), and both `lib/plan.ts` and `lib/target-path.ts` contain planning logic (`lib/plan.ts:2-3` imports `target-path`). This is acceptable at the current size. It is also the main scaling limit for re-render cost and merge conflicts (CR8).
- **A6 (P3) In-memory refresh lock.** `activeRefresh` / `lastRefreshStartedAt` (`app/api/catalog/route.ts:9-10`) are module globals. They work for one `next start` process but not across serverless instances. This is moot while production refresh is disabled (CR3).

## Recommended actions

1. **P1 / S** Protect `master`: require a PR, and require the CI check "Typecheck, test, and build" to pass. Stop direct goal-branch merges like `6f1cc1c` and `4a8c732`. (C1)
2. **P2 / S** Get real approval from someone other than the author: a second GitHub account, a bot app, or the owner approving. Keep the agent reviews, which catch real bugs (#23, #29). (PR1)
3. **P2 / S** Bump `next` to >= 16.3.8 (GHSA-vcvr-r3jv-pc5j) and add `.github/dependabot.yml` for npm and GitHub Actions. (CR1)
4. **P2 / S** Hide "Refresh catalog" / "Load official catalog" when the server cannot refresh. For example, expose `refreshAvailable` from `GET /api/catalog`, or check `NODE_ENV` and the token server-side. (CR3)
5. **P2 / M** Decide where roadmaps are served from. Either commit a validated snapshot for at least one program, or hide the roadmap selector when nothing is ready. Then document which features are local-only. (D1, A1)
6. **P2 / S** Handle cross-tab edits: add a `storage` event listener in `AppProvider` that reloads the plan or warns when another tab writes it. (CR2)
7. **P2 / M** Move the read-only roadmap snapshot readers and shared types from `catalog-service/` into `lib/`, so Next does not bundle the crawler. (A2)
8. **P2 / M** Split `components/course-graph.tsx` (985 lines) and `lib/graph.ts` (1317 lines) along existing seams: layout, find/keys, overlay, inspector. Split the `AppContext` value, or memoize it. (CR8, A5)
9. **P2 / M** Add a small Playwright smoke suite for acceptance-checklist flows 4-8 and 11 (Explore map, add to term, drag/move, complete/waive persistence, corrupt storage), and run it in CI. Record one PASS/FAIL run. (CR9, T5)
10. **P2 / S** Choose one ticket/review home. Either bring `.ycm-harness/state.json` up to date with the roadmap tickets (`1a5c1c70`, `25be36b4`) and the harness#49-#57 work, or note in README that tickets live in `johnyuencm/harness`. (T1, A4)
11. **P2 / S** Stop re-landing by cherry-pick plus empty "ancestry" PRs. Merge branches directly, and delete the 21 merged remote branches. (C2, PR2)
12. **P3 / S** Add an Origin check, token and cooldown to `catalog-service` `POST /catalogs/:id/refresh`, and map its errors to safe messages. (CR4, CR5)
13. **P3 / S** Untrack `next-env.d.ts` or pin its form, and drop the unread `data/courses.json` / `data/requirements.json` mirrors. (C5, A3)
14. **P3 / S** Hide the "Terms" row on course cards while `termOfferings` is empty everywhere. (T3)
15. **P3 / S** Add a `migratePlan` hook before the first plan schema change. (D4)
16. **P3 / S** Close harness#48 (all P0-P2 children done), and fix the `status=todo` marker on #5. (T2, T4)
17. **P3 / S** Move `UI/` reference PNGs (7 MB, not linked from any doc) out of the repo. (A4)

## Verification (2026-09-30)

Verifier: independent agent, different model family (DeepSeek). Read-only; no non-GET request was sent to production. All git/GitHub claims re-checked against the worktree at `8605d24` and the live repo.

| Finding | Verdict | Evidence |
| --- | --- | --- |
| C1 master unprotected + direct-to-master merges | CONFIRMED | `gh api .../branches/master/protection` -> 404; `git log -1 6f1cc1c` parent 2 is `b9ceacf` on `goal/multi-university-roadmaps`; `git show --stat` = +3048/-271 |
| PR1 self-review, no enforcement | CONFIRMED (severity OVERSTATED) | 29 PRs all authored by `TheNewBee`; 11 merged with zero reviews, not 9 (#2,#3,#7,#8,#10,#11,#14,#15,#16,#17,#20). Lowered P1 -> P2 to match this sweep's rule for solo maintainers. |
| D1 roadmap selector cannot get data | CONFIRMED | `.gitignore:11` = `data/catalogs/`; `git log --all -- data/catalogs` is empty; live `/api/roadmaps` = 40 universities, all 39 unready; `?university=northeastern` -> `programs: []` |
| CR3 refresh buttons always 401 in prod | CONFIRMED | `components/app-shell.tsx:79`, `components/catalog-state.tsx:9` POST; `app/api/catalog/route.ts:39-42` returns `NODE_ENV === "development"` fallback |
| CR1 next critical advisory | CONFIRMED (claim = unreachable) | `npm audit --omit=dev` 1 critical GHSA-vcvr-r3jv-pc5j; lockfile pins 16.3.4; `grep next/og\|ImageResponse` = none. Author's UNVERIFIED now resolved: path unreachable. |
| CR2 cross-tab overwrite | CONFIRMED | `components/app-provider.tsx:224` whole-plan `setItem`; mount-only `loadPlan` at `:155-158`; no `storage` listener anywhere |
| CR8 two central modules too large | CONFIRMED (numbers corrected) | 985 and 1317 lines exact; hook calls 39 not 38; exports 86 not 63; 13 long lines exact |
| A2 layering leak | CONFIRMED | `lib/roadmaps.ts:3` and `app/api/roadmaps/route.ts:3-9` import `catalog-service/*`; `catalog-service/roadmaps.ts:16-17` imports the crawler |
| A4 artifacts in three places | CONFIRMED | `artifacts/` 52 files / 556 KB; `UI/` 7.0 MB; not linked from any doc |
| T1 stale in-repo ledger | CONFIRMED | `.ycm-harness/state.json` `updated_at` 2026-09-16; `grep -c roadmap` = 0; roadmap ticket reviews exist in `artifacts/` |
| T2 `status=todo` on closed #5 | CONFIRMED | `gh issue view 5` body still contains `status=todo`; issue state CLOSED |
| T3 Terms row always Unknown | CONFIRMED (line corrected) | `components/course-card.tsx:53` (was cited as :54); `grep -c termOfferings data/catalog.json` = 0 |
| C2 duplicate patch-ids | CONFIRMED | `git patch-id --stable` matches for `c6353f4`/`0b4731c` and `57cf587`/`c7c4fed` |
| C4 harness bookkeeping commits | CONFIRMED | ~56 commits only touch `.ycm-harness`/`artifacts`/wiki |
| C5/CR10 `next-env.d.ts` tracked | CONFIRMED | `git ls-files next-env.d.ts` returns it |
| CR4 catalog-service POST no auth | CONFIRMED | `catalog-service/server.ts:113-119` has no token/Origin/cooldown; Next route has both (`route.ts:22-31,107`) |
| CR5 raw error messages | CONFIRMED | `catalog-service/server.ts:118-122` returns `error.message` |
| CR7 dead code | CONFIRMED | `catalog-service/refresh.ts:76-84` empty `if`; `catalog-service/scheduler.ts:35-36` unchecked cast |
| D3 blocked vs recorded ordering | CONFIRMED | `lib/catalog-view.ts:63-71` checks eligibility before `recordedCourseCodes` |
| D4 no plan migration | CONFIRMED | `lib/plan.ts:6` v1 key; `lib/plan.ts:617` rejects `version !== 1` |
| C3, C6, D2, D5, A3, A5, A6, CR6, CR9, T4, T5, PR2 | CONFIRMED | Not individually re-opened; each is a low-severity observation consistent with the code read during this pass (`lib/plan.ts:6`, `catalog-service/refresh.ts:240-247`, `app/courses/page.tsx:63-64`, `lib/plan.ts:2-3`, `app/api/catalog/route.ts:9-10`). |
| Scope "25 merged" | CORRECTED | `gh pr list --state all` = 26 MERGED, 3 CLOSED |

Check re-run: `npm test` (tsx --test, 18 files) -> exit 0, 233 tests, 233 pass, 0 fail. Matches the report.

Counts: confirmed 22 findings (2 with corrected numbers/lines, 1 also with corrected severity), removed 0, added 2 (both P3, below).

### Added in verification

- **(added in verification) P2 — CI pins no GitHub Actions SHA and Node CI (22) differs from local (24.20.0).** `.github/workflows/ci.yml:23,26,63` uses `actions/checkout@v4` and `actions/setup-node@v4` by mutable tag, so a retagged/compromised action runs with repo write scope on the deploy job. Pin the SHAs. The report ran tests on Node 24.20.0 while CI pins `node-version: 22` (`package.json` engines `>=22`); the re-run here (Node 24) passed, so the difference is not breaking today, but the verified environment should match CI.
- **(added in verification) P3 — the catalog-refresh fallback runs the crawler inside the Next serverless function.** `app/api/catalog/route.ts:75-82` dynamically imports `@/scraper/refresh` and calls `refreshCatalog({ force: true })` whenever the local `catalog-service` is unreachable (the normal case on Vercel). If an operator ever sets `CATALOG_REFRESH_TOKEN` on Vercel, a POST would run the crawler and attempt to write `data/` on the read-only serverless filesystem. This is latent today only because production refresh is disabled (CR3); fixing CR3 by keeping the fallback would expose it. Related: `isServiceUnreachable` (`route.ts:52-56`) classifies failure by error type (`TypeError`/`cause`), so a genuine 5xx from `catalog-service` can be misread as unreachable and routed to the same fallback. Prefer failing closed in production instead of falling back to the in-process crawler.

### Verifier notes on the omitted findings

The report's "checked and fine" list holds up: the roadmaps route rejects traversal twice (`app/api/roadmaps/route.ts:14,42-47`), registry storage paths reject `..`/absolute (`catalog-service/registry.ts:184-190`), the token compare is constant-time (`app/api/catalog/route.ts:34-37`), and the only API surface is `GET /api/catalog`, `POST /api/catalog`, `GET /api/roadmaps` (no `dangerouslySetInnerHTML` or `innerHTML` anywhere).
