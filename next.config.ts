import { resolve } from "node:path";
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
  turbopack: {
    resolveAlias: {
      "@pdfme/converter": "./features/document-studio/blank-paper-converter.ts",
    },
  },
  experimental: process.env.CCU360_BUILD_DIR
    ? { cpus: 2, turbopackFileSystemCacheForBuild: false }
    : {},
  webpack(config, { dev }) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@pdfme/converter$": resolve(
        process.cwd(),
        "features/document-studio/blank-paper-converter.ts",
      ),
    };
    if (dev && process.env.CCU360_BUILD_DIR) config.cache = false;
    return config;
  },
  // Clinical data uses no-store requests and tenant-scoped in-memory queries.
  cacheComponents: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...(/^[0-9a-f]{40}$/i.test(process.env.VERCEL_GIT_COMMIT_SHA ?? "")
            ? [
                {
                  key: "X-CCU360-Revision",
                  value: process.env.VERCEL_GIT_COMMIT_SHA!,
                },
              ]
            : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
