# user_advocate review — ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f

Verdict: **FAIL** (one high finding: UA-1)

Goal: a student opening Prerequisite Graph should see the full official MSCS Seattle program.
Reviewed state: branch `fix/complete-prereq-graph`, HEAD `9ecd96e`. Product files clean at
review time (only `.ycm-harness/*` and `artifacts/` dirty). Reviewer is not the implementer.
The only file written by this review is this artifact. No product file was modified.

## How this was exercised — live, in a real browser

The Cursor IDE browser was unavailable in this session (`browser_navigate` and
`browser_tabs new` both returned "No browser tab available" / immediately-dead `viewId`, 5
attempts). Rather than review from source, I drove the running dev server with real Chrome
152 over the DevTools Protocol from a driver kept **outside** the repo
(`%TEMP%\ua-live\{cdp,map,map2,viewports,dup}.mjs`), so the repo was never touched. Every
number and quote below is read out of the live DOM at `http://localhost:3000`, not from code.
Screenshots: `%TEMP%\ua-live\01..14-*.png`.

## Acceptance criteria — live results

| # | Criterion | Live result |
| --- | --- | --- |
| 1 | `/map` with untouched filters shows every core/breadth/elective course, incl. `CS 5800`, `CS 5100` | **met in the DOM, defeated on screen.** Heading reads `Entire MSCS Seattle program · 114 courses · 80 links`; 114 `.react-flow__node` elements rendered; fetched `/api/catalog` in-page and diffed the 96 official listed codes against the rendered node ids → `missingFromMap: []`; `CS 5800` ✓ `CS 5100` ✓. But see **UA-1**: at default zoom the course codes render at **2.34 CSS px** (1.62px on a 13″ laptop). |
| 2 | Direct external prereqs such as `CS 5004` stay visible; `CS 1800` is not in the catalog | **met.** `CS 5004` is a rendered node in the default view; `CS 1800` is absent from the node set and from `/courses`. |
| 3 | Immediate neighborhood of `CS 5500` stays a local 4-course view | **met, exercised by hand.** Searched "CS 5500" in the graph search, clicked the result, `Show → Immediate neighborhood`: heading `Focused on CS 5500 · 4 courses · 5 links`, node ids exactly `["CS 5004","CS 5010","CS 5500","CS 6510"]`. (From a fresh `/map` the same control shows `CS 5010`'s 6-node neighborhood first — PM-2, confirmed live.) |
| 4 | `C-` grade floors parse correctly | **met, and visible to the user.** Opened the `CS 6140` detail dialog from the inspector: it prints "CS 5800 with a minimum grade of C- or CS 7800 with a minimum grade of C-" and the eligibility line "Requires one of the alternatives in (CS 5800 (minimum grade C-) OR CS 7800 (minimum grade C-))". No stray hyphen token anywhere in the rendered dialog. |

So the ticket's *data* problem is genuinely fixed. The finding below is about whether the
student can actually *see* the program they were promised.

## Findings

### UA-1 (high) — the default program map is unreadable at every viewport I tested; the page's primary surface is a grey smudge until the user zooms 4.7×

`components/course-graph.tsx:74` wraps the program layout at 6 rows and
`components/course-graph.tsx:83` spaces columns 230px apart, so 114 nodes lay out roughly
4,400px wide by ~890px tall. React Flow's `fitView`
(`components/course-graph.tsx:104`) then fits that to the pane's *width*, and the pane is
landscape. Measured live:

| Viewport | Pane | fitView scale | Course-code text | Node box | Canvas height unused |
| --- | --- | --- | --- | --- | --- |
| 1366×768 (13″ laptop) | 695×560 | 0.129 | **1.62 px** | 25×13 px | 80% |
| 1440×900 | 765×648 | 0.143 | **1.78 px** | 28×15 px | 81% |
| 1680×1100 | 1004×760 | 0.187 | **2.34 px** | 37×19 px | 79% |
| 1920×1080 | 1134×760 | 0.211 | **2.64 px** | 41×22 px | 76% |

Body font is 12.48px, so nothing on the map is legible at the default view — not the course
code, not the title (2.1px at 1680), not the requirement badge. `01-default-map.png` and
`13-default-1366.png` show what a student actually gets: a band of blank rectangles across
the middle of a mostly empty canvas. The map is 114 nodes only if you inspect the DOM.

Recovering costs real work, measured: clicking React Flow's zoom-in until the code text
reaches 11px took **9 clicks** (scale 0.129 → 0.966, `11-zoomed-legible.png`), and at that
zoom **30 of 114 nodes** are on screen — so the whole-program overview the ticket was filed
to deliver does not exist at any zoom level. There is no minimap
(`hasMiniMap: false`; the only controls present are Zoom In / Zoom Out / Fit View), so once
zoomed in the student is panning a 4,400px canvas with no positional cue.

Why I rank this high rather than medium: this seat's criterion is the job-to-be-done, and the
job is "see the full official MSCS Seattle program". The default state of the page's namesake
view does not deliver it on any screen I tested. It is also not a physical consequence of
114 nodes — 76–81% of the canvas height is left empty while the content is crushed to fit the
width, i.e. the illegibility comes from the fixed 6-row wrap rather than from the node count.

In fairness: the student is **not** trapped and nothing is lost. The `Table` toggle is one
click away and is the strongest thing in this change (see below), and zoom works. That is why
this is a blocking usability defect rather than a broken feature. Phase 1 could not have
caught it — both artifacts state they never rendered the page.

### UA-2 (medium) — the graph search offers a "focus the map here" affordance that silently does nothing for 28 courses

From the default `Entire program` scope I typed "CS 2500" and clicked the result row. The row
carries a `Crosshair` icon (`components/course-graph.tsx:102`), the same icon the panel uses
for "Focused on …", so it reads as "re-center the map on this". Live, after the click:
`nodeCount: 114` (unchanged), `nodeExists: false` for `CS 2500`, no `.graph-focused` element,
heading still `Entire MSCS Seattle program · 114 courses · 80 links`. Only the right-hand
inspector changed. `focus()` (`components/course-graph.tsx:100`) sets `focusCode` but never
touches `depth`, and the search pool is all 142 catalog courses while the default map can only
ever contain 114 — 28 catalog courses can never have a node there (computed live from
`/api/catalog`). The user clicked a targeting control on a map and the map did not move, with
no message explaining why. `06-search-cs2500.png`. (Same root cause as TL-3; I record it here
because I watched it silently fail, which is the part that matters at this seat.)

### UA-3 (medium) — in two of the four scopes the panel and the inspector disagree about what is focused, and there is no way to re-center

Live at `Show → Two connections away` focused on `CS 5500`, I clicked the `CS 5001` node. The
panel heading kept saying **"Focused on CS 5500 · 10 courses · 13 links"** while the inspector
heading said **"CS 5001"**. The inspector's buttons at that moment were
`["Show entire program", "Show neighborhood", "CS 5004", "Full course details"]` — no
"Focus map here", because that button is gated on `depth === "1"`
(`components/course-graph.tsx:105`). So at `Two connections away` and `Full connected
component` the only way to re-center is "Show neighborhood", which also silently drops the
scope to `1` — the user asked to move the camera and got the zoom level changed too. Two
Shneiderman violations in one control: the screen contradicts itself (feedback), and the only
available exit changes a setting the user did not ask to change (internal locus of control).
`05-depth2-refocus.png`. Confirms TL-2 from the UI.

### UA-4 (medium) — `/courses` cannot find a course the map is actively showing, and the empty state recommends recovery steps that cannot work

Live on `/courses`:

- Searching **`CS 5004`** → `0 courses`, empty state "A different search might open a door. /
  No courses match these filters. Try a broader interest, a different code, or fewer filters."
  `CS 5004` is simultaneously a visible node on the default map with a "Details" button. The
  explorer drops every external course at `app/courses/page.tsx:38`, so no combination of
  "fewer filters" will ever surface it. `09-courses-cs5004.png`.
- Searching **`CS 1800`** → the identical generic empty state. `08-courses-cs1800.png`.

The advice is actively misleading in both cases: the user is told to adjust filters when the
truth is "this course is outside the catalog this app publishes" or "this course exists but is
only reachable from the map". I also checked the whole rendered `/courses` page for any
statement of the new scope: `mentionsProgramScope: false` — the string "MSCS Seattle" appears
nowhere on the page, while `/map` states it three times. The explorer's own count is
`96 courses`, exactly the official program listing, so the scope is correct; it is just never
disclosed off `/map`. This is PM-1, confirmed live and worse than described, because the
`CS 5004` case is a course the app itself shows elsewhere.

### UA-5 (medium) — keyboard users must cross 346 tab stops to get from the map to the inspector

Counted live on the default `/map`: **451** focusable elements on the page, **426** of them
inside the map (114 nodes × "select" + "Details", plus edges). First node is tab stop 98; the
inspector begins at tab stop 444, so traversing the map costs **346** tab presses. The only
skip link is the shell's `Skip to content` (`components/app-shell.tsx:42`), which jumps *into*
main, not past the map, so there is no shortcut over the graph. Before this change the default
view was a handful of nodes; the default is now 114, so this burden is a direct consequence of
the ticket. Each node does carry a good label (`"Select CS 2550, External course (CS 2550).
Locked / external."`) and is properly tabbable — the problem is purely the absence of a way
out. Shneiderman: no shortcut for frequent users, and high short-term memory load.

### UA-6 (low) — changing the scope silently changes the map for screen-reader users

`114 courses · 80 links` lives in a plain `<span>` in `.graph-panel-heading`
(`components/course-graph.tsx:104`); it is not a live region
(`nodeCountAnnouncedInLiveRegion: false`). The only two live regions on `/map` are React
Flow's own empty announcer nodes (`aria-live="assertive"` and `role="status"`, both with
empty text, verified live). So `Show: Entire program → Immediate neighborhood` takes the view
from 114 courses to 6 with no announcement. `/courses` does this correctly — its result count
is `role="status"` (`app/courses/page.tsx:80`) — so this is an inconsistency inside the same
product, not a missing capability.

