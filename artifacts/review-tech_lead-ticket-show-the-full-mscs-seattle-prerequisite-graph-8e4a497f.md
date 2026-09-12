# tech_lead review — ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f

Verdict: **PASS** (no high findings)

Goal: Complete MSCS Seattle prerequisite graph.
Reviewed state: branch `fix/complete-prereq-graph` vs `master` (`git diff master...HEAD`),
commits `c2adbe1`, `7e1a9b8`, `bf4e78e`, `b523ef0`, `9ecd96e`.
Reviewer is not the implementer. No product file was modified by this review; the only
file written is this artifact.

## Evidence I ran myself

| Command / check | Result |
| --- | --- |
| `npm test` | 38 pass / 0 fail / 0 skipped / 0 todo |
| `npm run typecheck` (`tsc --noEmit`) | clean, no output |
| Recompute default scope `programMapCodes(catalog.courses, requirements)` on published `data/catalog.json` | 114 nodes; `listedMissing: []` over all 96 listed codes; `CS 5800` ✓ `CS 5100` ✓ `CS 5004` ✓ `CS 1800` ✗ |
| `visibleGraphDistances("1", "CS 5500", …)` | exactly `["CS 5004","CS 5010","CS 5500","CS 6510"]` |
| `data/raw/mscs-sea-program.html` course links vs `data/requirements.json` | 96 links, 96 listed, both set differences empty |
| Snapshot audit `data/catalog.json` | 142 courses (96 program + 46 external), 0 dangling relation endpoints; `officialUrl` is the MSCS-SEA program-requirements URL |
| Grade-floor tally, master vs HEAD | master `{D:257, C:130, B:2, S:6}` → HEAD `{D-:28, C-:62, B-:2, D:2, C:23, C+:1}`; unknown-prereq courses 163 → 33; **newly unknown in HEAD: none** |

## Acceptance criteria

1. **met.** Default scope is `program` (`components/course-graph.tsx:54`) →
   `visibleGraphDistances` → `programMapCodes` (`lib/graph.ts:94-105`, `lib/graph.ts:15-26`).
   All 96 courses linked on the cached official page render as nodes, including the
   prerequisite-less `CS 5800` and `CS 5100`. Locked by `tests/graph.test.ts:31-40`.
2. **met.** `CS 5004` is in the default map; `CS 1800` is absent from the snapshot
   (`scraper/parser.ts:492-513`, `tests/scraper.test.ts:128-137`). See TL-1 and TL-4 for how
   fragile the second half of this is.
3. **met.** `option value="1"` survives (`components/course-graph.tsx:104`) and depth-1 of
   `CS 5500` is 4 local nodes while `program` scope independently keeps the isolated cores
   (`tests/graph.test.ts:43-52`). See TL-2 for a control that regressed inside this feature.
4. **met.** `scraper/parser.ts:63-67` accepts and normalizes a trailing ASCII/Unicode minus;
   the published `CS 6140` expression is two `minimumGrade: "C-"` course items, and the
   master→HEAD tally above shows the bare-letter mis-parse is gone with no new unknowns.
   Both gates pass on the submitted state. See TL-5.

## Findings

### TL-1 (medium) — two competing definitions of "program closure"; the default map still shows nodes whose own prerequisites are missing

`scraper/parser.ts:492-507` keeps the **transitive** requirement closure of the listed set,
while `lib/graph.ts:19-24` (`programMapCodes`) admits only **direct** dependencies. The two
disagree by 28 of the 142 published courses (`CS 5001`, `CS 5002`, `CS 5003`, `CS 5005`,
`CS 2000`, `CS 2500`, `MATH 3081`, `IE 6200`, …): they ship in `data/catalog.json`, are
searchable, and can never appear in the default map.

The concrete consequence is the original complaint reproduced one level down. `CS 5004`
renders as a default-map node with `prerequisiteCodes: ["CS 5001","CS 5002"]` and
`corequisiteCodes: ["CS 5005"]`; the relationship table prints all three as chips
(`components/course-graph.tsx:104`) while none of the three has a node, and the edge filter
`visible.has(source) && visible.has(target)` drops their edges. A user reading the table sees
prerequisites the map does not draw — the shape of the bug this ticket set out to fix.
Neither closure rule is named, documented, or asserted anywhere; they are just two loops in
modules that now share `lib/graph.ts`.

