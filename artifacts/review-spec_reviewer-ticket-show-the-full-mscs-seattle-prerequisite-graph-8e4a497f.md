# Spec review — ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f

- **Reviewer role:** spec_reviewer (independent; not the implementer)
- **Repo:** `C:\Users\user\Desktop\github\CoursesPlanner`
- **Reviewed state:** `fix/complete-prereq-graph` @ `6caccf16eea121ad721bf38a0df6fcdd8e61c0a3`
- **Ticket status when reviewed:** `in_review`, `code_changed: true`
- **Verdict:** **PASS** (4/4 acceptance criteria met)
- **Product files modified by me:** none. Only this artifact was overwritten.

No `design.md` / `implementation-plan.md` / `prd.md` exists under the goal directory. Alignment is judged against `.ycm-harness/state.json` goal text plus the four ticket acceptance criteria.

HEAD after the original listed-set work also includes later review-driven commits (`51ffb41` packing/zoom, `6b0961c` explorer search, `6273251` chain emphasis). Those do not change default-map membership.

## Execution evidence I ran myself

| Command / probe | Result |
| --- | --- |
| `git rev-parse HEAD` | `6caccf16eea121ad721bf38a0df6fcdd8e61c0a3` |
| `npm test` | `tests 39 / pass 39 / fail 0 / todo 0`, ~1.23 s. Includes `tests/graph.test.ts` (3 cases) and `parses letter-grade floors that include a trailing minus`. |
| `npm run typecheck` (`tsc --noEmit`) | Exit 0, no diagnostics. |
| Cached official HTML `data/raw/mscs-sea-program.html` `#programrequirementstextcontainer td.codecol a.code` vs `listedProgramCodes(parseProgramRequirements(...))` | 96 unique codes; both set-differences empty. |
| Live official page fetched 2026-09-12 (`catalog.northeastern.edu/.../computer-science-mscs-sea/#programrequirementstext`) | Same 96 codes as the cached HTML listed set (core `CS 5010`/`CS 5011`/`CS 5800`, breadth including `CS 5100`, electives including `CY` / `DADS 7305` / `DS 5110` / `DS 5230`). Live-vs-listed differences: empty. Live codes missing from default map: empty. |
| Recompute on published catalog (`lib/catalog.ts` default path = `data/catalogs/neu-mscs-seattle/catalog.json`) | 142 catalog courses; 96 listed program codes; **114 default-map nodes**; `listedMissingCatalog: []`; `listedMissingMap: []`. SHA-256 of `data/catalog.json` equals per-id snapshot (`1addb33a…`). |
| Isolated-course audit | `CS 5800` `prerequisites.type === "none"`, `prerequisiteCodes: []`, on default map. `CS 5100` same. |
| External / undergraduate audit | `CS 5004` present, `requirementType: "external"`, on default map; `CS 5500.prerequisiteCodes` includes `CS 5004`. `"code": "CS 1800"` absent from `data/catalog.json`. |
| `neighborhoodDistances("CS 5500", relations, 1)` on published snapshot | `["CS 5004", "CS 5010", "CS 5500", "CS 6510"]` — 4 nodes. `CS 5800` not in that set; still in program scope. |
| Grade-floor walk of every `minimumGrade` in published snapshot | Observed: `C-` 62, `D-` 28, `C` 23, `D` 2, `B-` 2, `C+` 1. Hyphen-only tokens: none. Unknown leaves whose text mixes `minimum grade` with a leftover hyphen: none. |
| `parseRequirement("CS 5800 with a minimum grade of C- or …")` | `{ type: "any", items: [{ code: "CS 5800", minimumGrade: "C-" }, { code: "CS 7800", minimumGrade: "C-" }] }` |
| Diff audit of `tests/` since `cc7993e` | `tests/graph.test.ts` new (+61); `tests/scraper.test.ts` +29. **Zero test deletions.** |
| `TODO\|FIXME\|HACK\|XXX` scan of `lib/graph.ts`, `scraper/parser.ts`, `components/course-graph.tsx` | No matches. |

## Per-criterion map

