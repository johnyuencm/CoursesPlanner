# project_manager review — skill-tree-map

Verdict: **PASS** (round 2; no high findings)

Goal: Complete MSCS Seattle prerequisite graph (still **active**). This slice is
the five skill-tree asks on `fix/complete-prereq-graph` plus follow-up `5943b04`
(keep `CS 5011` with `CS 5010`: coreq-linked, no undirected line). Not a harness
ticket close and **not** a parent-goal complete. Reviewer is **not** the
implementer (commits `bbaf742`, `d703339`, `60ec94e`, `5943b04`). The only file
written by this review is this artifact. Do **not** complete
`goal_complete-mscs-seattle-prerequisite-graph_5f65` from this pass.

No `design.md` / `implementation-plan.md` / `prd.md` under the goal directory.
Acceptance is the five user asks plus the `5943b04` follow-up. Prior ticket
`ticket-show-titles-and-real-prerequisite-arrows-6c4ad3df` required
selected-chain-only arrows; the skill-tree slice **intentionally supersedes**
that (all in-scope directed prerequisite arrows stay; selection emphasizes the
chain).

Named leftovers (prior panel + this slice) stay **out of "done"**: first-paint
camera on `CS 5010`, neighborhood / full-component wrap layout, 4-line inspector
clamp, extra "Unlinked in this catalog" band, Planned/Waived/Needs-review pills,
no new harness ticket / verify evidence for this HEAD, parent goal left active,
vertical adjacency of the 5010/5011 pair (PM-2).

## Evidence I inspected

| Check | Result |
| --- | --- |
| `git branch --show-current` | `fix/complete-prereq-graph` |
| HEAD | `5943b04` *Keep corequisite partners in the skill tree instead of the no-prereq band.* |
| Slice commits | `bbaf742` classify; `d703339` pack bands; `60ec94e` nodes / arrows / inspector; `5943b04` coreq incidence + rank share |
| `git status -sb` | tracking `origin/fix/complete-prereq-graph`; only this review + tech_lead artifact untracked |
| Tests deleted | **none**. Round-1 band tests kept; `5943b04` adds three tests (`tests/graph.test.ts:122-158`) |
| `npm test` (this review) | **50 pass / 0 fail / 0 skip / 0 todo** |
| Harness verify for HEAD | **missing** (last recorded verify is the Ctrl+F ticket). Process leftover, not product proof. |
| Live `/map` | **not done** — no browser session in this review |
| `MiniMap` / `.graph-node-tooltip` / `.react-flow__minimap` | still **gone** from `components/course-graph.tsx` and `app/globals.css` |
| Directed vs coreq edges on program membership | 53 directed on-map prereq edges; **1** catalog coreq pair (`CS 5011`→`CS 5010`) **not** in `directedPrerequisiteRelations` / not drawn |
| Layout dump (UI `typeOrder` comparator, matching `course-graph.tsx:188-189`) | tree 45 codes (was 44); `CS 5010` `{x:0,y:2048}`; `CS 5011` `{x:0,y:2688}` (Δy=640 = 5 rows); between them `CS 5004`/`CS 5800`/`CS 7800`/`CS 5600`. No-prereq band label y=2896. `classified.noPrerequisite` does **not** include `CS 5011`. Default comparator: same x, Δy=512, three cores between (`CS 5800`/`CS 7800`/`CS 5600`). |
| `TODO`/`FIXME` in `lib/` `components/` for this slice | none |

## Per-criterion map

