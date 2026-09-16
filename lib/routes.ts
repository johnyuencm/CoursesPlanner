export const routes = {
  overview: "/",
  explore: "/explore",
  plan: "/planner",
  courses: "/courses",
  paths: "/pathways",
} as const;

/** Deep-link stub for the target path panel (Why-blocked follow-up can reuse this). */
export const targetPathHref = `${routes.plan}#target-path`;

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
