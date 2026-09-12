# Security audit — johnyuencm/CoursesPlanner

**Date:** 2026-09-12  
**Scope:** Static analysis of `master` (`82175ba`), dependency review (`npm audit` + Next.js advisories), Next config, the catalog scraper, the sole API route, client rendering/persistence, and CI.  
**Method:** Read-only review. No exploits against external systems, no live catalog scrape, no remediation patches.  
**Parent:** harness#27  
**App model:** Local-first Next.js planner. Student plans live in LocalStorage. Catalog HTML is fetched only from hardcoded `catalog.northeastern.edu` URLs.

## Executive summary

No Critical or High issues were verified as reachable on this checkout.

The application is intentionally unauthenticated and stores no accounts or secrets. The scraper does not accept caller-supplied URLs. UI links are allowlisted to HTTPS `catalog.northeastern.edu`. React text rendering plus `OfficialLink` blocks the usual XSS/`javascript:` paths. `next@16.3.4` is past the August 2026 RCE patches, and `npm audit` reported **0** vulnerabilities.

The one realistically reachable application finding is the unauthenticated `POST /api/catalog` refresh, which performs outbound fetches and writes catalog files whenever the Next server is network-reachable. Two Low process/info findings follow.

| ID | Severity | Finding |
| --- | --- | --- |
| M-1 | Medium | Unauthenticated `POST /api/catalog` forces catalog refresh, outbound fetches, and disk writes |
| L-1 | Low | API error bodies reflect internal filesystem paths and upstream redirect URLs |
| L-2 | Low | No CI, Dependabot, or automated `npm audit` — Next.js just had Critical RCEs |

---

## M-1 — Unauthenticated catalog refresh with disk writes and outbound fetches

**Severity:** Medium  
**Component:** `app/api/catalog/route.ts` (POST), `scraper/refresh.ts` (`refreshCatalog`)

### Attack scenario

Anyone who can reach the Next.js server can `POST /api/catalog` with an empty body and no `Origin` / `Sec-Fetch-Site` headers (curl, scripts, other LAN clients). That call:

1. Always invokes `refreshCatalog({ force: true })` unless an in-memory 30s cooldown on **that process** is active.
2. Fetches allowlisted HTTPS pages on `catalog.northeastern.edu` (15s timeout, 5MB cap, up to four sources with a 750ms delay).
3. Parses HTML, validates the catalog, then atomically overwrites `data/raw/*.html`, `data/catalog.json`, `data/courses.json`, and `data/requirements.json`.

Browser cross-site form/`fetch` CSRF is largely blocked (`sec-fetch-site: cross-site` and mismatched `Origin`). Non-browser clients and same-machine/LAN callers are not.

### Prerequisites

At least one of:

- `next start` (package script `"start": "next start"`). Next.js documents `--hostname` default **`0.0.0.0`**, so a production-mode local run is LAN-reachable unless the OS firewall or `-H 127.0.0.1` restricts it.
- Any public or shared deployment (Vercel, a class VM, Docker published on `0.0.0.0`).
- `next dev --hostname 0.0.0.0` (dev default is typically localhost; this is an explicit bind).

No account, cookie, or CSRF token is required. The POST body must be empty (non-empty bodies return 400).

### Potential impact

- **Availability:** One request can occupy the Node process for multiple sequential HTTPS round-trips (worst case tens of seconds). The 30s cooldown is in-module memory, so serverless replicas, multiple `next start` workers, or a process restart bypass it.
- **Third-party abuse:** The server becomes an on-demand fetcher against Northeastern’s catalog (forced refresh, not cache-only).
- **Integrity of shared catalog state:** On a shared host, any caller can rebuild the on-disk catalog all users load via `GET /api/catalog`. Content still has to parse as official catalog HTML and pass `validateCatalog` — an attacker cannot upload an arbitrary JSON body — but they can force a rebuild during a source outage/defacement, or burn CPU/disk on every student machine that exposed `next start`.
- **Not RCE / not classic SSRF:** Fetch targets are code-defined; redirects must stay `https://catalog.northeastern.edu` and are blocked from `/search`, `/xsearch`, `/course-search`, and `/archive`. TLS hostname checking prevents “allowlist host, connect to RFC1918 IP” via HTTP. This is **not** user-controlled SSRF.