| # | User ask | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Lines without direction were confusing → directed unlock arrows; no coreq lines | **met** | Drawn edges are `directedPrerequisiteRelations(...)` (`components/course-graph.tsx:146`, `lib/graph.ts:126-128`). Each edge has `markerEnd: MarkerType.ArrowClosed` and `ariaLabel: "${source} unlocks ${target}"` (`course-graph.tsx:222-235`). Dump: 53 directed, `pairDrawn=false` for 5010/5011. Coreqs remain inspector/table only (`:328,484-488,457`). Layout ranks use prereq edges then overlay coreq rank-share without drawing (`lib/graph.ts:183-190`). |
| 2 | Card blocking description → inspector shows catalog description; tooltips/MiniMap removed | **met** | Unchanged since `60ec94e`. Inspector `selected.description` (`course-graph.tsx:472`); 4-line clamp (`app/globals.css:404`); "Full course details" (`course-graph.tsx:492-494`). Hover tooltip DOM/CSS and `MiniMap` still absent. Node body is code/title/credits (`:68-81`). |
| 3 | Messy graph vs UI cards → compact CourseCard chrome on nodes | **met** | Unchanged. Program nodes use `graph-compact` (`course-graph.tsx:177`) and CourseCard tokens (`:69-78`, `app/globals.css:210-212,372-377`). **Not** `<CourseCard compact />`. |
| 4 | RPG skill tree lock/unlock → status pills Locked/Eligible/Completed; locked stay visible | **met** | Unchanged. `graphStatus` → `courseStatus` (`course-graph.tsx:113-116,156-157,74`). Locked is grey only (`app/globals.css:378-379`); membership is still `visible.keys()` / `layout.positions` with no lock filter. |
| 5 | Idle no-prereq courses → labeled "No prerequisite required" band; tree roots stay left | **met** | Copy is exact `PROGRAM_BAND_COPY["no-prerequisite"]` (`lib/graph.ts:114-116`). `CS 5150` still in-band; `CS 5010` still a tree root at x=0 (`tests/graph.test.ts:111-120,160-186`). `5943b04` **improves** this ask: `CS 5011` is no longer parked with startable isolates. Rank 0 column is still x=0 (`lib/graph.ts:239`). |
| 6 | Follow-up: keep `CS 5011` beside `CS 5010` (coreq linked, no undirected line) | **partial** | **Linked:** `classifyUnlinkedProgramCodes` now walks **all** in-scope relations, including coreqs (`lib/graph.ts:140-144`); layout `linked` uses `scoped` not `prereqEdges` (`:191-195`); tests lock `CS 5011` out of both bands (`tests/graph.test.ts:122-128`) and above the no-prereq label (`:130-138`). **No line:** dump `pairDrawn=false`; UI edges never receive the coreq pair (`course-graph.tsx:146`). **Beside:** only same column (`x=0` both; assert `:139`). UI dump: four cores between them; `CS 5011` is the last tree cell (y=2688) immediately above the idle band (label y=2896), not the card next to `CS 5010` (y=2048). See PM-2. |

## Goal alignment

Correct next slice, not a side-quest. Round 1 put the skill-tree chrome on `/map`
and accidentally dropped the only catalog coreq pair into the idle band. `5943b04`
is the cheap fix: treat coreq incidence as **link membership** and restore
min-rank co-column, without drawing an undirected stroke. That moves the parent
goal (readable official graph) forward. Cheaper than a new edge type or mounting
`coreq-note` on every node.

Vertical y-pinning of coreq partners was **not** taken. That would be a tighter
reading of "beside" and is named as leftover, not claimed done by the asserts
(same `x` only).

Parent goal remains incomplete for named leftovers. This pass does not close it.

## Scope honesty

- No product TODO standing in for a met criterion. No test skipped, deleted, or
  weakened. Three tests **added** in `5943b04`.
- Drawn arrows remain real `catalogRelations` minus `corequisite: true`.
- `<CourseCard>` is still **not** mounted on nodes (ask 3 chrome clone).
- Test title at `tests/graph.test.ts:130` says "beside CS 5010"; the body only
  checks `x` equality and y-above-band. That is an overclaim in the title, not a
  greenwashed adjacency test.
- Extra vs the five asks (not unmet): second band "Unlinked in this catalog";
  Planned/Waived pills; all-arrow emphasis vs selected-only.
- Neighborhood / two-away / full-component views still wrap-4
  (`course-graph.tsx:205-220`). Not claimed as the skill tree.
- First-paint still `onInit` centers `selectedCode` default `CS 5010`
  (`:121-122,428-430`) at zoom 1. Band at y=2896 is off-screen until Fit / pan.
- No harness ticket / `ticket submit` / distinct verify run for `5943b04`.
  `npm test` in this review is implementer-adjacent evidence, not kernel proof.

## Trade-offs (named)

1. All 53 on-map prerequisite arrows stay visible (light grey unless selected).
2. Inspector description is 4-line clamped; full text is the details modal.
3. Coreq pair is **linked for layout only**. No canvas stroke. Inspector still
   carries the take-together copy.
4. Coreq rank-share uses `Math.min` on both endpoints (`lib/graph.ts:185-190`),
   which can pull a later-rank partner left (synthetic test `tests/graph.test.ts:141-158`
   puts A, B, and C in one column). Seattle's only in-scope pair is already
   rank 0, so this does not collapse a 5010 unlock chain.
5. Eligible copy stays "Prerequisite eligible", not the shorter "Eligible".
6. `CS 5011` sits in the tree column but is packed as a leftover (no outgoing
   prereq children), so it lands at the bottom of rank 0 rather than on the
   `CS 5010` row.

## User impact

Visible `/map` value: skill-tree reading plus the recitation no longer labeled
like a startable elective. Students still will not see `CS 5011` as the card
immediately next to `CS 5010` without scanning down the root column.

## Risk surface

