---
reviewed_head_sha: 4e602f4c95c50c9db8f36310e49a2c2617247ade
---

# PR #131 review: user advocate

- Ticket: #117 (B6). PR: https://github.com/johnyuencm/CoursesPlanner/pull/131
- Seat: user advocate, phase 2, last seat. I did not change code. I did not commit.
- Phase 1: tech_lead and project_manager PASS in round 2.
- Users: students who plan NEU courses. Most arrive from a search result on a phone. Second reader: the AdSense "low value content" review of `/`.

## Verdict

**PASS** for the scope of #131.

- Search results now name the course code and the program on every sitemap page.
- The clipped titles keep the course code and the first words. One sibling pair loses the words that tell them apart.
- The phone header line is useful. At 375 px and less, it wraps to 2 lines in the sticky bar.
- The `/` intro is clear and true.
- The stress walk has 1 N2 FAIL. The diff does not touch navigation, so this FAIL is a pre-existing defect. It does not block this PR. Track it in a separate ticket.

## How I ran it

```
git checkout fix/117-short-titles   (HEAD cd5d006 = 4e602f4 + 2 review files; product files identical)
npm run build                       -> "Build complete."
npm start                           -> wrangler dev on 127.0.0.1:3000
curl every <loc> in /sitemap.xml    -> live <title> and meta description of 357 pages
Browser pane at 390x844, 375x667, 320x640, 1024x768, 1280x800
stress-walk.mjs (Playwright 1.64.1 in the session scratchpad, not in the repo)
```

I stopped the server after the run (port 3000 free). `git status` is clean.

## Live evidence

### Search titles and descriptions (357 sitemap pages, live server)

| Measure | Result |
| --- | --- |
| Titles at 60 characters or less | 357 of 357 (max 60) |
| Unique titles | 357 of 357 |
| Titles clipped with "…" | 133 |
| Course descriptions at 160 or less | 335 of 335 (max 160) |
| Course descriptions clipped with "…" | 64 of 335 |
| Course descriptions without the unlock fact | 32 of 335 |

Examples of live titles:

| Page | Live `<title>` |
| --- | --- |
| `/` | `Course Map · Pick your college and program` |
| Portland overview | `NEU MSDS Portland · Course Map` |
| Align overview | `NEU MSCS Align Boston · Course Map` |
| Seattle CS 6760 | `CS 6760 Privacy, Security, and Usability · NEU MSCS Seattle` |
| Seattle CY 5001 | `CY 5001 Cybersecurity: Technologies… · NEU MSCS Seattle` |
| Seattle CS 2100 | `CS 2100 Program Design… · NEU MSCS Seattle` |
| Seattle CS 3100 | `CS 3100 Program Design… · NEU MSCS Seattle` |
| Boston CS 2100 | `CS 2100 Program Design and Implementation… · NEU MSCS Boston` |

Live description of Seattle CS 2100:

> CS 2100 Program Design and Implementation 1 (4 credits) in NEU MSCS Seattle: outside the degree requirements (a prerequisite for other courses here). It…

### Phone header (course page CS 2100, Seattle)

Visible text of the new line: `Northeastern University · Computer Science, MSCS—Seattle`.

| Viewport | Lines | Sticky topbar with line | Without line | Share of screen (topbar + 64 px bottom nav) |
| --- | --- | --- | --- | --- |
| 390x844 | 1 (17 px) | 178 px | not measured | 29% |
| 375x667 | 2 (34 px) | 195 px | 149 px | 39% |
| 320x640 | 2 (34 px) | 211 px | 165 px | 43% |
| 1024x768 | 1 | shown, no overflow | n/a | n/a |
| 1280x800 | hidden (`display: none`); sidebar shows the names | n/a | n/a | n/a |

- The line is in the prerendered HTML (`dist/server/prerendered-routes/.../cs-2100.html`). It does not pop in after load.
- The line stays visible while the page scrolls (topbar `position: sticky`, `top: 0`).
- Align page at 390 px: `Northeastern · Computer Science, MSCS—Align (Boston)`, 1 line.

### `/` intro at 390 px (visible text)

> Course Map turns the official catalog of a program into a prerequisite map. See what each course needs first and what it unlocks next, then plan your terms. The planner checks prerequisites. For a program marked Audit, it also checks the degree rules. Your plan stays in this browser.

- Each claim matches the product. README says that a Map-tier program gets map, courses and plan checks, but no degree audit.
- The legend below the search box defines Audit and Map. At 390 px it is about one screen lower than the intro.

## Findings

### H1 (high by checklist rule, pre-existing, not from #131): home is 3 back presses from a course page

- Evidence: stress walk, `Seattle course CS 2100`: home, Seattle card, Courses tab, CS 2100. System back needs 3 presses (table below).
- Cause: every in-app link pushes a history entry. The diff changes no link, router or nav code (`git diff master...4e602f4 --stat -- app components`: metadata, 1 `<p>`, 3 CSS lines).
- Impact today: the user does not get stuck. "Change college or program" is in the avatar menu (`profile-dropdown`) on phones.
- The checklist rule makes any N2 FAIL high. I do not count it against #131. Open a separate ticket.

### M1 (medium): the phone header line wraps to 2 lines at 375 px and less

