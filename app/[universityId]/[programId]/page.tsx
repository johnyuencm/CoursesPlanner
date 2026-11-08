import type { Metadata } from "next";
import { Overview } from "@/components/overview";
import { DegreeRules, PathwayList, UnlockLeaders } from "@/components/program-summary";
import { readProgram, type ProgramParams } from "@/lib/program-page";

type Props = { params: Promise<ProgramParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { routes } = await readProgram(params);
  return { alternates: { canonical: routes.overview } };
}

export default async function OverviewPage({ params }: Props) {
  const { catalog, routes } = await readProgram(params);
  return <>
    <Overview />
    <div className="static-page course-index">
      <DegreeRules catalog={catalog} routes={routes} />
      <UnlockLeaders catalog={catalog} routes={routes} limit={8} />
      <PathwayList catalog={catalog} routes={routes} />
    </div>
  </>;
}
