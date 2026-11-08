import { catalogCodeGrammar } from "./course-code";

export const routes = {
  overview: "/",
  explore: "/explore",
  plan: "/planner",
  courses: "/courses",
  paths: "/pathways",
} as const;

/** Deep-link for the target path panel (blocked-course chain UI reuses the same helpers). */
export const targetPathHref = `${routes.plan}#target-path`;
export const criticalPathHref = `${routes.plan}#critical-path`;

/** Normalize `?focus=` from Courses → Explore with the active catalog's grammar (Northeastern: `CS 5500` or `CS5500`). */
export function parseExploreFocus(value: string | null | undefined, grammar = catalogCodeGrammar()): string | null {
  return value ? grammar.normalize(value) : null;
}

export function exploreFocusHref(code: string): string {
  return `${routes.explore}?focus=${encodeURIComponent(code)}`;
}

export const primaryNav = [
  { href: routes.explore, label: "Explore" },
  { href: routes.plan, label: "Plan" },
  { href: routes.courses, label: "Courses" },
  { href: routes.paths, label: "Paths" },
] as const;

/** Old bookmarks. Keep in sync with `redirects` in next.config.ts. */
export const legacyRedirects = [
  { source: "/map", destination: routes.explore, permanent: true },
] as const;
