import type {
  Catalog,
  DegreeProgressV2,
  DegreeRequirement,
  DegreeRequirementV2,
  RuleGroup,
  RuleGroupResult,
  StudentPlan,
} from "./types";
import {
  auditNotes,
  auditPlanCourses,
  chooseBreadth,
  hasBlockingIssue,
  sumCredits,
  type CountedCourse,
  type PlanCourseAudit,
} from "./validation";

const unique = (values: Iterable<string>): string[] => [...new Set(values)];

/** Expresses a v1 (fixed MSCS shape) requirement as a v2 rule-group tree. */
export function requirementsV2FromV1(requirements: DegreeRequirement): DegreeRequirementV2 {
  const rule = (pattern: RegExp) => requirements.rawRules.find((text) => pattern.test(text)) ?? "";
  const breadth = requirements.breadthRequirements;
  return {
    version: 2,
    name: requirements.name,
    catalogYear: requirements.catalogYear,
    minimumGpa: requirements.minimumGpa,
    officialUrl: requirements.officialUrl,
    uncertainties: requirements.uncertainties,
    lastUpdated: requirements.lastUpdated,
    root: {
      kind: "all",
      id: "program",
      label: requirements.name,
      rawText: rule(/complete all courses/i),
      children: [
        {
          kind: "choose-courses",
          id: "core",
          label: "Core requirements",
          rawText: "",
          count: requirements.coreCourses.length,
          courses: requirements.coreCourses,
        },
        {
          kind: "choose-areas",
          id: "breadth",
          label: "Breadth areas",
          rawText: rule(/from at least/i),
          count: breadth.coursesRequired,
          minAreas: breadth.minCategories,
          credits: breadth.credits,
          areas: breadth.categories,
        },
        {
          // The catalog lets breadth-area courses that breadth did not use count here.
          kind: "choose-credits",
          id: "electives",
          label: "Electives",
          rawText: rule(/semester hours from/i),
          credits: requirements.electiveCredits,
          courses: unique([...requirements.eligibleElectives, ...breadth.categories.flatMap((area) => area.courses)]),
        },
        {
          kind: "total-credits",
          id: "total",
          label: "Total credits",
          rawText: rule(/total semester hours/i),
          credits: requirements.totalCredits,
        },
      ],
    },
  };
}

function groupCodes(group: RuleGroup): string[] {
  switch (group.kind) {
    case "all":
      return group.children.flatMap(groupCodes);
    case "choose-courses":
    case "choose-credits":
      return group.courses;
    case "choose-areas":
      return group.areas.flatMap((area) => area.courses);
    case "total-credits":
    case "unmodeled":
      return [];
  }
}

function evaluateGroup(group: RuleGroup, audit: PlanCourseAudit, consumed: Set<string>): RuleGroupResult {
  const used = group.shareCourses ? new Set(consumed) : consumed;
  const credited = (codes: string[]) => audit.counted.filter((course) => codes.includes(course.code));
  const base = { id: group.id, kind: group.kind, label: group.label, rawText: group.rawText };
  const empty = { courses: [], waived: [], credits: 0, areas: [], children: [] };

  switch (group.kind) {
    case "all": {
      const children = group.children.map((child) => evaluateGroup(child, audit, used));
      const courses = unique(children.flatMap((child) => child.courses));
      return {
        ...base,
        ...empty,
        satisfied: children.every((child) => child.satisfied),
        courses,
        waived: unique(children.flatMap((child) => child.waived)),
        credits: sumCredits(credited(courses)),
        children,
      };
    }
    case "choose-courses": {
      const courses: string[] = [];
      const waived: string[] = [];
      for (const code of unique(group.courses)) {
        if (courses.length + waived.length >= group.count) break;
        if (used.has(code)) continue;
        if (audit.waived.has(code)) waived.push(code);
        else if (audit.completed.has(code) || audit.validPlanned.has(code)) courses.push(code);
      }
      for (const code of [...courses, ...waived]) used.add(code);
      return {
        ...base,
        ...empty,
        satisfied: courses.length + waived.length >= group.count,
        courses,
        waived,
        credits: sumCredits(credited(courses)),
      };
    }
    case "choose-credits": {
      // Every eligible unused course counts here, so the credit total is not capped at the target.
      const listed = new Set(group.courses);
      const picked = audit.counted.filter((course) => listed.has(course.code) && !used.has(course.code));
      for (const course of picked) used.add(course.code);
      const credits = sumCredits(picked);
      return { ...base, ...empty, satisfied: credits >= group.credits, courses: picked.map((course) => course.code), credits };
    }
    case "choose-areas": {
      const membership = new Map<string, string[]>();
      for (const area of group.areas) {
        for (const code of area.courses) membership.set(code, [...(membership.get(code) ?? []), area.id]);
      }
      const candidates: CountedCourse[] = audit.counted.filter(
        (course) => membership.has(course.code) && !used.has(course.code),
      );
      const allocation = chooseBreadth(candidates, group.count, group.minAreas, group.credits, membership);
      for (const course of allocation.selected) used.add(course.code);
      return {
        ...base,
        ...empty,
        satisfied: allocation.satisfied,
        courses: allocation.selected.map((course) => course.code),
        credits: sumCredits(allocation.selected),
        areas: allocation.categories,
      };
    }
    case "total-credits": {
      const credits = sumCredits(audit.counted);
      return { ...base, ...empty, satisfied: credits >= group.credits, credits };
    }
    case "unmodeled":
      return { ...base, ...empty, satisfied: false };
  }
}

/** Audits a plan against a v2 requirement tree. Allocation is deterministic: depth first, in tree order. */
export function validatePlanV2(plan: StudentPlan, catalog: Catalog, requirements: DegreeRequirementV2): DegreeProgressV2 {
  const audit = auditPlanCourses(plan, catalog, new Set(groupCodes(requirements.root)));
  const root = evaluateGroup(requirements.root, audit, new Set());
  const earnedCredits = sumCredits(audit.counted, "earned");
  const plannedCredits = sumCredits(audit.counted, "planned");
  return {
    earnedCredits,
    plannedCredits,
    totalCredits: earnedCredits + plannedCredits,
    root,
    issues: audit.issues,
    satisfied: root.satisfied && !hasBlockingIssue(audit.issues),
    notes: auditNotes(requirements.minimumGpa, requirements.uncertainties, catalog.warnings),
  };
}
