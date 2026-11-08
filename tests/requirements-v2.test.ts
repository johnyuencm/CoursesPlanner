import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateCatalog } from "../lib/catalog";
import { programCourseCodes, requirementTier, requirementView, validatePlanV2 } from "../lib/requirements-v2";
import type { Catalog, Course, DegreeRequirementV2, RuleGroup, StudentPlan } from "../lib/types";

const seattle = JSON.parse(readFileSync(path.join(process.cwd(), "data", "catalog.json"), "utf8")) as Catalog;

function course(code: string, credits = 4): Course {
  return {
    code,
    title: code,
    credits,
    description: "",
    prerequisites: { type: "none" },
    corequisites: { type: "none" },
    prerequisiteText: "",
    corequisiteText: "",
    prerequisiteCodes: [],
    corequisiteCodes: [],
    unlocks: [],
    breadthCategories: [],
    requirementType: "elective",
    electiveEligible: true,
    topics: [],
    officialUrl: "https://example.test/course",
    uncertainties: [],
  };
}

const codes = ["CS 1", "CS 2", "CS 3", "CS 4", "CS 5", "CS 6"];
const small: Catalog = {
  courses: codes.map((code) => course(code)),
  requirements: seattle.requirements,
  lastUpdated: "2026-11-07",
  sources: [],
  warnings: [],
};

function plan(completedCourses: string[], waivedCourses: string[] = []): StudentPlan {
  return { version: 1, completedCourses, waivedCourses, completedCredits: {}, semesters: [] };
}

function audit(root: RuleGroup, studentPlan: StudentPlan) {
  const requirements: DegreeRequirementV2 = {
    version: 2,
    name: "Test",
    catalogYear: "2026-2027",
    officialUrl: "https://example.test/program",
    uncertainties: [],
    lastUpdated: "2026-11-07",
    root,
  };
  return validatePlanV2(studentPlan, small, requirements);
}

const base = { label: "", rawText: "" };

test("the MSCS Seattle snapshot stores the v2 tree and keeps catalog text", () => {
  const v2 = seattle.requirements;
  assert.equal(v2.version, 2);
  assert.equal(v2.root.kind, "all");
  if (v2.root.kind !== "all") return;
  assert.deepEqual(v2.root.children.map((group) => `${group.id}:${group.kind}`), [
    "core:choose-courses",
    "breadth:choose-areas",
    "electives:choose-credits",
    "total:total-credits",
  ]);
  const [core, breadth, electives, total] = v2.root.children;
  assert.ok(core.kind === "choose-courses");
  assert.deepEqual([core.count, core.courses], [3, ["CS 5010", "CS 5011", "CS 5800"]]);
  assert.ok(breadth.kind === "choose-areas");
  assert.deepEqual([breadth.count, breadth.minAreas, breadth.credits, breadth.areas.length], [3, 2, 12, 3]);
  assert.ok(electives.kind === "choose-credits" && electives.credits === 12);
  assert.ok(total.kind === "total-credits" && total.credits === 32);
  assert.match(v2.root.rawText, /Complete all courses/);
  assert.match(breadth.rawText, /three courses from at least two/);
  assert.match(electives.rawText, /12 semester hours/);
  assert.match(total.rawText, /32 total semester hours/);
});

