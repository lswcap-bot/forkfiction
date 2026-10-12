import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // 작품 올리기는 원고 전체를 서버 액션으로 보낸다(한 장 10만 자, 『칼의 여행』은 약 370KB)
    serverActions: { bodySizeLimit: "5mb" },
  },
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
