import type { Metadata } from "next";
import { PathwaysWorkspace } from "@/components/pathways-workspace";
import { PathwayList } from "@/components/program-summary";
import { readCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Paths",
  description: "Suggested course paths for Northeastern's MSCS Seattle program: machine learning, systems, data engineering, robotics and general software engineering.",
  alternates: { canonical: "/pathways" },
};

export default function PathwaysPage() {
  return <>
    <PathwaysWorkspace />
    <div className="static-page course-index"><PathwayList catalog={readCatalog()} /></div>
  </>;
}