| # | Acceptance criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Opening `/map` without changing filters shows every core, breadth, and elective course listed on the official MSCS Seattle program requirements page as a node, including `CS 5800` and `CS 5100` which have no parsed prerequisites | **met** | Route `app/map/page.tsx:8-9` mounts `CourseGraph`. Default scope is `"program"` (`components/course-graph.tsx:87`) → `visibleGraphDistances` (`:95-97`) → `programMapCodes` (`lib/graph.ts:15-27`) seeded from `listedProgramCodes` (`:5-13` = core ∪ electives ∪ breadth category courses), not a BFS from the focus course. Program nodes are `visible.keys()` (`components/course-graph.tsx:107-110`). Recomputed: all 96 official listed codes (cached HTML ≡ live page ≡ published `requirements`) are default-map nodes; `CS 5800` / `CS 5100` have `prerequisites.type === "none"` (`data/catalog.json:1324-1336`, `:751-764`). Guarded by `tests/graph.test.ts:30-41` and `tests/scraper.test.ts:128-129`, both passing in the run above. |
| 2 | Direct external prerequisites of those program courses, such as `CS 5004` for `CS 5500`, remain visible. Unrelated undergraduate CS listings such as `CS 1800` are not in the published catalog snapshot | **met** | `lib/graph.ts:22-25` re-admits each listed course's `prerequisiteCodes` / `corequisiteCodes` when those codes exist in the catalog. `scraper/parser.ts:492-513` publishes listed courses plus their requirement closure, so bulk CS listings never enter. Snapshot: `CS 5004` present and on the default map (`data/catalog.json:574-577`); `CS 5500` names it (`:1164-1166`); grep for `"code": "CS 1800"` in `data/catalog.json` is empty. Asserted at `tests/graph.test.ts:39-40` and `tests/scraper.test.ts:130-131`. |
| 3 | The Show control still offers Immediate neighborhood and that view of `CS 5500` stays a local neighborhood rather than replacing the entire-program default | **met** | Control retains `<option value="1">Immediate neighborhood</option>` (`components/course-graph.tsx:167-173`). Non-program scopes call `neighborhoodDistances` (`lib/graph.ts:104-105`) and use focus layout / `fitView` (`components/course-graph.tsx:111-126`, `:182`). Default state remains `"program"` (`:87`); neighborhood is opt-in. Chain-emphasis (`upstream`/`downstream` styling at `:93-94`, `:102`, `:128-131`) does not add nodes. Measured: immediate `CS 5500` = 4 local nodes; `CS 5800` is not among them. `tests/graph.test.ts:44-54` asserts the exact local set and that program scope still keeps the isolated cores. |
| 4 | Grade floors such as `C-` parse as `minimumGrade` `C-` rather than an unknown hyphen token; `npm test` and `npm run typecheck` pass | **met** | `scraper/parser.ts:63-67`: pattern `([A-Z](?:[+\u2212\u2013-])?)` plus Unicode-minus/en-dash normalization to ASCII `-`. Published `CS 6140` is `{ type: "any", items: [{ code: "CS 5800", minimumGrade: "C-" }, { code: "CS 7800", minimumGrade: "C-" }] }` (`data/catalog.json:1515-1528`). Snapshot grade set contains `C-` / `D-` / `B-` and no hyphen-only token. Unit test `tests/scraper.test.ts:84-91` plus the structural `CS 6140` assertion at `:72-78`. Both gates run by me: 39/39 pass, `tsc --noEmit` exit 0. |

Note on criterion 4: some courses still carry an `unknown` leaf whose text is a non-course clause such as `Graduate` (example: `CS 5400` uncertainties at `data/catalog.json:1125-1127`, beside a correctly parsed `minimumGrade`). That is the pre-existing unknown-clause design, not a residual hyphen-token defect. A full-tree walk found zero unknown leaves whose text mixes `minimum grade` with a leftover hyphen.

## Design alignment

The change matches the goal in `.ycm-harness/state.json`: default map membership is the official listed set, not reachability from one focus course, so isolated program courses are not dropped. Publishing a program-scoped catalog snapshot is required by criterion 2's wording that `CS 1800` "is not in the published catalog snapshot". Those files hash-match the per-id copies under `data/catalogs/neu-mscs-seattle/`, which is what `lib/catalog.ts:220-226` actually serves.

