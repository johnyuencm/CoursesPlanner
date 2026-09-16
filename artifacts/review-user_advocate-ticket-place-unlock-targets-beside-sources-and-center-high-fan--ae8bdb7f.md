# user_advocate review — ticket-place-unlock-targets-beside-sources-and-center-high-fan--ae8bdb7f

Verdict: **PASS** (no high findings; the original Entire-program hunt is gone)

Goal / job: On Entire program, sit CS 6220 beside CS 5800 and CS 7800 instead of far at the top of the canvas; when many courses point at one target, seat that target in the middle with a surround-then-point bus.
Reviewed state: branch `land/local-graph-focus`. Product commit `b1825c1`. HEAD `4779f5c` is harness ledger only. Reviewer is **not** the implementer. No product file was modified. The only file written is this artifact.

Phase 1 settled PASS with no unresolved high (`artifacts/review-tech_lead-ticket-place-unlock-targets-beside-sources-and-center-high-fan--ae8bdb7f.md`, `artifacts/review-project_manager-ticket-place-unlock-targets-beside-sources-and-center-high-fan--ae8bdb7f.md`). Live `/map` matches their CS 6220 band and CS 5500 left-to-right geometry. This seat does not re-litigate layout architecture.

Live driver: `cursor-ide-browser` tab already on `http://localhost:3000/map` (viewId `8f1e86`). Show was **Entire program** (`select` value `program`). Viewport reported 1920×1080; the map pane was ~1134px wide after chrome.

## How this was exercised — live

| Step | What happened |
| --- | --- |
| Confirm Show | Combobox **Show** = **Entire program**. Status chip: Entire MSCS Seattle program. 114 courses, 79 unlock arrows. |
| Find field `CS 6220` | Find hit **CS 6220 Data Mining Techniques**. **Show flipped to This course’s full chain** (`locate` always `setDepth("course")` at `components/course-graph.tsx:356`). Inspector **Show entire program** appeared. Recovered by setting Show back to Entire program. See UA-1. |
| Restore Entire program, keep CS 6220 selected | Show = Entire program again. CS 6220 still selected. |
| Scroll `.flow-canvas` to the 5800/7800/6220 band (`scrollLeft=0`, `scrollTop≈2680`) | Three cards on one screen. CS 5800 and CS 7800 consecutive on the left; CS 6220 immediately to their right on the CS 5800 row. |
| Click **Select every visible prerequisite of CS 6220: CS 5800, CS 7800** | Bus control `[pressed]`. Line focus **CS 6220 shared prerequisite bus**. Status: `Selected CS 6220 · CS 5800, CS 7800 unlock CS 6220.` Inspector lists visible incoming CS 5800, CS 7800 and the catalog OR rule. **Exit line focus** present. |
| Exit line focus, pan to CS 5500 | CS 5010 and CS 5004 left; CS 5500 to their right; CS 6510 continues further right on the CS 5500 row. |
| Click CS 6180 incoming bus (≥5) | Line focus **CS 6180 shared prerequisite bus**. Status lists eight unlockers. Target sits at median parent Y. Parents occupy three columns; a tight surround is not possible on one screen. |

## Requested live checks

### 1. CS 6220 incoming bus on Entire program — **met**

React Flow node transforms (Entire program, live catalog):

| Course | x | y |
| --- | ---: | ---: |
| CS 5800 | 0 | 2880 |
| CS 7800 | 0 | 3040 |
| CS 6220 | 534 | 2880 |

- Sources occupy consecutive rows: `3040 − 2880 = 160` (`PROGRAM_ROW`).
- CS 6220 is to the right of both sources. Its y sits in `[2880, 3040]`.
- Canvas node y-range is `0 … 6520`. CS 6220 is **not** at the top of the map.

Painted connectors (not the old gutter-below-source long run):

- `CS 5800-CS 6220-18`: `M 226 2938.5 H 406 V 2938 H 532`
- `CS 7800-CS 6220-19`: `M 226 3098 H 406 V 2938 H 532`
- Shared bus hit path: `M 406 2938 V 3098 M 406 2938 H 532`

That is a short H-V-H: join at x=406, vertical only across the two source rows (2938–3098), then point into CS 6220. No `V 140` gutter hop and no long vertical to the top of the canvas. Screenshot of the selected bus with both sources on screen: `ua-cs6220-band-sources-visible.png`.

Selecting the bus did **not** change Show away from Entire program.

### 2. CS 6180 (≥5 incoming) — **honest limit, not an AC miss**

Eight visible parents, three source columns plus the target:

| Course | x | y |
| --- | ---: | ---: |
| CS 5180 | 0 | 0 |
| CS 5100 | 0 | 160 |
| CS 6120 | 0 | 320 |
| DADS 7275 | 0 | 1440 |
| EECE 5644 | 0 | 1600 |
| CS 6140 | 534 | 2720 |
| CS 7150 | 1068 | 1600 |
| CS 7140 | 1068 | 1760 |
| **CS 6180** | **1602** | **1440** |

Parent y spans `0 … 2720`. CS 6180’s y is the lower median of those eight rows (`ys[floor((8-1)/2)] = 1440`, same row as DADS 7275). Bus: `M 1564 140 V 2860 M 1564 1498 H 1600` — surround-then-point is present, but the vertical is 2720px. With the camera on CS 6180, only CS 7140 / CS 7150 (adjacent column) and CS 6180 stayed in the pane; CS 5180/5100/6120/6140 were off-screen. A perfect tight surround would need same-column consecutive parents. Seattle CS 6180 is not that graph. Ticket AC2 is the isolated five-source synthetic; this is the catalog case the prompt asked to report honestly.

