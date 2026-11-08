// Server-rendered program facts. Crawlers and first paint see real text while the
// interactive client views still load the catalog. Every fact comes from the catalog or config/pathways.json.
import Link from "next/link";
import pathwayConfig from "@/config/pathways.json";
import { courseSlug, creditsLabel, publicCourses, transitiveUnlocks } from "@/lib/course-pages";
import { requirementView } from "@/lib/requirements-v2";
import type { ProgramRoutes } from "@/lib/routes";
import type { Catalog, Pathway } from "@/lib/types";

const pathways = pathwayConfig as Pathway[];

function courseLinker(catalog: Catalog, routes: ProgramRoutes) {
  const byCode = new Map(catalog.courses.map((course) => [course.code, course]));
  const pageCodes = new Set(publicCourses(catalog).map((course) => course.code));
  return (code: string) => {
    const label = <><strong>{code}</strong> {byCode.get(code)?.title}</>;
    return pageCodes.has(code) ? <Link href={routes.course(courseSlug(code, catalog))}>{label}</Link> : label;
  };
}

export function DegreeRules({ catalog, routes }: { catalog: Catalog; routes: ProgramRoutes }) {
  const rules = catalog.requirements;
  const { totalCredits, core, breadth, electives } = requirementView(rules);
  const link = courseLinker(catalog, routes);
  const byCode = new Map(catalog.courses.map((course) => [course.code, course]));
  return <section aria-labelledby="degree-rules-title">
    <h2 id="degree-rules-title">{rules.name}: degree rules</h2>
    <p>The {rules.catalogYear} Northeastern catalog asks for {totalCredits} credits{rules.minimumGpa !== undefined && <> and a minimum {rules.minimumGpa.toFixed(1)} GPA</>}.
      This map models those rules from the official catalog. It is not an official degree audit.</p>
    {core.length > 0 && <><h3>Required core courses</h3>
    <ul className="static-list">{core.map((code) => <li key={code}>{link(code)}
      {byCode.get(code) && <small>{creditsLabel(byCode.get(code)!)}</small>}</li>)}</ul></>}
    {breadth && <><h3>Breadth areas</h3>
    <p>Take {breadth.count} breadth courses ({breadth.credits} credits) from at least {breadth.minAreas} of these {breadth.areas.length} areas.</p>
    {breadth.areas.map((category) => <details key={category.id}>
      <summary>{category.name} ({category.courses.length} courses)</summary>
      <ul className="static-list">{category.courses.map((code) => <li key={code}>{link(code)}</li>)}</ul>
    </details>)}</>}
    {electives && <><h3>Electives</h3>
    <p>Complete {electives.credits} more credits from the breadth courses and the other listed electives.
      The catalog lists {electives.courses.length} courses that can count here. The <Link href={routes.courses}>course index</Link> shows how each course counts. <a href={rules.officialUrl} rel="noopener">Official program requirements</a>.</p></>}
  </section>;
}

/** Courses that open the most other courses, directly or through a chain. */
export function UnlockLeaders({ catalog, routes, limit }: { catalog: Catalog; routes: ProgramRoutes; limit: number }) {
  const link = courseLinker(catalog, routes);
  const ranked = publicCourses(catalog)
    .map((course) => ({ course, total: transitiveUnlocks(course.code, catalog.courses).length }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total || b.course.unlocks.length - a.course.unlocks.length)
    .slice(0, limit);
  return <section aria-labelledby="unlock-leaders-title">
    <h2 id="unlock-leaders-title">Courses that unlock the most</h2>
    <p>Other courses list these as prerequisites, directly or through a chain. Plan them before the courses that need them.</p>
    <ul className="static-list">{ranked.map(({ course, total }) => <li key={course.code}>{link(course.code)}
      <small>Direct prerequisite for {course.unlocks.length} course{course.unlocks.length === 1 ? "" : "s"}, {total} in the full chain</small></li>)}</ul>
  </section>;
}

export function PathwayList({ catalog, routes }: { catalog: Catalog; routes: ProgramRoutes }) {
  const link = courseLinker(catalog, routes);
  return <section aria-labelledby="pathway-list-title">
    <h2 id="pathway-list-title">Paths</h2>
    <p>A path is a suggested set of courses for one career goal. It never changes the degree requirements.</p>
    <ul className="static-list">{pathways.map((pathway) => <li key={pathway.id}>
      <Link href={routes.pathway(pathway.id)}><strong>{pathway.name}</strong></Link> <small>{pathway.description}</small>
      {pathway.groups.map((group) => <small key={group.label}>{group.label}: {group.courses.map((code, index) => <span key={code}>{index ? ", " : ""}{link(code)}</span>)}</small>)}
    </li>)}</ul>
  </section>;
}
