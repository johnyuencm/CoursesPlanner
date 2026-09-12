import type { Metadata } from "next";
import { AppProvider } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";
import "@xyflow/react/dist/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NEU MSCS Course Planner", template: "%s · NEU MSCS Course Planner" },
  description: "Find your direction through Northeastern's MSCS Seattle curriculum. Explore real catalog requirements, trace prerequisites, and build a local-first degree plan.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AppProvider><AppShell>{children}</AppShell></AppProvider>
      </body>
    </html>
  );
}
