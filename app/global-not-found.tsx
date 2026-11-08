import type { Metadata } from "next";
import { DEFAULT_CATALOG_KEY } from "@/lib/catalog-key";
import { programRoutes } from "@/lib/routes";
import "./globals.css";

const routes = programRoutes(DEFAULT_CATALOG_KEY);

// Route misses skip the root layout and its client providers. A full layout
// render cost 14-95 ms of CPU on Workers, over the 10 ms Free plan limit.
export const metadata: Metadata = {
  title: "Page not found · NEU MSCS Course Map",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <main style={{ maxWidth: "36rem", margin: "4rem auto", padding: "0 1rem" }}>
          <h1>Page not found</h1>
          <p>This page does not exist in the course map.</p>
          <p>
            <a href={routes.overview}>Overview</a> · <a href={routes.courses}>All courses</a> · <a href={routes.explore}>Explore</a>
          </p>
        </main>
      </body>
    </html>
  );
}
