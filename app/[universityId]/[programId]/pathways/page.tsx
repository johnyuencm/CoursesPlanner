import type { Metadata } from "next";
import { PathwaysWorkspace } from "@/components/pathways-workspace";
import { PathwayList } from "@/components/program-summary";
import { readProgram, type ProgramParams } from "@/lib/program-page";

type Props = { params: Promise<ProgramParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, routes } = await readProgram(params);
  return {
    title: "Paths",
    description: `Suggested course paths for the ${name} program: machine learning, systems, data engineering, robotics and general software engineering.`,
    alternates: { canonical: routes.paths },
  };
}

export default async function PathwaysPage({ params }: Props) {
  const { catalog, routes } = await readProgram(params);
  return <>
    <PathwaysWorkspace />
    <div className="static-page course-index"><PathwayList catalog={catalog} routes={routes} /></div>
  </>;
}
