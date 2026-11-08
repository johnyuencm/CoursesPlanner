import type { Metadata } from "next";
import { readProgram, type ProgramParams } from "@/lib/program-page";

export async function generateMetadata({ params }: { params: Promise<ProgramParams> }): Promise<Metadata> {
  const { routes } = await readProgram(params);
  return {
    title: "Explore",
    description: "Understand what every course unlocks in the Northeastern MSCS Seattle curriculum.",
    alternates: { canonical: routes.explore },
  };
}

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
