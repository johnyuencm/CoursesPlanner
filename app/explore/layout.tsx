import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore",
  description: "Understand what every course unlocks in the Northeastern MSCS Seattle curriculum.",
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
