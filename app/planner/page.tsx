import type { Metadata } from "next";
import PlannerBoard from "@/components/planner-board";

export const metadata: Metadata = { title: "Build my plan" };

export default function PlannerPage() {
  return <PlannerBoard />;
}
