# user_advocate review — ticket-show-the-full-mscs-seattle-prerequisite-graph-8e4a497f

Verdict: **PASS** (no high findings; prior UA-1 is closed live)

Goal: a student opening Prerequisite Graph should see the full official MSCS Seattle program.
Reviewed state: branch `fix/complete-prereq-graph`, HEAD `2fd63b5`. Reviewer is not the
implementer. No product file was modified. The only file written is this artifact.

`cursor-ide-browser` did not work in this session (`browser_tabs` created a `viewId` that
died before navigation; `browser_navigate` returned "No browser tab available" / "Browser
view not found" on every retry). Live evidence is Chrome 152 over DevTools Protocol against
`http://localhost:3000` (driver kept outside the repo at `%TEMP%\ua-live-r2\`). Every number
below is `getComputedStyle` × viewport `scale` on `.graph-course-node.graph-compact
.graph-node-main strong`, plus screenshots `01`–`09` in that folder.

## How this was exercised — live

| Step | What happened |
| --- | --- |
| Default `/map` at 1680×1100 | Heading `Entire MSCS Seattle program` · status `114 courses · 80 links`. Viewport `translate(28px, 20px) scale(1)`. Course-code text **15.2 CSS px** (computed 15.2 × scale 1). `CS 5800` ✓ `CS 5100` ✓ `CS 5004` ✓ `CS 1800` absent. MiniMap present and in the pane (`200×150` at y=907, inViewport true). `01-default-map.png`. |
| Default `/map` at 1366×768 | Same status, same `scale(1)`, same **15.2 CSS px** on `CS 5010`. `CS 5800`/`CS 5100` still in the first row and readable. MiniMap clipped (`bottom` 833.8 vs window 768). `08-default-1366.png`. |
| Fit to view | 1680: scale 0.691 → **10.5 CSS px**, all 114 compact nodes in the DOM, codes still readable (`02-fit-to-view.png`). 1366: scale 0.478 → **7.26 CSS px**, a true thumbnail (`09-fit-1366.png`). Default zoom is no longer crushed. |
| Search `CS 5500` then Immediate neighborhood | Result click kept program scope (`114 courses · 80 links`, inspector `CS 5500`). Show → Immediate neighborhood: heading `Focused on CS 5500` · `4 courses · 5 links`; node ids exactly `CS 5010`, `CS 5004`, `CS 5500`, `CS 6510`. `03-neighborhood-5500.png`. |
| Search `CS 2500` from program view | Result copy: `not on this view — opens neighborhood`. After click the map changed: `Focused on CS 2500` · `3 courses · 3 links`, nodes `CS 2500`/`CS 2100`/`CY 2550`, inspector `CS 2500`. Not inspector-only. `04-search-cs2500.png`. |
| `CS 6140` details | Inspector: `(CS 5800 (minimum grade C-) OR CS 7800 (minimum grade C-))`. Dialog: `grade ≥ C-` on both leaves, catalog wording `minimum grade of C-`, eligibility line uses `C-`. No stray unknown hyphen. `05-cs6140-details.png`. |
| `/courses?q=CS 5004` | Status `2 courses`; first card is `CS 5004` Object-Oriented Design. `06-courses-cs5004.png`. |
| `/courses?q=CS 1800` | Status `0 courses`. Empty title `CS 1800 is not in this catalog.` Body explains official MSCS Seattle + named prerequisites; **does not** say "try fewer filters" (`fewer: false`). `07-courses-cs1800.png`. |

## Acceptance criteria — live results

| # | Criterion | Live result |
| --- | --- | --- |
| 1 | `/map` default shows every official core/breadth/elective incl. `CS 5800` and `CS 5100` | **met.** Status is 114/80; both isolated cores are in the first row at readable 15.2px. Fit-to-view at 1680 brings the remaining official + direct-external chips on screen without returning to ~2px. |
| 2 | Direct externals like `CS 5004` visible; `CS 1800` not in snapshot | **met.** `CS 5004` is a default-map node (and a Course Explorer hit). `CS 1800` is absent from the map DOM and from `/courses`. |
| 3 | Immediate neighborhood of `CS 5500` stays local | **met.** Exactly the four expected courses. |
| 4 | `C-` parses correctly (`CS 6140` details) | **met** in inspector, catalog wording, grade chips, and eligibility copy. |

## Prior high finding (UA-1) — closed

Round-1 UA-1 measured course codes at **1.62–2.64 CSS px** because `fitView` scaled a 6-row strip to the pane width. Live at `2fd63b5` the default viewport is `scale(1)` (`components/course-graph.tsx:180-184`, `READABLE_ZOOM = 1`). Compact code font is `0.95rem` → **15.2px** on both 1366×768 and 1680×1100. That is larger than body text and is not a thumbnail. The student can read `CS 5800` / `CS 5100` on first paint. MiniMap exists. This seat's blocking job-to-be-done failure is gone.

## Findings

None at `high` or `medium`.

`ack_zero_findings_reason`: Live re-measure closed UA-1 (default `.graph-node-main strong` is 15.2 CSS px at scale 1, not ~2px). The four acceptance flows and the CS 2500 / Course Explorer recoveries all completed without a silent failure, a trap, or a misleading empty state. Remaining interaction-design defects (pointer-only nodes, MiniMap clipped on a 13″ laptop, dead emphasize CSS) are owned by the paired `uiux` artifact and do not stop a mouse user from seeing the official program, focusing a neighborhood, or finding `CS 5004`.

### Live nits (not scored as findings; do not reopen UA-1)

- **Fit to view on a 13″ laptop** still shrinks codes to 7.26px (`09-fit-1366.png`). That control is now a deliberate overview, not the default. Table remains the readable full-list surface.
- **MiniMap / canvas hint sit below the fold at 1366×768** (minimap `bottom` 833.8 vs window 768; hint y=848.8). Confirms uiux F6 live; "Fit to view" in the header still works.
- **`CS 5500` inspector still prints `CS 5010 OR CS 5010`** (catalog wording, previously UA-7). Not caused by this round; visible but not blocking.
- Keyboard node traversal was not re-run; uiux F2 already covers `nodesFocusable={false}`.

## Discoverability / errors / anti-patterns

- **Discoverability:** Prerequisite Graph is in the left nav; the page heading names MSCS Seattle; the panel says `Entire MSCS Seattle program` and `114 courses`. Course Explorer now discloses the same scope. Search results tell you when a hit is off the current view.
- **Error messages:** `/courses?q=CS 1800` names the code and the catalog boundary. Graph search with no hits says "Try another code or title." Recovery is obvious.
- **Anti-patterns checked:** the previous silent CS 2500 search is gone; the previous "try fewer filters" lie is gone; default zoom no longer silently renders an unreadable map. No blocking prompt, no irreversible action, no data loss.

## Problem solved?

Yes, for a student who opens Prerequisite Graph to see the official MSCS Seattle program. They get a readable default grid that includes the isolated cores, a MiniMap (on a desktop pane), Fit to view / Table for the rest, a local CS 5500 neighborhood, honest explorer search for `CS 5004`, and an honest miss for `CS 1800`. Grade floors with `C-` reach the details dialog.

## Shneiderman (brief; visual/a11y detail in `artifacts/review-uiux-…md`)

1. **Consistency** — Map, table, inspector, and explorer now share "MSCS Seattle" / official-program language. Map-click vs table-click still differ (uiux F10).
2. **Shortcuts** — Graph search, Show select, header Fit to view, skip-to-inspector. MiniMap is the overview shortcut but is clipped on a 13″ laptop.
3. **Informative feedback** — `role="status"` count, `Focused on {code}`, and the off-map search suffix are live and accurate. Chain-emphasis CSS is still empty (uiux F1); not re-litigated here.
4. **Closure** — Neighborhood ↔ Entire program, details dialog, Add to Plan all terminate cleanly.
5. **Simple error handling** — CS 1800 empty state is the model: name the miss, explain why, offer reset.
6. **Easy reversal** — Show entire program from the inspector; scope select; nothing destructive. Viewport pan is reset on remount (uiux F8).
7. **Internal locus of control** — Off-map search discloses the neighborhood switch before the click. No modal trap.
8. **Reduced memory load** — Inspector keeps the selected course's rules while the map is a code grid. Compact mode hides titles (uiux note); search and inspector compensate.

**Clarity / hierarchy / accessibility:** first-paint codes are readable (the job). Hierarchy inside the canvas is still a type/code grid rather than a prerequisite layering (uiux F4). Keyboard access to nodes is a uiux high, not re-scored here.

## Not done by this review

- No NVDA/JAWS session; no touch/mobile viewport below 1366.
- Did not re-run scraper tests or official-page fidelity — phase 1 covered those; live UI did not contradict them.
- `ycm-harness review *` was not run. No harness review JSON was written.
