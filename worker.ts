import vinext from "vinext/server/app-router-entry";
import { CATALOGS } from "./lib/catalog-key";
import { isProgramPath, isUnknownProgramPath, programPagePaths } from "./lib/course-pages";
import { readProgramCatalog } from "./lib/program-catalog";
import { legacyDestination } from "./lib/routes";

// An unknown program or course page renders notFound() inside the layouts: p50 15 ms CPU, over the
// Workers Free 10 ms limit. A route miss renders app/global-not-found.tsx without the layouts.
// This check runs before vinext, so real pages still get the prerendered HTML directly.
// A proxy.ts did the same job, but vinext middleware made every course page slower (docs/deploy.md).
// The page paths of a program come from its published catalog (static assets), once per isolate.
// An unknown program needs no catalog read.
const pages = new Map<string, Promise<Set<string>>>();
const NO_PAGES: ReadonlySet<string> = new Set();

function programPages(key: string): Promise<ReadonlySet<string>> {
  if (!Object.hasOwn(CATALOGS, key)) return Promise.resolve(NO_PAGES);
  let known = pages.get(key);
  if (!known) {
    known = readProgramCatalog(key).then((catalog) => new Set(programPagePaths(key, catalog)));
    known.catch(() => pages.delete(key)); // try again on the next request
    pages.set(key, known);
  }
  return known;
}

export default {
  async fetch(request: Request, env: Parameters<typeof vinext.fetch>[1], ctx: Parameters<typeof vinext.fetch>[2]) {
    const url = new URL(request.url);
    // An old URL with a trailing slash (`/courses/`): one hop to the new path, not two.
    const legacy = url.pathname.length > 1 && url.pathname.endsWith("/") ? legacyDestination(url.pathname.slice(0, -1)) : null;
    if (legacy) return new Response(null, { status: 308, headers: { Location: legacy + url.search } });
    if (isProgramPath(url.pathname)) {
      // Without the catalog, vinext renders the page and answers as before.
      const known = await programPages(url.pathname.split("/", 3).slice(1).join("/")).catch(() => undefined);
      if (known && isUnknownProgramPath(url.pathname, known)) request = new Request(new URL("/__unknown-page", url), request);
    }
    return vinext.fetch(request, env, ctx);
  },
};
