import type { Metadata } from "next";
import { Overview } from "@/components/overview";
import { DegreeRules, PathwayList, UnlockLeaders } from "@/components/program-summary";
import { readCatalog } from "@/lib/catalog";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function OverviewPage() {
  const catalog = await readCatalog();
  return <>
    <Overview />
    <div className="static-page course-index">
      <DegreeRules catalog={catalog} />
      <UnlockLeaders catalog={catalog} limit={8} />
      <PathwayList catalog={catalog} />
    </div>
  </>;
}