### Evidence

`POST` is unauthenticated aside from a browser cross-site heuristic. Missing `Origin` is treated as same-site:

```17:28:app/api/catalog/route.ts
function isCrossSite(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin !== request.nextUrl.origin;
  } catch {
    return true;
  }
}
```

Empty-body POST always forces a network refresh:

```40:64:app/api/catalog/route.ts
export async function POST(request: NextRequest) {
  if (isCrossSite(request)) return errorResponse(new Error("Cross-site catalog refresh refused."), 403);
  const payload = await request.arrayBuffer();
  if (payload.byteLength > 0) {
    return errorResponse(new Error("Catalog refresh does not accept a request body."), 400);
  }
  // ...
      activeRefresh = refreshCatalog({ force: true }).finally(() => {
        activeRefresh = null;
      });
```

Writes land under `process.cwd()` after parse/validate:

```311:326:scraper/refresh.ts
  for (const entry of loaded.filter(({ fromNetwork }) => fromNetwork)) {
    await atomicWrite(path.join(rawDir, entry.source.fileName), entry.html);
  }
  // ...
  await atomicWrite(path.join(dataDir, "courses.json"), json(courses));
  await atomicWrite(path.join(dataDir, "requirements.json"), json(requirements));
  await atomicWrite(path.join(dataDir, "catalog.json"), json(catalog));
```

`package.json` exposes `next start` with no hostname pin. README documents the UI Refresh button as same-origin POST; it does not warn that production bind + this route is an unauthenticated write/fetch trigger.

### Recommended remediation

Do not implement in this audit. Suggested ticket work:

1. Treat refresh as a **local operator** action: keep `npm run catalog:refresh` for disk updates; make `POST /api/catalog` a no-op in production, or gate it with a localhost-only check, a shared secret header, or `NODE_ENV=development`.
2. If a UI refresh must remain, bind `next start` to `127.0.0.1` in docs/scripts and reject POSTs unless `sec-fetch-site` is `same-origin` (not merely “not cross-site”).
3. Persist cooldown (or disable force-from-HTTP entirely) so serverless/multi-instance cannot stampede Northeastern.
4. Do not write the application cwd on hosted platforms; refresh should fail closed there.

### Validation plan

1. On a disposable local `next start`, from another host or with headers stripped: `curl -sS -D- -X POST http://<bind>:3000/api/catalog -o /dev/null`. Expect today’s code to return 200/502 with `X-Catalog-Refresh` unless cooldown hits. **Do not** run this against a shared or production catalog host; it causes real outbound fetches.
2. Repeat from a browser on another origin (page `fetch` or form POST). Expect **403** (`Cross-site catalog refresh refused.`).
3. After a fix: same curl should be **401/403/404**; UI refresh on localhost should still work if that product behavior is kept.
4. Confirm `GET /api/catalog` still serves `data/catalog.json` without scraping.

---

## L-1 — API errors reflect filesystem paths and redirect locations

**Severity:** Low  
**Component:** `app/api/catalog/route.ts` `errorResponse`, `scraper/refresh.ts`

### Attack scenario

A failed refresh (timeout, oversized body, refused redirect, missing cache file) returns `error.message` verbatim as JSON to whoever called GET/POST. Several scraper errors embed absolute paths or the raw `Location` header.

### Prerequisites

Network access to the API (same as M-1 for POST; GET 503 if `catalog.json` is invalid/missing). No privilege beyond hitting the route.

### Potential impact

Information disclosure only: host absolute paths (helps local malware/pivot) and any query string Northeastern puts on a refused redirect. No secrets were observed in-repo, and catalog redirects are unlikely to carry session tokens. Still a needless leak on an unauthenticated endpoint.

### Evidence

```12:15:app/api/catalog/route.ts
function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Catalog operation failed.";
  return NextResponse.json({ error: message }, { status });
}
```

Examples of messages that can surface:

