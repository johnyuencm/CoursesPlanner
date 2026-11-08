import type { Metadata } from "next";
import PlannerBoard from "@/components/planner-board";
import { DegreeRules } from "@/components/program-summary";
import { readCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Build my plan",
  description: "Plan your Northeastern MSCS Seattle semesters. The planner checks prerequisites and degree rules, and saves the plan only in your browser.",
  alternates: { canonical: "/planner" },
};

export default function PlannerPage() {
  return <>
    <PlannerBoard />
    <div className="static-page course-index">
      <section aria-labelledby="planner-about-title">
        <h2 id="planner-about-title">How the planner works</h2>
        <p>Add courses to semesters. The planner checks each course against its prerequisites and corequisites in the catalog.
          It also counts your credits against the degree rules below. Your plan stays in this browser. Nothing goes to a server.</p>
      </section>
      <DegreeRules catalog={readCatalog()} />
    </div>
  </>;
}
