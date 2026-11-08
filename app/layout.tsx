import type { Metadata } from "next";
import { SITE_URL } from "@/lib/course-pages";
import "@xyflow/react/dist/style.css";
import "./globals.css";

// Generic product name. Program layouts add the college and program from the snapshot.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL), // canonical host; the vercel.app alias points here
  title: { default: "Course Map", template: "%s · Course Map" },
  description: "Pick your college and program. See what every course unlocks, then plan your terms locally.",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "32x32" }] },
};

// The app shell and its client state are in app/[universityId]/[programId]/layout.tsx.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
