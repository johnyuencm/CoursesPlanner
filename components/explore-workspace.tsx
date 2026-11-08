"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { ProgramRoadmap } from "@/lib/types";
import { useApp } from "@/components/app-provider";
import { RoadmapSelector } from "@/components/roadmap-selector";
import { LoadingState } from "@/components/ui";
import { catalogCodeGrammar } from "@/lib/course-code";
import { parseExploreFocus } from "@/lib/routes";

const CourseGraph = dynamic(() => import("@/components/course-graph"), { ssr: false, loading: () => <LoadingState /> });

export function ExploreWorkspace() {
  const params = useSearchParams();
  const { catalog } = useApp();
  const [roadmap, setRoadmap] = useState<ProgramRoadmap | null>(null);
  // The URL focus applies to the app catalog only (course-graph ignores it while a roadmap is open).
  const requestedFocus = parseExploreFocus(params.get("focus"), catalogCodeGrammar(catalog));
  return <>
    <RoadmapSelector onRoadmapChange={setRoadmap} />
    <CourseGraph roadmap={roadmap} requestedFocus={requestedFocus} />
  </>;
}
