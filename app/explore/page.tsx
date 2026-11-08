import { Suspense } from "react";
import Link from "next/link";
import { ExploreWorkspace } from "@/components/explore-workspace";
import { UnlockLeaders } from "@/components/program-summary";
import { readCatalog } from "@/lib/catalog";

export default async function ExplorePage() {
  const catalog = await readCatalog();
  const links = catalog.courses.reduce((sum, course) => sum + course.unlocks.length, 0);
  return <>
    {/* The graph reads ?focus= in the browser, so it renders after load. The text below is in the first paint. */}
    <Suspense fallback={null}><ExploreWorkspace /></Suspense>
    <div className="static-page course-index">
      <section aria-labelledby="explore-intro-title">
        <h2 id="explore-intro-title">About the course map</h2>
        <p>The map shows {catalog.courses.length} courses from the {catalog.requirements.catalogYear} Northeastern catalog and {links} prerequisite links between them.
          Each link joins a prerequisite to the course that needs it.
          Select a course to see what it requires and what it opens next.</p>
        <p>Every course with catalog text also has its own page. See the <Link href="/courses">course index</Link> or the <Link href="/pathways">paths</Link>.</p>
      </section>
      <UnlockLeaders catalog={catalog} limit={12} />
    </div>
  </>;
}
