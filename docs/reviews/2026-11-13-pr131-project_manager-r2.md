---
reviewed_head_sha: 4e602f4c95c50c9db8f36310e49a2c2617247ade
---

# PR #131 review: project manager, round 2

- Fix commit: `4e602f4` (`git diff 26fe44a..4e602f4`, 15 files, +89 / -14).
- The PR branch head is now `fa76ee0`. It adds only the 2 round 1 review files on top of `4e602f4`. Code is the same.
- Seat: project manager. I did not change code.

## Verdict

**PASS.** M1 is closed. M2 is closed: `docs/ia.md` now names the cost. The 6 criteria still hold. I found no new high or medium finding.

## Evidence that I collected

| Check | Result |
| --- | --- |
| CI on `4e602f4` | `Typecheck, test, and build` success |
| CI on `fa76ee0` (PR head) | success, run 43397598832 |
| Sitemap metadata dump, round 1 against round 2 | 357 titles and 357 descriptions are byte-identical. Max title 60. 357 unique. |
| `tsx --test` on `roadmaps`, `published-programs`, `sitemap-metadata`, `course-code` | 39 of 39 pass |

## Round 1 findings

| Finding | State | Evidence |
| --- | --- | --- |
| M1: a new crawl deletes the Map-tier short name | closed | `catalog-service/universities.json` `crawl.shortNames` holds the 4 names. `catalog-service/roadmaps.ts:214-217` writes it into each roadmap. `lib/university-directory.ts:78-82` validates it. `tests/roadmaps.test.ts` "the crawl writes the short name ... also after a reset" proves a new crawl keeps it. `tests/published-programs.test.ts:78-79` fails when a roadmap and the config differ. |
| M2: clipped titles lose course-name words | closed | `docs/ia.md:43` names the cost and says that the `<h1>` and the description keep the full name. Clipping all 133 long titles stays an acceptable reading of the 90% criterion (see round 1). |
| L2: no guard for a long short name | closed | `lib/program-page.ts` `titleName()` keeps 30 characters for the page part. `clip()` now handles a limit below 2. New test in `tests/sitemap-metadata.test.ts` covers 44, 54 and 73-character names. |
| L1, L3 | open, accepted | No change needed. |

## Criteria after the fix

| # | Criterion | State |
| --- | --- | --- |
| 1 | Short label stored with the catalog, not in UI | met. The Map-tier source of truth moved from the roadmap file to `catalog-service/universities.json`. The crawl copies it into the roadmap. It is still catalog data, not UI. |
| 2 | Titles use it, 90% at 60 or less, all unique | met. 357 of 357, unique. The pathway page title now also uses `pageTitle()`. Its output is the same today. |
| 3 | Course descriptions at 160 or less | met. Max 160, unchanged. |
| 4 | Header on phones | met (code only). No CSS or JSX change in round 2. |
| 5 | Intro on `/` | met. No change. |
| 6 | Test pins title length and uniqueness | met. Same test, plus the fallback-name test. |

## Docs stay true

| Doc | State |
| --- | --- |
| `docs/add-courseleaf-college.md` step 5 | True. `crawl.shortNames` is read in `catalog-service/roadmaps.ts:214`. A program with status `queued` is crawled again (`catalog-service/roadmaps.ts:191`). The 2 named tests fail as the step says. |
| `docs/ia.md:42-44` | True. Matches the code and the tests. |
| `lib/types.ts` `ProgramRoadmap.shortName` comment | True. |

## New low notes

- L4: `docs/ia.md:44` says that a short name of more than 27 characters gets clipped in titles. `tests/sitemap-metadata.test.ts` then fails, because each program title must contain the full short name. This is a safe failure, not a bug. The doc can say that the test rejects such a name.
- L5: the clipped fallback looks poor, for example `CS 6650 Building Scalable… · Northeastern University…`. All published programs have a short name, and the sitemap test enforces it. Thus no live page shows it.
