import type { Metadata } from "next";
import { SITE_URL } from "@/lib/course-pages";
import "@xyflow/react/dist/style.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL), // canonical host; the vercel.app alias points here
  title: { default: "NEU MSCS Course Map", template: "%s · NEU MSCS Course Map" },
  description: "Understand what every course unlocks in Northeastern's MSCS Seattle curriculum. Explore the prerequisite map, then plan locally.",
};

// The app shell and its client state are in app/[universityId]/[programId]/layout.tsx.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