### TL-2 (medium) — "Focus map here" no longer exists in two of the four Show scopes

`components/course-graph.tsx:105` gates the refocus button on `depth === "1"`:

    {depth === "1" && focusCode !== selectedCode && <button …>Focus map here</button>}

On `master` the same button was rendered whenever `focusCode !== selectedCode`, at any depth.
So in `Two connections away` and `Full connected component` — both of which are focus-relative
(`lib/graph.ts:104-105`) and both of which still print "Focused on **{focusCode}**" in the
panel heading — selecting a different node now offers no way to re-center at that scope. The
only refocus affordance left is "Show neighborhood", which force-drops the scope to `1`.
Those two options become read-only views of whatever focus was last set from depth 1.

### TL-3 (low) — graph search can select a course that has no node

`components/course-graph.tsx:102` searches all 142 catalog courses and `focus()`
(`components/course-graph.tsx:100`) never touches `depth`. From the default `program` scope,
choosing a transitive-only external (e.g. `CS 2500`) sets `selectedCode` to a course with no
node, so the crosshair result updates the inspector but visibly does nothing to the map.
Same root cause as TL-1; recoverable in one extra click, hence low.

### TL-4 (medium) — nothing bounds the snapshot against re-inflating

The unbounded `while (growing)` closure in `scraper/parser.ts:494-507` is the same mechanism
that previously dragged in the whole undergraduate CS listing. The guardrails are
`tests/scraper.test.ts:131` and `tests/graph.test.ts:39`, both of which only assert
`CS 1800 === false`, and `tests/graph.test.ts:40`, which asserts a **lower** bound
(`>= coreCourses.length + 20`). `CS 1800`'s absence is incidental, not a property of any
stated rule: it is excluded only because no listed course currently reaches `CS 3000`, whose
prerequisites name it. One catalog refresh that adds a single prerequisite edge into the
undergraduate core silently re-inflates the published snapshot with every test still green.
No assertion caps snapshot size or external-node count.

### TL-5 (low) — grade-floor regex dropped its boundary anchor

