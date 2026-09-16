import type { NextConfig } from "next";
import { legacyRedirects } from "./lib/routes";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  serverExternalPackages: ["cheerio"],
  experimental: {
    // Bound long-lived `next dev` RAM; requires the default Turbopack FS cache.
    turbopackMemoryEviction: "full",
  },
  async redirects() {
    return [...legacyRedirects];
  },
};

export default nextConfig;
