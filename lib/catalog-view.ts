import { pathwayRelevance } from "./graph";
import { recordedCourseCodes } from "./plan";
import type { Course, Pathway, StudentPlan } from "./types";
import { getEligibility } from "./validation";

export type CatalogTakeStatus = "recorded" | "can-take-now" | "blocked" | "review";

export type CatalogFilterState = {
  search: string;
  type: string;
  category: string;
  credits: string;
  topic: string;
  noPrereq: boolean;
  takeNow: boolean;
  blocked: boolean;
  minUnlocks: number | null;
};

export const DEFAULT_CATALOG_FILTERS: CatalogFilterState = {
  search: "",
  type: "all",
  category: "all",
  credits: "all",
  topic: "all",
  noPrereq: false,
  takeNow: false,
  blocked: false,
  minUnlocks: null,
};

export type CourseDependencyStats = {
  prereqCount: number;
  hasPrereqs: boolean;
  unlockCount: number;
  requiredByPathwayCount: number;
  pathwayNames: string[];
  pathwaySummary: string;
  terms: string[];
};

export function courseDependencyStats(
  course: Pick<Course, "code" | "prerequisiteCodes" | "prerequisites" | "unlocks" | "termOfferings">,
  pathways: readonly Pick<Pathway, "id" | "name" | "groups">[],
  preferredPathwayId?: string | null,
): CourseDependencyStats {
  const relevance = pathwayRelevance(course.code, pathways, preferredPathwayId);
  const pathwayIds = new Set(relevance.hits.map((hit) => hit.pathwayId));
  return {
    prereqCount: course.prerequisiteCodes.length,
    hasPrereqs: course.prerequisites.type !== "none",
    unlockCount: course.unlocks.length,
    requiredByPathwayCount: pathwayIds.size,
    pathwayNames: [...new Set(relevance.hits.map((hit) => hit.pathwayName))],
    pathwaySummary: relevance.summary,
    terms: course.termOfferings ?? [],
  };
}

export function catalogTakeStatus(course: Course, plan: StudentPlan): CatalogTakeStatus {
  const prior = new Set([...plan.completedCourses, ...plan.waivedCourses]);
  if (prior.has(course.code)) return "recorded";
  const eligibility = getEligibility(course, prior);
  if (eligibility.status === "locked") return "blocked";
  if (eligibility.status === "uncertain") return "review";
  if (recordedCourseCodes(plan).has(course.code)) return "recorded";
  return "can-take-now";
}

export function matchesCatalogFilters(course: Course, plan: StudentPlan, filters: CatalogFilterState): boolean {
  const normalized = filters.search.toLowerCase().replace(/\s/g, "");
  if (course.requirementType === "external" && !normalized) return false;
  const haystack = `${course.code} ${course.title} ${course.topics.join(" ")} ${course.description}`
    .toLowerCase()
    .replace(/\s/g, "");
  if (normalized && !haystack.includes(normalized)) return false;
  if (filters.type === "core" && course.requirementType !== "core") return false;
  if (filters.type === "breadth" && course.breadthCategories.length === 0) return false;
  if (filters.type === "elective" && !course.electiveEligible) return false;
  if (filters.category !== "all" && !course.breadthCategories.includes(filters.category)) return false;
  if (filters.credits === "variable" && (course.maxCredits === undefined || course.maxCredits === course.credits)) {
    return false;
  }
  if (
    filters.credits !== "all" &&
    filters.credits !== "variable" &&
    (Number(filters.credits) < course.credits || Number(filters.credits) > (course.maxCredits ?? course.credits))
  ) {
    return false;
  }
  if (filters.noPrereq && course.prerequisites.type !== "none") return false;
  const take = catalogTakeStatus(course, plan);
  if (filters.takeNow && take !== "can-take-now") return false;
  if (filters.blocked && take !== "blocked") return false;
  if (filters.topic !== "all" && !course.topics.includes(filters.topic)) return false;
  if (filters.minUnlocks !== null && course.unlocks.length <= filters.minUnlocks) return false;
  return true;
}

export function filterCatalogCourses(
  courses: readonly Course[],
  plan: StudentPlan,
  filters: CatalogFilterState,
): Course[] {
  return courses.filter((course) => matchesCatalogFilters(course, plan, filters));
}

export function consumeExploreFocus(
  requestedFocus: string | null | undefined,
  knownCodes: ReadonlySet<string> | Iterable<string>,
  lastApplied: { current: string | null },
): string | null {
  if (!requestedFocus) return null;
  const known = knownCodes instanceof Set ? knownCodes : new Set(knownCodes);
  if (!known.has(requestedFocus)) return null;
  if (lastApplied.current === requestedFocus) return null;
  lastApplied.current = requestedFocus;
  return requestedFocus;
}
