---
reviewed_head_sha: aeda4f498bd368f4c4b7f7f75f7af4cb8b54e12b
verdict: PASS
---

# #151 review: project manager (round 1)

- Ticket: johnyuencm/CoursesPlanner#151
- Branch: `fix/151-lost-programs-json`, stacked on `fix/136-roadmap-read-errors` (PR #152).
- Diff: `git diff origin/fix/136-roadmap-read-errors...aeda4f4` (5 files, +91 / -17).
- Debate partner: `docs/reviews/2026-11-21-151-tech_lead.md`. That file was not on the branch at the time of this round.

## Verdict

PASS. All four criteria are met. No high finding.
Two medium findings stay. M1 is a cheap fix that I recommend in this PR. M2 is bookkeeping on the issue before it closes.

```
programs.json state          published.json lists uni?   answer (list, ?university=, &program=)
-------------------          -------------------------   --------------------------------------
missing                      yes                         404 "The program list (programs.json) is missing."
missing                      no                          200, status "queued"  (shortcut, #127)
not JSON / bad shape / wrong uni   n/a                   503 "The program list (programs.json) is invalid." + log line
valid                        n/a                         200
```

## Evidence that I ran

- `npx tsx --test tests/roadmaps-route.test.ts tests/snapshot-manifest.test.ts` at `aeda4f4`: 19 pass, 0 fail.
- I did not run `npm run typecheck`, the full `npm test` or `npm run build`. For these I use the orchestrator record: typecheck 0, npm test 372/0, build 0.

## Per-criterion map

| # | Criterion | State | Evidence |
|---|-----------|-------|----------|
| 1 | A lost local `programs.json` does not show "Queued ... waiting for crawl". The text names the real cause. | met (see M1, J1, J2) | `lib/roadmap-reader.ts:149` throws `missing-programs` when a published university has no list. `tests/snapshot-manifest.test.ts` test "a lost programs.json of a published university ..." checks the list and `?university=`. The `&program=` path was already `missing-programs` from #136 (`lib/roadmap-reader.ts:178`). |
| 2 | An invalid `programs.json` gives its own `RoadmapReadError` kind with a short true text. | met | New kind at `lib/roadmap-reader.ts:26`. Parse errors (`:104-107`) and shape or registry mismatch (`:109-117`) both map to it. `roadmapReadAnswer` logs the file and cause (`:39-43`). |
| 3 | Tests cover both. typecheck, test and build pass. | met | `tests/roadmaps-route.test.ts:220-234` (3 bad contents, both endpoints, log lines). `tests/snapshot-manifest.test.ts` adds 2 tests (CLI + build, lost-vs-queued). Verify: see above. |
| 4 | (Issue comment) The new kind joins the build pass-through check. | met | `lib/snapshot-manifest.ts:75`. Test "an invalid programs.json names the file in the CLI and the build, with no snapshot prefix (#151)". |

## Judgement calls

### J1: one lost file breaks the whole university list

The list endpoint uses `Promise.all` (`lib/roadmap-reader.ts:157-166`). One throw fails the full list. The selector then shows "Unable to load universities: The program list (programs.json) is missing."

My answer: this is acceptable for this ticket. Reasons:

- An invalid `programs.json` already broke the whole list before this change. The new behavior is the same failure model.
- The state is dev-only. The build fails loudly when a published list is missing (`lib/snapshot-manifest.ts:75`), so production cannot ship it.
- A per-university "unavailable" row needs a new status value in the list contract. That is a design change, not a text fix. It is out of scope.

But see M1: the whole-list text does not say which university.

### J2: the status guide still shows "Queued waiting for crawl"

`components/roadmap-selector.tsx:101` is a fixed legend. It explains the meaning of the "Queued" status. It is always visible, also with no error.

My answer: this does not break criterion 1. The criterion is about the text for the lost-file state. In that state no university shows "(Queued)" and the status line shows the real cause. The legend makes no claim about the lost file. No fix and no follow-up needed. A follow-up is optional only if the product wants to hide the legend while the list failed.

## Findings

### Medium

- **M1: the list error does not name the university, and writes no log line.**
  `lib/roadmap-reader.ts:39` returns the `missing-programs` answer with no log. The body text has no university id (`:24`). On the list endpoint (no query) the user and the developer cannot see which university lost its file. Today only northeastern has a list, so the gap is small. With a second university the cause is ambiguous.
  The detail exists in the error message ("Program list is missing: data/catalogs/<id>/programs.json"), but nothing shows it.
  Recommended fix here (one condition): log `missing-programs` too, as for `invalid-programs`. Alternative: follow-up issue. Not blocking: the criterion asks for the cause, and the cause is named.

- **M2: the named limits are not recorded on the issue.**
  The implementer names four limits: unpublished local crawl still reads "queued", CLI `--list-*` and the catalog service still say "queued", the legend (J2), and no test for the Worker asset-body guard. Only the first one is in the code (`lib/roadmap-reader.ts:125`, `shortcut:` comment). No open issue holds the others (checked `gh api .../issues?state=open`).
  Fix: before #151 closes, write the limits into an issue #151 comment or the PR body. Open a follow-up issue for the CLI and catalog service text, because the issue title asks for true text and those paths still say "queued".

### Low

- **L1:** `GET /api/roadmaps` (the list, no query) answers 404 when one list is lost. The list resource exists, so 404 is odd for a client. 503 would match "data not available". Product choice, not a criterion.
- **L2:** The Worker body guard (`lib/snapshot-assets.ts:34-35`) has no test. The `SyntaxError` split in `lib/roadmap-reader.ts:104-107` depends on it. Named by the implementer.
- **L3:** A corrupt `data/published.json` gives the generic 503 only when a list is also missing (`lib/roadmap-reader.ts:128-131`). True but not specific. Rare dev state.

## Scope and goal

- Goal alignment: yes. The change fixes the false "queued" text and adds the asked kind. No side-quest.
- Design alignment: the issue left the "lost vs queued" signal open (#127 removed the crawl status read). The `published.json` signal is a cheap, true signal for the shipped case. It is a clear choice, and the limit is in a `shortcut:` comment.
- Gold-plating: none found. The Worker body guard is needed for the `SyntaxError` rule to stay true.
- Deleted tests: none. One `rm` line in `tests/roadmaps-route.test.ts` moved into a variable, same check.

## Fix here vs follow-up

```
M1 log/name the university  -> fix here (one condition), else follow-up issue
M2 record limits on #151     -> do before close (comment + 1 follow-up issue)
J1 per-university failure    -> no action (design change, out of scope)
J2 legend text               -> no action
L1-L3                        -> optional follow-up
```
