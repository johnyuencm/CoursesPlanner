import type { Catalog, Course, Pathway, RequirementExpression } from "./types";

/** Public site origin for canonical URLs and the sitemap. */
export const SITE_URL = "https://coursesplanner.johnyc.com";

/** "CS 5010" -> "cs-5010" (URL segment for /courses/<slug>). */
export function courseSlug(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Courses that get their own page: every course with real catalog text. Placeholder externals stay out (thin). */
export function publicCourses(catalog: Catalog): Course[] {
  return catalog.courses
    .filter((course) => !course.description.includes("unavailable in the cached")) // the scraper's placeholder text
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

export function courseBySlug(catalog: Catalog, slug: string): Course | undefined {
  return publicCourses(catalog).find((course) => courseSlug(course.code) === slug);
}

/** Every course that this course opens, directly or through a chain. */
export function transitiveUnlocks(code: string, courses: readonly Course[]): string[] {
  const byCode = new Map(courses.map((course) => [course.code, course]));
  const seen = new Set<string>();
  const stack = [...(byCode.get(code)?.unlocks ?? [])];
  while (stack.length) {
    const next = stack.pop()!;
    if (seen.has(next) || next === code) continue;
    seen.add(next);
    stack.push(...(byCode.get(next)?.unlocks ?? []));
  }
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Fewest courses in a row that end at this course, oldest first (the course itself is last).
 * "and" requirements take their longest branch, "or" requirements their shortest one.
 * A code outside the catalog counts as one course with no known prerequisites.
 */
export function shortestPrerequisiteChain(code: string, courses: readonly Course[]): string[] {
  const byCode = new Map(courses.map((course) => [course.code, course]));
  const memo = new Map<string, string[]>();
  const walk = (current: string, path: ReadonlySet<string>): string[] => {
    const cached = memo.get(current);
    if (cached) return cached;
    const chainOf = (expr: RequirementExpression): string[] => {
      if (expr.type === "none" || expr.type === "unknown") return [];
      if (expr.type === "course") {
        if (path.has(expr.code)) return []; // cycle guard
        return byCode.has(expr.code) ? walk(expr.code, new Set(path).add(expr.code)) : [expr.code];
      }
      const chains = expr.items.map(chainOf);
      if (!chains.length) return [];
      return chains.reduce((best, chain) => (expr.type === "all" ? chain.length > best.length : chain.length < best.length) ? chain : best);
    };
    const result = [...chainOf(byCode.get(current)?.prerequisites ?? { type: "none" }), current];
    memo.set(current, result);
    return result;
  };
  return walk(code, new Set([code]));
}

/** Paths (personas) that list this course, with the group label it is in. */
export function pathwaysFor(code: string, pathways: readonly Pathway[]): { pathway: Pathway; group: string }[] {
  return pathways.flatMap((pathway) =>
    pathway.groups.filter((group) => group.courses.includes(code)).map((group) => ({ pathway, group: group.label })),
  );
}

/** Short role of the course in the MSCS Seattle degree. */
export function requirementLabel(course: Course, catalog: Catalog): string {
  if (course.requirementType === "core") return "Required core course";
  if (course.requirementType === "breadth") {
    const names = catalog.requirements.breadthRequirements.categories
      .filter((category) => category.courses.includes(course.code))
      .map((category) => category.name);
    return names.length ? `Breadth course: ${names.join(", ")}` : "Breadth course";
  }
  if (course.requirementType === "elective") return "Counts as an elective";
  if (course.requirementType === "program") return "Listed in the program";
  return "Outside the degree requirements (a prerequisite for program courses)";
}

/** Short prerequisite text that keeps "and" / "or": "CS 5800 or CS 7800", "(A or B) and C". */
export function requirementText(expr: RequirementExpression, nested = false): string {
  if (expr.type === "none") return "";
  if (expr.type === "course") return expr.code;
  if (expr.type === "unknown") return expr.text;
  const parts = expr.items.map((item) => requirementText(item, true)).filter(Boolean);
  const text = parts.join(expr.type === "all" ? " and " : " or ");
  return nested && parts.length > 1 ? `(${text})` : text;
}

/**
 * Prerequisites that the given set of courses does not cover. Each entry is one requirement:
 * a single code, or the codes of an "or" group where none is in the set (take any one of them).
 */
export function unmetRequirements(expr: RequirementExpression, have: ReadonlySet<string>): string[][] {
  if (expr.type === "none" || expr.type === "unknown") return [];
  if (expr.type === "course") return have.has(expr.code) ? [] : [[expr.code]];
  const children = expr.items.map((item) => unmetRequirements(item, have));
  if (expr.type === "all") return children.flat();
  if (children.some((child) => child.length === 0)) return []; // one alternative is already covered
  return [[...new Set(children.flat(2))]];
}

export function creditsLabel(course: Course): string {
  const credits = course.maxCredits && course.maxCredits !== course.credits ? `${course.credits}–${course.maxCredits}` : `${course.credits}`;
  return `${credits} credit${course.credits === 1 && !course.maxCredits ? "" : "s"}`;
}
