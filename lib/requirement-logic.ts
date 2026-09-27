import type { RequirementExpression } from "./types";

export type GraphJoin = "all" | "any" | "course";

export const REQUIREMENT_ALL_LABEL = "ALL of the following (AND)";
export const REQUIREMENT_ANY_LABEL = "ANY of the following (OR)";

export function requirementCodes(expression: RequirementExpression, output = new Set<string>()): string[] {
  if (expression.type === "course") output.add(expression.code);
  if (expression.type === "all" || expression.type === "any") {
    for (const item of expression.items) requirementCodes(item, output);
  }
  return [...output].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function requirementItemKey(item: RequirementExpression): string {
  switch (item.type) {
    case "none":
      return "none";
    case "unknown":
      return `unknown:${item.text}`;
    case "course":
      return `course:${item.code}:${item.minimumGrade ?? ""}:${item.concurrent ? "1" : "0"}`;
    case "all":
    case "any":
      return `${item.type}:${item.items.map(requirementItemKey).join("|")}`;
  }
}

function uniqueRequirementItems(items: RequirementExpression[]): RequirementExpression[] {
  const seen = new Set<string>();
  const result: RequirementExpression[] = [];
  for (const item of items) {
    const key = requirementItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

/** Collapse nested same-operator groups and duplicate course leaves for display and join grouping. */
export function simplifyRequirement(expression: RequirementExpression): RequirementExpression {
  if (expression.type !== "all" && expression.type !== "any") return expression;
  const flattened: RequirementExpression[] = [];
  for (const item of expression.items.map(simplifyRequirement)) {
    if (item.type === expression.type) flattened.push(...item.items);
    else flattened.push(item);
  }
  const items = uniqueRequirementItems(flattened);
  if (items.length === 0) return { type: "none" };
  if (items.length === 1) return items[0]!;
  return { type: expression.type, items };
}

export type RequirementJoinGroup = {
  id: string;
  join: GraphJoin | "unknown";
  codes: string[];
  label: string;
};

function groupFromItem(id: string, item: RequirementExpression): RequirementJoinGroup {
  if (item.type === "course") {
    return { id, join: "course", codes: [item.code], label: item.code };
  }
  if (item.type === "any") {
    return { id, join: "any", codes: requirementCodes(item), label: REQUIREMENT_ANY_LABEL };
  }
  if (item.type === "all") {
    return { id, join: "all", codes: requirementCodes(item), label: REQUIREMENT_ALL_LABEL };
  }
  return { id, join: "unknown", codes: [], label: "Needs review" };
}

/**
 * Incoming named-course groups for one expression.
 * Top-level OR is one group. Top-level AND keeps course conjuncts on one AND bus
 * and isolates nested OR alternatives on their own bus.
 */
export function requirementJoinGroups(expression: RequirementExpression): RequirementJoinGroup[] {
  const flat = simplifyRequirement(expression);
  if (flat.type === "none") return [];
  if (flat.type === "unknown") return [{ id: "unknown", join: "unknown", codes: [], label: "Needs review" }];
  if (flat.type === "course") return [groupFromItem(`course:${flat.code}`, flat)];
  if (flat.type === "any") return [groupFromItem("any", flat)];

  const groups: RequirementJoinGroup[] = [];
  let courseCodes: string[] = [];
  const flushCourses = () => {
    if (!courseCodes.length) return;
    groups.push({
      id: `all:${groups.length}`,
      join: "all",
      codes: [...new Set(courseCodes)].sort((left, right) => left.localeCompare(right, undefined, { numeric: true })),
      label: REQUIREMENT_ALL_LABEL,
    });
    courseCodes = [];
  };
  for (const item of flat.items) {
    if (item.type === "course") {
      courseCodes.push(item.code);
      continue;
    }
    flushCourses();
    groups.push(groupFromItem(`all:${groups.length}`, item));
  }
  flushCourses();
  return groups;
}

export function namedPrerequisiteJoin(expression: RequirementExpression, code: string): GraphJoin | "unknown" {
  const group = requirementJoinGroups(expression).find((item) => item.codes.includes(code));
  if (!group || group.join === "unknown") return "unknown";
  return group.join;
}

export function namedPrerequisiteGroupId(expression: RequirementExpression, code: string): string | undefined {
  return requirementJoinGroups(expression).find((item) => item.codes.includes(code))?.id;
}

export function requirementOperatorLabel(join: "all" | "any"): string {
  return join === "all" ? REQUIREMENT_ALL_LABEL : REQUIREMENT_ANY_LABEL;
}

export function graphJoinStrokeDasharray(join?: GraphJoin | "unknown", corequisite = false): string | undefined {
  if (corequisite) return "2 3";
  if (join === "any") return "7 5";
  return undefined;
}

export function graphJoinMarker(join?: GraphJoin | "unknown", corequisite = false): "AND" | "OR" | "corequisite" | undefined {
  if (corequisite) return "corequisite";
  if (join === "any") return "OR";
  if (join === "all") return "AND";
  return undefined;
}

export function busGroupKey(target: string, groupId?: string): string {
  return groupId ? `${target}::${groupId}` : target;
}

export type RelationshipExplanation = {
  title: string;
  body: string;
  note: string;
};

const CATALOG_RULE_NOTE =
  "A line records a named catalog link; the rule above states whether prerequisites are AND, OR, or need review.";

export function relationshipExplanationCopy(input: {
  kind: "branch" | "bus";
  source?: string;
  target: string;
  sources: readonly string[];
  join?: GraphJoin | "unknown";
  corequisite?: boolean;
}): RelationshipExplanation {
  const { kind, source, target, sources, join, corequisite } = input;
  if (corequisite) {
    return {
      title: kind === "branch" && source ? `${source} → ${target}` : `${target} · corequisites`,
      body:
        kind === "branch" && source
          ? `${source} is a corequisite of ${target}. Take together.`
          : `Take together · corequisites: ${sources.join(", ")}.`,
      note: CATALOG_RULE_NOTE,
    };
  }
  if (kind === "branch" && source) {
    if (join === "any") {
      return {
        title: `${source} → ${target}`,
        body: `${source} is named as an OR alternative of ${target}.`,
        note: CATALOG_RULE_NOTE,
      };
    }
    if (join === "all") {
      return {
        title: `${source} → ${target}`,
        body: `${source} is named in the AND group for ${target}.`,
        note: CATALOG_RULE_NOTE,
      };
    }
    return {
      title: `${source} → ${target}`,
      body: `${source} is named as a prerequisite of ${target}.`,
      note: CATALOG_RULE_NOTE,
    };
  }
  if (join === "any") {
    return {
      title: `${target} · OR`,
      body: `Visible OR alternatives: ${sources.join(", ")}.`,
      note: CATALOG_RULE_NOTE,
    };
  }
  if (join === "all") {
    return {
      title: `${target} shared prerequisite bus`,
      body: `Visible AND prerequisites: ${sources.join(", ")}.`,
      note: CATALOG_RULE_NOTE,
    };
  }
  return {
    title: `${target} shared prerequisite bus`,
    body: `Visible incoming prerequisites: ${sources.join(", ")}.`,
    note: CATALOG_RULE_NOTE,
  };
}

export function relationshipGroupButtonLabel(group: { target: string; join?: GraphJoin | "unknown"; sources: readonly string[] }): string {
  if (group.join === "any") return `OR · ${group.target}`;
  if (group.join === "all" && group.sources.length > 1) return `AND · ${group.target}`;
  return `All into ${group.target}`;
}