// Equivalence evidence kept after v1 was deleted (#70): tests/fixtures/mscs-v1-audits.json holds the v1
// audit of each seeded plan below, recorded while v1 and v2 both ran and agreed.
test("v2 gives the recorded v1 audit for 500 seeded plans over the real MSCS Seattle catalog", () => {
  const recorded = JSON.parse(readFileSync(path.join(process.cwd(), "tests", "fixtures", "mscs-v1-audits.json"), "utf8")) as unknown[];
  let seed = 63;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  const tree = seattle.requirements;
  const view = requirementView(tree);
  const actual: unknown[] = [];
  const record = (studentPlan: StudentPlan) => {
    const progress = validatePlanV2(studentPlan, seattle, tree);
    const [core, breadth, electives] = progress.root.children;
    const coreDone = [...core.courses, ...core.waived];
    actual.push([
      progress.earnedCredits,
      progress.plannedCredits,
      view.core.filter((code) => coreDone.includes(code)),
      breadth.courses,
      breadth.areas,
      breadth.satisfied,
      electives.credits,
      progress.issues.length,
      progress.satisfied,
    ]);
  };
  const pool = [...seattle.courses.map((item) => item.code), "CS 9999"];
  for (let run = 0; run < 300; run += 1) {
    const take = (count: number) => Array.from({ length: count }, () => pick(pool));
    record({
      version: 1,
      completedCourses: take(Math.floor(random() * 10)),
      waivedCourses: take(Math.floor(random() * 2)),
      completedCredits: {},
      semesters: ["fall", "spring", "summer"].map((id) => ({
        id,
        name: id,
        type: "academic" as const,
        courses: take(Math.floor(random() * 4)).map((code) => ({ code })),
      })),
    });
  }
  // Near-complete plans: the core (one course sometimes waived), then breadth and elective courses.
  const breadthCodes = view.areas.flatMap((area) => area.courses);
  for (let run = 0; run < 200; run += 1) {
    const take = (codes: string[], count: number) => Array.from({ length: count }, () => pick(codes));
    const waived = random() < 0.3 ? [pick(view.core)] : [];
    record({
      version: 1,
      completedCourses: [
        ...view.core.filter((code) => !waived.includes(code)),
        ...take(breadthCodes, 2 + Math.floor(random() * 4)),
        ...take(view.electives!.courses, Math.floor(random() * 4)),
      ],
      waivedCourses: waived,
      completedCredits: {},
      semesters: [],
    });
  }
  assert.deepEqual(actual, recorded);
  // The fixture is not vacuous: it holds satisfied audits and satisfied breadth.
  assert.ok(recorded.filter((row) => (row as unknown[])[8]).length >= 20);
});

test("choose-courses counts completed and waived slots, and waived courses earn no credit", () => {
  const group: RuleGroup = { ...base, kind: "choose-courses", id: "core", count: 2, courses: ["CS 1", "CS 2", "CS 3"] };
  const partial = audit(group, plan(["CS 3"]));
  assert.equal(partial.root.satisfied, false);
  const done = audit(group, plan(["CS 3"], ["CS 1"]));
  assert.equal(done.root.satisfied, true);
  assert.deepEqual(done.root.courses, ["CS 3"]);
  assert.deepEqual(done.root.waived, ["CS 1"]);
  assert.equal(done.root.credits, 4);
});

test("choose-credits sums every eligible unused course", () => {
  const group: RuleGroup = { ...base, kind: "choose-credits", id: "electives", credits: 8, courses: ["CS 1", "CS 2", "CS 3"] };
  assert.equal(audit(group, plan(["CS 1", "CS 4"])).root.satisfied, false);
  const result = audit(group, plan(["CS 1", "CS 2", "CS 3"])).root;
  assert.equal(result.satisfied, true);
  assert.equal(result.credits, 12);
});

test("choose-areas needs N courses across M areas", () => {
  const group: RuleGroup = {
    ...base,
    kind: "choose-areas",
    id: "breadth",
    count: 2,
    minAreas: 2,
    credits: 8,
    areas: [
      { id: "a", name: "A", courses: ["CS 1", "CS 2"] },
      { id: "b", name: "B", courses: ["CS 3"] },
    ],
  };
  assert.equal(audit(group, plan(["CS 1", "CS 2"])).root.satisfied, false);
  const result = audit(group, plan(["CS 1", "CS 2", "CS 3"])).root;
  assert.equal(result.satisfied, true);
  assert.equal(result.courses.length, 2);
  assert.deepEqual([...result.areas].sort(), ["a", "b"]);
});

test("total-credits counts degree courses only", () => {
  const root: RuleGroup = {
    ...base,
    kind: "all",
    id: "program",
    children: [
      { ...base, kind: "choose-credits", id: "electives", credits: 8, courses: ["CS 1", "CS 2"] },
      { ...base, kind: "total-credits", id: "total", credits: 8 },
    ],
  };
  assert.equal(audit(root, plan(["CS 1", "CS 5"])).root.satisfied, false);
  const result = audit(root, plan(["CS 1", "CS 2", "CS 5"]));
  assert.equal(result.root.children[1].credits, 8);
  assert.equal(result.root.satisfied, true);
  assert.equal(result.satisfied, true);
});

