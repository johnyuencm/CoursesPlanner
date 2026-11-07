import type { Metadata } from "next";
import { AppProvider } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";
import { SITE_URL } from "@/lib/course-pages";
import "@xyflow/react/dist/style.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL), // canonical host; the vercel.app alias points here
  title: { default: "NEU MSCS Course Map", template: "%s · NEU MSCS Course Map" },
  description: "Understand what every course unlocks in Northeastern's MSCS Seattle curriculum. Explore the prerequisite map, then plan locally.",
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
