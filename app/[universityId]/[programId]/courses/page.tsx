import type { Metadata } from "next";
import Link from "next/link";
import { CoursesExplorer } from "@/components/courses-explorer";
import { readProgram, type ProgramParams } from "@/lib/program-page";
import { courseSlug, creditsLabel, publicCourses, requirementLabel } from "@/lib/course-pages";

type Props = { params: Promise<ProgramParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, routes } = await readProgram(params);
  return {
    title: "Courses",
    description: `Every course in the ${name} catalog, with prerequisites, what each course unlocks, and how it counts toward the degree.`,
    alternates: { canonical: routes.courses },
  };
}

export default async function CoursesPage({ params }: Props) {
  const { catalog, routes } = await readProgram(params);
  const courses = publicCourses(catalog);
  // The interactive explorer loads the catalog in the browser; this index is plain HTML, so every course page is one link away.
  return <>
    <CoursesExplorer />
    <section className="static-page course-index" aria-labelledby="course-index-title">
      <h2 id="course-index-title">Course index</h2>
      <p className="muted">All {courses.length} courses with catalog details, from the {catalog.requirements.catalogYear} catalog. Each page shows the prerequisites, what the course unlocks, and the paths that use it.</p>
      <ul className="static-list">
        {courses.map((course) => <li key={course.code}>
          <Link href={routes.course(courseSlug(course.code, catalog))}><strong>{course.code}</strong> {course.title}</Link>
          <small>{creditsLabel(course)} · {requirementLabel(course, catalog)}</small>
        </li>)}
      </ul>
    </section>
  </>;
}