test("all needs every child, and an unmodeled group is never satisfied", () => {
  const unmodeled: RuleGroup = { ...base, kind: "unmodeled", id: "thesis", rawText: "Thesis approved by the committee." };
  const lone = audit(unmodeled, plan(codes));
  assert.equal(lone.root.satisfied, false);
  assert.equal(lone.satisfied, false);
  assert.equal(lone.root.rawText, "Thesis approved by the committee.");

  const core: RuleGroup = { ...base, kind: "choose-courses", id: "core", count: 1, courses: ["CS 1"] };
  const result = audit({ ...base, kind: "all", id: "program", children: [core, unmodeled] }, plan(codes));
  assert.equal(result.root.children[0].satisfied, true);
  assert.equal(result.root.satisfied, false);
  assert.equal(audit({ ...base, kind: "all", id: "program", children: [core] }, plan(codes)).root.satisfied, true);
});

test("one course counts toward one group unless the group allows double counting", () => {
  const first: RuleGroup = { ...base, kind: "choose-courses", id: "first", count: 1, courses: ["CS 1"] };
  const second: RuleGroup = { ...base, kind: "choose-credits", id: "second", credits: 4, courses: ["CS 1"] };
  const exclusive = audit({ ...base, kind: "all", id: "program", children: [first, second] }, plan(["CS 1"]));
  assert.deepEqual(exclusive.root.children.map((child) => child.satisfied), [true, false]);

  const shared = audit(
    { ...base, kind: "all", id: "program", children: [{ ...first, shareCourses: true }, second] },
    plan(["CS 1"]),
  );
  assert.deepEqual(shared.root.children.map((child) => child.satisfied), [true, true]);
  assert.deepEqual(shared.root.courses, ["CS 1"]);
  assert.equal(shared.root.credits, 4);
});

test("allocation is deterministic for any input order", () => {
  const root: RuleGroup = {
    ...base,
    kind: "all",
    id: "program",
    children: [
      {
        ...base,
        kind: "choose-areas",
        id: "breadth",
        count: 2,
        minAreas: 1,
        credits: 8,
        areas: [{ id: "a", name: "A", courses: ["CS 1", "CS 2", "CS 3", "CS 4"] }],
      },
      { ...base, kind: "choose-credits", id: "electives", credits: 4, courses: ["CS 1", "CS 2", "CS 3", "CS 4"] },
    ],
  };
  const forward = audit(root, plan(["CS 1", "CS 2", "CS 3", "CS 4"])).root;
  const backward = audit(root, plan(["CS 4", "CS 3", "CS 2", "CS 1"])).root;
  assert.deepEqual(forward.children[0].courses, ["CS 1", "CS 2"]);
  assert.deepEqual(backward.children[0].courses, forward.children[0].courses);
  assert.deepEqual([...backward.children[1].courses].sort(), [...forward.children[1].courses].sort());
});

// PR #92 review, finding 1: allocation must not be greedy in tree order.
const program = (...children: RuleGroup[]): RuleGroup => ({ ...base, kind: "all", id: "program", children });
const met = (root: RuleGroup, completed: string[]) =>
  audit(root, plan(completed)).root.children.map((child) => child.satisfied);

test("probe A: a credit group leaves a course for a later group that needs it", () => {
  const root = program(
    { ...base, kind: "choose-credits", id: "credits", credits: 4, courses: ["CS 1", "CS 2"] },
    { ...base, kind: "choose-courses", id: "req", count: 1, courses: ["CS 2"] },
  );
  for (const order of [["CS 1", "CS 2"], ["CS 2", "CS 1"]]) {
    const result = audit(root, plan(order)).root;
    assert.deepEqual(result.children.map((child) => child.satisfied), [true, true]);
    assert.deepEqual(result.children.map((child) => child.courses), [["CS 1"], ["CS 2"]]);
    assert.equal(result.satisfied, true);
  }
});

test("probe B: a choose group picks the course that a later group does not need", () => {
  const either: RuleGroup = { ...base, kind: "choose-courses", id: "either", count: 1, courses: ["CS 1", "CS 2"] };
  const only: RuleGroup = { ...base, kind: "choose-courses", id: "only", count: 1, courses: ["CS 1"] };
  assert.deepEqual(met(program(either, only), ["CS 1", "CS 2"]), [true, true]);
  assert.deepEqual(met(program(either, only), ["CS 2", "CS 1"]), [true, true]);
  // An unfinished plan still gets the best allocation for the groups that it can meet.
  const total: RuleGroup = { ...base, kind: "total-credits", id: "total", credits: 99 };
  assert.deepEqual(met(program(either, only, total), ["CS 1", "CS 2"]), [true, true, false]);
});

