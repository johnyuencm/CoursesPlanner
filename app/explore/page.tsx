"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ProgramRoadmap } from "@/lib/types";
import { RoadmapSelector } from "@/components/roadmap-selector";
import { LoadingState } from "@/components/ui";

const CourseGraph = dynamic(() => import("@/components/course-graph"), { ssr: false, loading: () => <LoadingState /> });

export default function ExplorePage() {
  const [roadmap, setRoadmap] = useState<ProgramRoadmap | null>(null);
  return <>
    <RoadmapSelector onRoadmapChange={setRoadmap} />
    <CourseGraph roadmap={roadmap} />
  </>;
}