### UA-7 (low) — a newly-promoted default node prints "CS 5001 (minimum grade C-) OR CS 5001 (minimum grade C-)"

The live `CS 5004` table row reads: `((CS 5001 (minimum grade C-) OR CS 5001 (minimum grade
C-)) AND (CS 5002 (minimum grade C-) OR CS 5002 (minimum grade C-)))` — an OR between a course
and itself, which reads as nonsense to a student.

I checked whether this branch caused it, and it did not. The upstream catalog text is itself
duplicated: `prerequisiteText` is `"(CS 5001 with a minimum grade of C- or CS 5001 with a
minimum grade of C- ); …"` on **both** `master` and `HEAD`. The branch strictly improved the
rendering — on `master` each item parsed as `minimumGrade: "C"` plus a stray
`{type:"unknown",text:"-"}`, and duplicated OR groups fell from 4 (`CS 5004`, `CS 5008`) to 2
(`CS 5004` only). Recorded as low and only because this ticket newly puts `CS 5004` on the
default map, so a pre-existing data wart is now on the first screen a student sees.

### UA-8 (low) — `CS 5004`'s printed prerequisites have no node and no edge on the default map

Live table audit: **4 of 114** rows print prerequisite/corequisite chips for courses absent
from the view — `CS 5004` → `CS 5001, CS 5002, CS 5005`; `CS 3650` → `CIS 310M, CS 2510,
CS 3100, EECE 2560`; `CY 2550` → 5 chips; `DADS 7275` → 7 chips. A student reading the row
sees requirements the map does not draw, which is the same shape as the complaint this ticket
answers. I keep it low rather than medium because all four are `requirementType: "external"`
(verified live) — no official program course has a dangling chip — so the incompleteness is
confined to the external fringe. Same seam as TL-1; this is the live user-visible form of it.

