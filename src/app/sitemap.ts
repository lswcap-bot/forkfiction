import type { MetadataRoute } from "next";
import { getSitemapWorks, siteUrl } from "@/lib/public-works";

// 공개 작품의 대문·갈래 지도·장 주소. 임시 저장·숨긴 작품은 들어가지 않는다(방문자 권한으로 읽는다).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const works = await getSitemapWorks();
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.1 },
    ...works.flatMap((w) => [
      { url: `${base}/w/${w.slug}`, lastModified: w.updated_at, changeFrequency: "weekly" as const, priority: 0.8 },
      { url: `${base}/w/${w.slug}/tree`, lastModified: w.updated_at, changeFrequency: "weekly" as const, priority: 0.5 },
      ...w.positions.map((p) => ({ url: `${base}/w/${w.slug}/${p}`, lastModified: w.updated_at, priority: 0.6 })),
    ]),
  ];
}
