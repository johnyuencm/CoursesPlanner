import vinext from "vinext/server/app-router-entry";
import { readCatalog } from "./lib/catalog";
import { courseSlug, isUnknownCoursePath, publicCourses } from "./lib/course-pages";

// An unknown /courses/<slug> renders notFound() inside the root layout: p50 15 ms CPU, over the
// Workers Free 10 ms limit. A route miss renders app/global-not-found.tsx without the layout.
// This check runs before vinext, so real course pages still get the prerendered HTML directly.
// A proxy.ts did the same job, but vinext middleware made every course page slower (docs/deploy.md).
// The slugs come from the published catalog (static assets), once per isolate.
let slugs: Promise<Set<string>> | undefined;

function courseSlugs(): Promise<Set<string>> {
  slugs ??= readCatalog().then((catalog) => new Set(publicCourses(catalog).map((course) => courseSlug(course.code, catalog))));
  slugs.catch(() => { slugs = undefined; }); // try again on the next request
  return slugs;
}

export default {
  async fetch(request: Request, env: Parameters<typeof vinext.fetch>[1], ctx: Parameters<typeof vinext.fetch>[2]) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/courses/")) {
      // Without the catalog, vinext renders the page and answers as before.
      const known = await courseSlugs().catch(() => undefined);
      if (known && isUnknownCoursePath(url.pathname, known)) request = new Request(new URL("/__unknown-course", url), request);
    }
    return vinext.fetch(request, env, ctx);
  },
};
