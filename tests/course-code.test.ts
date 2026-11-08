import { strict as assert } from "node:assert";
import test from "node:test";

import roadmap from "../data/catalogs/northeastern/roadmaps/computer-science-mscs-sea-8b0d00dbda.json";
import { getAdapter, registeredAdapters } from "../catalog-service/adapters";
import { readCatalog } from "../lib/catalog";
import { type CourseCodeGrammar, courseCodeGrammar, northeasternCodeGrammar } from "../lib/course-code";
import { courseSlug } from "../lib/course-pages";
import { parseExploreFocus } from "../lib/routes";

const grammar = northeasternCodeGrammar;
// The hardcoded pattern that #68 replaces with the grammar.
const OLD_PATTERN = /^[A-Z]{2,6} \d{2,4}[A-Z]{0,2}$/;

test("Northeastern grammar round-trips real fixture codes: display -> canonical -> slug", () => {
  const cases: Array<[input: string, canonical: string, slug: string, subject: string]> = [
    ["CS 5800", "CS 5800", "cs-5800", "CS"],
    ["cs5800", "CS 5800", "cs-5800", "CS"],
    ["DADS 7275", "DADS 7275", "dads-7275", "DADS"],
    ["dads-7275", "DADS 7275", "dads-7275", "DADS"],
    ["CIS 200M", "CIS 200M", "cis-200m", "CIS"],
    [" cis+200m ", "CIS 200M", "cis-200m", "CIS"],
  ];
  for (const [input, canonical, slug, subject] of cases) {
    assert.equal(grammar.normalize(input), canonical, input);
    assert.ok(grammar.pattern.test(canonical), canonical);
    assert.equal(grammar.display(canonical), canonical);
    assert.equal(grammar.normalize(grammar.display(canonical)), canonical, "display text normalizes back");
    assert.equal(grammar.slug(canonical), slug);
    assert.equal(grammar.subject(canonical), subject);
  }
});

test("Northeastern grammar gives today's results for every packaged course code", async () => {
  const codes = new Set([...(await readCatalog()).courses, ...roadmap.courses].map((course) => course.code));
  assert.ok(codes.size > 100, "fixtures hold real codes");
  for (const code of codes) {
    assert.equal(grammar.pattern.test(code), OLD_PATTERN.test(code), code);
    assert.equal(grammar.normalize(code), code, code);
    assert.equal(grammar.display(code), code);
    assert.equal(grammar.slug(code), courseSlug(code), code);
    assert.equal(grammar.subject(code), code.match(/^([A-Z]{2,6}) /)?.[1] ?? null, code);
  }
});

test("Northeastern normalizer matches the explore-focus parser on loose and invalid input", () => {
  const inputs = [
    "CS 5500", "cs5500", "CS-5500", "cs+5500", "  CS   5500 ", "CS 7980A", "cis 200m", "DADS7275",
    "", "   ", "CS", "CS 5", "CS 58000", "C 5800", "CSABCDE 5800", "CS 5800ABC", "../etc", "6.1210", "15-122",
  ];
  for (const input of inputs) assert.equal(grammar.normalize(input), parseExploreFocus(input), JSON.stringify(input));
  assert.equal(grammar.pattern.test("cs 5800"), false, "canonical codes are upper case");
  assert.equal(grammar.pattern.test("CS  5800"), false, "canonical codes use one space");
  assert.equal(grammar.subject("6.1210"), null);
});

test("each adapter declares the grammar that the lookup returns", async () => {
  for (const id of registeredAdapters()) assert.equal(getAdapter(id).codeGrammar, courseCodeGrammar(id), id);
  assert.equal(courseCodeGrammar((await readCatalog()).adapter!), northeasternCodeGrammar);
  assert.throws(() => courseCodeGrammar("no-such-adapter"), /no-such-adapter/);
});

// Test-only grammars for code shapes that other colleges use.
const mitLike: CourseCodeGrammar = {
  pattern: /^\d{1,2}\.\d{2,4}[A-Z]?$/,
  normalize(input) {
    const code = input.trim().toUpperCase().replace(/\s+/g, "");
    return this.pattern.test(code) ? code : null;
  },
  display: (code) => code,
  slug: (code) => code.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  subject: (code) => code.split(".")[0] ?? null,
};

const cmuLike: CourseCodeGrammar = {
  pattern: /^\d{2}-\d{3}$/,
  normalize(input) {
    const match = input.trim().match(/^(\d{2})\s*-?\s*(\d{3})$/);
    return match ? `${match[1]}-${match[2]}` : null;
  },
  display: (code) => code,
  slug: (code) => code,
  subject: (code) => code.slice(0, 2),
};

test("dotted and dashed codes work through the grammar interface", () => {
  const cases: Array<[CourseCodeGrammar, string, string, string, string]> = [
    [mitLike, " 6.1210 ", "6.1210", "6-1210", "6"],
    [mitLike, "18.06", "18.06", "18-06", "18"],
    [cmuLike, "15-122", "15-122", "15-122", "15"],
    [cmuLike, "15122", "15-122", "15-122", "15"],
  ];
  for (const [codeGrammar, input, canonical, slug, subject] of cases) {
    assert.equal(codeGrammar.normalize(input), canonical, input);
    assert.ok(codeGrammar.pattern.test(canonical));
    assert.equal(codeGrammar.normalize(codeGrammar.display(canonical)), canonical);
    assert.equal(codeGrammar.slug(canonical), slug);
    assert.equal(codeGrammar.subject(canonical), subject);
  }
  assert.equal(mitLike.normalize("CS 5800"), null);
  assert.equal(cmuLike.normalize("6.1210"), null);
  assert.equal(grammar.normalize("15-122"), null);
});