- Evidence: table above. The line adds 46 px to the sticky topbar at 375x667 and at 320x640.
- At 320x640, fixed chrome takes 43% of the screen. At 375x667 (iPhone SE size) it takes 39%. The student reads course text in the rest.
- The full names cause the wrap: `Northeastern University · Computer Science, MSCS—Seattle` is 56 characters. The short name `NEU MSCS Seattle` exists in the catalog already.
- This confirms PM round 1 L3 live, and shows that it also occurs at 375 px, not only at 320 px.
- Criterion 4 is still met. The line names the college and program.

### L1 (low): two sibling courses get the same visible words in search

- `CS 2100 Program Design… · NEU MSCS Seattle` and `CS 3100 Program Design… · NEU MSCS Seattle`. The full names end in "Implementation 1" and "Implementation 2".
- The course code is first and unique, so the result still identifies the course. A student who scans by name sees 2 equal names.
- Other clipped titles keep a clear name start, for example `CY 5001 Cybersecurity: Technologies…`.
- The other same-word pairs (`Co-op Work Experience`, `Information Visualization`) are cross-listed courses with the same full name. They are not a clip defect.

### L2 (low): some descriptions end on a word with no meaning

- 13 course descriptions end in `It…`. Other tails: `unlocks…` (6), `other…` (4), `prerequisite…` (4), `this…` (3).
- 32 course descriptions lose the unlock fact, which is the value of the page.
- A search snippet that ends in `It…` looks broken. Search engines can also ignore the meta description.

### L3 (low, pre-existing data): the header uses 2 forms of the college name

- Seattle: `Northeastern University · …`. Boston and Portland: `Northeastern · …`.
- The values come from the catalog snapshots, not from this diff.

### L4 (low): the intro names "Audit" before the page defines it

- The intro says "For a program marked Audit". The definition is in the legend, about one screen lower at 390 px.
- The program cards show the Audit and Map badges, so a reader can connect them.

## Job to be done

```
search result ──> title: "<code> <first words>… · NEU MSCS Seattle"   (course + program: yes)
      │
      v
course page on phone ──> header: "Northeastern University · Computer Science, MSCS—Seattle"
      │                              (program: yes; 2 lines at <=375 px)
      v
h1: "CS 2100 · Program Design and Implementation 1"   (full name: yes)
```

- Does a search result tell the program and the course? Yes, on 357 of 357 pages.
- Do clipped titles identify the course? Yes, by the code. One pair loses the name words that tell them apart (L1).
- Is the phone header useful? Yes, it tells a student from search which program the page is for. It costs 1 extra line at 375 px and less (M1).
- Is the `/` intro clear and honest? Yes. Whether 5 sentences are enough for AdSense is a policy question. The UI cannot answer it.

## Interaction design (Shneiderman)

| Rule | Note |
| --- | --- |
| Consistency | Titles use one pattern everywhere: `<page> · <short name>`. The header uses `university · program` like the sidebar. College name form differs by catalog (L3). |
| Shortcuts | No change. The header line is text, not a control. |
| Informative feedback | Good. The line tells the student which program the page is for at every scroll position. |
| Closure | Not applicable. The change adds no task flow. |
| Simple error handling | Not applicable. No new input. Unknown program still gets the 404 page (unchanged). |
| Easy reversal | Not applicable. To change program on a phone, the student uses the avatar menu (unchanged). |
| Internal locus of control | Not affected. |
| Short-term memory load | Better. The student does not have to remember the program after the sidebar hides the names. |
| Clarity and hierarchy | The line is small (`--fs-sm`, weight 600) and above the search box. It does not compete with the `h1`. |
| Accessibility | Color `rgb(79, 88, 102)` on white, about 7:1. Plain `<p>` text, read by screen readers in order. No information by color alone. |

## UX mechanics stress walk

Config: home `/` (`.picker-header`); screen 1: Seattle card; screen 2: Seattle card, Courses tab, CS 2100. No list or send in scope.

| # | Check | Target | Result | Detail |
|---|---|---|---|---|
| N2 | Back (system) reaches home within 2 presses | Seattle overview | PASS | 1 press(es) |
| N2 | Back (system) reaches home within 2 presses | Seattle course CS 2100 | FAIL | 3 press(es) |
| L1 | At most one layer over a screen | all walked steps | PASS | never more than one |

## Manual checklist

| # | Result | Reason |
| --- | --- | --- |
| N1 | PASS | Back from CS 2100 returned to the Courses tab, then the overview, then `/` (stress walk). |
| N2 | FAIL | Pre-existing, see H1. |
| N3 | NOT TESTED | No form or send in this change. |
| N4 | NOT TESTED | Deep link from search opens the course page directly. Home is not under it. This is normal web behavior and not changed. |
| N5 | NOT TESTED | No list or scroll change in this diff. |
| N6 | PASS | Reload at each viewport gave the same page and title. Every page has its own URL. |
| L1 | PASS | Stress walk. |
| L2 | NOT TESTED | No layer added. |
| L3 | NOT TESTED | No layer added. |
| L4 | NOT TESTED | No dialog added. |
| D1 | NOT TESTED | No list data. The header is static and prerendered. |
| D2 | NOT TESTED | No data state change. |
| D3 | PASS | The header line is in the prerendered HTML, so it causes no jump when the page loads. |
| D4 | NOT TESTED | No API in this change. |
| D5 | NOT TESTED | No API in this change. |
| A1 | NOT TESTED | No control added. |
| A2 | NOT TESTED | No send action. |
| A3 to A6 | NOT TESTED | No send action. |
| M1 to M5 | NOT TESTED | No live data or motion in this change. |
