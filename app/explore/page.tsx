"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { ProgramRoadmap } from "@/lib/types";
import { RoadmapSelector } from "@/components/roadmap-selector";
import { LoadingState } from "@/components/ui";
import { parseExploreFocus } from "@/lib/routes";

const CourseGraph = dynamic(() => import("@/components/course-graph"), { ssr: false, loading: () => <LoadingState /> });

function ExploreWorkspace() {
  const params = useSearchParams();
  const [roadmap, setRoadmap] = useState<ProgramRoadmap | null>(null);
  const requestedFocus = parseExploreFocus(params.get("focus"));
  return <>
    <RoadmapSelector onRoadmapChange={setRoadmap} />
    <CourseGraph roadmap={roadmap} requestedFocus={requestedFocus} />
  </>;
}

export default function ExplorePage() {
  return <Suspense fallback={<LoadingState />}><ExploreWorkspace /></Suspense>;
}