## Shneiderman's eight rules + clarity, hierarchy, accessibility

1. **Consistency** — mostly good; node kinds, badges and the legend use one vocabulary across
   map, table and inspector. Two breaks: result-count announcement (UA-6) and catalog-scope
   disclosure present on `/map` but absent on `/courses` (UA-4).
2. **Shortcuts for frequent users** — weakest rule here. `Fit to view` and the scope select
   are good mouse shortcuts, but there is no keyboard way past 426 focusables (UA-5) and no
   minimap or overview affordance for a 4,400px canvas (UA-1).
3. **Informative feedback** — the panel heading, `Focused on {code}`, and the live node/link
   count are genuinely well done. Broken in the two silent cases: search that does not move
   the map (UA-2) and the heading/inspector contradiction at depth 2+ (UA-3).
4. **Closure** — satisfied for the plan flow (`Add to Plan` → picker) and for detail dialogs.
5. **Simple error handling** — the `/courses` empty state is the failure: it names recovery
   steps that cannot succeed (UA-4). No crashes, no invalid states observed.
6. **Easy reversal** — good. Every scope change is a single select away from `Entire program`,
   the inspector offers `Show entire program`, and nothing is destructive. `Show neighborhood`
   changing two things at once is the one place reversal is muddier (UA-3).
