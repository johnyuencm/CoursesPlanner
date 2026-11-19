---
ticket: 140
role: user_advocate
phase: 2
reviewed_head_sha: a0b581bc4d607a1b3ab222c10d9596fee9c77a33
base_sha: c87953a
date: 2026-11-19
verdict: PASS
---

# Issue #140: user advocate review (phase 2)

## Verdict

PASS. A student on a slow network now sees a calm loading state on MSCS Boston and MSCS Seattle. The "unavailable" text shows only after the request fails. Try again works. Stress-walk D1 now passes. No high findings. The medium and low findings below are older than #140, or are low cost.

## How I tested (live)

- `npm run build` (exit 0). Then `npm start` (wrangler dev, port 3000). No deploy.
- Playwright 1.63 (pre-installed), Chromium, viewports 1280x900 and 390x844.
- Programs: Boston `northeastern/computer-science-mscs-976b977119`, Seattle `northeastern/computer-science-mscs-sea-8b0d00dbda`. Page: `/<key>/planner`.
- Three network modes on `**/api/catalog**`:
  - `delay`: 2.5 s delay, then the real answer.
  - `block`: `route.abort('internetdisconnected')` (broken network).
  - `http503`: a 503 with an HTML body (broken proxy or server).
- Sampled page text and every `[role=status]`, `[role=alert]`, `[aria-live]` element at 200, 800, 1600 and 2200 ms.
- After a failure: pressed Try again once while still broken, then let the network recover and pressed Try again again.
- `curl` of the server HTML (first paint, before JS) for both programs.
- Ran `stress-walk.mjs` from the `designing-ux-mechanics` skill.
- Server stopped after the walk. Scratch files stay in the session scratchpad. No files added to the repo except this review.

```
first visit (slow network)
  SSR + JS:  "Loading the course map" (role=status)  ──2.5 s──►  semester board
                                                       └─fail──►  "did not load" card + Try again
  Try again ──► "Loading the course map" ──► board  (or the same card again)
```

## Live results

| Program | Width | Mode | Loading seen | "unavailable" during load | After |
|---|---|---|---|---|---|
| Boston | 1280 | delay | yes, 0 to 2.2 s | no | board at 2.75 s, no "unavailable" |
| Boston | 390 | delay | yes | no | board at 2.70 s |
| Seattle | 1280 | delay | yes | no | board at 2.71 s |
| Seattle | 390 | delay | yes | no | board at 2.74 s |
| Boston | 1280, 390 | block | n/a | n/a | failure card; Try again (still broken) sends 1 request, card stays; Try again (recovered) shows loading, board in 2.6 s |
| Boston | 1280, 390 | http503 | n/a | n/a | same as block |
| Seattle | 1280, 390 | block | n/a | n/a | same as Boston |
| Seattle | 1280, 390 | http503 | n/a | n/a | same as Boston |

- Server HTML (no JS): "Loading the course map" 1 time, "while the catalog loads" 1 time, "unavailable" 0 times, on both programs.
- Heading text while loading: "Your local plan remains available for backup while the catalog loads." After failure: "... while the catalog is unavailable."
- No page errors in any run.

### Screen reader: what status regions say while loading

Three `role="status"` nodes are in the DOM at every sample (1280 and 390, both programs):

| Node | Text | Rendered |
|---|---|---|
| `p.muted` in PlanBackup (`components/plan-backup.tsx:140`) | empty | no (0 size) |
| `LoadingState` div (`components/ui.tsx:56`) | "Loading the course map. Reading the official catalog and the plan saved in this browser." | yes |
| toast region (`aria-live="polite"`) | empty | no |

Only one region has text. A screen reader user hears one sensible status. The two empty regions say nothing. This confirms TL L3; it is harmless today.

## Findings

### High

None.

### Medium

