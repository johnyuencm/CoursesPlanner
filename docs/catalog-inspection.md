# MSCS (Seattle) Catalog Inspection — research notes, pre-implementation

Catalog inspected: **Northeastern Academic Catalog, 2026–2027 Edition**
Program page: https://catalog.northeastern.edu/graduate/computer-information-science/computer-science/computer-science-mscs-sea/#programrequirementstext (HTTP 200, plain static HTML, no JS needed for content)

## 1. Available data (cached locally)

| File | Content |
|---|---|
| `data/raw/mscs-sea-program.html` | Full program page (degree requirements tables, overview) |
| `data/raw/cs.html` | Official bulk CS descriptions: 188 courseblocks, including prerequisites/corequisites; HTTP 200 verified 2026-09-10 |
| `data/raw/cs5800-search.html` | CS 5800 course search result (no prereq) |
| `data/raw/cs6140-search.html` | CS 6140 (OR-prereq + grade floor) |
| `data/raw/search-CS%205010.html` | CS 5010 + CS 5011 (corequisite example) |
| `data/raw/search-CS%206510.html` | CS 6510 (grouped AND/OR prereq with parentheses) |
| `data/raw/search-CS%206640.html` | CS 6640 (OR-prereq with D-/C- grades) |

Retrieval method: `curl -sL -A "Mozilla/5.0"`. No JS execution required — all course data is in server-rendered HTML.

**robots.txt:** https://catalog.northeastern.edu/robots.txt disallows `/search/` (also `/xsearch/`, `/course-search/`, `/archive/`). Do not crawl these paths; delays do not override a disallow. The official bulk source https://catalog.northeastern.edu/course-descriptions/cs/ is **not disallowed** and includes prerequisites/corequisites in static HTML. The Seattle program page and `sitemap.xml` are not disallowed either (verified 2026-09-10). Cache bulk subject pages instead of requesting individual search results.

## 2. Requirement representation (exact rules, 2026–2027 catalog)

Program requirements live in `<div id="programrequirementstextcontainer" ...>` as `<table class="course_lists">`-style tables. Structure observed in raw HTML:

- Rows: `<tr class="even/odd areaheader">` = section/category headers ("Algorithms", breadth area names)
- Course rows: `<tr class="... lastrow"><td class="codecol"><a href="/search/?P=CS%205800" class="bubblelink code">CS 5800</a></td><td>Title</td><td class="hourscol">4</td></tr>`
- Rules text ("Complete three courses from at least two...") is in `<span class="courselistcomment">` rows.