test("allocation never reports a group as satisfied when no allocation can meet both", () => {
  const root = program(
    { ...base, kind: "choose-courses", id: "first", count: 1, courses: ["CS 1"] },
    { ...base, kind: "choose-courses", id: "second", count: 1, courses: ["CS 1"] },
  );
  // Earlier groups have priority when not every group can be met.
  assert.deepEqual(met(root, ["CS 1"]), [true, false]);
  assert.equal(audit(root, plan(["CS 1"])).satisfied, false);
});

test("allocation searches choose-areas selections so a later group can be met", () => {
  const root = program(
    {
      ...base,
      kind: "choose-areas",
      id: "breadth",
      count: 2,
      minAreas: 2,
      credits: 8,
      areas: [
        { id: "a", name: "A", courses: ["CS 1", "CS 2"] },
        { id: "b", name: "B", courses: ["CS 3"] },
      ],
    },
    { ...base, kind: "choose-courses", id: "req", count: 1, courses: ["CS 1"] },
  );
  const result = audit(root, plan(["CS 1", "CS 2", "CS 3"])).root;
  assert.deepEqual(result.children.map((child) => child.satisfied), [true, true]);
  assert.deepEqual(result.children[0].courses, ["CS 2", "CS 3"]);
});

test("allocation meets every group exactly when a brute-force search can, on 400 random trees", () => {
  const pool = ["CS 1", "CS 2", "CS 3", "CS 4", "CS 5"];
  const credits: Record<string, number> = { "CS 1": 4, "CS 2": 2, "CS 3": 4, "CS 4": 3, "CS 5": 1 };
  const varied: Catalog = { ...small, courses: pool.map((code) => course(code, credits[code])) };
  let seed = 70;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const some = () => pool.filter(() => random() < 0.5);
  const count = (max: number) => Math.floor(random() * max) + 1;
  const leaf = (id: string): RuleGroup => {
    const kind = Math.floor(random() * 3);
    if (kind === 0) return { ...base, kind: "choose-courses", id, count: count(2), courses: some() };
    if (kind === 1) return { ...base, kind: "choose-credits", id, credits: count(8), courses: some() };
    return {
      ...base,
      kind: "choose-areas",
      id,
      count: count(2),
      minAreas: count(2),
      credits: count(6),
      areas: [{ id: "a", name: "A", courses: some() }, { id: "b", name: "B", courses: some() }],
    };
  };
  // Independent check: can this group be met from these courses alone?
  const canMeet = (group: RuleGroup, codes: string[]): boolean => {
    const sum = (list: string[]) => list.reduce((total, code) => total + credits[code], 0);
    if (group.kind === "choose-courses") return codes.filter((code) => group.courses.includes(code)).length >= group.count;
    if (group.kind === "choose-credits") return sum(codes.filter((code) => group.courses.includes(code))) >= group.credits;
    if (group.kind !== "choose-areas") return false;
    const inArea = (code: string) => group.areas.filter((area) => area.courses.includes(code)).map((area) => area.id);
    const subsets = (list: string[]): string[][] => (list.length ? subsets(list.slice(1)).flatMap((rest) => [rest, [list[0], ...rest]]) : [[]]);
    const areaCount = (list: string[]): number =>
      list.length ? Math.max(0, ...inArea(list[0]).map((id) => 1 + areaCount(list.slice(1).filter((code) => inArea(code).some((other) => other !== id))))) : 0;
    return subsets(codes.filter((code) => inArea(code).length)).some(
      (subset) => subset.length === group.count && sum(subset) >= group.credits && areaCount(subset) >= group.minAreas,
    );
  };
  let valid = 0;
  for (let run = 0; run < 400; run += 1) {
    const groups = Array.from({ length: count(3) }, (_, index) => leaf(`g${index}`));
    const completed = some();
    let exists = false;
    for (let assignment = 0; assignment < (groups.length + 1) ** completed.length && !exists; assignment += 1) {
      const owned = groups.map((): string[] => []);
      completed.forEach((code, index) => {
        const owner = Math.floor(assignment / (groups.length + 1) ** index) % (groups.length + 1);
        if (owner < groups.length) owned[owner].push(code);
      });
      exists = groups.every((group, index) => canMeet(group, owned[index]));
    }
    const result = validatePlanV2(plan(completed), varied, {
      version: 2, name: "Random", catalogYear: "", officialUrl: "", uncertainties: [], lastUpdated: "", root: program(...groups),
    }).root;
    const label = JSON.stringify({ groups, completed });
    assert.equal(result.children.every((child) => child.satisfied), exists, label);
    // No group claims a course twice, and each satisfied group is met by its own courses.
    const used = result.children.flatMap((child) => child.courses);
    assert.equal(new Set(used).size, used.length, label);
    result.children.forEach((child, index) => {
      if (child.satisfied) assert.ok(canMeet(groups[index], child.courses), label);
    });
    const reversed = validatePlanV2(plan([...completed].reverse()), varied, {
      version: 2, name: "Random", catalogYear: "", officialUrl: "", uncertainties: [], lastUpdated: "", root: program(...groups),
    }).root;
    assert.deepEqual(reversed, result, label);
    if (exists) valid += 1;
  }
  assert.ok(valid > 100 && valid < 350, `${valid} of 400 random trees have a valid allocation`);
});

