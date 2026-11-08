import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import pathwayConfig from "@/config/pathways.json";
import { PageHeading } from "@/components/ui";
import { courseSlug, creditsLabel, publicCourses, requirementLabel, requirementText, unmetRequirements } from "@/lib/course-pages";
import { readProgram, type ProgramParams } from "@/lib/program-page";
import type { Pathway } from "@/lib/types";

const pathways = pathwayConfig as Pathway[];

type Props = { params: Promise<ProgramParams & { id: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return pathways.map((pathway) => ({ id: pathway.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { routes } = await readProgram(params);
  const pathway = pathways.find((item) => item.id === id);
  if (!pathway) return {};
  return {
    title: `${pathway.name} path`,
    description: `${pathway.description} Courses for the ${pathway.name} path in Northeastern's MSCS Seattle program, with prerequisites and how each one counts.`,
    alternates: { canonical: routes.pathway(id) },
  };
}

export default async function PathwayPage({ params }: Props) {
  const { id } = await params;
  const pathway = pathways.find((item) => item.id === id);
  if (!pathway) notFound();
  const { catalog, routes } = await readProgram(params);
  const byCode = new Map(catalog.courses.map((course) => [course.code, course]));
  const pageCodes = new Set(publicCourses(catalog).map((course) => course.code));
  const inPath = new Set(pathway.groups.flatMap((group) => group.courses));
  // Prerequisites that the path itself does not cover ("or" groups count as covered when one option is in the path).
  const groups = new Map<string, string[]>();
  for (const code of inPath) {
    for (const options of unmetRequirements(byCode.get(code)?.prerequisites ?? { type: "none" }, inPath)) groups.set(options.join("|"), options);
  }
  const before = [...groups.values()].sort((a, b) => a[0]!.localeCompare(b[0]!, undefined, { numeric: true }));
  const counts = { core: 0, breadth: 0, elective: 0, other: 0 };
  for (const code of inPath) {
    const type = byCode.get(code)?.requirementType;
    counts[type === "core" || type === "breadth" || type === "elective" ? type : "other"] += 1;
  }
  const link = (code: string) => pageCodes.has(code)
    ? <Link href={routes.course(courseSlug(code, catalog))}><strong>{code}</strong> {byCode.get(code)?.title}</Link>
    : <strong>{code}</strong>;

  return <article className="static-page pathway-page">
    <PageHeading eyebrow="Path" title={pathway.name} description={pathway.description}
      actions={<Link className="text-link" href={routes.paths}>Open the interactive paths page</Link>} />

    <p>This path lists {inPath.size} courses: {counts.core} core, {counts.breadth} breadth and {counts.elective} elective
      {counts.other ? `, plus ${counts.other} other` : ""}. A path is a suggestion. It never changes the degree requirements.</p>

    {pathway.groups.map((group) => <section key={group.label}>
      <h2>{group.label}</h2>
      <ul className="static-list">{group.courses.map((code) => {
        const course = byCode.get(code);
        return <li key={code}>{link(code)}
          {course && <small>{creditsLabel(course)} · {requirementLabel(course, catalog)}
            {course.prerequisites.type === "none" ? " · no prerequisites" : ` · needs ${requirementText(course.prerequisites)}`}</small>}
        </li>;
      })}</ul>
    </section>)}

    {before.length > 0 && <section>
      <h2>Plan these first</h2>
      <p>These prerequisites are not in the path, but path courses need them:</p>
      <ul className="static-list">{before.map((options) => <li key={options.join("|")}>
        {options.length > 1 ? <>One of: {options.map((code, index) => <span key={code}>{index ? ", " : ""}{link(code)}</span>)}</> : link(options[0]!)}
      </li>)}</ul>
    </section>}

    <section>
      <h2>Other paths</h2>
      <ul className="static-list">{pathways.filter((item) => item.id !== pathway.id).map((item) =>
        <li key={item.id}><Link href={routes.pathway(item.id)}>{item.name}</Link> <small>{item.description}</small></li>)}</ul>
    </section>
    <p className="muted">This planner is an advising aid, not an official degree audit. <Link href={routes.courses}>All courses</Link></p>
  </article>;
}