- **M1. Raw error strings in the failure card (older than #140).** `components/catalog-state.tsx:11` puts `catalogError` in front of the help text. `components/app-provider.tsx:212` passes the raw `Error.message`. Live text:
  - block: "Failed to fetch Check your connection, then try again. ..."
  - 503: "Unexpected token '<', "<html>Serv"... is not valid JSON Check your connection, then try again. ..."
  The second one is developer text. It does not help a student. There is also no full stop between the raw error and "Check". #140 makes this card the main failure view of the planner, so the student now meets it more directly. Not a regression: the card showed the same text before #140 (quiet mode hid only the busy state).
- **M2. On a phone, Try again is below the fold (older than #140).** At 390x844 after a failure, the visible screen shows the heading, the amber "The catalog is unavailable, so the semester board is hidden..." box and the backup panel. The "did not load" card and its Try again button start below the fold (screenshot `Seattle-390-block-failed.png` in the scratchpad). The student must scroll to find the recovery action. The page order (PlanBackup above CatalogState) is not changed by #140.

### Low

- **L1. One problem, three messages.** After a failure the page says it three times: the heading ("... while the catalog is unavailable"), the PlanBackup notice (`role="status"`, "The catalog is unavailable, so the semester board is hidden..."), and the "The course catalog did not load" card. This is older than #140. Only the PlanBackup notice is in a live region, so a screen reader hears it one time. Sighted users read it three times.
- **L2. Focus goes to `<body>` after Try again.** Pressing Try again unmounts the button (the card becomes the loading state). `document.activeElement` is `BODY` afterwards, at both widths. A keyboard user loses their place. The loading region is `role="status"`, so a screen reader still hears "Loading the course map". Older than #140 in shape.
- **L3. Two empty `role="status"` nodes while loading** (TL L3). Confirmed live. No audible effect.
- **L4. Restore backup is disabled during load with the reason only in `title`** (`components/plan-backup.tsx:127`). Touch and keyboard users do not see "Wait for the catalog to finish loading". Older than #140. The load is short, so the cost is low.
- **Note (not a finding of this ticket): CLS.** The stress walk measures CLS 0.261 on both programs when the board replaces the loading card. This is filed as #144. I do not fail #140 for it.

## Interaction design (Shneiderman)

| Rule | Note |
|---|---|
| Consistency | Good. The planner now uses the same `LoadingState` as the other catalog views. Heading text matches the state ("loads" vs "is unavailable"). |
| Shortcuts | No change. Not relevant to a load state. |
| Informative feedback | Good. Spinner, title and one line say what is happening. Fixed the false "unavailable" message. |
| Closure | Good. The loading card goes away when the board appears. |
| Simple error handling | Partly. A Try again exists and works. The error text can be raw (M1), and the button can be off screen on a phone (M2). |
| Easy reversal | Not relevant. Loading changes no data. The local plan stays available and Download backup works during load. |
| Internal locus of control | Good. The student can download a backup while waiting and can retry after a failure. |
| Short-term memory load | Good. The heading explains why the board is missing. |
| Clarity and hierarchy | Good while loading (one card, one message). Weaker on failure (L1, M2). |
| Accessibility | One audible status while loading. No color-only meaning: the amber box also has text. Focus loss after Try again (L2). |

## App UI mechanics: stress walk

Config (scratchpad `ux-walk.json`): home is the Boston planner. Lists: Boston and Seattle planner catalog, `api: /api/catalog`, `empty: text=while the catalog is unavailable`, `throttleMs: 2500`. No screens and no sends: the planner saves only in the browser.

| # | Check | Target | Result | Detail |
|---|---|---|---|---|
| D1 | No empty state before the first answer | Boston planner catalog | PASS | skeleton, cache or loading shown |
| M1 | No layout shift when data lands (CLS ≤ 0.1) | Boston planner catalog | FAIL | CLS 0.261 |
| D1 | No empty state before the first answer | Seattle planner catalog | PASS | skeleton, cache or loading shown |
| M1 | No layout shift when data lands (CLS ≤ 0.1) | Seattle planner catalog | FAIL | CLS 0.261 |
| L1 | At most one layer over a screen | all walked steps | PASS | never more than one |

D1 was FAIL on both programs in the #126 walk (`docs/reviews/2026-11-20-126-user_advocate.md`). It is now PASS. M1 FAIL is tracked by #144.

## Manual checklist items

| # | Result | Reason |
|---|---|---|
| N1–N6 | NOT TESTED | #140 changes no navigation. |
| L1 | PASS | Stress walk. No layer opens on this path. |
| L2–L4 | NOT TESTED | No layer on this path. |
| D1 | PASS | Live walk and stress walk, both programs, both widths. |
| D2 | NOT TESTED | Return visits use the session cache; not changed by #140. |
| D3 | PASS (spinner), FAIL (jump) | No spinner flash risk at 2.5 s. Layout jump is #144. |
| D4 | PASS with notes | The error is in place and offers a working retry. See M1 (raw text) and M2 (below the fold on a phone). |
| D5 | NOT TESTED | No offline cache for the catalog on first visit. Blocked network gives the failure card (D4). |
| A1–A6 | NOT TESTED | No network send on this screen. Try again was pressed once per step; it sent one request each time. |
| M1 | FAIL | CLS 0.261, filed as #144. Not counted against #140. |
| M2–M5 | NOT TESTED | No motion change in #140. |

## Problem solved?

Yes. All four acceptance points hold live:

- While the catalog loads, the planner shows "Loading the course map", not "unavailable" (both programs, both widths, server HTML and client).
- "Unavailable" shows only after the request fails (network abort and HTTP 503).
- Tests for both states exist (`tests/planner-page.test.ts`). The TL found one wrong assert message (L2); the assert is correct.
- Build passes. I did not measure Worker CPU; the change is client-side text only.

Not checked: real screen reader output (I read the live-region DOM, not NVDA or VoiceOver audio), and Worker CPU.
