import type { NextConfig } from "next";
import { verifyProductionMode } from "./lib/deployment";

verifyProductionMode(process.env.VERCEL_ENV, process.env.NEXT_PUBLIC_DEMO_MODE);
const nextConfig: NextConfig = {
  output: "standalone",
  distDir: process.env.CCU360_BUILD_DIR ?? ".next",
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/**": ["./lib/server/.demo-session-key"],
  },
  turbopack: {},
  experimental: process.env.CCU360_BUILD_DIR
    ? { cpus: 2, turbopackFileSystemCacheForBuild: false }
    : {},
  webpack(config, { dev }) {
    if (dev && process.env.CCU360_BUILD_DIR) config.cache = false;
    return config;
  },
  // No shared server caching of clinical data. The phase-one UI uses synthetic client state.
  cacheComponents: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
