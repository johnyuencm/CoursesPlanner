import * as cheerio from "cheerio";
import type {
  BreadthCategory,
  Course,
  DegreeRequirement,
  RequirementExpression,
} from "../lib/types";

export const PROGRAM_URL =
  "https://catalog.northeastern.edu/graduate/computer-information-science/computer-science/computer-science-mscs-sea/#programrequirementstext";

const normalize = (value: string) => value.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const normalizeCode = (value: string) => normalize(value).toUpperCase();

interface Token {
  type: "course" | "unknown" | "and" | "or" | "lparen" | "rparen";
  expression?: RequirementExpression;
}

function tokenizeRequirement(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const rest = input.slice(index);
    const whitespace = rest.match(/^\s+/)?.[0];
    if (whitespace) {
      index += whitespace.length;
      continue;
    }
    if (rest[0] === "(") {
      tokens.push({ type: "lparen" });
      index += 1;
      continue;
    }
    if (rest[0] === ")") {
      tokens.push({ type: "rparen" });
      index += 1;
      continue;
    }
    if (rest[0] === ";") {
      tokens.push({ type: "and" });
      index += 1;
      continue;
    }
    const operator = rest.match(/^(and|or)\b/i);
    if (operator) {
      tokens.push({ type: operator[1].toLowerCase() as "and" | "or" });
      index += operator[0].length;
      continue;
    }

    const courseMatch = rest.match(/^([A-Z]{2,6})\s+(\d{2,4}[A-Z]{0,2})\b/i);
    if (courseMatch) {
      const code = `${courseMatch[1].toUpperCase()} ${courseMatch[2].toUpperCase()}`;
      index += courseMatch[0].length;
      let tail = input.slice(index);
      const gap = tail.match(/^\s*/)?.[0] ?? "";
      index += gap.length;
      tail = input.slice(index);

      const grade = tail.match(/^with\s+a\s+minimum\s+grade\s+of\s+([A-Z][+-]?)\b/i);
      let minimumGrade: string | undefined;
      if (grade) {
        minimumGrade = grade[1].toUpperCase();
        index += grade[0].length;
      }

      tail = input.slice(index);
      const concurrent = tail.match(
        /^\s*,?\s*(?:\(\s*)?(?:(?:which|that)\s+)?(?:may|can)\s+be\s+taken\s+concurrently(?:\s*\))?/i,
      );
      if (concurrent) index += concurrent[0].length;

      tokens.push({
        type: "course",
        expression: {
          type: "course",
          code,
          ...(minimumGrade ? { minimumGrade } : {}),
          ...(concurrent ? { concurrent: true } : {}),
        },
      });
      continue;
    }

    let end = index + 1;
    while (end < input.length) {
      const candidate = input.slice(end);
      if (
        candidate[0] === "(" ||
        candidate[0] === ")" ||
        candidate[0] === ";" ||
        /^(and|or)\b/i.test(candidate)
      ) {
        break;
      }
      end += 1;
    }
    const text = normalize(input.slice(index, end));
    if (text) tokens.push({ type: "unknown", expression: { type: "unknown", text } });
    index = end;
  }

  return tokens;
}

const startsExpression = (token: Token | undefined) =>
  token?.type === "course" || token?.type === "unknown" || token?.type === "lparen";