test("tier: MSCS Seattle is Audit; an unmodeled group or credits that do not add up give Map", () => {
  const mscs = seattle.requirements;
  assert.equal(requirementTier(mscs, seattle.courses), "audit");
  const children = mscs.root.kind === "all" ? mscs.root.children : [];
  const tree = (...groups: RuleGroup[]): DegreeRequirementV2 => ({ ...mscs, root: { ...mscs.root, kind: "all", children: groups } as RuleGroup });
  const unmodeled: RuleGroup = { ...base, kind: "unmodeled", id: "thesis", rawText: "Thesis option." };
  assert.equal(requirementTier(tree(...children, unmodeled), seattle.courses), "map");
  assert.equal(requirementTier(tree(...children.filter((group) => group.id !== "electives")), seattle.courses), "map");
  assert.equal(requirementTier(tree(...children.filter((group) => group.kind !== "total-credits")), seattle.courses), "map");
});

test("a Map-tier program still checks prerequisites and term order, without a degree audit", () => {
  const first = course("CS 1");
  const second = { ...course("CS 2"), prerequisites: { type: "course" as const, code: "CS 1" } };
  const catalog: Catalog = { ...small, courses: [first, second] };
  const requirements: DegreeRequirementV2 = {
    version: 2, name: "Map program", catalogYear: "", officialUrl: "", uncertainties: [], lastUpdated: "",
    root: program({ ...base, kind: "unmodeled", id: "rules", rawText: "Complete 30 credits approved by an advisor." }),
  };
  const semester = (id: string, code: string) => ({ id, name: id, type: "academic" as const, courses: [{ code }] });
  const wrongOrder = validatePlanV2({ ...plan([]), semesters: [semester("fall", "CS 2"), semester("spring", "CS 1")] }, catalog, requirements);
  assert.equal(wrongOrder.tier, "map");
  assert.equal(wrongOrder.satisfied, false);
  assert.deepEqual(wrongOrder.issues.map((issue) => `${issue.kind}:${issue.courseCode}`), ["prerequisite:CS 2"]);
  const rightOrder = validatePlanV2({ ...plan([]), semesters: [semester("fall", "CS 1"), semester("spring", "CS 2")] }, catalog, requirements);
  assert.deepEqual(rightOrder.issues, []);
  // Every catalog course counts toward the plan credits, but the plan is never "satisfied".
  assert.equal(rightOrder.totalCredits, 8);
  assert.equal(rightOrder.requiredCredits, null);
  assert.equal(rightOrder.satisfied, false);
});

test("the Plan audit for MSCS Seattle runs on v2, with the raw catalog rule on each modeled group", () => {
  const progress = validatePlanV2(plan(["CS 5010", "CS 5800"], ["CS 5011"]), seattle, seattle.requirements);
  assert.equal(progress.tier, "audit");
  assert.equal(progress.requiredCredits, 32);
  const [core, breadth, electives, total] = progress.root.children;
  assert.deepEqual([core.satisfied, core.courses, core.waived, core.summary], [true, ["CS 5010", "CS 5800"], ["CS 5011"], "3 of 3 courses"]);
  assert.equal(breadth.summary, "0 of 3 courses, 0 of 2 areas, 0 of 12 credits");
  assert.match(breadth.rawText, /three courses from at least two/);
  assert.equal(electives.summary, "0 of 12 credits");
  assert.equal(total.summary, "8 of 32 credits");
  const missing = validatePlanV2(plan(["CS 5010"]), seattle, seattle.requirements).root.children[0];
  assert.equal(missing.summary, "1 of 3 courses; needs CS 5011, CS 5800");
});