HEAD `6273251` (selected-chain emphasis, keyboard-reachable node main button, inspector focus after search) does not fork the listed-set design. It adds presentation and focus behavior on top of the same `visibleGraphDistances` membership.

## Honest done-state

- No TODOs in the ticket's key files.
- No mocked graph or parser behavior in the new tests; they parse cached official HTML.
- No tests deleted or weakened; `tests/graph.test.ts` is new.
- Graph unit tests rebuild from `cs.html` only (`tests/graph.test.ts:23-26`), so non-CS listed courses are placeholders in that fixture graph. The **published** snapshot (what `/map` loads) contains real `CY` / `DADS` / `DS` records. I did not treat the CS-only fixture as proof of the published node set; the published-catalog recomputation and live-page 96≡96 check above are the execution evidence for "every listed course".

## Scope

**Required work is present.** Extra work nobody listed in the four criteria:

- `app/courses/page.tsx` Explorer now shows external/locked courses when a search string is present (`:38`) and gained code-aware empty copy (`:59-61`, `:85`). Outside the ticket's key-file list.
- Canvas packing / default zoom / MiniMap (`lib/graph.ts:108-118`, `components/course-graph.tsx:20-22`, `:176-203`) — review-driven readability work. Not required by the written criteria; it does not contradict them.
- Selected-chain emphasis and post-search inspector focus (`components/course-graph.tsx:93-94`, `:102`, `:140-152`, `:222`; `app/globals.css:376`) — review-driven; does not change default or neighborhood node sets.

## Findings

### medium

1. **Unrequested Course Explorer behavior ships unverified.** `app/courses/page.tsx:38` (`if (course.requirementType === "external" && !normalized) return false`), `:59-61`, `:63`, `:85`. External courses now appear in Explorer results whenever a search string is present, and the empty state gained `looksLikeCode` / `knownCode` copy. No test covers the new predicate or the changed filter branch. Defensible as a mitigation for the pruned snapshot, but it is extra behavior this ticket's acceptance text does not ask for.

### low

2. **Pipeline closure is transitive; default map closure is direct.** `scraper/parser.ts:495-508` grows a `while (growing)` dependency closure; `lib/graph.ts:22-25` admits only direct dependencies of listed courses. Measured on the shipped snapshot: 142 catalog courses vs 114 default-map nodes. The 28 second-hop entries (`CS 2000`, `CS 2500`, `CS 5001`, `CS 5002`, `CS 5003`, `CS 5005`, …) are in the published catalog and searchable, but never default-map nodes. Criterion 2 requires *direct* externals such as `CS 5004` to remain visible and `CS 1800` to stay out; both hold. The dual rule is undocumented and untested as a distinction.

3. **Graph tests do not pin the published snapshot's full listed set.** `tests/graph.test.ts:30-41` samples `CS 5010/5011/5800/5100/5500/5004` and `visible.size >= core + 20`. It does not `assert` all 96 listed codes against `data/catalog.json`. Product behavior meets criterion 1 (recomputed above against cached HTML, live page, and published snapshot); the automated lock is weaker than the criterion.

4. **Grade-floor regex accepts any capital letter.** `scraper/parser.ts:63`: `([A-Z](?:[+\u2212\u2013-])?)`. A malformed source such as "minimum grade of Z-" would be recorded as a grade rather than unknown. Current snapshot values are exactly `B- C C+ C- D D-`, so criterion 4 is not violated.

## Limits of this review

I verified criterion 1 and 3 at module level against the published snapshot the app serves, confirmed the live official page's 96 listed codes match that set, and read the default state plus Show-control markup in `components/course-graph.tsx`. I did **not** screenshot the rendered React Flow node list in a browser in this pass. Node *membership* is proven by the same functions the page calls; on-screen readability of 114 compact nodes is a UI/UX concern, not an unmet written criterion.

No numeric score assigned. No `ycm-harness review *` command run. No harness review JSON written.
