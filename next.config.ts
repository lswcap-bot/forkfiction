import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      // 프로필 주소 /@필명 → /u/필명
      { source: "/@:handle", destination: "/u/:handle" },
    ];
  },
};

export default nextConfig;
