import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

// 홈과 그 밖의 화면의 공유 미리보기 이미지
export const alt = "ForkFiction — 이 이야기, 여기서부터 당신 버전으로.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return renderOgImage({});
}
