import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";
import { getPublicWork } from "@/lib/public-works";

// 작품 대문(과 갈래 지도·비교 등 하위 화면)의 공유 미리보기 이미지. 공개 작품이 아니면 서비스 소개 그림.
export const alt = "ForkFiction 작품";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = await getPublicWork(decodeURIComponent(slug));
  if (!work) return renderOgImage({});
  return renderOgImage({
    title: work.title,
    eyebrow: work.isFork
      ? `${work.parentTitle ? `『${work.parentTitle}』` : "숨겨진 작품"} ${work.fork_chapter_position}장에서 갈라짐`
      : "원작",
    note: (work.isFork ? work.fork_note : work.summary) ?? undefined,
    author: work.owner.display_name,
    canon: work.is_canon,
  });
}
