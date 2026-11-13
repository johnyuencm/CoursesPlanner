export type RequirementExpression =
  | { type: "none" }
  | { type: "course"; code: string; minimumGrade?: string; concurrent?: boolean }
  | { type: "all" | "any"; items: RequirementExpression[] }
  | { type: "unknown"; text: string };

export interface Course {
  code: string;
  title: string;
  credits: number;
  maxCredits?: number;
  description: string;
  prerequisites: RequirementExpression;
  corequisites: RequirementExpression;
  prerequisiteText: string;
  corequisiteText: string;
  prerequisiteCodes: string[];
  corequisiteCodes: string[];
  unlocks: string[];
  /**
   * Course roles derived from the program's v2 rule groups by the parser (`requirementView`):
   * `breadthCategories` are the `choose-areas` area ids that list the course, "core" is a course
   * of a `choose-courses` group that needs every listed course, and `electiveEligible` means a
   * `choose-credits` group lists it. Roadmaps use "program" or "external". The audit reads the tree, not these fields.
   */
  breadthCategories: string[];
  requirementType: "core" | "breadth" | "elective" | "program" | "external";
  electiveEligible: boolean;
  topics: string[];
  officialUrl: string;
  uncertainties: string[];
  /** Catalog term offerings when a source provides them; omitted means unknown. */
  termOfferings?: string[];
}

export interface BreadthCategory {
  id: string;
  name: string;
  courses: string[];
}

interface RuleGroupBase {
  id: string;
  label: string;
  /** Catalog wording this group models; empty when the catalog gives none. */
  rawText: string;
  /**
   * The catalog allows double counting for this group (and its subtree). It is two-sided:
   * the group may use any course, including courses that other groups use, and the courses
   * it uses stay available to every other group.
   */
  shareCourses?: boolean;
}

/**
 * Requirement model v2: a tree of rule groups.
 * One course counts toward one group unless a group sets `shareCourses`.
 * The audit searches for an allocation that meets every group. When no allocation
 * can meet every group, earlier groups (depth first, in tree order) have priority.
 */
export type RuleGroup =
  | (RuleGroupBase & { kind: "all"; children: RuleGroup[] })
  | (RuleGroupBase & { kind: "choose-courses"; count: number; courses: string[] })
  | (RuleGroupBase & { kind: "choose-credits"; credits: number; courses: string[] })
  | (RuleGroupBase & { kind: "choose-areas"; count: number; minAreas: number; credits: number; areas: BreadthCategory[] })
  | (RuleGroupBase & { kind: "total-credits"; credits: number })
  | (RuleGroupBase & { kind: "unmodeled" });

export interface DegreeRequirementV2 {
  version: 2;
  name: string;
  catalogYear: string;
  minimumGpa?: number;
  officialUrl: string;
  uncertainties: string[];
  lastUpdated: string;
  root: RuleGroup;
}

export interface RuleGroupResult {
  id: string;
  kind: RuleGroup["kind"];
  label: string;
  rawText: string;
  satisfied: boolean;
  /** Courses allocated to this group (subtree for `all`), in allocation order. */
  courses: string[];
  /** Waived courses that satisfy a `choose-courses` slot; they earn no credit. */
  waived: string[];
  credits: number;
  /** `choose-areas` only: areas matched one course each. */
  areas: string[];
  /** Progress against the target, for example "8 of 12 credits". Empty for `all` and `unmodeled`. */
  summary: string;
  children: RuleGroupResult[];
}

/**
 * Audit: every top-level group is modeled and their credits add up to the program total.
 * Map: anything less. A Map-tier program gets plan checks, but no degree audit.
 */
export type SupportTier = "audit" | "map";

export interface DegreeProgressV2 {
  tier: SupportTier;
  earnedCredits: number;
  plannedCredits: number;
  totalCredits: number;
  /** The top-level `total-credits` target, or null when the tree has none. */
  requiredCredits: number | null;
  root: RuleGroupResult;
  issues: PlanIssue[];
  satisfied: boolean;
  notes: string[];
}

export interface Catalog {
  id?: string;
  university?: string;
  program?: string;
  /** Short name of the college and program for page titles, for example "NEU MSCS Seattle" (#117). */
  shortName?: string;
  adapter?: string;
  courses: Course[];
  requirements: DegreeRequirementV2;
  lastUpdated: string;
  sources: string[];
  warnings: string[];
}

export type RoadmapStatus = "unverified" | "queued" | "ready" | "unsupported" | "error";
export type ProgramKind = "degree" | "major" | "minor" | "certificate" | "other";

export interface DiscoveredProgram {
  id: string;
  universityId: string;
  university: string;
  name?: string;
  kind?: ProgramKind;
  officialUrl: string;
  status: RoadmapStatus;
  statusUpdatedAt: string;
  reason?: string;
}

export interface DiscoveredPrograms {
  version: 1;
  universityId: string;
  university: string;
  adapter: string;
  sourceUrl: string;
  discoveredAt: string;
  programs: DiscoveredProgram[];
}

export interface ProgramRoadmap {
  universityId: string;
  university: string;
  programId: string;
  program: string;
  /** `Catalog.shortName`. The crawl copies it from `crawl.shortNames` in catalog-service/universities.json. */
  shortName?: string;
  adapter: string;
  officialUrl: string;
  programCourseCodes: string[];
  courses: Course[];
  lastUpdated: string;
  sources: string[];
  warnings: string[];
}

export interface RoadmapStatusCounts {
  queued: number;
  ready: number;
  unsupported: number;
  error: number;
}

export interface RoadmapCrawlStatus {
  version: 1;
  universityId: string;
  status: RoadmapStatus;
  discoveryStatus: RoadmapStatus;
  queue: string[];
  counts: RoadmapStatusCounts;
  updatedAt: string;
  reason?: string;
}

export interface ProgramDirectoryResponse {
  universityId: string;
  programs: DiscoveredProgram[];
  status: RoadmapCrawlStatus;
}

export interface PlannedCourse {
  code: string;
  credits?: number;
}

export interface Semester {
  id: string;
  name: string;
  type: "academic" | "coop";
  courses: PlannedCourse[];
}

export interface StudentPlan {
  version: 1;
  completedCourses: string[];
  waivedCourses: string[];
  completedCredits: Record<string, number>;
  semesters: Semester[];
}

export interface Eligibility {
  status: "eligible" | "locked" | "uncertain";
  missing: string[];
  reasons: string[];
}

export interface PlanIssue {
  kind: "prerequisite" | "corequisite" | "duplicate" | "unknown" | "credits";
  severity: "error" | "warning";
  courseCode: string;
  semesterId?: string;
  message: string;
  relatedCourses: string[];
}

export interface Pathway {
  id: string;
  name: string;
  description: string;
  groups: { label: string; courses: string[] }[];
}
