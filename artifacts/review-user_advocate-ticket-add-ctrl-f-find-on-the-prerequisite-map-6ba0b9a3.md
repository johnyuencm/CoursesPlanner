# user_advocate review — ticket-add-ctrl-f-find-on-the-prerequisite-map-6ba0b9a3

Verdict: **PASS** (no high findings; a student can locate the wanted course on `/map`)

Goal / job: Ctrl+F-style find on the prerequisite map lets a student quickly
locate a wanted course, including nodes culled by React Flow so native browser
find would miss them.
Reviewed state: branch `fix/complete-prereq-graph`, product commit `4a9be0d`
(`Add Ctrl+F course find on the prerequisite map.`). Workspace HEAD `1d0a239`
is harness ledger only. Reviewer is not the implementer. No product file was
modified. The only file written is this artifact.

`cursor-ide-browser` did not stay alive (create tab → navigate → view not
found). Live evidence is Chrome Headless over DevTools Protocol against
`http://localhost:3000/map` (driver outside the repo at
`%TEMP%\ua-live-ctrlf\`; screenshots `00`–`11`, `results.json`). Viewport
override 1680×1100. Key events used CDP `Input.dispatchKeyEvent` (real
keydown, not only React `input` events).

Interaction-design / Shneiderman checklist lives in
`artifacts/review-uiux-ticket-add-ctrl-f-find-on-the-prerequisite-map-6ba0b9a3.md`.
This seat does not restage F1–F9. Live UI did not contradict their read of
`0 of N`, two search pills, or Escape-only-on-the-field. It **did** contradict
their claim that Ctrl+F skips dialogs (uiux F4 / golden-rule note): see UA-1.

This seat did not re-run `npm test` / `npm run typecheck`.

## How this was exercised — live

| Step | What happened |
| --- | --- |
| Default `/map` | Heading **Prerequisite Graph**. Description names **Press Ctrl+F**. Find placeholder `Find a course (Ctrl+F)` with visible `Ctrl+F` kbd. Inspector CS 5010. Viewport `translate(28px, 20px) scale(1)`. **23** culled nodes in the DOM. **CS 5500 in view** (`has5500Dom: true`). **PHYS 5116 not in the DOM** (`hasPhysDom: false`, `inViewPhys: false`). Native Ctrl+F would not see PHYS. `00-default-map.png`. |
| Ctrl+F then `PHYS 5116` from that default | `keydown` Ctrl+F: `defaultPrevented: true`, focus `#graph-find`. Query locates **1 of 1**. Inspector **PHYS 5116**. Panel stays **Entire MSCS Seattle program** (114 courses, 1 arrow). Viewport `translate(414px, -1198px) scale(1)`. PHYS node in view with a ring, arrow to CS 7332. Find field still focused, match row still open. `00b-phys-from-default.png`. |
| Type `cs` | Dropdown lists matches (106). Status **`0 of 106`**. First row CS 2550 (external). Map does not pan. Find stays open. `02-type-cs.png`. |
| Enter on `cs` | Status **`1 of 106`**. Inspector **CS 2550**. Map pans to that locked/external node. Find stays open. `02b-cs-enter.png`. |
| Fit to view (still `cs`) | Transform `scale(0.174)`. All **114** nodes in the DOM. Find still **1 of 106**, list still open. `03-fit-to-view.png`. |
| `cs5500` | Auto-locate **1 of 1**. Inspector **CS 5500**. Viewport `translate(226px, 50px) scale(1)`. CS 5500 in view with ring. Find stays open. `04-cs5500.png`. |
| Enter then F3 on unique `cs5500` | Still **1 of 1**, same course, find still focused. `05` / `06`. |
| Escape | Query cleared, `#graph-find` blurred, kbd `Ctrl+F` returns. Inspector stays CS 5500. `07-escape.png`. |
| Repeat PHYS 5116 | Same pan/select as from default. `08-phys-5116.png`. |
| `zzzznope` | Status **No matches**. Copy **No matching courses. Try another code or title.** Next/prev idle. Field stays open to retype. `09-no-matches.png`. |
| Header search then Ctrl+F | Before: focus `aria-label="Search courses, topics, or keywords"`, `headerFocused: true`. After Ctrl+F: `#graph-find` focused, header not focused, `defaultPrevented: true`. Header does **not** steal the shortcut. `10-ctrl-f-from-header.png`. |
| Course details dialog then Ctrl+F | Drawer open (`<dialog open>`, `role` attribute **null**). Focus inside dialog (`<p>`). Ctrl+F: `closestRoleDialog: false`, `closestDialog: true`, **`defaultPrevented: true`**, `#graph-find` **not** focused (inert). Shortcut does nothing visible. `11-dialog-ctrl-f.png`. |

## Re-check list (requested)

| Check | Live result |
| --- | --- |
| Ctrl/Cmd+F focuses graph find (not browser find) | **met on `/map`.** Capture handler `preventDefault`s; focus `#graph-find`. Cmd not pressed on this Windows run; code also keys `metaKey` (`components/course-graph.tsx:180-186`). Headless has no find-bar chrome to photograph; the page swallows the event. |
| Typing lists matches | **met.** `cs` → 106-row list; `cs5500` / `PHYS 5116` → one highlighted row. |
| Enter / F3 next match and pans if on view | **met.** Enter from `cs` (`findIndex` -1) wraps to first hit and pans. F3 on a unique hit stays on that hit and keeps find open. |
| `cs5500` / `PHYS 5116` locates off-screen | **met.** Default culls PHYS; find pans to it at zoom 1 without leaving Entire program. `cs5500` after Fit-to-view (tiny 114-node map) zooms/pans to CS 5500. |
| Escape clears | **met.** Query empty, field blurred, kbd hint restored. Does not undo selection/pan (uiux F2/F7). |
| Find stays open for next | **met.** After PHYS, `cs5500`, Enter, and F3 the query and list remain; input stays focused. |
| Header search steals Ctrl+F? | **no.** Topbar search loses focus to `#graph-find`. |
| Dialogs still allow browser find? | **no.** See UA-1. |
| No-match recovery | **met.** Honest copy; student can edit the same field. |

## Findings

### UA-1 — medium — Course-details Ctrl+F is a dead shortcut

On `/map` with the CS 5500 details drawer open, a real Ctrl+F is
`preventDefault`ed and does **not** move focus to graph find. Live
`lastKey`: `{ prevented: true, closestRoleDialog: false, closestDialog: true }`.
The skip is `target.closest("[role='dialog']")`
(`components/course-graph.tsx:179-180`). The modal is a native `<dialog>`
with **no** `role` attribute (`components/ui.tsx:20`), so the selector never
matches. The map field is inert under `showModal()`, so the stolen shortcut
also cannot land there. Recovery: close the drawer, then Ctrl+F — or scroll
the description. Not trapped, not data loss, not the map-locate job. It
**does** break “search this syllabus with browser find,” which the ticket
asked this seat to check. uiux F4 assumed dialogs are skipped; live they are
not.

### UA-2 — low — Two-letter Enter jumps to an external isolate

Typing `cs` lists 106 courses and shows **`0 of 106`** until Enter
(`components/course-graph.tsx:240`, `257`; uiux F1). Enter then pans to
**CS 2550** (locked/external), not a core the student is likely hunting.
Keep typing `cs5500` still works (auto-locate at 4 characters,
`lib/graph.ts:280-283`). Not blocking.

No `high` findings.

## Discoverability / errors / anti-patterns

- **Discoverability:** A student who never opens source still sees Ctrl+F in
  the page description, the find placeholder, and the kbd badge. The field is
  in the first screen next to Fit to view. The larger topbar search is a
  different job (details / `/courses`) — uiux F4. Live, Ctrl+F from that
  topbar correctly retargets map find.
- **Error messages:** `zzzznope` → **No matches** plus **Try another code or
  title.** Next/prev do not fake a hit. Recovery is type something else.
- **Anti-patterns checked:** Find stays open after a hit (no silent close).
  PHYS 5116 / CS 5500 stay on Entire program (no surprise neighborhood for
  those two). Escape does not restore camera (uiux F2/F7) but does not trap.
  Header search does not steal Ctrl+F. Dialog Ctrl+F is the remaining
  silent-failure (UA-1). No blocking prompt, no data loss, no confirm-to-
  continue.

## Problem solved?

**Yes.** The original pain is that culled React Flow nodes are invisible to
browser find. Live, PHYS 5116 starts **out of the DOM** and Ctrl+F + the
code still pans it on-screen at readable zoom, with the inspector on that
course and find left open for the next query. `cs5500` works from a
Fit-to-view thumbnail as well as from a readable viewport. A student who
knows the code or title can finish the job in a few keystrokes without
reading source.

## Pairing with uiux

- Do not restage F1 (`0 of N`), F3 (combobox), F4 (two pills — except the
  live dialog contradiction in UA-1), F5–F9.
- F2 (off-map locate remounts neighborhood) did **not** fire for the ticket’s
  PHYS 5116 / CS 5500 cases; both stayed Entire program.
- Visual / golden-rule detail: `artifacts/review-uiux-ticket-add-ctrl-f-find-on-the-prerequisite-map-6ba0b9a3.md`.

## Not done by this review

- `cursor-ide-browser` was unavailable; live pass used standalone Chrome CDP,
  not the IDE tab. Headless cannot photograph a native find bar.
- No Cmd+F, mobile, NVDA/JAWS, or 1366×768 pass.
- Did not search a catalog-only course that is absent from the program map
  (uiux F2 path).
- Did not re-run `npm test` / `npm run typecheck`.
- `ycm-harness review *` was not run. No harness review JSON was written.
- Fix implementations are not proposed.