// PR #92 review, finding 2: `shareCourses` is two-sided.
test("probe C: a shared group may use a course that another group also uses", () => {
  const only: RuleGroup = { ...base, kind: "choose-courses", id: "only", count: 1, courses: ["CS 1"] };
  const shared: RuleGroup = { ...only, id: "shared", shareCourses: true };
  assert.deepEqual(met(program(only, shared), ["CS 1"]), [true, true]);
  assert.deepEqual(met(program(shared, only), ["CS 1"]), [true, true]);
});

// PR #98 review: the step cap must not hide a full allocation in a plain tree, and must bound the time.
test("a large credit group leaves a later group its course, and a pigeonhole tree stays fast", () => {
  const many = Array.from({ length: 24 }, (_, index) => `CS ${100 + index}`);
  const catalog: Catalog = { ...small, courses: many.map((code) => course(code, 3)) };
  const tree = (root: RuleGroup): DegreeRequirementV2 => ({
    version: 2, name: "Large", catalogYear: "", officialUrl: "", uncertainties: [], lastUpdated: "", root,
  });
  // 30 credits from 24 three-credit courses, then one named course: needs 10 + 1 courses.
  const credits = validatePlanV2(plan(many), catalog, tree(program(
    { ...base, kind: "choose-credits", id: "electives", credits: 30, courses: many },
    { ...base, kind: "choose-courses", id: "req", count: 1, courses: [many[0]] },
  ))).root;
  assert.deepEqual(credits.children.map((child) => child.satisfied), [true, true]);

  // Ten groups compete for nine courses; the first group must take the course that no other lists.
  const nine = many.slice(0, 9);
  const pigeon = validatePlanV2(plan([...nine, many[9]]), catalog, tree(program(
    { ...base, kind: "choose-courses", id: "first", count: 1, courses: [nine[0], many[9]] },
    ...nine.map((_, index): RuleGroup => ({ ...base, kind: "choose-courses", id: `g${index}`, count: 1, courses: nine })),
  ))).root;
  assert.equal(pigeon.satisfied, true);

  // Nine groups on eight courses cannot all be met; a wide choose-areas group after them must not freeze the audit.
  const areaCodes = Array.from({ length: 40 }, (_, index) => `CS ${200 + index}`);
  const wide: Catalog = { ...small, courses: [...nine, ...areaCodes].map((code) => course(code)) };
  const started = performance.now();
  const slow = validatePlanV2(plan([...nine.slice(0, 8), ...areaCodes]), wide, tree(program(
    ...nine.map((_, index): RuleGroup => ({ ...base, kind: "choose-courses", id: `g${index}`, count: 1, courses: nine.slice(0, 8) })),
    {
      ...base, kind: "choose-areas", id: "breadth", count: 3, minAreas: 2, credits: 12,
      areas: [{ id: "a", name: "A", courses: areaCodes.slice(0, 20) }, { id: "b", name: "B", courses: areaCodes.slice(20) }],
    },
  ))).root;
  assert.equal(slow.satisfied, false);
  assert.equal(slow.children[9].satisfied, true);
  assert.ok(performance.now() - started < 3000, `audit took ${performance.now() - started} ms`);
});

// Issue #105: the planner runs the audit on every plan change, so a large group must not freeze it.
const within200ms = <T>(label: string, run: () => T): T => {
  const started = performance.now();
  const result = run();
  const ms = performance.now() - started;
  assert.ok(ms < 200, `${label} took ${ms.toFixed(1)} ms`);
  return result;
};
const largeTree = (root: RuleGroup): DegreeRequirementV2 => ({
  version: 2, name: "Large", catalogYear: "", officialUrl: "", uncertainties: [], lastUpdated: "", root,
});

/** Independent check: a satisfied group result is met by its own courses only. */
function assertHonest(group: RuleGroup, result: { satisfied: boolean; courses: string[]; waived: string[]; areas: string[] }, credits: Map<string, number>, label: string) {
  if (!result.satisfied) return;
  const sum = (list: string[]) => list.reduce((total, code) => total + (credits.get(code) ?? 0), 0);
  const taken = [...result.courses, ...result.waived];
  assert.equal(new Set(taken).size, taken.length, label);
  if (group.kind === "choose-courses") {
    assert.ok(taken.every((code) => group.courses.includes(code)) && taken.length >= group.count, label);
  } else if (group.kind === "choose-credits") {
    assert.ok(taken.every((code) => group.courses.includes(code)) && sum(taken) >= group.credits, label);
  } else if (group.kind === "choose-areas") {
    assert.equal(taken.length, group.count, label);
    assert.ok(sum(taken) >= group.credits, label);
    assert.ok(new Set(result.areas).size === result.areas.length && result.areas.length >= group.minAreas, label);
    // Each reported area needs its own course from that area.
    const inArea = (code: string, id: string) => group.areas.some((area) => area.id === id && area.courses.includes(code));
    const match = (areas: string[], left: string[]): boolean =>
      !areas.length || left.some((code) => inArea(code, areas[0]) && match(areas.slice(1), left.filter((other) => other !== code)));
    assert.ok(match(result.areas, taken), label);
  }
}

