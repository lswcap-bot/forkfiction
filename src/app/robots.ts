import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/public-works";

// 읽는 화면만 검색에 열고, 계정·작업·관리 화면은 막는다
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/notifications", "/new", "/onboarding", "/login", "/auth/", "/w/*/edit"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
