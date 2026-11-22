---
reviewed_head_sha: cd7eb0b2ae1fff1240f6722a08eed27b64edc354
---
# Review (tech_lead + project_manager, one seat): issue #110, static 404

Inspected: git diff origin/master...HEAD (worker.ts, lib/not-found.ts, tests/course-pages.test.ts, docs/deploy.md, artifacts/local-check-110.txt), app/global-not-found.tsx, lib/course-pages.ts, issue #110 comments.

## Findings

1. MEDIUM, test is a false-green risk (tests/course-pages.test.ts:196-197). The worker wiring is pinned only by a regex on worker.ts source text. No test runs the worker path, so a logic error in the guard would pass. Any harmless reformat of the line breaks the regex. The response checks (status, content-type, max-age, noindex) are real but do not prove worker.ts uses them for unknown paths. The test also never compares the string with app/global-not-found.tsx.
2. MEDIUM, text drift is unguarded (lib/not-found.ts:1-2). The comment says "keep the text equal" but nothing enforces it. Already different: the static page has no favicon.ico link (the TSX has icon.svg and favicon.ico), and it does not load globals.css (the TSX imports it). The 404 page is unstyled against global-not-found. Pick one: add a drift test on title, h1, copy, robots, or accept and document the visual difference. docs/deploy.md says "The text equals" which is only true for the words.
3. LOW, cache-control public max-age=300 on a 404 (lib/not-found.ts:6). Browsers and shared caches may keep a 404 for 5 min. A program or course published by a later deploy shows 404 for up to 5 min for visitors who hit it earlier. Low risk (page list is built at deploy, paths rarely hit before publish). Not mentioned in docs/deploy.md.
4. LOW, HEAD and other methods. The guard runs for every method. HEAD gets 404 (correct; Workers drops the body). POST to a program path gets 404 HTML, not 405. Same as before, no regression. No HEAD test.
5. LOW, SEO. Meta robots noindex is present; no X-Robots-Tag header. Status 404 plus noindex meta is enough. Matches the TSX.
6. INFO, scope. A route miss such as /nothing still renders global-not-found (p50 6 ms per the issue). Not changed. docs/deploy.md states this. Honest.

## Done-state (project manager)

- DONE: unknown program and course paths bypass vinext. 371 tests, typecheck and build pass per artifacts/local-check-110.txt. Local wrangler dev shows 404 at 481 bytes. Course page 200 is unchanged (same Set lookup, no new work on the hot path).
- NOT DONE: live CPU p50 <= 6 ms (acceptance) is not measured. The deploy.md table is a "pending deploy" note with no numbers. Course-page no-regression has no live number either. These are owner steps after deploy.
- Required: do not close #110 from the PR (no "Closes/Fixes #110"; use "Refs"). The issue was already reopened once after a premature auto-close by PR #118.
- Risk to the target: the 7 ms to 6 ms gain is inferred. A 404 response still costs fetch overhead; if live p50 stays above 6 ms the next step is an asset-served 404.

## Verdict: PASS (conditional)

No high findings. Mergeable as a step on the condition that the PR body uses "Refs #110" and the issue stays open until live numbers are in docs/deploy.md. Findings 1 and 2 (medium) should be fixed or explicitly accepted by the owner.
