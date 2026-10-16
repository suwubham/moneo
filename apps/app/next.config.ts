import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    // Cashew backups are whole SQLite files.
    serverActions: { bodySizeLimit: "11mb" },
    // Failed navigations and Server Actions wait and retry when the connection returns; enables useOffline().
    useOffline: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@moneo/ui"],
  async headers() {
    // The service worker must never be cached, or a fixed version could take days to reach people.
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