test("choose-areas 5 of 96 courses is fast, deterministic and never falsely satisfied", () => {
  const codes = programCourseCodes(seattle.requirements);
  assert.equal(codes.length, 96);
  const everything = seattle.courses.map((item) => item.code);
  const credits = new Map(seattle.courses.map((item) => [item.code, item.credits]));
  const mscs = seattle.requirements.root;
  assert.ok(mscs.kind === "all");
  const breadthOf = (change: Partial<GroupOfAreas>): GroupOfAreas => ({
    ...(mscs.children[1] as GroupOfAreas),
    count: 5,
    areas: [{ id: "a", name: "A", courses: codes.slice(0, 48) }, { id: "b", name: "B", courses: codes.slice(48) }],
    ...change,
  });
  const run = (breadth: GroupOfAreas, completed: string[]) =>
    validatePlanV2(plan(completed), seattle, { ...seattle.requirements, root: { ...mscs, children: mscs.children.map((group) => (group.id === "breadth" ? breadth : group)) } });

  const breadth = breadthOf({});
  const result = within200ms("5 of 96", () => run(breadth, everything)).root.children[1];
  assert.equal(result.satisfied, true);
  assertHonest(breadth, result, credits, "5 of 96");
  assert.deepEqual(within200ms("5 of 96, reversed plan", () => run(breadth, [...everything].reverse())).root.children[1], result);

  // Five courses carry at most 20 credits, so 21 credits can never be met.
  const impossible = breadthOf({ credits: 21 });
  const none = within200ms("5 of 96, 21 credits", () => run(impossible, everything)).root.children[1];
  assert.equal(none.satisfied, false);
  assert.equal(none.courses.length, 5);
});
type GroupOfAreas = Extract<RuleGroup, { kind: "choose-areas" }>;

test("choose-credits over 30+ candidates finds a minimal set fast and leaves later groups their courses", () => {
  for (const size of [24, 32, 40]) {
    const ones = Array.from({ length: size }, (_, index) => `CS ${100 + index}`);
    const catalog: Catalog = { ...small, courses: [...ones.map((code) => course(code, 1)), course("CS 999", 40)] };
    const listed = [...ones, "CS 999"];
    const electives: RuleGroup = { ...base, kind: "choose-credits", id: "electives", credits: 40, courses: listed };
    const first: RuleGroup = { ...base, kind: "choose-courses", id: "first", count: 1, courses: [ones[0]] };
    const audit40 = (root: RuleGroup) => within200ms(`${size} one-credit courses`, () => validatePlanV2(plan(listed), catalog, largeTree(root))).root;
    assert.equal(audit40(program(electives)).satisfied, true);
    assert.deepEqual(audit40(program(electives, first)).children.map((child) => child.satisfied), [true, true]);
    // The 40-credit course alone meets the group. Without it, the group needs 40 one-credit courses.
    const withoutBig = within200ms("no 40-credit course", () => validatePlanV2(plan(ones), catalog, largeTree(program(electives)))).root;
    assert.equal(withoutBig.satisfied, size >= 40);
  }
});