### 3. Neighborhood of CS 5500 still left-to-right — **met**

| Course | x | y |
| --- | ---: | ---: |
| CS 5010 | 0 | 2240 |
| CS 5004 | 0 | 2560 |
| CS 5500 | 534 | 2400 |
| CS 6510 | 1068 | 2400 |

Live screenshot: CS 5010 / CS 5011 / CS 5004 on the left, CS 5400 / CS 5500 / CS 7980 in the next column, green unlock continuing right toward CS 6510 (`ua-cs5500-neighborhood-ltr.png`). Incoming 5500 bus remains `M 436 2298 V 2618 M 436 2458 H 532`.

## Shneiderman / interaction design

- **Consistency:** Entire program still uses the same cards, Show control, and shared-bus click as other scopes. Adjacent unlocks now use the same short H-V-H the neighborhood already taught (`isShortPrerequisiteSpan` vs `PROGRAM_COL` in `lib/graph.ts:236-238`, `prerequisiteConnector` `:469-472`). CS 5500 neighborhood did not flip to a new reading direction.
- **Shortcuts for frequent users:** Find (Ctrl+F), skip-to-selected-course, bus vs branch hit targets, line-focus **Exit** and Add-to-semester. No new gesture required to get the seating — it is the default Entire-program layout.
- **Informative feedback:** Status names the selected bus (`CS 5800, CS 7800 unlock CS 6220`). Inspector **CS 6220 shared prerequisite bus** repeats the two sources and the catalog OR rule. Line focus copy: “The current map stays put.”
- **Closure:** Bus select is a completed focus; **Exit line focus** and Escape (existing) close it. Show change is a completed scope change.
- **Simple error handling:** No new failure path in this ticket. Empty find still says “No matching courses. Try another code or title.” Unused this pass after a successful CS 6220 hit.
- **Easy reversal:** Exit line focus returned every visible relationship. Show → Entire program undid the Find-driven chain view.
- **Internal locus of control:** Seating is automatic (good for the original complaint). The student still chooses Entire program vs chain. Find is the weak spot: typing a code changes the map they asked to keep (UA-1).
- **Reduced short-term memory load:** CS 5800 → CS 6220 no longer requires remembering a card at the top of a ~6500px canvas. CS 6180 still asks the student to pan across three columns and 17 rows; the bus spine is a memory aid, not a cluster.
- **Clarity / hierarchy:** The 6220 band is readable at 100% zoom: two sources, one short vertical, one arrow into the target. Color still groups by destination; the inspector text states AND/OR so color is not the only channel.
- **Accessibility:** Bus control has a name that lists both sources. Status is a live region. Skip map to selected course exists (this session’s skip-link click was intercepted by page lede text in the automation viewport; panning the canvas still reached the cards). Keyboard Find works.

## Discoverability / errors / anti-patterns

- **Discoverability:** The new seating has no flag or extra control. A student who already uses **Show → Entire program** sees CS 6220 beside CS 5800/CS 7800 without reading source. The map footnote still tells them to choose Entire program. Find is labeled for jumping to a code on the current map but currently leaves Entire program (UA-1).
- **Error messages:** None added. Recovery from the Find scope change is the existing Show dropdown / **Show entire program**.
- **Anti-patterns:** No silent layout failure on the reported course. No extra confirm. Line focus is a mode with a visible Exit. Find changing Show without asking is a footgun for inspecting this layout, not a trap.

## Problem solved?

Yes. The reported Entire-program picture — CS 5800 and CS 7800 firing a long line at CS 6220 at the top of the canvas — is gone. Live, those two sources sit on consecutive rows and CS 6220 sits in that band with a short surround-then-point bus. CS 5500 still reads left-to-right. CS 6180 with eight incoming parents is seated on the median row with a surround-then-point spine, but those parents span columns `0 / 534 / 1068` and y `0 … 2720`, so a tight surround cannot appear in one viewport.

## Findings

None high or medium.

- `low` UA-1 `components/course-graph.tsx:348-356`: Map Find (`locate`) always `setDepth("course")`. Live: with Show already Entire program, filling **Find a course on the map** with `CS 6220` switched Show to **This course’s full chain**. The job this ticket fixes lives on Entire program. Recovery is one Show change (or inspector **Show entire program**). Not a trapped mode; not this ticket’s layout code. Pre-existing locate behavior that makes the new seating easy to miss if the student uses Find to check CS 6220 on the big map.

## Verdict rationale

The stated user job completed on live `/map` Entire program: CS 6220 is beside CS 5800/CS 7800; the incoming bus is short surround-then-point, not a run to the top. CS 5500 neighborhood remains LTR. CS 6180’s imperfect surround is a catalog-geometry limit, not a failed seating. Residual Find-scope change is low. High bar (cannot complete, data loss, trapped mode, inaccessible primary flow) is not met.

## Not done by this review

- Did not re-run `npm test` / `npm run typecheck` (phase-1 already did; this seat is live operator value).
- Did not re-open CS 6240’s off-band seating from the tech_lead note; live 6220/5500 checks did not contradict phase-1 PASS.
- Did not treat the Next.js hydration “Error feedback” region in the accessibility tree as a product finding (not visible on the map screenshots; `app-shell.tsx`, outside this ticket).
- Did not run `ycm-harness review *`; no harness review JSON written.
- Did not propose a fix implementation.