```114:116:scraper/refresh.ts
    throw new Error(`Cached response exceeds ${MAX_RESPONSE_BYTES} bytes: ${filePath}`);
```

```145:152:scraper/refresh.ts
function safeRedirect(currentUrl: string, location: string): string {
  const redirected = new URL(location, currentUrl);
  if (
    redirected.protocol !== "https:" ||
    redirected.origin !== CATALOG_ORIGIN ||
    /^\/(?:search|xsearch|course-search|archive)(?:\/|$)/i.test(redirected.pathname)
  ) {
    throw new Error(`Refused catalog redirect to ${redirected.toString()}`);
```

The client renders `data.error` as React text (`components/app-provider.tsx`), so this is not XSS.

### Recommended remediation

Return stable public errors (`Catalog refresh failed`, `Catalog unavailable`). Log `error.message` server-side only. Never include `filePath` or redirect URLs in API JSON.

### Validation plan

1. Temporarily point cache metadata at an oversized file or mock a `Location: https://example.com/` redirect in unit tests of `refreshCatalog`.
2. Assert the HTTP JSON body does not contain `data/raw`, `process.cwd()` paths, or the redirect URL.
3. Confirm the UI still shows a generic failure banner.

---

## L-2 — No CI/CD or automated dependency scanning

**Severity:** Low (process / supply chain)  
**Component:** repository layout (no `.github/`), `package.json` scripts

### Attack scenario

A High/Critical advisory in `next`, `react`, `cheerio`, or `sharp` (optional Image Optimization) can sit on `master` until someone remembers to run `npm audit`. August 2026 Next.js releases included **unauthenticated RCE** (Windows cache-path / server-reference key; AVIF/`libheif` via `sharp`). This pin happened to be updated to `16.3.4`; nothing in-repo would have caught a miss.

### Prerequisites

None for the gap itself. Exploitation would require a later vulnerable dependency plus a reachable Next server (see M-1).

### Potential impact

Delayed patching of framework RCEs. No Actions secrets to leak (there is no workflow). Dependabot PRs will not appear.

### Evidence

- No `.github/` directory (GitHub API `get_file_contents` on `.github` → missing).
- No workflow YAML, `dependabot.yml`, `SECURITY.md`, or `npm audit` script.
- Scripts are only `dev` / `build` / `start` / `typecheck` / `test` / `catalog:refresh`.
- `npm audit` on this lockfile (2026-09-12): **0** vulnerabilities — current pin is clean, the control is still absent.

### Recommended remediation

Add GitHub Actions: `npm ci`, `npm audit --audit-level=high`, `npm test`, `npm run typecheck`, `npm run build`. Enable Dependabot or npm `audit` in CI for `next` and `sharp`. Pin/monitor Next security releases (16.3.3+ for CVE-2026-75604 / GHSA-p293-qw3h-jr36; 16.3.4 + `sharp@0.35.4` for the AVIF/`libheif` follow-up).

### Validation plan

Open a PR that bumps a known-vulnerable `next` (in a throwaway fork) and confirm CI fails `npm audit`. Confirm Dependabot or equivalent opens PRs for `next` minor/security updates.

---

## Checked — no verified reachable finding

### Secrets

- `.gitignore` ignores `.env*`.
- Git history / tree grep found no API keys, tokens, PEM material, or GitHub PATs (course HTML mentioning “password” in CY catalog prose only).
- No Vercel/GitHub Actions secrets (no CI). `CATALOG_DATA_PATH` is an optional filesystem override, not a credential.

### Authn / authz

- No accounts, sessions, cookies, or middleware. By design.
- Student PII is a local course plan in LocalStorage (`neu-mscs-planner-plan-v1`). Sensitivity is low; XSS would still be the steal path — none found.

### API surface

- Single route: `app/api/catalog/route.ts` (`GET` reads validated `data/catalog.json`; `POST` refresh).
- GET has no path/query file parameter. `readCatalog()` is env-or-default path, then `validateCatalog`.
- No CORS `Access-Control-Allow-Origin`. Cross-origin JS cannot read the JSON; GET still executes (public catalog data).
- POST rejects non-empty bodies (no attacker-supplied catalog JSON).
- No Server Actions, no `middleware.ts`.

