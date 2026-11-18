---
reviewed_head_sha: 37baa36397cacc7b3d740ea1067a476d07d491b5
---

# PR #131 review: user advocate, round 2

- Fix commit: `37baa36` (`git diff 4e602f4..37baa36`: `app-shell.tsx`, `layout.tsx`, `globals.css`, `lib/program-page.ts`, a test, `docs/ia.md`).
- Local HEAD is `9a8ac57`. It adds only review files. Product files are identical to `37baa36` (`git diff --quiet 37baa36 HEAD -- app components lib catalog-service data config public worker.ts`).
- Seat: user advocate. I did not change code. I did not commit.
- Round 1: `docs/reviews/2026-11-13-pr131-user_advocate.md`.

## Verdict

**PASS.** M1 is closed. L2 is mostly closed. I found no new high or medium finding.

## How I ran it

```
npm run build   -> exit 0
npm start       -> wrangler dev on 127.0.0.1:3000 (stopped after the run; port 3000 free)
Browser pane at 320x640, 375x667, 630x900, 700x900
python check of every prerendered page in dist/server/prerendered-routes
```

## M1: phone header line (closed)

| Viewport | Page | Visible text | Lines | Sticky topbar with line | Without line | Line costs |
| --- | --- | --- | --- | --- | --- | --- |
| 320x640 | Seattle CS 2100 | `NEU MSCS Seattle` | 1 (17 px) | 195 px | 166 px | 29 px |
| 375x667 | Align CS 2100 | `NEU MSCS Align Boston` | 1 (17 px) | 178 px | 149 px | 29 px |
| 630x900 | Seattle CS 2100 | `Northeastern University · Computer Science, MSCS—Seattle` | 1, fits (598 of 598 px) | n/a | n/a | n/a |
| 700x900 | Align CS 2100 | `Northeastern · Computer Science, MSCS—Align (Boston)` | 1, fits | n/a | n/a | n/a |

- Round 1 cost was 46 px and 2 lines at 320 and 375 px. Now it is 29 px and 1 line.
- At 320x640, fixed chrome (topbar + 64 px bottom nav) is now 40% of the screen, down from 43%. The rest of the topbar height is from before this PR.
- The phone text now matches the search title (`… · NEU MSCS Seattle`). A student from search sees the same name in the result and on the page. This is a consistency gain.
- From 621 px to about 630 px the full name fills the line exactly. `white-space: nowrap` and `text-overflow: ellipsis` give a safe "…" if it is wider. No wrap is possible.
- The hidden span has `display: none`, so a screen reader reads only one name.

## L2: description tails (mostly closed)

Course detail pages: 335. Max description 160.

| Tail | Round 1 | Round 2 |
| --- | --- | --- |
| ends in `It…` | 13 | 0 |
| ends in `.…` | not counted | 0 |
| ends in `It unlocks…` | n/a | 6 |
| ends in `It unlocks no…` | n/a | 4 |
| ends in `It unlocks 1…` | n/a | 7 |
| description without the unlock fact | 32 | 32 |

- New low note L5: about 17 descriptions now end in a cut unlock sentence (`It unlocks…`, `It unlocks no…`, `It unlocks 1…`). They are true but they do not give the number. This is better than `It…`. The page itself has the full sentence.
- Two `courses` index pages have descriptions of 162 and 166 characters. Criterion 3 covers only course pages, so this is not a finding.

## Round 1 findings that stay open

| Finding | State |
| --- | --- |
| H1: 3 back presses to home (pre-existing, not from #131) | open. Track in a separate ticket. Not changed by this fix. |
| L1: `CS 2100` and `CS 3100` both `Program Design…` in Seattle titles | open, accepted. The code tells them apart. |
| L3: `Northeastern University` against `Northeastern` | open, catalog data. Not visible on phones now, because phones show the short name. |
| L4: intro names "Audit" before the legend | open, accepted. |
