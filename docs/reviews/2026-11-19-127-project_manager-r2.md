---
ticket: 127
seat: project_manager
round: 2
reviewed_head_sha: 2096874b51483ab88151c5c832e7db7c33923468
base_sha: 04e51ff
previous_round: docs/reviews/2026-11-18-127-project_manager.md (PASS at a5e2ad7)
verdict: PASS
---

# #127 project_manager review, round 2

Branch `fix/127-build-tracked-only`. Head `2096874`. New since round 1: `c7602d7`, `0b7b7e5`, `8b2dd2e`, `2096874` (docs only).

## Verdict

PASS. The three acceptance criteria stay met. Candidate 1 is in #127 scope. One medium: the PR does not exist yet, and its body must name the full list of behaviour changes below. Two of them are not named in any commit or doc yet. One low: open one follow-up issue for candidate 2 and the "Queued" dev text.

## Per-criterion map

| AC | State | Evidence |
|----|-------|----------|
| 1. The build reads only `programs.json`, published roadmaps and other tracked files | met | Unchanged since round 1 on the build path. `readState()` is no longer in `lib/roadmap-reader.ts`. It now lives only in `catalog-service/roadmaps.ts:37`. Grep: its callers are `readCrawlDirectory()` (`:67`) and `crawlRoadmaps()` (`:132`). Neither is on the build path. The build cannot reach the status file through the shared reader now, not only by the call order. |
| 2. The build output is the same with or without ignored crawl output, invalid status included | met | `tests/snapshot-manifest.test.ts:58-64` (unchanged). Round 1 manual full-build check still applies: `8b2dd2e` does not touch `lib/snapshot-manifest.ts` or `vite.config.ts`. |
| 3. A test plants an invalid status file in a temp copy and runs `buildSnapshotAssets()` | met | Same test. This seat ran `npx tsx --test tests/snapshot-manifest.test.ts tests/roadmaps-route.test.ts` at `2096874`: `# pass 17`, `# fail 0`. Orchestrator reports full `npm test` 359 pass, typecheck 0, build 0. |

## Round 1 findings: status

| Round 1 finding | Status | Evidence |
|---|---|---|
| medium: API answer changes not named | partly closed | Commit `8b2dd2e` and `docs/deploy.md:60` name the app rule and the endpoint change. Tests pin the 404 (`tests/snapshot-manifest.test.ts:66-80`) and the clean-vs-dirty answers (`:82-111`). Still open: no PR body exists (REST `pulls?head=...` returns nothing). See medium-1. |
| low: AC2 full build rests on manual evidence | unchanged, accepted | Two clean builds differ in chunk hashes. Keep the manual result in the PR body. |

## Scope: is candidate 1 still #127?

Yes. The #127 problem text says the old code "breaks the rule 'the app reads only tracked catalog files'". The ACs name only the build, but the rule names the app.

```
a5e2ad7: build + &program=  -> tracked only
         list + ?university= -> status file   <- split made by a5e2ad7 (PM r1 medium)
8b2dd2e: every app read     -> tracked only
         CLI --list-*, catalog service, crawler -> status file (unchanged output)
```

- `8b2dd2e` removes an inconsistency that the first fix created. It does not add a feature.
- It moves code (`readState()` to its writer module). It adds no new state, option or endpoint.
- The operator views keep their output. `tests/snapshot-manifest.test.ts:113-121` pins that they still read the status.
- Cheaper option: leave the split and document it. That keeps two endpoints that disagree on the same state. The move is small, so the cost is justified.

Rank: in scope. Name the widened scope (build plus app API) in the PR body.

## Behaviour changes the PR body must name

Base `04e51ff` against head `2096874`. All rows except 9 need local crawl output; production ships no status file.

