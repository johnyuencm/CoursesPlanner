// Drop-in `validatePlan` for tests: runs v1 and v2 (via the MSCS converter) and fails on any difference.
// Every existing validation scenario imports this, so each one is also an equivalence check (#63).
import { strict as assert } from "node:assert";

import { requirementsV2FromV1, validatePlanV2 } from "../lib/requirements-v2";
import type { Catalog, DegreeProgress, DegreeProgressV2, RuleGroup, RuleGroupResult, StudentPlan } from "../lib/types";
import { validatePlan as validatePlanV1 } from "../lib/validation";

function find<T extends { id: string }>(node: T, id: string): T | undefined {
  if (node.id === id) return node;
  for (const child of (node as { children?: T[] }).children ?? []) {
    const hit = find(child, id);
    if (hit) return hit;
  }
  return undefined;
}

function must<T>(value: T | undefined, id: string): T {
  if (value === undefined) throw new Error(`No rule group ${id}`);
  return value;
}

/** Projects a v2 audit onto the v1 `DegreeProgress` fields the UI reads. */
export function progressV1FromV2(progress: DegreeProgressV2, root: RuleGroup): DegreeProgress {
  const group = (id: string) => must(find(root, id), id);
  const result = (id: string) => must(find<RuleGroupResult>(progress.root, id), id);
  const core = group("core");
  const breadth = group("breadth");
  const electives = group("electives");
  const total = group("total");
  if (core.kind !== "choose-courses" || breadth.kind !== "choose-areas" || electives.kind !== "choose-credits" || total.kind !== "total-credits") {
    throw new Error("Not an MSCS-shaped tree");
  }
  const coreResult = result("core");
  const breadthResult = result("breadth");
  return {
    earnedCredits: progress.earnedCredits,
    plannedCredits: progress.plannedCredits,
    totalCredits: progress.totalCredits,
    requiredCredits: total.credits,
    core: core.courses.map((code) => {
      const waived = coreResult.waived.includes(code);
      return { code, waived, satisfied: waived || coreResult.courses.includes(code) };
    }),
    breadth: {
      assignedCourses: breadthResult.courses,
      categoriesSatisfied: breadthResult.areas,
      coursesRequired: breadth.count,
      minCategories: breadth.minAreas,
      satisfied: breadthResult.satisfied,
    },
    electiveCredits: result("electives").credits,
    requiredElectiveCredits: electives.credits,
    issues: progress.issues,
    satisfied: progress.satisfied,
    notes: progress.notes,
  };
}

export function validatePlan(plan: StudentPlan, catalog: Catalog): DegreeProgress {
  const v1 = validatePlanV1(plan, catalog);
  const requirements = requirementsV2FromV1(catalog.requirements);
  const v2 = validatePlanV2(plan, catalog, requirements);
  assert.deepEqual(progressV1FromV2(v2, requirements.root), v1, "v1 and v2 audits differ");
  return v1;
}
