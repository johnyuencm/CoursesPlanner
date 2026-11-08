import vinext from "vinext/server/app-router-entry";
import catalog from "./data/catalog.json";
import { courseSlug, isUnknownCoursePath, publicCourses } from "./lib/course-pages";
import type { Catalog } from "./lib/types";

// An unknown /courses/<slug> renders notFound() inside the root layout: p50 15 ms CPU, over the
// Workers Free 10 ms limit. A route miss renders app/global-not-found.tsx without the layout.
// This check runs before vinext, so real course pages still get the prerendered HTML directly.
// A proxy.ts did the same job, but vinext middleware made every course page slower (docs/deploy.md).
let slugs: Set<string> | undefined;

export default {
  fetch(request: Request, env: Parameters<typeof vinext.fetch>[1], ctx: Parameters<typeof vinext.fetch>[2]) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/courses/")) {
      slugs ??= new Set(publicCourses(catalog as Catalog).map((course) => courseSlug(course.code)));
      if (isUnknownCoursePath(url.pathname, slugs)) request = new Request(new URL("/__unknown-course", url), request);
    }
    return vinext.fetch(request, env, ctx);
  },
};
