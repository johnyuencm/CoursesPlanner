import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  experimental: {
    // Bound long-lived `next dev` RAM; requires the default Turbopack FS cache.
    turbopackMemoryEviction: "full",
  },
};

export default nextConfig;