### Scraper / SSRF

Reviewed `scraper/refresh.ts` and `scraper/parser.ts`:

- Targets are constants (`PROGRAM_URL`, `SUBJECT_SOURCES`). Unknown subjects throw rather than interpolating a URL.
- `redirect: "manual"`, max 3 hops, HTTPS + exact origin `https://catalog.northeastern.edu`, search/archive paths denied.
- 15s abort, 5MB streamed cap, HTML content-type / doctype checks, 750ms delay.
- `rootDir` is not taken from the HTTP request.
- Cheerio uses `.text()` for titles/descriptions; `officialUrl` fragments come from `id` on a hardcoded host, then `validateCatalog` / `OfficialLink` require `https:` + hostname `catalog.northeastern.edu`.

Classic SSRF (caller URL, file://, 169.254.169.254, redirect-to-internal) was **not** found.

### XSS

- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `document.write`, markdown HTML, or `srcDoc`.
- Catalog and plan strings render as React text. `Meter` width is a clamped number.
- `OfficialLink` (`components/ui.tsx`) refuses non-HTTPS or non-`catalog.northeastern.edu` hrefs; `rel="noopener noreferrer"` on `_blank`.
- `lib/plan.ts` bounds LocalStorage JSON (prototype check, code regex, sizes). Pathways JSON is similarly bounded (`app/pathways/page.tsx`).
- Search query `q` is `encodeURIComponent`’d into `/courses?q=` and bound to a controlled `<input>`.
- Client `setCatalog(data as Catalog)` is a shallow shape check, not `validateCatalog`. GET/POST already validate on the server, so this is defense-in-depth only, not a current sink.

### Next.js advisories (pinned `next@16.3.4`, lockfile `sharp@0.35.4`)

| Advisory | Status on this pin |
| --- | --- |
| CVE-2026-75604 / GHSA-p293-qw3h-jr36 Windows RCE (cache path / server-reference key) | Patched in 16.3.3; **not affected** |
| GHSA-2xp9-vwfh-vxw4 AVIF/`libheif` RCE via Image Optimization | 16.3.3 disabled AVIF; 16.3.4 re-enabled with **`sharp@^0.35.4`**. Lockfile has `0.35.4`. App has **no** `next/image` usage, **no** `public/` images, **no** `images.remotePatterns` |
| Image optimizer DNS-rebinding SSRF (public notes around 16.4 canaries) | Requires remote image allowlist; **not configured** |

`npm audit` (prod+dev, 2026-09-12): 0 issues. Snyk’s public `next` page listed 16.3.4 as having no known direct vulnerabilities at review time.

Hardening note (not a finding): `next.config.ts` does not set `images.unoptimized: true`. The default optimizer endpoint is unused; disabling it would shrink future Image Optimization CVEs to zero.

### Next config / headers

```1:8:next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
};
```

No CSP / `frame-ancestors`. Destructive “Reset local plan” uses `window.confirm` (hard to clickjack). Refresh-via-clickjack is the same effect as M-1 with user interaction; not filed separately.

### Persistence / injection

- Plan parse rejects non-plain objects, bad codes, oversize arrays (`lib/plan.ts`).
- Prototype pollution via `JSON.parse` of LocalStorage is not a practical path here.
- No file upload / plan import.

### CI / GitHub

Private repo, no issues/PRs, no Actions, no Dependabot (see L-2).

---

## Out of scope / not reported

- Style, UX, or catalog-parse fidelity.
- Theoretical ReDoS on official catalog prose without a demonstrated hang.
- `CATALOG_DATA_PATH` arbitrary-file read (requires already controlling process environment; file must still pass `validateCatalog`).
- Attacking `catalog.northeastern.edu` itself.

## Suggested tickets (under harness#27)

1. **[Medium]** Restrict `POST /api/catalog` (localhost / secret / disable in production; bind `next start` to loopback in local scripts).
2. **[Low]** Sanitize catalog API error JSON.
3. **[Low]** Add CI audit + tests/build and Dependabot for `next`.

No code was changed for this review other than adding this report.