// PR #98 review probes D, F and G at their larger sizes.
test("the PR #98 review probes keep their results", () => {
  // D: an unmet group keeps its partial progress and holds its courses.
  assert.deepEqual(
    met(program(
      { ...base, kind: "choose-courses", id: "two", count: 2, courses: ["CS 1", "CS 2"] },
      { ...base, kind: "choose-courses", id: "one", count: 1, courses: ["CS 1"] },
    ), ["CS 1"]),
    [false, false],
  );
  // F: 30 credits of N three-credit courses, then one named course.
  for (const size of [18, 20, 24, 32]) {
    const many = Array.from({ length: size }, (_, index) => `CS ${100 + index}`);
    const catalog: Catalog = { ...small, courses: many.map((code) => course(code, 3)) };
    const result = within200ms(`probe F, ${size} courses`, () => validatePlanV2(plan(many), catalog, largeTree(program(
      { ...base, kind: "choose-credits", id: "electives", credits: 30, courses: many },
      { ...base, kind: "choose-courses", id: "req", count: 1, courses: [many[0]] },
    )))).root;
    assert.deepEqual(result.children.map((child) => child.satisfied), [true, true], `probe F, ${size} courses`);
  }
  // G: one group "1 of {A, B}", then n groups "1 of {A, C1..Cn-1}".
  for (let size = 2; size <= 13; size += 1) {
    const others = Array.from({ length: size - 1 }, (_, index) => `CS ${100 + index}`);
    const catalog: Catalog = { ...small, courses: ["CS A", "CS B", ...others].map((code) => course(code)) };
    const result = within200ms(`probe G, ${size} groups`, () => validatePlanV2(plan(["CS A", "CS B", ...others]), catalog, largeTree(program(
      { ...base, kind: "choose-courses", id: "first", count: 1, courses: ["CS A", "CS B"] },
      ...Array.from({ length: size }, (_, index): RuleGroup => ({ ...base, kind: "choose-courses", id: `g${index}`, count: 1, courses: ["CS A", ...others] })),
    )))).root;
    assert.equal(result.satisfied, true, `probe G, ${size} groups`);
  }
});

test("worst-case random trees finish fast, never claim a false satisfied group and ignore plan order", () => {
  let seed = 105;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const between = (low: number, high: number) => low + Math.floor(random() * (high - low + 1));
  for (let run = 0; run < 60; run += 1) {
    const pool = Array.from({ length: between(15, 40) }, (_, index) => `CS ${100 + index}`);
    const credits = new Map(pool.map((code) => [code, between(1, 4)]));
    const catalog: Catalog = { ...small, courses: pool.map((code) => course(code, credits.get(code))) };
    // Wide lists that overlap a lot are the worst case for the search.
    const some = () => pool.filter(() => random() < 0.7);
    const groups = Array.from({ length: between(2, 10) }, (_, index): RuleGroup => {
      const id = `g${index}`;
      const kind = between(0, 2);
      if (kind === 0) return { ...base, kind: "choose-courses", id, count: between(1, 8), courses: some() };
      if (kind === 1) return { ...base, kind: "choose-credits", id, credits: between(4, 40), courses: some() };
      const areas = Array.from({ length: between(2, 3) }, (_, area) => ({ id: `a${area}`, name: `A${area}`, courses: some() }));
      return { ...base, kind: "choose-areas", id, count: between(2, 6), minAreas: between(1, areas.length), credits: between(4, 20), areas };
    });
    const tree = largeTree(program(...groups));
    const label = `random tree ${run}`;
    const result = within200ms(label, () => validatePlanV2(plan(pool), catalog, tree)).root;
    const used = result.children.flatMap((child) => [...child.courses, ...child.waived]);
    assert.equal(new Set(used).size, used.length, label);
    groups.forEach((group, index) => assertHonest(group, result.children[index], credits, label));
    assert.deepEqual(within200ms(`${label}, reversed`, () => validatePlanV2(plan([...pool].reverse()), catalog, tree)).root, result, label);
  }
});

test("the catalog trust boundary accepts the v2 snapshot and rejects v1 or broken rule groups", () => {
  const copy = () => JSON.parse(JSON.stringify(seattle)) as Catalog & { requirements: { root: { children: Record<string, unknown>[] } } };
  validateCatalog(copy());
  const v1 = copy() as unknown as { requirements: Record<string, unknown> };
  v1.requirements = { ...v1.requirements, version: undefined, coreCourses: ["CS 5010"] };
  assert.throws(() => validateCatalog(v1), /Degree requirements are invalid/);
  const broken = (change: (groups: Record<string, unknown>[]) => void, message: RegExp) => {
    const catalog = copy();
    change(catalog.requirements.root.children);
    assert.throws(() => validateCatalog(catalog), message);
  };
  broken((groups) => { groups[0].kind = "pick-some"; }, /core has an unknown kind/);
  broken((groups) => { groups[0].courses = ["CS 5010", "CS 9999"]; }, /core lists courses not in the catalog: CS 9999/);
  broken((groups) => { groups[0].count = 4; }, /core count/);
  broken((groups) => { groups[1].minAreas = 4; }, /breadth count, minAreas or credits/);
  broken((groups) => { groups[2].id = "core"; }, /duplicate id core/);
  broken((groups) => { groups[3].credits = 0; }, /total credits/);
});