| # | Surface | Before | After | Named where today |
|---|---|---|---|---|
| 1 | `npm run build`, invalid status file | fails | passes, same output | `a5e2ad7`, `docs/deploy.md:59` |
| 2 | `/api/roadmaps?university=&program=`, invalid status | 503 | 200 | `8b2dd2e` |
| 3 | same, status `ready`, `programs.json` missing | 503 | 404 "Unknown roadmap program." | test only (`c7602d7`) |
| 4 | `/api/roadmaps` list and `?university=`, invalid status | 503 | 200 | `8b2dd2e`, `docs/deploy.md:60` |
| 5 | same, status `ready`, `programs.json` missing | 503 | 200, status `queued`, 0 programs | architecture page table only |
| 6 | list and `?university=` in dev, valid status during or after a local crawl | status from the crawl file (progress, `reason`) | status rebuilt from `programs.json` only | not named |
| 7 | `/api/roadmaps` generic 503 | silent | one `console.error` line with the cause | `0b7b7e5`, `docs/deploy.md:60` |
| 8 | CLI `--list-*`, catalog service, crawler: bad status file | raw message | message starts with the absolute file path; HTTP body stays generic (`catalog-service/server.ts:43`) | `0b7b7e5` |
| 9 | Module exports | `readState` exported from `lib/roadmap-reader.ts`; `catalog-service/roadmaps.ts` re-exports `readProgramDirectory` | `readState` private in the crawler; new `readCrawlDirectory`, `latestUpdate`; `listRoadmapUniversities` takes a third `readDirectory` argument | `8b2dd2e` (partly) |
| 10 | CLI `--roadmap`, invalid status | exit 1 | exit 0 | UA round 1 record only |

Also state: the Worker bundle no longer names the status file, and clean-copy API bodies are byte-equal to base (`8b2dd2e`).

## Findings

### medium-1: the PR body must carry the full change list

No PR exists yet for the branch. Rows 3, 5, 6 and 10 are not in any commit message or doc. Row 6 is the one an operator can notice: in `npm run dev`, the selector no longer shows live crawl progress or the crawl error `reason`. The operator must use `--list-programs`. That is the design intent (dev answers like the Worker), but it is a visible change and must be named. Fix: copy the table above into the PR body. No code change.

### low-1: open one follow-up issue for candidate 2 and the "Queued" dev text

- Candidate 2 (one typed roadmap read error) is out of #127 scope. I agree with the deferral: it does not change which files the app reads.
- Row 3 and row 5 give misleading text for a broken local state. Row 3 says "Unknown roadmap program." for a published program. Row 5 shows the university as "Queued ... waiting for crawl" (`components/roadmap-selector.tsx:101`) when the local directory is broken.
- Both are dev-only. Production always ships `programs.json`.
- Today the deferral lives only in `artifacts/architecture-127-build-tracked-only.html`. No open issue covers it (REST issue list: only #127 and #110 match roadmap terms). A deferral without a tracker item gets lost.
- Fix: create one issue: "Roadmap reads: one typed error; broken local `programs.json` gives misleading 404 text and 'Queued' status". Link it in the PR body. Rank `low`, no milestone pressure.

## Design and goal alignment

- `8b2dd2e` follows the architecture page's candidate 1. No silent fork.
- `0b7b7e5` logs only on the error path. Body stays generic, so no path leak. Good.
- Candidates 3 and 4 stay unbuilt with a reason. Candidate 4 needs a product owner decision. That is correctly not decided by the implementer.

## Scope honesty

- No TODO, skip, mock of product behaviour, or deleted assertion in the new commits. `tests/roadmaps-route.test.ts:229-241` adds assertions and removes none.
- Test helpers mock `console.error` only to assert the log line. Acceptable.

## Risk surface

- Production: low. `lib/snapshot-manifest.ts` and the snapshot path are untouched since round 1.
- Dev: an operator loses crawl progress in the UI (row 6). Mitigation: CLI `--list-*` keeps it, and `docs/deploy.md:60` says so.
- Unknown external callers of the removed exports (row 9): none in the repo (grep). The package is an app, not a library.

## Not checked

- Full `npm test`, typecheck and `npm run build` at `2096874`. This seat ran 2 test files only. The orchestrator reports all 0 exit.
- A full `next dev` or `npm start` HTTP run. Tests call `handleRoadmapsRequest` directly.
- The tech_lead and user_advocate round 2 records. None exist at `2096874`; this round used their round 1 records.
