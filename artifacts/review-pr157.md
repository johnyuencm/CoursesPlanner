---
reviewed_head_sha: 0a30d172eee81a42a5166a29856f6078a4e7a630
---
# Review of PR 157 (fix #151, lost or invalid programs.json)

Verdict: PASS. No defect found. No code change.

## Verify (on the PR head)
- `npm run typecheck`: exit 0.
- `npm test`: 373 pass, 0 fail.
- `npm run build`: exit 0 ("Build complete").
- CI on the PR: Typecheck, test, and build SUCCESS.

## Acceptance of #151
| Criterion | Result |
| --- | --- |
| A lost local programs.json does not show "Queued ... waiting for crawl" | Met. `readProgramDirectory` throws `missing-programs` when `data/published.json` lists the university. The selector hides the status guide while the list is empty. |
| An invalid programs.json has its own kind | Met. `invalid-programs` is 503 "The program list (programs.json) is invalid." Only a local non-JSON file, a failed validation or a registry mismatch map to it. A bad Worker asset body stays a generic 503. |
| Tests cover both, and the three commands pass | Met. Route, selector, CLI and build tests cover both. |

## tech_lead and project_manager view
- The Worker path does not change: `published.json` is read only when a crawlable university has no list.
- HTTP bodies hold no paths. One log line holds the path.
- `LocalJsonError` plus the `snapshot-assets.ts` guard keep a Worker asset fault apart from a corrupt local file.
- Known limit: an unpublished local crawl that loses its list still reads as queued. The PR names it and tracks it in #155. This is a product decision, not a defect.
- Stacked on #152. Merge #152 first, then retarget this PR to master.

## user_advocate view
- The operator sees the real cause (missing or invalid file) in place of a false "queued" text.
- The selector shows no status guide next to an error. This removes a confusing hint.