`scraper/parser.ts:63` replaced `([A-Z][+-]?)\b` with `([A-Z](?:[+\u2212\u2013-])?)` under the
`i` flag. Correct for every floor present in the fixtures (verified tally above), and the
fix itself is right — the old `\b` was what forced `C-` to degrade to `C` plus a stray hyphen
token. But with no trailing boundary, a future word-valued floor ("minimum grade of
Satisfactory") captures `S` and leaves `atisfactory` to be AND-joined as an `unknown` item.
That fails toward blocked-and-unknown rather than false-eligible, so not a blocker, and the
new test (`tests/scraper.test.ts:84`) pins the good case; nothing pins rejection of a
non-letter-grade floor.

### TL-6 (low) — append-only harness ledgers are now tracked product files

Commit `9ecd96e` tracks `.ycm-harness/state.json` and `.ycm-harness/events.jsonl`. Both are
already dirty in the working tree at review time, so every harness action from now on dirties
the product repo, and append-only JSONL will conflict on any branch merge. Product files are
clean, so the diff I reviewed is the submitted diff.

### TL-7 (low) — `topologicalRanks` degrades quietly on cycles and deep chains

`lib/graph.ts:69-91` computes longest-path depth by recursion with
`Math.max(...dependencies.map(rankOf))`. A node revisited while `visiting` returns `0`
**without** memoizing, so a cycle's layout depends on `Set` insertion order, and the
recursion is unbounded by design. No live impact: `catalogRelations` emits one edge per
corequisite pair (`lib/graph.ts:36-41`), the current data has no prerequisite cycle, and
chains are shallow. Flagged because the failure mode is a silently wrong layout, not a throw.

## Areas inspected and found clean

- **Architecture.** Extracting traversal into `lib/graph.ts` and sharing it with the scraper
  is the right direction: one definition of "listed program course"
  (`lib/graph.ts:5-12`, `scraper/parser.ts:2`), no duplicated curated course list. The new
  `scraper → lib` dependency stays safe because `lib/graph.ts` imports only `lib/types`, so
  the scraper remains runnable outside Next (proven: the graph tests execute it).
  The unresolved seam is TL-1, not the extraction.
- **Correctness / data integrity.** 0 dangling relation endpoints; `unlocks` is recomputed
  over the pruned set with all prerequisite codes guaranteed resident
  (`scraper/parser.ts:524-530`); duplicate-parse guard retained (`scraper/parser.ts:488`);
  the closure loop terminates (monotonically growing bounded set); requirement typing still
  derives from core/breadth/elective membership (`scraper/parser.ts:535-541`).
- **Tests.** Additions only, `53/0` and `29/0`; no test skipped, disabled, deleted, or
  loosened; nothing mocked in place of graph behavior. The new assertions do exercise the new
  behavior (isolated-core membership, depth-1 locality, `C-` floors) rather than restating
  implementation. Gaps are TL-4, not false greens.
- **Operations.** Rollback is a branch revert plus a snapshot regeneration; no migration, no
  persisted-state change. `parsePlan` already preserves well-formed codes that are no longer
  in the catalog, so plans referencing pruned courses degrade to unknown rather than being
  dropped. Rendering 114 nodes / 80 edges in React Flow and 114 table rows is well inside
  budget; the canvas height change (`app/globals.css:360`) is viewport-relative with a floor.
- **Security.** No new network, filesystem, process, or credential surface. `catalogOrigin`
  and its `new URL()` validation are unchanged, and the unsafe-official-link test still
  passes. The new regex is bounded and non-backtracking-hazardous (no ReDoS). No
  platform-specific path handling introduced.
- **Code health.** Net effect is positive: the component shed its inline BFS, and traversal is
  now unit-testable in isolation. TL-1 is the one place the change makes future evolution
  harder rather than easier.

## Debate round 1 — response to project_manager

Their artifact reproduces the same numbers I did independently (114 nodes / 80 links, 96≡96,
4-node `CS 5500` neighborhood, grade-floor set), and we agree on PASS with no high findings.

- **PM-1 (medium, explorer does not disclose the narrowed catalog):** concede. Real, and it is
  the same family as TL-1/TL-3 — the snapshot boundary is stated only on `/map`
  (`components/course-graph.tsx:102`, `:106`, `README.md:11`).
- **PM-4 / PM-5:** agree; same as my TL-5 / TL-6, same severity.
- **PM-2, PM-3:** agree as written, and both understate one thing: the scope-switching UI lost
  a control it had on `master`. See **TL-2** (`components/course-graph.tsx:105`) — this is new
  evidence neither of their findings covers.
- **Rebut their "Risk: 28 of the 142 … remain reachable in course details and the
  neighborhood scopes":** reachability is not the whole cost. The divergence also puts nodes
  on the default map whose printed prerequisite chips have no corresponding node or edge
  (`CS 5004` → `CS 5001`, `CS 5002`, `CS 5005`), which is the same class of incompleteness the
  ticket was filed against. I record it as **TL-1 (medium)** rather than a deferred risk.
- **Rebut their "Risk: a future page change … refresh path is covered":** the uncovered
  direction is the opposite one. A refresh that adds a prerequisite edge into the
  undergraduate core re-inflates the snapshot with every test still green, because the only
  guards are one incidental absence assertion and a lower bound. See **TL-4 (medium)**.

No unrebutted high findings from either seat. I can PASS.

## Not done by this review

- No live fetch of the catalog. Program-page fidelity was checked against the committed
  fixture `data/raw/mscs-sea-program.html`, so "matches the official page" is only as fresh as
  that snapshot.
- No browser run of `/map`. Criteria 1–3 were verified by recomputing the component's own
  `visible` set and edge filter from the published data, not by rendering the page.
