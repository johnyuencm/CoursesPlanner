import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import northeastern from "../catalog-service/courseleaf/northeastern.json";
import { getAdapter } from "../catalog-service/adapters";
import { COURSELEAF_CONFIGS, courseLeafLayout, parseCourseLeafConfig } from "../catalog-service/courseleaf";
import { parseCourses, parseRequirement } from "../scraper/parser";

const raw = (name: string) => readFileSync(path.join(process.cwd(), "data", "raw", name), "utf8");
const PROGRAM_URL =
  "https://catalog.northeastern.edu/graduate/computer-information-science/computer-science/computer-science-mscs-sea/";

test("the old Northeastern adapter id is an alias of the generic CourseLeaf adapter", () => {
  const alias = getAdapter("northeastern-acalog");
  const generic = getAdapter("courseleaf-northeastern");
  assert.equal(alias.id, "northeastern-acalog", "an alias keeps its id, so snapshots stay the same");
  assert.equal(generic.id, "courseleaf-northeastern");
  assert.equal(alias.codeGrammar, generic.codeGrammar);

  const url = "https://catalog.northeastern.edu/course-descriptions/cs/";
  assert.deepEqual(generic.parseCourses(raw("cs.html"), url), alias.parseCourses(raw("cs.html"), url));
  const scope = generic.parseProgramScope!(raw("mscs-sea-program.html"), PROGRAM_URL);
  assert.deepEqual(scope, alias.parseProgramScope!(raw("mscs-sea-program.html"), PROGRAM_URL));
  assert.deepEqual(
    generic.courseSources!(scope!.programCourseCodes, "https://catalog.northeastern.edu").map(({ url }) => url),
    ["cs", "cy", "dads", "ds"].map((subject) => `https://catalog.northeastern.edu/course-descriptions/${subject}/`),
  );
});

test("a CourseLeaf config is validated at load", () => {
  const valid = structuredClone(northeastern);
  assert.deepEqual(parseCourseLeafConfig(valid, "ok").selectors, northeastern.selectors);
  assert.deepEqual(COURSELEAF_CONFIGS.map(({ id }) => id), ["northeastern"]);

  const broken = (change: (config: Record<string, any>) => void) => {
    const config: Record<string, any> = structuredClone(northeastern);
    change(config);
    return () => parseCourseLeafConfig(config, "bad.json");
  };
  assert.throws(broken((config) => { config.programRoot = ["/x/"]; }), /bad\.json has unknown keys: programRoot/);
  assert.throws(broken((config) => { config.selectors.courseTitel = "p"; }), /bad\.json\.selectors has unknown keys: courseTitel/);
  assert.throws(
    broken((config) => { config.courseDescriptionUrl = "http://catalog.example.edu/courses/{subject}/"; }),
    /courseDescriptionUrl must be an HTTPS URL/,
  );
  assert.throws(broken((config) => { config.courseDescriptionUrl = "https://catalog.example.edu/courses/"; }), /\{subject\} once/);
  assert.throws(broken((config) => { config.courseDescriptionUrl = "https://{subject}.example.edu/"; }), /in the path/);
  assert.throws(broken((config) => { config.selectors.courseBlock = "div[[courseblock"; }), /selectors\.courseBlock is not a valid selector/);
  assert.throws(broken((config) => { config.selectors.codeLink = " "; }), /selectors\.codeLink is required/);
  assert.throws(broken((config) => { delete config.selectors.credits; }), /selectors\.credits is required/);
  assert.throws(broken((config) => { config.codeGrammar = "mit"; }), /codeGrammar must be one of: northeastern/);
  assert.throws(broken((config) => { config.creditUnit = "hours"; }), /creditUnit must be one of/);
  assert.throws(broken((config) => { config.programRoots = ["graduate"]; }), /programRoots/);
  assert.throws(broken((config) => { config.id = "../x"; }), /\.id is invalid/);
});

test("a new college needs only a config when its layout differs in selectors and credit unit", () => {
  const layout = courseLeafLayout(
    parseCourseLeafConfig(
      {
        ...structuredClone(northeastern),
        id: "example",
        aliases: [],
        creditUnit: "credits",
        courseDescriptionUrl: "https://catalog.example.edu/courses/{subject}/",
        selectors: {
          ...northeastern.selectors,
          courseBlock: "section.course",
          courseTitle: "h3",
          courseDescription: ".desc",
          courseExtra: ".extra",
        },
      },
      "example.json",
    ),
  );
  const html = `<section class="course" id="cs5800"><h3>CS 5800. Algorithms. (4 Credits)</h3>
    <div class="desc">Graphs and flows.</div>
    <div class="extra"><strong>Prerequisite(s):</strong> CS 5010 with a minimum grade of C-</div></section>`;
  const [course] = parseCourses(html, "https://catalog.example.edu/courses/cs/", layout);
  assert.equal(course?.code, "CS 5800");
  assert.equal(course?.credits, 4);
  assert.equal(course?.description, "Graphs and flows.");
  assert.deepEqual(course?.prerequisiteCodes, ["CS 5010"]);
  assert.equal(course?.officialUrl, "https://catalog.example.edu/courses/cs/#cs5800");
  assert.equal(layout.placeholderUrl, "https://catalog.example.edu/courses/");
  // Northeastern pages say "Hours", so the "credits" unit rejects them.
  const creditsUnit = courseLeafLayout(parseCourseLeafConfig({ ...structuredClone(northeastern), creditUnit: "credits" }, "x.json"));
  assert.throws(
    () => parseCourses(raw("cs.html"), "https://catalog.northeastern.edu/course-descriptions/cs/", creditsUnit),
    /Unrecognized course title line/,
  );
  assert.deepEqual(parseRequirement("CS 5010 or CS 5004", layout), parseRequirement("CS 5010 or CS 5004"));
});
