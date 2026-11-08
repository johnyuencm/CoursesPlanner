import { DEFAULT_CATALOG_KEY } from "./catalog-key";
import { catalogCodeGrammar } from "./course-code";

/** Page paths of one program. Every page lives under `/<universityId>/<programId>` (#71). */
export function programRoutes(catalogKey: string) {
  const base = `/${catalogKey}`;
  return {
    overview: base,
    explore: `${base}/explore`,
    plan: `${base}/planner`,
    courses: `${base}/courses`,
    paths: `${base}/pathways`,
    course: (slug: string) => `${base}/courses/${slug}`,
    pathway: (id: string) => `${base}/pathways/${id}`,
    /** Explore with `?focus=` (Courses → Explore deep link). */
    exploreFocus: (code: string) => `${base}/explore?focus=${encodeURIComponent(code)}`,
    /** Deep links to the target path and critical path panels on Plan. */
    targetPath: `${base}/planner#target-path`,
    criticalPath: `${base}/planner#critical-path`,
  };
}

export type ProgramRoutes = ReturnType<typeof programRoutes>;

/** Normalize `?focus=` from Courses → Explore with the active catalog's grammar (Northeastern: `CS 5500` or `CS5500`). */
export function parseExploreFocus(value: string | null | undefined, grammar = catalogCodeGrammar()): string | null {
  return value ? grammar.normalize(value) : null;
}

export function primaryNav(routes: ProgramRoutes) {
  return [
    { href: routes.explore, label: "Explore" },
    { href: routes.plan, label: "Plan" },
    { href: routes.courses, label: "Courses" },
    { href: routes.paths, label: "Paths" },
  ] as const;
}

const defaultProgram = `/${DEFAULT_CATALOG_KEY}`;

/**
 * Old top-level URLs. `next.config.ts` serves them as redirects; the query string stays.
 * `/` is a temporary redirect, because T8 (#72) makes `/` the program picker.
 */
export const legacyRedirects = [
  { source: "/", destination: defaultProgram, permanent: false },
  { source: "/map", destination: `${defaultProgram}/explore`, permanent: true },
  // Exact rules: vinext gives `/courses/:path*` with no path a trailing slash, so a second redirect.
  ...["/explore", "/planner", "/courses", "/pathways", "/courses/:slug", "/pathways/:id"].map((source) => (
    { source, destination: `${defaultProgram}${source}`, permanent: true }
  )),
];
