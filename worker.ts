import vinext from "vinext/server/app-router-entry";
// @ts-ignore vite.config.ts provides this module: every page path, made at build time (#110).
import pagePaths from "virtual:program-pages";
import { isUnknownProgramPath } from "./lib/course-pages";
import { unknownPageResponse } from "./lib/not-found";
import { legacyDestination } from "./lib/routes";

// An unknown program or course page renders notFound() inside the layouts: p50 15 ms CPU, over the
// Workers Free 10 ms limit. Even the layout-free global-not-found render cost p50 7 ms (#110), so this
// check answers with a static 404 string and never calls vinext. Real pages still get the prerendered HTML.
// A proxy.ts did the same job, but vinext middleware made every course page slower (docs/deploy.md).
// The page paths are a small list in the bundle. Before #110 the first program request of each
// isolate read and parsed the full catalog to make them, and every program request waited for it.
const pages: ReadonlySet<string> = new Set(pagePaths as string[]);

export default {
  async fetch(request: Request, env: Parameters<typeof vinext.fetch>[1], ctx: Parameters<typeof vinext.fetch>[2]) {
    const url = new URL(request.url);
    // An old URL with a trailing slash (`/courses/`): one hop to the new path, not two.
    const legacy = url.pathname.length > 1 && url.pathname.endsWith("/") ? legacyDestination(url.pathname.slice(0, -1)) : null;
    if (legacy) return new Response(null, { status: 308, headers: { Location: legacy + url.search } });
    if (isUnknownProgramPath(url.pathname, pages)) return unknownPageResponse();
    return vinext.fetch(request, env, ctx);
  },
};
