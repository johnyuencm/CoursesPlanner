import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { LoadingState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Explore",
  description: "Understand what every course unlocks in the Northeastern MSCS Seattle curriculum.",
};

const CourseGraph = dynamic(() => import("@/components/course-graph"), {
  ssr: false,
  loading: () => <LoadingState />,
});

export default function ExplorePage() {
  return <CourseGraph />;
}
