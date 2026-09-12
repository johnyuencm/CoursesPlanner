# project_manager review — ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f

Verdict: **PASS** (no high findings)

Goal: Complete MSCS Seattle prerequisite graph.
Reviewed state: branch `fix/complete-prereq-graph` (`git diff master...HEAD`), commits
`c2adbe1`, `7e1a9b8`, `bf4e78e`, `b523ef0`, `9ecd96e`.
Reviewer is not the implementer. No product files were modified by this review.

## Evidence commands run by the reviewer

| Command | Result |
| --- | --- |
| `npm test` | 38 pass / 0 fail (duration 1714 ms) |
| `npm run typecheck` (`tsc --noEmit`) | clean, no output |
| `npx tsx` recomputation of the component's default scope via `visibleGraphDistances("program", …)` on published `data/catalog.json` | `114` nodes, `80` links; `CS 5800` ✓, `CS 5100` ✓, `CS 5004` ✓, `CS 1800` ✗; zero listed program codes missing |
| `neighborhoodDistances("CS 5500", relations, 1)` | `["CS 5004","CS 5010","CS 5500","CS 6510"]` (4 nodes) |
| Raw-page cross-check of `data/raw/mscs-sea-program.html` against `data/requirements.json` | 96 course codes on the page, 96 listed; `pageCodesNotInListed: (none)`, `listedNotOnPage: (none)` |
| Published snapshot audit of `data/catalog.json` | 142 courses = 96 program (`requirementType !== external`) + 46 external closure; `minimumGrade` values observed: `B- C C+ C- D D-`; no `-`-only grade token |
| Program-course link-gap audit (prerequisite text mentions a code that produced no edge) | 0 program courses |

The independent node/link recomputation mirrors the component exactly: node set is
`visible` (`components/course-graph.tsx:62-65`) and edges are
`relations.filter(visible.has(source) && visible.has(target))`
(`components/course-graph.tsx:89`). So `114 courses · 80 links` rendered in the panel
heading (`components/course-graph.tsx:104`) is reproduced, not taken on trust.

## Per-criterion map

| # | Acceptance criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `/map` with untouched filters shows every core, breadth, and elective course on the official page, including `CS 5800` and `CS 5100` | **met** | Default scope is `program` (`components/course-graph.tsx:54`) resolving through `visibleGraphDistances` → `programMapCodes` (`lib/graph.ts:98-105`, `lib/graph.ts:14-26`). Recomputed default map = 114 nodes with `listedMissing: []` across all 96 page codes; `CS 5800` and `CS 5100` present. Page fidelity confirmed: page 96 codes ≡ `requirements.json` 96 codes. Isolation of `CS 5800`/`CS 5100` is genuine, not a parse gap — their prerequisite text in `data/raw/cs.html` is empty upstream of parsing (`prerequisiteText: ""`, `prerequisiteCodes: []`), and the catalog source contains no prerequisite sentence for either. Regression-locked by `tests/graph.test.ts:28-40` and `tests/scraper.test.ts:128-131`. |
| 2 | Direct external prerequisites such as `CS 5004` for `CS 5500` stay visible; `CS 1800` is not in the published snapshot | **met** | `programMapCodes` adds each listed course's direct prerequisites/corequisites present in the catalog (`lib/graph.ts:19-24`); recomputed map contains `CS 5004` and excludes `CS 1800`. `buildCourseGraph` now keeps only the listed set plus its requirement closure (`scraper/parser.ts:484-512`), so the snapshot is 142 courses (was ~17k lines of bulk CS listings). `CS 5500` retains both parsed prerequisites (`CS 5004`, `CS 5010`). Locked by `tests/scraper.test.ts:128-137`. |
| 3 | The Show control still offers Immediate neighborhood and that view of `CS 5500` stays local rather than replacing the entire-program default | **met** | `Show` select still exposes `Entire program`, `Immediate neighborhood`, `Two connections away`, `Full connected component` (`components/course-graph.tsx:104`); default stays `program`. Immediate neighborhood of `CS 5500` recomputed to exactly 4 local nodes while the program scope simultaneously retains `CS 5800`/`CS 5100`, proving the two scopes are independent (`tests/graph.test.ts:42-52`). See finding PM-2 on the UI path to that view. |
| 4 | Grade floors such as `C-` parse as `minimumGrade C-`, not an unknown hyphen token; `npm test` and `npm run typecheck` pass | **met** | Tokenizer now accepts a trailing ASCII/Unicode minus and normalizes it (`scraper/parser.ts:63-67`). `CS 6140` in the published catalog is `{"type":"any","items":[{"code":"CS 5800","minimumGrade":"C-"},{"code":"CS 7800","minimumGrade":"C-"}]}`. No `minimumGrade` in the snapshot is a bare `-`; observed values are `B- C C+ C- D D-`. Zero program courses whose prerequisite text shows a dashed grade but parsed without one. `npm test` 38/38 pass and `tsc --noEmit` clean, both run by this reviewer on the submitted state. Locked by `tests/scraper.test.ts:72-92`. |

