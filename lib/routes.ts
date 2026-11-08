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

/** Old top-level URLs. `next.config.ts` serves them as redirects; the query string stays. `/` is the program picker (#72). */
export const legacyRedirects = [
  { source: "/map", destination: `${defaultProgram}/explore`, permanent: true },
  // Exact rules: vinext gives `/courses/:path*` with no path a trailing slash, so a second redirect.
  ...["/explore", "/planner", "/courses", "/pathways", "/courses/:slug", "/pathways/:id"].map((source) => (
    { source, destination: `${defaultProgram}${source}`, permanent: true }
  )),
];

/**
 * The new path of an old top-level path, or null. The rules are `legacyRedirects` (`:name` matches one segment).
 * `worker.ts` uses it for a trailing slash (`/courses/`). Else vinext removes the slash first: a second hop.
 */
export function legacyDestination(pathname: string): string | null {
  const parts = pathname.split("/");
  for (const { source, destination } of legacyRedirects) {
    const pattern = source.split("/");
    const match = pattern.length === parts.length && pattern.every((part, index) => part.startsWith(":") ? parts[index] !== "" : part === parts[index]);
    if (match) return destination.replace(/:\w+/g, (name) => parts[pattern.indexOf(name)]!);
  }
  return null;
}
