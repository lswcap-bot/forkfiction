import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";
import { getPublicChapterTitle, getPublicWork } from "@/lib/public-works";

// 장 읽기 화면의 공유 미리보기 이미지: 작품 제목과 'N장 · 장 제목'
export const alt = "ForkFiction 장 읽기";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string; position: string }> }) {
  const { slug, position } = await params;
  const decoded = decodeURIComponent(slug);
  const n = /^[1-9]\d{0,3}$/.test(position) ? Number(position) : null;
  const [work, chapterTitle] = await Promise.all([
    getPublicWork(decoded),
    n === null ? Promise.resolve(null) : getPublicChapterTitle(decoded, n),
  ]);
  if (!work || !chapterTitle) return renderOgImage({});
  return renderOgImage({
    title: work.title,
    eyebrow: `${n}장 · ${chapterTitle}`,
    note: work.isFork ? `${work.parentTitle ? `『${work.parentTitle}』` : "숨겨진 작품"} ${work.fork_chapter_position}장에서 갈라진 갈래` : undefined,
    author: work.owner.display_name,
    canon: work.is_canon,
  });
}