**Verified degree rules (MSCS Seattle):**
- **32 total semester hours**, minimum **3.000 GPA**.
- **Core (8 SH):** CS 5010 (Programming, 4h) **AND** CS 5011 (Recitation, 0h — coreq of 5010); CS 5800 Algorithms (4h).
- **Breadth (12 SH):** three courses (3 × 4h) from **at least two** of the three breadth areas. Exact `areaheader` strings in the HTML: **"Artificial Intelligence and Data Science"**, **"Systems and Software"**, **"Theory and Security"**. Area-to-course mapping in the flat table is positional (rows follow their header) — scraper must slice by `areaheader` rows, not guess by course-number range.
- **Electives (12 SH):** "Complete 12 semester hours from the breadth area courses and/or the following" — i.e. breadth list ∪ elective list, includes CY/DS/DADS cross-listed courses (CY 5001…DS 5230), plus co-op (CS 6954/6955/6964/6965), practicum, directed study, topics, thesis, master's project.
- **No tracks/concentrations appear on this page** — single unified curriculum (unlike the user's possibly remembered "tracks"). Do not model tracks unless another page proves them.
- MS thesis committee rules are in `id="textcontainer"` (3 members, 2 Khoury, arm's-length member) — informational, not parseable constraints.

## 3. Prerequisite retrieval + syntax

Use **https://catalog.northeastern.edu/course-descriptions/cs/**: one HTTP 200 response provides 188 CS courseblocks with descriptions and prerequisite/corequisite text. The earlier claim that `/search/` was the only source was false; failed guessed per-course URLs did not establish that. Links inside bulk courseblocks point to `/search/`, but their visible text is already sufficient: do not follow those links.

Selectors within the bulk subject page:
- `div.courseblock` — one course record.
- `p.courseblocktitle > strong` — code, title, and hours. Normalize nonbreaking spaces, then match the **leading code** exactly (CS 5011's title also mentions CS 5010).
- `p.cb_desc` — description (use full text including nested anchors).
- `p.courseblockextra` — metadata paragraphs; inspect each direct `strong` label for `Prerequisite(s):`, `Corequisite(s):`, or `Attribute(s):`. Extract the remaining paragraph text including nested anchors. There are no separate prerequisite/corequisite CSS classes.

Verified directly in the saved bulk HTML:
- **CS 5010**, Programming Design Paradigm, 4 hours: corequisite **CS 5011**; no prerequisite paragraph.
- **CS 5800**, Algorithms, 4 hours: no prerequisite/corequisite paragraph (an attribute paragraph is present).
- **CS 6510**, Advanced Software Development, 4 hours: prerequisites **(CS 5004 minimum B- OR CS 5010 minimum C-); CS 5500 minimum C-**; no corequisite paragraph.
- **CS 5011**, Recitation for CS 5010, 0 hours: corequisite **CS 5010**.

Previously cached search HTML uses `article.search-courseresult` and `<h3>` headings; these selectors are not needed for bulk ingestion.

**Observed syntax (verbatim):**
- OR with grade floors: `Prerequisite(s): CS 5800 with a minimum grade of C- or CS 7800 with a minimum grade of C-` (CS 6140)
- Grouped AND/OR: `Prerequisite(s): ( CS 5004 with a minimum grade of B- or CS 5010 with a minimum grade of C- ); CS 5500 with a minimum grade of C-` (CS 6510) — semicolon = AND, `or` = OR, parens group.
- Corequisite: `Corequisite(s): CS 5010` (CS 5011)
- Grade tokens: "with a minimum grade of C-" / "B-" / "D-". Other courses may add "may be taken concurrently" — not yet observed in our sample; parse defensively.
- Permission escape hatch text: "Students who do not meet course prerequisites may seek permission of instructor." (CS 6510) — informational.

Grammar for a parser: prereq string → split on `;` (AND of groups) → within group split on ` or ` (OR) → each leaf = course code + optional `with a minimum grade of X`. Handle parens; handle prose fallback (store raw string, flag unparsed).

## 4. Unreliable / unknown data (handle conservatively)

1. **Use bulk `/course-descriptions/cs/`, not robots-disallowed `/search/`.** A successfully matched courseblock without a prerequisite paragraph means "none listed"; a missing courseblock or failed fetch means "unknown". Bulk CY/DS/DADS pages are candidate sources for other subjects but were not verified in this spot check.
2. **Match the leading course code in `p.courseblocktitle > strong` exactly.** Titles/descriptions can mention other codes (CS 5011's title mentions CS 5010); whole-block substring matching is incorrect.
3. **Breadth-area boundaries** are positional in the flat table (`areaheader` rows); do not infer by course number ranges. Verified headers: "Artificial Intelligence and Data Science", "Systems and Software", "Theory and Security".
4. **Offerings / term availability / Seattle-specific section data is NOT in the catalog at all** — no term schedule, no campus filter on course pages beyond an "Attribute(s)" line. Any "offered in Fall X" claims must come from a different source (Banner/class search) — out of scope here; flag as unknown rather than invent.
5. **Special-topics courses (CS 5963, CS 6983, CS 71xx "Special Topics"…)** have generic titles; their content varies per offering — cannot be prerequisites modeled reliably.
6. **Co-op/practicum/thesis courses** count toward the elective 12 SH per the catalog text but may have enrollment restrictions not in the catalog.
7. Catalog year is 2026–2027; pages carry "2026-2027 Edition". Requirements change yearly — record the edition string in scraped output, and check `sitemap.xml`/archive if pinning to a past year is ever needed (archive is robots-disallowed).
8. CS 5011 is 0 hours but required (coreq) — don't drop 0-hour rows when summing.

## 5. Scraping plan implications (for implementation)

- Parse program page from cache: tables in `#programrequirementstextcontainer`; iterate `<tr>`; `areaheader` rows change current section; `.codecol a.code` text identifies each course. Do not follow its `/search/?P=…` link.
- Fetch/cache each required subject's bulk `/course-descriptions/<subject>/` page after checking robots.txt → index `div.courseblock` records by the exact leading code in `p.courseblocktitle > strong` → parse `p.courseblockextra` by its `strong` labels. CS is verified; verify CY/DS/DADS before relying on them.
- Model: total=32, GPA≥3.0, core {CS 5010 + coreq 5011, CS 5800}, breadth 3 courses ≥2 areas, electives 12 SH from breadth∪elective lists.
