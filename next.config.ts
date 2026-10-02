import type { NextConfig } from "next";
import { legacyRedirects } from "./lib/routes";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  serverExternalPackages: ["cheerio"],
  // The roadmap reader is dynamic and reads these files at runtime, so the
  // serverless trace must ship them. Keep it to the committed snapshot only;
  // raw HTML caches and the scraper stay out of the bundle.
  outputFileTracingIncludes: {
    "/api/roadmaps": [
      "./catalog-service/universities.json",
      "./data/catalogs/northeastern/programs.json",
      "./data/catalogs/northeastern/roadmaps/computer-science-mscs-sea-8b0d00dbda.json",
    ],
  },
  experimental: {
    // Bound long-lived `next dev` RAM; requires the default Turbopack FS cache.
    turbopackMemoryEviction: "full",
  },
  async redirects() {
    return [...legacyRedirects];
  },
};

export default nextConfig;