export function parseRequirement(text: string): RequirementExpression {
  const original = normalize(text.replace(/^(?:pre|co)requisite\(s\):\s*/i, ""));
  if (!original || /^(?:none|n\/a)$/i.test(original)) return { type: "none" };

  const tokens = tokenizeRequirement(original);
  let position = 0;

  const combine = (
    type: "all" | "any",
    left: RequirementExpression,
    right: RequirementExpression,
  ): RequirementExpression => ({ type, items: [left, right] });

  const primary = (): RequirementExpression => {
    const token = tokens[position++];
    if (!token) throw new Error("Expected a requirement");
    if (token.type === "course" || token.type === "unknown") return token.expression!;
    if (token.type === "lparen") {
      const expression = orExpression();
      if (tokens[position]?.type !== "rparen") throw new Error("Unclosed parenthesis");
      position += 1;
      return expression;
    }
    throw new Error(`Unexpected token ${token.type}`);
  };

  const andExpression = (): RequirementExpression => {
    let left = primary();
    while (tokens[position]?.type === "and" || startsExpression(tokens[position])) {
      if (tokens[position]?.type === "and") position += 1;
      left = combine("all", left, primary());
    }
    return left;
  };

  const orExpression = (): RequirementExpression => {
    let left = andExpression();
    while (tokens[position]?.type === "or") {
      position += 1;
      left = combine("any", left, andExpression());
    }
    return left;
  };

  try {
    const expression = orExpression();
    if (position !== tokens.length) throw new Error("Trailing requirement syntax");
    return expression;
  } catch {
    return { type: "unknown", text: original };
  }
}

function expressionCodes(expression: RequirementExpression, output = new Set<string>()): Set<string> {
  if (expression.type === "course") output.add(expression.code);
  if (expression.type === "all" || expression.type === "any") {
    for (const item of expression.items) expressionCodes(item, output);
  }
  return output;
}

function unknownTexts(expression: RequirementExpression, output: string[] = []): string[] {
  if (expression.type === "unknown") output.push(expression.text);
  if (expression.type === "all" || expression.type === "any") {
    for (const item of expression.items) unknownTexts(item, output);
  }
  return output;
}

const TOPIC_RULES = [
  ["Robotics", /\brobot(?:ic|ics)?\b|autonomous (?:robot|system)/i],
  [
    "AI / ML",
    /artificial intelligence|machine learning|deep learning|neural|natural language|generative ai|reinforcement learning|pattern recognition|computer vision/i,
  ],
  ["Systems", /operating system|distributed system|computer system|cloud computing|parallel processing|compiler|systems architecture/i],
  [
    "Software Engineering",
    /software engineering|software development|programming language|web development|mobile application|program design|human[- ]computer interaction/i,
  ],
  ["Data", /\bdata(?:base| mining| science| visualization)?\b|information retrieval|visualization/i],
  [
    "Networks / Security",
    /\bnetwork(?:ing|s)?\b|security|cybersecurity|cryptograph|privacy|forensic|vulnerabilit/i,
  ],
] as const;

function inferTopics(title: string, description: string): string[] {
  const text = `${title} ${description}`;
  return TOPIC_RULES.filter(([, pattern]) => pattern.test(text)).map(([topic]) => topic);
}

function parseCredits(value: string): { credits: number; maxCredits?: number } {
  const numbers = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!numbers.length || numbers.some((number) => !Number.isFinite(number))) {
    throw new Error(`Unrecognized credit value: ${value}`);
  }
  const credits = Math.min(...numbers);
  const maxCredits = Math.max(...numbers);
  return maxCredits === credits ? { credits } : { credits, maxCredits };
}

