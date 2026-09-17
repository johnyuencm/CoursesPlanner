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
  breadthCategories: string[];
  requirementType: "core" | "breadth" | "elective" | "program" | "external";
  electiveEligible: boolean;
  topics: string[];
  officialUrl: string;
  uncertainties: string[];
}

export interface BreadthCategory {
  id: string;
  name: string;
  courses: string[];
}

export interface DegreeRequirement {
  name: string;
  catalogYear: string;
  totalCredits: number;
  minimumGpa: number;
  coreCourses: string[];
  breadthRequirements: {
    coursesRequired: number;
    minCategories: number;
    credits: number;
    categories: BreadthCategory[];
  };
  electiveCredits: number;
  eligibleElectives: string[];
  officialUrl: string;
  rawRules: string[];
  uncertainties: string[];
  lastUpdated: string;
}

export interface Catalog {
  id?: string;
  university?: string;
  program?: string;
  adapter?: string;
  courses: Course[];
  requirements: DegreeRequirement;
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

export interface DegreeProgress {
  earnedCredits: number;
  plannedCredits: number;
  totalCredits: number;
  requiredCredits: number;
  core: { code: string; satisfied: boolean; waived: boolean }[];
  breadth: {
    assignedCourses: string[];
    categoriesSatisfied: string[];
    coursesRequired: number;
    minCategories: number;
    satisfied: boolean;
  };
  electiveCredits: number;
  requiredElectiveCredits: number;
  issues: PlanIssue[];
  satisfied: boolean;
  notes: string[];
}

export interface Pathway {
  id: string;
  name: string;
  description: string;
  groups: { label: string; courses: string[] }[];
}
