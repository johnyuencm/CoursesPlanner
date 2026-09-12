"use client";

import dynamic from "next/dynamic";
import { LoadingState } from "@/components/ui";

const CourseGraph = dynamic(() => import("@/components/course-graph"), { ssr: false, loading: () => <LoadingState /> });

export default function MapPage() {
  return <CourseGraph />;
}
