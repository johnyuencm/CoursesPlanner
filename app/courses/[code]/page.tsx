import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import pathwayConfig from "@/config/pathways.json";
import { PageHeading } from "@/components/ui";
import { readCatalog } from "@/lib/catalog";
import {
  courseBySlug,
  courseSlug,
  creditsLabel,
  shortestPrerequisiteChain,
  pathwaysFor,
  publicCourses,
  requirementLabel,
  transitiveUnlocks,
} from "@/lib/course-pages";
import { exploreFocusHref, routes } from "@/lib/routes";
import type { Catalog, Pathway } from "@/lib/types";

const pathways = pathwayConfig as Pathway[];

type Props = { params: Promise<{ code: string }> };

export const dynamicParams = false; // only the prerendered course pages exist; anything else is a 404

export function generateStaticParams() {
  return publicCourses(readCatalog()).map((course) => ({ code: courseSlug(course.code) }));
}

function unlockSummary(code: string, catalog: Catalog) {
  const course = catalog.courses.find((item) => item.code === code)!;
  const all = transitiveUnlocks(code, catalog.courses);
  if (!course.unlocks.length) return "It is not a prerequisite for any other course in this catalog.";
  return `It is a direct prerequisite for ${course.unlocks.length} course${course.unlocks.length > 1 ? "s" : ""}` +
    (all.length > course.unlocks.length ? `, and ${all.length} courses depend on it through a chain.` : ".");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const catalog = readCatalog();
  const course = courseBySlug(catalog, code);
  if (!course) return {};
  return {
    title: `${course.code} ${course.title}`,
    description: `${course.code} ${course.title} (${creditsLabel(course)}) in Northeastern's MSCS Seattle program: ${requirementLabel(course, catalog).toLowerCase()}. ${unlockSummary(course.code, catalog)}`,
    alternates: { canonical: `/courses/${code}` },
  };
}

export default async function CoursePage({ params }: Props) {
  const { code } = await params;
  const catalog = readCatalog();
  const course = courseBySlug(catalog, code);
  if (!course) notFound();
  const byCode = new Map(catalog.courses.map((item) => [item.code, item]));
  const pageCodes = new Set(publicCourses(catalog).map((item) => item.code));
  const ref = (target: string) => {
    const title = byCode.get(target)?.title;
    const label = <><strong>{target}</strong>{title && !title.startsWith("External course") ? ` ${title}` : ""}</>;
    return pageCodes.has(target) ? <Link href={`/courses/${courseSlug(target)}`}>{label}</Link> : label;
  };
  const chain = shortestPrerequisiteChain(course.code, catalog.courses);
  const downstream = transitiveUnlocks(course.code, catalog.courses).filter((item) => !course.unlocks.includes(item));
  const usedBy = pathwaysFor(course.code, pathways);
  const hasCoreq = course.corequisites.type !== "none" && course.corequisiteText.trim();

  return <article className="static-page course-page">
    <PageHeading
      eyebrow={requirementLabel(course, catalog)}
      title={`${course.code} · ${course.title}`}
      description={`${creditsLabel(course)}. ${unlockSummary(course.code, catalog)}`}
      actions={<Link className="text-link" href={exploreFocusHref(course.code)}>See it on the course map</Link>}
    />

    <section>
      <h2>What it unlocks</h2>
      {course.unlocks.length ? <ul className="static-list">{course.unlocks.map((item) => <li key={item}>{ref(item)}</li>)}</ul>
        : <p>No course in this catalog lists {course.code} as a prerequisite. You can take it late in the program without blocking anything.</p>}
      {downstream.length > 0 && <p className="muted">Further down the chain: {downstream.map((item, index) => <span key={item}>{index ? ", " : ""}{ref(item)}</span>)}.</p>}
    </section>

    <section>
      <h2>Before you take it</h2>
      <p>{course.prerequisites.type === "none" ? "No prerequisites." : course.prerequisiteText}</p>
      {course.prerequisiteCodes.length > 0 && <ul className="static-list">{course.prerequisiteCodes.map((item) => <li key={item}>{ref(item)}</li>)}</ul>}
      {chain.length > 2 && <p className="muted">Fewest courses in a row to reach it: {chain.map((item, index) => <span key={item}>{index ? " → " : ""}{ref(item)}</span>)} ({chain.length} courses, counting this one).</p>}
      {hasCoreq && <p><strong>Corequisite:</strong> {course.corequisiteText}</p>}
    </section>

    {usedBy.length > 0 && <section>
      <h2>Paths that use it</h2>
      <ul className="static-list">{usedBy.map(({ pathway, group }) => <li key={`${pathway.id}-${group}`}>
        <Link href={`/pathways/${pathway.id}`}>{pathway.name}</Link> <small>{group}</small>
      </li>)}</ul>
    </section>}

    <section>
      <h2>Catalog description</h2>
      <p>{course.description}</p>
      <p className="muted">From the {catalog.requirements.catalogYear} Northeastern catalog. <a href={course.officialUrl} rel="noopener">Official course page</a>.
        Semester offerings are not in the catalog, so check section times with the university.</p>
    </section>

    <p className="muted">This planner is an advising aid, not an official degree audit. <Link href={routes.courses}>All courses</Link> · <Link href={routes.plan}>Plan your semesters</Link></p>
  </article>;
}