export function parseCourses(html: string, officialUrl: string): Course[] {
  const $ = cheerio.load(html);
  const blocks = $("div.courseblock");
  if (!blocks.length) throw new Error(`No course blocks found in ${officialUrl}`);

  const courses: Course[] = [];
  blocks.each((_index, element) => {
    const block = $(element);
    const titleLine = normalize(block.find("p.courseblocktitle").first().text());
    const match = titleLine.match(
      /^([A-Z]{2,6}\s+\d{2,4}[A-Z]{0,2})\.\s+(.+)\.\s+\(([^()]*(?:Hour|Hours))\)$/i,
    );
    if (!match) throw new Error(`Unrecognized course title line in ${officialUrl}: ${titleLine}`);

    const code = normalizeCode(match[1]);
    const title = normalize(match[2]);
    const creditRange = parseCredits(match[3]);
    const description = normalize(block.find("p.cb_desc").first().text());
    let prerequisiteText = "";
    let corequisiteText = "";

    block.find("p.courseblockextra").each((_extraIndex, extraElement) => {
      const extra = $(extraElement);
      const label = normalize(extra.find("strong").first().text());
      const fullText = normalize(extra.text());
      const value = normalize(fullText.slice(label.length));
      if (/^Prerequisite\(s\):?$/i.test(label)) prerequisiteText = value;
      if (/^Corequisite\(s\):?$/i.test(label)) corequisiteText = value;
    });

    const prerequisites = parseRequirement(prerequisiteText);
    const corequisites = parseRequirement(corequisiteText);
    const uncertainties = [
      ...unknownTexts(prerequisites).map(
        (unknown) => `Prerequisite clause not fully understood: ${unknown}`,
      ),
      ...unknownTexts(corequisites).map(
        (unknown) => `Corequisite clause not fully understood: ${unknown}`,
      ),
    ];
    const blockAnchor = block.attr("id");

    courses.push({
      code,
      title,
      ...creditRange,
      description,
      prerequisites,
      corequisites,
      prerequisiteText,
      corequisiteText,
      prerequisiteCodes: [...expressionCodes(prerequisites)].sort(),
      corequisiteCodes: [...expressionCodes(corequisites)].sort(),
      unlocks: [],
      breadthCategories: [],
      requirementType: "external",
      electiveEligible: false,
      topics: inferTopics(title, description),
      officialUrl: blockAnchor ? `${officialUrl.replace(/#.*$/, "")}#${blockAnchor}` : officialUrl,
      uncertainties,
    });
  });

  const duplicates = courses.filter(
    (course, index) => courses.findIndex((candidate) => candidate.code === course.code) !== index,
  );
  if (duplicates.length) throw new Error(`Duplicate course blocks: ${duplicates.map(({ code }) => code).join(", ")}`);
  return courses;
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function parseCount(value: string, context: string): number {
  const normalized = value.toLowerCase();
  const count = /^\d+$/.test(normalized) ? Number(normalized) : NUMBER_WORDS[normalized];
  if (!Number.isInteger(count)) throw new Error(`Unrecognized ${context} count: ${value}`);
  return count;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseProgramRequirements(
  html: string,
  officialUrl = PROGRAM_URL,
  lastUpdated = new Date().toISOString(),
): DegreeRequirement {
  const $ = cheerio.load(html);
  const root = $("#programrequirementstextcontainer");
  if (!root.length) throw new Error("Program requirements container not found");

  const findHeading = (pattern: RegExp) =>
    root.find("h2").filter((_index, element) => pattern.test(normalize($(element).text()))).first();
  const findTable = (pattern: RegExp) => {
    const heading = findHeading(pattern);
    if (!heading.length) throw new Error(`Required program section not found: ${pattern.source}`);
    const table = heading.nextAll("table").first();
    if (!table.length) throw new Error(`Course table missing after ${normalize(heading.text())}`);
    return table;
  };
  const codesIn = (scope: ReturnType<typeof findTable>) =>
    scope
      .find("td.codecol a.code")
      .map((_index, element) => normalizeCode($(element).text()))
      .get()
      .filter(Boolean);

  const coreTable = findTable(/^Core Requirements$/i);
  const breadthTable = findTable(/^Breadth Areas$/i);
  const electiveTable = findTable(/^Electives$/i);
  const coreCourses = [...new Set(codesIn(coreTable))];
  if (!coreCourses.length) throw new Error("No core courses found");

  const breadthRuleRow = breadthTable
    .find("tr")
    .filter((_index, element) => $(element).find(".courselistcomment:not(.areaheader)").length > 0)
    .first();
  const breadthRule = normalize(breadthRuleRow.find(".courselistcomment").text());
  const breadthMatch = breadthRule.match(
    /complete\s+([a-z\d]+)\s+courses?\s+from\s+at\s+least\s+([a-z\d]+)\s+of\s+the\s+following\s+breadth\s+areas/i,
  );
  if (!breadthMatch) throw new Error(`Unrecognized breadth rule: ${breadthRule || "missing"}`);
  const coursesRequired = parseCount(breadthMatch[1], "breadth course");
  const minCategories = parseCount(breadthMatch[2], "breadth category");
  const breadthCredits = Number(normalize(breadthRuleRow.find("td.hourscol").text()));
  if (!Number.isFinite(breadthCredits) || breadthCredits <= 0) {
    throw new Error(`Unrecognized breadth credit requirement: ${breadthRuleRow.text()}`);
  }

  const categories: BreadthCategory[] = [];
  let currentCategory: BreadthCategory | undefined;
  breadthTable.find("tbody tr").each((_index, element) => {
    const row = $(element);
    const categoryName = normalize(row.find(".courselistcomment.areaheader").text());
    if (categoryName) {
      currentCategory = { id: slug(categoryName), name: categoryName, courses: [] };
      categories.push(currentCategory);
      return;
    }
    const rowCodes = codesIn(row as ReturnType<typeof findTable>);
    if (rowCodes.length && !currentCategory) {
      throw new Error(`Breadth courses found before a category header: ${rowCodes.join(", ")}`);
    }
    currentCategory?.courses.push(...rowCodes);
  });
  if (!categories.length || categories.some((category) => !category.courses.length)) {
    throw new Error("Breadth categories or their positional course mappings are missing");
  }
  if (minCategories > categories.length || coursesRequired < minCategories) {
    throw new Error(`Inconsistent breadth rule: ${breadthRule}`);
  }

  const electiveRuleRow = electiveTable
    .find("tr")
    .filter((_index, element) => $(element).find(".courselistcomment").length > 0)
    .first();
  const electiveRule = normalize(electiveRuleRow.find(".courselistcomment").text());
  if (!/breadth area courses?\s+and\/or\s+the following/i.test(electiveRule)) {
    throw new Error(`Unrecognized elective eligibility rule: ${electiveRule || "missing"}`);
  }
  const electiveMatch = electiveRule.match(/complete\s+(\d+(?:\.\d+)?)\s+semester hours/i);
  const electiveCredits = electiveMatch ? Number(electiveMatch[1]) : Number.NaN;
  if (!Number.isFinite(electiveCredits) || electiveCredits <= 0) {
    throw new Error(`Unrecognized elective credit requirement: ${electiveRule}`);
  }
  const breadthCourses = categories.flatMap((category) => category.courses);
  const eligibleElectives = [...new Set([...breadthCourses, ...codesIn(electiveTable)])];

  const creditHeading = findHeading(/^Program Credit\/GPA Requirements$/i);
  if (!creditHeading.length) throw new Error("Program Credit/GPA Requirements section not found");
  const creditRule = normalize(creditHeading.next("p").text());
  const totalMatch = creditRule.match(/(\d+(?:\.\d+)?)\s+total semester hours required/i);
  const gpaMatch = creditRule.match(/minimum\s+(\d+(?:\.\d+)?)\s+gpa required/i);
  if (!totalMatch || !gpaMatch) throw new Error(`Unrecognized total credit/GPA rule: ${creditRule}`);
  const totalCredits = Number(totalMatch[1]);
  const minimumGpa = Number(gpaMatch[1]);

  const title = normalize($("h1").first().text());
  const editionText = normalize($("h2.edition").first().text() || $("header .dec h2").first().text());
  const edition = editionText.match(/20\d{2}\s*[-–]\s*20\d{2}/)?.[0]?.replace(/\s+/g, "");
  if (!title || !edition) throw new Error("Program name or catalog edition not found");

  const coreCredits = coreTable
    .find("tbody tr td.hourscol")
    .map((_index, element) => Number(normalize($(element).text())))
    .get()
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0);
  const uncertainties = [
    "The catalog does not specify term offerings or Seattle-specific section availability.",
  ];
  if (coreCredits + breadthCredits + electiveCredits !== totalCredits) {
    uncertainties.push(
      `Parsed section credits total ${coreCredits + breadthCredits + electiveCredits}, while the program total is ${totalCredits}.`,
    );
  }

  const introductoryRules = root
    .children("p")
    .slice(0, 2)
    .map((_index, element) => normalize($(element).text()))
    .get()
    .filter(Boolean);

  return {
    name: title,
    catalogYear: edition,
    totalCredits,
    minimumGpa,
    coreCourses,
    breadthRequirements: {
      coursesRequired,
      minCategories,
      credits: breadthCredits,
      categories,
    },
    electiveCredits,
    eligibleElectives,
    officialUrl,
    rawRules: [...introductoryRules, breadthRule, electiveRule, creditRule],
    uncertainties,
    lastUpdated,
  };
}

function externalPlaceholder(code: string): Course {
  const unavailable = `Course details for ${code} are unavailable in the cached department sources.`;
  return {
    code,
    title: `External course (${code})`,
    credits: 0,
    description: unavailable,
    prerequisites: { type: "unknown", text: unavailable },
    corequisites: { type: "unknown", text: unavailable },
    prerequisiteText: unavailable,
    corequisiteText: unavailable,
    prerequisiteCodes: [],
    corequisiteCodes: [],
    unlocks: [],
    breadthCategories: [],
    requirementType: "external",
    electiveEligible: false,
    topics: [],
    officialUrl: "https://catalog.northeastern.edu/course-descriptions/",
    uncertainties: [unavailable, "Credits are unknown; zero is a placeholder and must not be counted."],
  };
}

export function buildCourseGraph(courses: Course[], requirements: DegreeRequirement): Course[] {
  const byCode = new Map<string, Course>();
  for (const course of courses) {
    if (byCode.has(course.code)) throw new Error(`Duplicate parsed course: ${course.code}`);
    byCode.set(course.code, { ...course, unlocks: [] });
  }

  const listedCodes = new Set([
    ...requirements.coreCourses,
    ...requirements.eligibleElectives,
    ...requirements.breadthRequirements.categories.flatMap((category) => category.courses),
  ]);
  for (const code of listedCodes) {
    if (!byCode.has(code)) byCode.set(code, externalPlaceholder(code));
  }

  for (const course of [...byCode.values()]) {
    for (const dependency of [...course.prerequisiteCodes, ...course.corequisiteCodes]) {
      if (!byCode.has(dependency)) byCode.set(dependency, externalPlaceholder(dependency));
    }
  }

  const coreCodes = new Set(requirements.coreCourses);
  const electiveCodes = new Set(requirements.eligibleElectives);
  const categoryIdsByCourse = new Map<string, string[]>();
  for (const category of requirements.breadthRequirements.categories) {
    for (const code of category.courses) {
      categoryIdsByCourse.set(code, [...(categoryIdsByCourse.get(code) ?? []), category.id]);
    }
  }

  const unlocks = new Map<string, Set<string>>();
  for (const course of byCode.values()) {
    for (const code of course.prerequisiteCodes) {
      if (!unlocks.has(code)) unlocks.set(code, new Set());
      unlocks.get(code)!.add(course.code);
    }
  }

  return [...byCode.values()]
    .map((course): Course => {
      const breadthCategories = categoryIdsByCourse.get(course.code) ?? [];
      const requirementType = coreCodes.has(course.code)
        ? "core"
        : breadthCategories.length
          ? "breadth"
          : electiveCodes.has(course.code)
            ? "elective"
            : "external";
      return {
        ...course,
        breadthCategories,
        requirementType,
        electiveEligible: electiveCodes.has(course.code),
        unlocks: [...(unlocks.get(course.code) ?? [])].sort(),
      };
    })
    .sort((left, right) => left.code.localeCompare(right.code, undefined, { numeric: true }));
}
