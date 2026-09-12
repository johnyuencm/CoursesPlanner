# NEU MSCS Course Planner

A local-first course and degree planner for Northeastern University's Seattle MS in Computer Science program.

The application explains the current catalog requirements, exposes parsed prerequisite relationships, and validates a semester-by-semester plan. It is an advising aid, not an official degree audit. Course availability in a specific semester or campus section is not included because the academic catalog does not provide that data.

## What the application includes

- **Degree overview** for total credits, required core, breadth areas, and electives.
- **Course explorer** with search, requirement, breadth, credit, prerequisite, eligibility, and topic filters.
- **Prerequisite graph** with upstream and downstream exploration plus an accessible relationship table.
- **Plan builder** with academic and internship/co-op terms, drag-and-drop, keyboard drag controls, and native move menus.
- **Live validation** for prerequisites, corequisites, credits, core, breadth diversity, and electives.
- **Next-course view** that reports prerequisite eligibility separately from actual course offerings.
- **Editable suggested pathways**, including a robotics-focused starting point. Pathways never change degree requirements.
- **Local persistence** in browser LocalStorage. No account, authentication service, or database is required.

## Catalog source inspection

Source behavior was inspected before implementation. Detailed findings are in [`docs/catalog-inspection.md`](docs/catalog-inspection.md).

Current source facts:

