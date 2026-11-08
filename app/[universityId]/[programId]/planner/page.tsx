import type { Metadata } from "next";
import PlannerBoard from "@/components/planner-board";
import { DegreeRules } from "@/components/program-summary";
import { readProgram, type ProgramParams } from "@/lib/program-page";

type Props = { params: Promise<ProgramParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { routes } = await readProgram(params);
  return {
    title: "Build my plan",
    description: "Plan your Northeastern MSCS Seattle semesters. The planner checks prerequisites and degree rules, and saves the plan only in your browser.",
    alternates: { canonical: routes.plan },
  };
}

export default async function PlannerPage({ params }: Props) {
  const { catalog, routes } = await readProgram(params);
  return <>
    <PlannerBoard />
    <div className="static-page course-index">
      <section aria-labelledby="planner-about-title">
        <h2 id="planner-about-title">How the planner works</h2>
        <p>Add courses to semesters. The planner checks each course against its prerequisites and corequisites in the catalog.
          It also counts your credits against the degree rules below. Your plan stays in this browser. Nothing goes to a server.</p>
      </section>
      <DegreeRules catalog={catalog} routes={routes} />
    </div>
  </>;
}
