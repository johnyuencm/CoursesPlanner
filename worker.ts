import vinext from "vinext/server/app-router-entry";
import { readCatalog } from "./lib/catalog";
import { CATALOGS } from "./lib/catalog-key";
import { isProgramPath, isUnknownProgramPath, programPagePaths } from "./lib/course-pages";

// An unknown program or course page renders notFound() inside the layouts: p50 15 ms CPU, over the
// Workers Free 10 ms limit. A route miss renders app/global-not-found.tsx without the layouts.
// This check runs before vinext, so real pages still get the prerendered HTML directly.
// A proxy.ts did the same job, but vinext middleware made every course page slower (docs/deploy.md).
// The page paths come from the published catalog (static assets), once per isolate.
let pages: Promise<Set<string>> | undefined;

function programPages(): Promise<Set<string>> {
  // ponytail: every catalog key serves the default catalog today (lib/catalog-key.ts CATALOGS).
  pages ??= readCatalog().then((catalog) => new Set(Object.keys(CATALOGS).flatMap((key) => programPagePaths(key, catalog))));
  pages.catch(() => { pages = undefined; }); // try again on the next request
  return pages;
}

export default {
  async fetch(request: Request, env: Parameters<typeof vinext.fetch>[1], ctx: Parameters<typeof vinext.fetch>[2]) {
    const url = new URL(request.url);
    if (isProgramPath(url.pathname)) {
      // Without the catalog, vinext renders the page and answers as before.
      const known = await programPages().catch(() => undefined);
      if (known && isUnknownProgramPath(url.pathname, known)) request = new Request(new URL("/__unknown-page", url), request);
    }
    return vinext.fetch(request, env, ctx);
  },
};