- Program: [Computer Science, MSCS—Seattle](https://catalog.northeastern.edu/graduate/computer-information-science/computer-science/computer-science-mscs-sea/#programrequirementstext)
- Catalog edition inspected: **2026–2027**
- Program requirement tables are server-rendered under `#programrequirementstextcontainer`.
- Bulk course descriptions, including prerequisite and corequisite text, are server-rendered under `/course-descriptions/<subject>/`.
- The application does not crawl catalog `/search/` routes, which Northeastern disallows in `robots.txt`.
- Breadth categories are parsed from their table headings and positional course rows. They are not inferred from course numbers.
- Semester offerings and Seattle-specific sections are not present in these sources. The application never infers them.

The inspected degree rules are 32 semester hours, three named core courses (including zero-credit CS 5011), three breadth courses across at least two of three areas, 12 breadth credits, and 12 elective credits. Runtime UI values come from normalized catalog data rather than duplicated UI constants.

## Architecture

```text
Official Northeastern catalog
        |
        | explicit refresh only
        v
scraper/refresh.ts ----> data/raw/*.html
        |
        v
scraper/parser.ts -----> data/courses.json
        |                data/requirements.json
        |                data/catalog.json
        v
app/api/catalog --------> AppProvider --------> pages and dialogs
                              |
                              v
                       LocalStorage plan
                              |
                              v
                       lib/validation.ts
```

### Main directories

| Path | Purpose |
| --- | --- |
| `app/` | Next.js App Router pages and catalog API route |
| `components/` | Shared shell, dialogs, course cards, graph, and planner UI |
| `scraper/parser.ts` | HTML parsing and prerequisite expression parsing |
| `scraper/refresh.ts` | Fixed-source fetch, cache, validation, and atomic output replacement |
| `lib/types.ts` | Catalog, course, requirement, plan, pathway, and validation models |
| `lib/catalog.ts` | Normalized catalog trust-boundary validation and disk loading |
| `lib/plan.ts` | LocalStorage plan validation and corruption recovery |
| `lib/validation.ts` | Eligibility, dependency closure, and degree-progress validation |
| `config/pathways.json` | Default recommendation-only pathway groups |
| `data/raw/` | Cached official HTML and research fixtures |
| `tests/` | Parser, validation, and persistence tests |
| `docs/` | Source inspection and acceptance checklist |

## Catalog cache and refresh behavior

Page loads never scrape Northeastern. `GET /api/catalog` reads only `data/catalog.json` and returns `503` if no valid normalized cache exists.

Refresh uses an allowlist of fixed HTTPS sources on `catalog.northeastern.edu`:

- Seattle MSCS program page
- CS bulk course descriptions
- CY bulk course descriptions when referenced
- DS bulk course descriptions when referenced
- DADS bulk course descriptions when referenced

The refresh pipeline:

1. Reads cached raw HTML and cache metadata.
2. Reuses raw sources for seven days unless refresh is forced.
3. Fetches only allowlisted official URLs, with a 15-second timeout, a 5 MB response limit, manual redirect checks, and a delay between requests.
4. Parses requirements and bulk course blocks.
5. Preserves unsupported prerequisite prose as explicit `unknown` expressions.
6. Validates the complete normalized catalog.
7. Atomically replaces raw network responses and normalized JSON only after parsing and validation succeed.
8. Falls back to an existing stale raw source when a refresh request fails. Missing optional department sources produce warnings and explicit placeholders; missing required sources still fail.

The UI's **Refresh Catalog** button calls same-origin `POST /api/catalog`. That route is for local demos: it is open only in `NODE_ENV=development` (typical `next dev`, loopback) unless `CATALOG_REFRESH_TOKEN` is set. When the token is set, POST requires the matching `x-catalog-refresh-token` header. Cross-site browser requests and request bodies are rejected, concurrent refreshes are deduplicated, and a 30-second cooldown applies. Production/`next start` refreshes should use `npm run catalog:refresh` rather than an unauthenticated POST. If refresh fails after the app has already loaded a catalog, the browser keeps the last loaded catalog and reports the error.

`data/raw/cs5800-search.html`, `data/raw/cs6140-search.html`, and similarly named search files are research fixtures. Normal ingestion uses bulk subject pages instead.

### Generated files

- `data/catalog.json`: complete validated payload used by the application.
- `data/courses.json`: normalized courses.
- `data/requirements.json`: normalized degree rules.
- `data/raw/.catalog-cache.json`: source URLs and fetch timestamps.

Do not hand-edit generated prerequisite relationships. Refresh or fix the parser instead.

## Normalized data model

The complete TypeScript definitions live in [`lib/types.ts`](lib/types.ts). Core shapes are:

```ts
type RequirementExpression =
  | { type: "none" }
  | {
      type: "course";
      code: string;
      minimumGrade?: string;
      concurrent?: boolean;
    }
  | { type: "all" | "any"; items: RequirementExpression[] }
  | { type: "unknown"; text: string };
```

Each normalized course includes:

- code, title, credit minimum, and optional credit maximum
- description and official URL
- prerequisite and corequisite expression trees
- raw prerequisite and corequisite wording
- referenced prerequisite and corequisite codes
- downstream prerequisite unlocks
- breadth categories and requirement type
- elective eligibility
- keyword-based recommendation topics
- explicit parsing uncertainties

Each catalog includes courses, degree requirements, source URLs, build timestamp, and warnings. Topic labels are recommendations inferred from catalog text; they are not official program classifications.

## Prerequisite and degree validation

Validation is conservative:

- Ordinary prerequisites require a completed, waived, or earlier-term course.
- A same-term course satisfies a prerequisite only when its parsed leaf explicitly permits concurrent enrollment.
- Corequisites may be completed earlier or placed in the same term.
- `all` and `any` expression structure remains intact. The graph shows course references, not a flattened substitute for the expression tree.
- Unknown clauses remain uncertain and block an unsupported eligibility claim.
- Waivers satisfy a named course requirement or dependency but award **zero credits**.
- Fixed-credit overrides are rejected. Variable-credit selections must remain within catalog bounds.
- External dependency placeholders never earn degree credit.
- Duplicate completed, waived, or planned courses produce issues rather than extra credit.
- Breadth allocation selects the required number of courses across the required number of areas.
- A course assigned to breadth is not counted again as an elective. Unused breadth-eligible courses may count toward electives when the catalog permits them.
- Degree satisfaction requires total credits, core, breadth, electives, and no blocking modeled issue.

The application cannot verify GPA, actual earned grades against minimum-grade clauses, advisor approval, thesis committee rules, enrollment restrictions, or term offerings. These limits remain visible in the audit.

## Planner persistence

The student plan is stored under a versioned LocalStorage key. `lib/plan.ts` validates browser data before use and bounds array sizes, text lengths, course-code format, credit values, term types, and unique term IDs.

Malformed or inaccessible LocalStorage data does not overwrite the stored value. The application starts with a fresh in-memory plan, reports the problem, and blocks automatic saving until the user explicitly resets the local plan.

Suggested pathway edits use a separate LocalStorage key. They affect recommendations only, never catalog requirements or degree validation.

## Local setup

Requirements:

- Node.js 22 or newer
- npm
- Network access only when refreshing missing or stale catalog sources

Install dependencies:

```bash
npm install
```

Generate or refresh normalized catalog data:

```bash
npm run catalog:refresh
```

Start development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Keep the demo on loopback (`localhost` / `127.0.0.1`) if you use the in-app refresh button; `next dev` already does this by default. For a production server on a shared network, bind loopback if you expose refresh at all:

```bash
npx next start --hostname 127.0.0.1
```

Prefer the CLI for operators. To allow HTTP refresh outside development, set a local secret and send it as a header (never put this token in client-side code):

```bash
export CATALOG_REFRESH_TOKEN="a long random local secret"
curl -X POST -H "x-catalog-refresh-token: $CATALOG_REFRESH_TOKEN" http://127.0.0.1:3000/api/catalog
```

If raw cache entries are fresh, normal refresh rebuilds normalized JSON without downloading those sources. Force a network attempt with:

```bash
npm run catalog:refresh -- --force
```

Forced refresh still uses a previously cached source when its network request fails. It does not replace valid cache files with failed or invalid responses.

## Verification commands

```bash
npm test
npm run typecheck
npm run build
```

Browser acceptance criteria are documented in [`docs/acceptance-checklist.md`](docs/acceptance-checklist.md). Command presence here is not a claim that a particular checkout has passed them; run all three after changing parser, validation, or UI code.

## Security and trust boundaries

- `GET /api/catalog` only reads the local cache. `POST /api/catalog` is not an unauthenticated refresh: it requires `CATALOG_REFRESH_TOKEN` via `x-catalog-refresh-token`, or is limited to `NODE_ENV=development`.
- Remote fetch targets are code-defined; refresh accepts no caller-supplied URL.
- Redirects must remain HTTPS on `catalog.northeastern.edu` and may not enter blocked search/archive paths.
- Responses and cached files are size-bounded.
- Normalized disk JSON and LocalStorage JSON are validated before application use.
- Official links rendered in the UI are restricted to HTTPS Northeastern catalog URLs.
- Refresh writes use temporary files and rename, so a failed parse does not partially replace normalized output.
- No credentials, login state, server database, telemetry service, or cloud persistence is used.

## Known limitations

- Catalog HTML structure can change and require parser updates.
- Current requirements are tied to the parsed catalog edition, not automatically to a student's matriculation year.
- Actual schedules, seat availability, campus sections, and future offerings are unavailable.
- Keyword topic labels and editable pathways are guidance only.
- Special topics vary by term and cannot be characterized reliably from generic catalog descriptions.
- Co-op, practicum, thesis, project, and directed-study entries may require approvals or restrictions not encoded in catalog text.
- Grade-floor text is preserved, but the MVP does not collect grades or calculate GPA.
- External or unavailable department courses remain visible as uncertain placeholders until their approved bulk source is cached successfully.
- The application does not replace consultation with Northeastern advising or an official degree audit.
