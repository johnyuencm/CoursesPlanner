---
reviewed_head_sha: 26fe44a8df3824e54e0aa9bc655fac641b149788
---

# PR #131 review: project manager, round 1

- PR: https://github.com/johnyuencm/CoursesPlanner/pull/131
- Issue: #117 (B6, parent #60). Source: `docs/reviews/2026-11-08-pr115-review.md`, findings 2 to 5.
- Branch: `fix/117-short-titles`. Diff: `git diff master...26fe44a` (24 files, +176 / -22).
- Seat: project manager. I am not the author. I did not change code.

## Verdict

**PASS.** All six acceptance criteria are met. I found no high finding. Two medium findings are durability and search-quality trade-offs. The PR names both, but the PR body does not name the keyword loss.

## Evidence that I collected

| Check | Result |
| --- | --- |
| `gh pr checks 131` | `Typecheck, test, and build` pass (54 s), run 43395837525 |
| PR head | `26fe44a8df3824e54e0aa9bc655fac641b149788` (matches the pinned SHA) |
| Sitemap metadata dump (the test's own `pageMetadata` merge, run from a scratch copy) | 357 pages. 357 of 357 titles are 60 characters or less. Max 60. 357 unique titles. 133 titles have "…". |
| Course page descriptions | 335 pages. Max 160. 64 descriptions have "…". |
| Non-course descriptions | Max 242. The ticket does not cover them. |
| Pages per program | Seattle 124, Boston 65, Align 67, Cybersecurity 46, Data Science 54, `/` 1 |

I did not open a browser. The header check is from code (CSS and JSX) only. The author claims a browser check at 320, 390, 1000 and 1280 px.

## Per-criterion map

| # | Criterion | State | Evidence |
| --- | --- | --- | --- |
| 1 | Short label per program, stored with the catalog, not hardcoded in UI | met | `lib/types.ts` `Catalog.shortName`, `ProgramRoadmap.shortName`. Values in `data/catalog.json`, `catalog-service/sources/neu-mscs-seattle.json` and the 4 Map-tier roadmap files. `catalog-service/refresh.ts:296` copies it. `lib/program-catalog.ts:29` copies it. Validators: `lib/catalog.ts:204`, `lib/catalog.ts:392`, `catalog-service/registry.ts:28`. `tests/ia.test.ts` still bans hardcoded names in `app/` and `components/`. |
| 2 | Titles use it. At least 90% are 60 characters or less. All unique. | met | `app/[universityId]/[programId]/layout.tsx` template `%s · <shortName>`. Course titles: `pageTitle()` in `lib/program-page.ts`. Dump: 357 of 357 are 60 or less, 357 unique. |
| 3 | Course page descriptions are 160 characters or less | met | `courses/[code]/page.tsx` `clip(..., DESCRIPTION_MAX)`. Dump: max 160 over 335 pages. |
| 4 | Phones show the college and program name in a header | met (code only) | `components/app-shell.tsx:78` `<p class="topbar-program">`. `app/globals.css:804` shows it at 1180 px or less. `:835` puts it on its own row at 860 px or less. No rule at 620 px hides it. |
| 5 | `/` has a short intro paragraph | met | `app/page.tsx:51`, 284 characters. `tests/ia.test.ts` checks key words and a 300-character limit. |
| 6 | A test pins title length and uniqueness over the sitemap | met | `tests/sitemap-metadata.test.ts`: uniqueness, 90% at 60 or less, short name in each program title, course descriptions at 160 or less, description uniqueness. CI passes. |

## Findings

### M1 (medium): a new crawl deletes the short name of a Map-tier program

- `catalog-service/roadmaps.ts:214-222` builds the roadmap object without `shortName`. `atomicWrite` then replaces the file.
- Thus `npm run catalog:refresh -- --crawl-roadmaps` removes the hand-written short name of 4 of 5 programs.
- Mitigation: `tests/sitemap-metadata.test.ts` fails when a short name is missing. `docs/add-courseleaf-college.md` step 5 and `docs/ia.md:42` tell the operator to add it again.
- Risk: the fix is manual and repeats at each crawl. A cheaper durable place exists: the program entry that the crawl already reads (for example `catalog-service/universities.json`), so that the crawl copies it.
- Status: named in the PR body ("Watch") and in docs. Not blocking. Track as a follow-up.

### M2 (medium): 133 titles lose course-name words to "…"

- The ticket asks for at least 90% at 60 characters or less. The PR clips every long title, so 100% fit. 133 of 357 titles (37%) end with "…".
- Is this an acceptable reading? Yes. Without clipping, 133 titles (37%) exceed 60 characters. Titles must name the program to stay unique, because the same course is in many programs. Thus the 90% target needs clipping for at least 98 titles (322 of 357 must fit). Clipping all 133 is the simpler and consistent choice.
- Cost: the title tag loses search keywords. Examples: `CS 5100 Foundations of Artificial… · NEU MSCS Seattle`, `CS 2100 Program Design… · NEU MSCS Seattle` (drops "and Implementation 1"). Before this PR, the full course name was in the title and only the program tail was cut in search results.
- Mitigation: the description starts with the full code and course title. The page `<h1>` keeps the full name. `docs/ia.md:36` documents the clip.
- Gap: the PR body says "cut after a whole word". It does not say that the title tag now holds fewer course-name words. Name this trade-off in the user-facing report. A later option is to clip only the titles needed to reach 90%.

### L1 (low): the brand "Course Map" is gone from 351 titles

- Only `/` and the 5 overview pages keep "Course Map". This follows from the short-name template. `docs/ia.md:34-35` documents it. No action needed. Name it in the report.

### L2 (low): `pageTitle()` has no guard for a long short name

- `lib/program-page.ts` `pageTitle()` gives `clip()` a budget of `60 - (short name + 3)`. A short name of about 57 or more characters gives a budget of 0 or less, and `clip()` then gives a broken title.
- No current value is near this limit (max 21 characters). The sitemap test catches a bad result. Add a length check on `shortName` in the validators when you touch them next.

### L3 (low): the phone header shows the full names, not the short name

- `components/app-shell.tsx:78` joins `university` and `program`, for example `Northeastern University · Computer Science, MSCS—Seattle`. At 320 px this line wraps to 2 lines in a sticky header.
- The criterion asks for the college and program name, so this is met. The short name is an option if vertical space becomes a problem.

## Design alignment

- The ticket is the design. The change follows it. Titles moved from `<page> · <university> <program> · Course Map` to `<page> · <short name>`. `docs/ia.md` records the new table.
- The header shows at 1180 px or less, not only on phones. This matches the width where the sidebar hides the names (`app/globals.css:803`). It is a correct widening, not a fork.

## Goal alignment and scope

- The change moves #60 forward: shorter titles and descriptions for search, a header on small screens, and intro text for the AdSense review.
- Scope creep is small and related: description uniqueness in the test, `unlockCount()` as a shorter form of `unlockSummary()`, and the dangling-word rule in `clip()`. No gold-plating found.
- No TODO, no mock, no deleted test. One assertion in `tests/ia.test.ts` changed to the new template. That change is correct.

## Docs stay true

| Doc | State |
| --- | --- |
| `README.md:45-46` | True. Matches the dump. |
| `docs/ia.md` Branding table and bullets | True. Each title row matches the dump. The test description matches `tests/sitemap-metadata.test.ts`. |
| `docs/add-courseleaf-college.md` step 5 | True. Matches `catalog-service/roadmaps.ts` (the crawl does not write `shortName`). |

## Deferred items

- M1 durable source for the Map-tier short name: named in PR body and docs, no follow-up issue yet.
- M2 keyword loss: documented in `docs/ia.md`, not named as a cost in the PR body.
- Non-course descriptions up to 242 characters: outside the ticket, not claimed.
- Not deployed. The PR body says so.