- Compact pill CSS `max-width: 58%` + ellipsis (`app/globals.css:385`) can clip
  "Prerequisite eligible" on 196px nodes (**PM-1**).
- `CS 5011` at the foot of column 0, just above the idle band, can still be
  misread as "almost an isolate" (**PM-2**).
- First-paint does not show the idle band or the 5004→5500→6510 chain without
  pan / Fit to view (prior leftover).
- No UI test that MiniMap/tooltip stay gone or that React Flow omits coreq
  edges — locked by helper + edge builder + new 5011 classification tests.
  Restoring `drawn = selectedChainRelations` would still keep `npm test` green
  (TL-2, conceded).

## Findings

### PM-1 (low) Compact eligible pill may not read as Eligible

Unchanged from round 1. `courseStatus` emits `"Prerequisite eligible"`
(`components/course-card.tsx:26`). Graph nodes put that string in `.status-pill`
with `max-width: 58%; overflow: hidden; text-overflow: ellipsis`
(`app/globals.css:385`) on a 196px compact card (`:374`). Ask 4 named Locked /
Eligible / Completed. States exist in DOM, legend, and `aria-label`; the on-node
Eligible reading may clip. Not an unmet criterion.

### PM-2 (medium) "Beside CS 5010" is same column, not adjacent cards

Follow-up `5943b04` and test title (`tests/graph.test.ts:130`) claim the
recitation stays **beside** `CS 5010`. Asserts only `positions[5011].x ===
positions[5010].x` and y above the no-prereq label (`:137-139`). UI comparator
dump: `CS 5010` y=2048, `CS 5011` y=2688, with `CS 5004`, `CS 5800`, `CS 7800`,
`CS 5600` between them. `CS 5011` has `unlocks: []` (`data/catalog.json:717`), so
the child-alignment pass never pins it to the 5010 row; leftover fill drops it
to the last tree cell (`lib/graph.ts:241-267`). Band membership is fixed (not
TL-1). Adjacent pairing is **not** done and must not be reported as done.

No high findings. Leftovers listed above are named, not claimed closed.

## Debate round 1

Independent first pass at `60ec94e`. `artifacts/review-tech_lead-skill-tree-map.md`
was not present at that writing.

## Debate round 2

Read `artifacts/review-tech_lead-skill-tree-map.md` (still a round-1 review of
`60ec94e`). New evidence: `5943b04`. No unrebutted **high** findings from either
seat.

### TL-1 (medium) — core recitation in the startable band

**Concede** as of `60ec94e`: `classifyUnlinkedProgramCodes` ignored coreq
incidence; dump put `CS 5011` at y=2808 in "No prerequisite required"; legend
copy "Startable, unlinked" (`course-graph.tsx:398`); tests did not mention
`CS 5011`.

**Follow-up fixes the stated defect.** `5943b04` walks all `relations` for
classification (`lib/graph.ts:140`) and all `scoped` for layout membership
(`:192-195`), restores min-rank co-column (`:185-190`), and adds
`tests/graph.test.ts:122-139`. This review's dump: `noPrereqHas5011=false`,
`unlinkedHas5011=false`, `CS 5011` y=2688 < band label y=2896, tree count 45
(was 44).

**Restate, narrower:** TL-1's "split the core sequence" is only partly closed.
Same column is back; adjacent placement is not (PM-2). I do not keep TL-1 as an
open band-membership miss.

### TL-2 (medium) — UI arrow/coreq/external contracts untested; PHYS vacuous

**Concede** the remaining gap. Still no test calling
`directedPrerequisiteRelations`, counting 53 in-scope arrows, or forbidding
coreq `strokeDasharray`. `PHYS 5116` is still a connected tree node
(`data/catalog.json` unlocks `CS 7332`), so
`classified.noPrerequisite.includes("PHYS 5116") === false`
(`tests/graph.test.ts:119`) still does not execute `requirementType !==
"external"` (`lib/graph.ts:151`). Restoring selected-chain-only drawing at
`course-graph.tsx:146` would still pass `npm test`.

**Partial rebut:** `5943b04` now locks `CS 5011` classification and same-column
layout (`tests/graph.test.ts:122-139`) plus synthetic rank-share (`:141-158`).
That closes the "tests never mention CS 5011" clause of TL-1/TL-2, not the
arrow-policy hole.

Not a PM high: product dump shows 53 directed edges and `pairDrawn=false`. Named
test debt, not an unmet skill-tree ask.

### TL-3 / TL-4 / TL-5 (low)

No debate. Clamp, `programFlowPositions(..., [])` footgun, and dead `openCourse`
are unchanged by `5943b04` and outside the follow-up.

Stop: both seats can PASS with no unrebutted high findings. Parent goal stays
open.