7. **Internal locus of control** — mostly respected: no blocking prompts, no modal traps, no
   confirmations to dismiss. Exception is UA-3's scope change the user did not request.
8. **Reduced short-term memory load** — the inspector tip is excellent and pre-answers the
   exact confusion this ticket creates ("Courses with no arrows still belong to the official
   program"), and the footnote states the default scope. Undercut by UA-1: a student cannot
   hold a program in their head from an illegible thumbnail.

**Clarity and visual hierarchy** — page heading, legend, panel heading and inspector form a
clear three-zone hierarchy at every viewport I rendered. The hierarchy *inside* the canvas is
what collapses (UA-1). **Accessibility** — legend conveys meaning with text next to every
swatch, never colour alone (`"Required / Breadth / Elective / Completed / Locked / external /
Prerequisite relationship"`); node aria-labels are descriptive; the `Show` select is wrapped
in a real `<label>`; the relationship table has an `sr-only` caption. Against that: 1.6–2.6px
text (UA-1), no announcement of view changes (UA-6), and the tab burden (UA-5).

## What this change gets right

- **The table view is the best answer to the ticket and it works.** At 1366×768 it renders all
  114 rows with the full AND/OR rule text, grade floors, corequisites and clickable code
  chips, in a scrollable region with an `sr-only` caption — legible, complete, keyboard- and
  screen-reader-friendly. Everything UA-1 says the map fails to deliver, the table delivers
  one click away. `14-table-1366.png`.
- **The isolated-core confusion was anticipated.** `CS 5800` and `CS 5100` render with no
  edges, and the inspector tip says outright that such courses still belong to the program.
  That is the right call and it is the sort of thing usually missed.
- **Grade floors reach the student, not just the JSON.** The `CS 6140` dialog spells out
  "minimum grade of C-" in both the rule text and the eligibility explanation (criterion 4).
- **Honest scope copy on `/map`** — heading, footnote and tip all state that the default is the
  official requirements page plus cataloged external prerequisites, and that arrows are parsed
  references rather than AND rules.
- **No footguns found.** No destructive action, no irreversible step, no blocking prompt, no
  data loss, no dead end. Plan state is untouched by this change.

## Not done by this review

- I did not exercise `Full connected component` live; I agree with PM-3 on reading the code
  but did not observe it, so do not treat that as live evidence.
- No mobile/touch viewport below 1366px wide was rendered.
- No screen reader was actually run; accessibility notes above are DOM/ARIA inspection plus
  measured geometry, not an NVDA/JAWS session.
- I did not re-verify the scraper, the tests, or the official-page fidelity — phase 1 covered
  those and live behavior did not contradict them.