## Design alignment

The change follows the agreed direction rather than forking it: graph traversal was
extracted from the component into `lib/graph.ts` and is now shared by the UI and by the
scraper's listed-code derivation (`scraper/parser.ts:2`, `scraper/parser.ts:492`), so the
published snapshot and the default map are computed from one definition of "listed
program course". No parallel or duplicated course-list constant was introduced.

## Goal alignment

The user's complaint was that the graph was incomplete versus the official program page.
The default view now covers 100% of the 96 page-listed courses instead of a one-course
neighborhood, which is the cheapest change that answers the complaint — it reuses the
existing `requirements.json` listing instead of adding a new curated list to maintain.
No side-quests: the CSS, README, and checklist edits are all in service of the same
change, and the `.gitignore`/`AGENTS.md` commit is tool bookkeeping.

## Scope honesty

- No tests deleted or weakened: `git diff --numstat -- tests/` is `53/0` and `29/0`
  (additions only).
- No `TODO`/`FIXME`/`HACK`/"not implemented" markers added anywhere in the `.ts`/`.tsx`
  diff.
- No mocked or stubbed behavior standing in for the graph: external placeholders
  (`scraper/parser.ts:483`) are an explicit, pre-existing, labeled node type
  ("Locked / external", `components/course-graph.tsx:83`), not a fake of program data.
- 4 listed courses keep an `unknown` prerequisite expression (`CS 5310`, `CS 5330`,
  `CS 5400`, `CY 5210`). This is honest, not hidden: those clauses name no course code, so
  no edge is being silently dropped, and the existing audit-blocker test still treats
  unknown syntax as a blocker.

## Findings

### PM-1 (medium) — narrowed catalog scope is only disclosed on the graph page

`scraper/parser.ts:484-512` shrinks the published snapshot from the full bulk CS listing
to 142 courses. This is explicitly authorized by criterion 2, but the user-facing copy was
updated only for the graph: `components/course-graph.tsx:102`,
`components/course-graph.tsx:106`, and `README.md:11`. The course explorer and its search
carry no statement that the catalog now covers the MSCS Seattle program plus its
prerequisite closure, so a search for a non-program listing (for example `CS 1800`) now
returns an unexplained empty result rather than "outside this program's catalog". Scope
reduction is correct; the disclosure is incomplete outside `/map`.

### PM-2 (low) — criterion 3's `CS 5500` case is proven at the function level, not from the UI default

The default focus moved from `CS 5500` to `CS 5010` (`components/course-graph.tsx:52-53`).
Choosing `Immediate neighborhood` straight from a fresh `/map` therefore renders
`CS 5010`'s neighborhood; reaching `CS 5500`'s local view requires focusing `CS 5500`
first, via graph search or the inspector's "Show neighborhood" button
(`components/course-graph.tsx:105`). The 4-node `CS 5500` neighborhood itself is proven
(`tests/graph.test.ts:48`), so the criterion holds, but the manual path has one more step
than the criterion's wording implies.

### PM-3 (low) — "Full connected component" is not a superset of "Entire program"

`lib/graph.ts:101-105` falls back to `neighborhoodDistances` from the focus for the `full`
scope, so isolated official courses such as `CS 5800` and `CS 5100` vanish on any scope
other than `program`. That is the intended semantics, but the label reads like the widest
view available and is now the narrower one for isolated nodes.

### PM-4 (low) — grade regex lost its word-boundary anchor

`scraper/parser.ts:63` replaced `([A-Z][+-]?)\b` with `([A-Z](?:[+\u2212\u2013-])?)`. Any
capital letter followed by a sign now matches without requiring a token boundary. The
cached source only contains `D-`, `C`, `C-`, `B-`, `D`, and `S`, so there is no current
mis-parse, but a future "minimum grade of Satisfactory" would silently capture `S` and
leave `atisfactory` in the stream.

### PM-5 (low) — tree not clean at review time

`.ycm-harness/state.json` and `.ycm-harness/events.jsonl` are modified in the working
tree. Harness bookkeeping only; no product file is dirty, so the reviewed diff is the
submitted diff.

## Deferrals and risk surface

- Deferred: enumerating open-ended elective language. Not actually needed — the page lists
  all 96 electives/breadth/core courses explicitly, and `requirements.uncertainties` still
  names offering data as unknown.
- Risk: 28 of the 142 snapshot courses are transitive-only external prerequisites that
  never appear on the default map (114 of 142). Not an acceptance criterion, and they
  remain reachable in course details and the neighborhood scopes.
- Risk: the snapshot is now derived from the listed set, so a future page change that adds
  a course requires a refresh to make it appear. The refresh path is covered by the
  existing offline-refresh test.
