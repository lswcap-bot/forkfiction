import { ImageResponse } from "next/og";

// 공유 미리보기 이미지(1200×630). 카카오톡·SNS가 작품·장 주소를 펼칠 때 쓴다.
// 한글 글꼴은 저장소에 넣지 않고, 그림에 들어갈 글자만 Google Fonts에서 잘라 받는다.
// 글꼴을 못 받으면 기본 글꼴로라도 그린다.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

async function loadFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700&text=${encodeURIComponent(text)}`;
    // User-Agent 없이 받으면 ImageResponse가 읽을 수 있는 TrueType 주소를 준다
    const css = await (await fetch(url)).text();
    const fontUrl = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!fontUrl) return null;
    const res = await fetch(fontUrl);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export type OgContent = {
  /** 작품 제목. 없으면 서비스 소개 그림 */
  title?: string;
  /** 제목 위 작은 줄: 갈래면 '『원작』 8장에서 갈라짐', 장이면 '3장 · 장 제목' */
  eyebrow?: string;
  /** 제목 아래 줄: 한 줄 소개나 작품 소개 */
  note?: string;
  author?: string;
  canon?: boolean;
};

export async function renderOgImage(content: OgContent) {
  const title = content.title ? `『${clip(content.title, 28)}』` : "이 이야기, 여기서부터 당신 버전으로.";
  const eyebrow = content.eyebrow ? clip(content.eyebrow, 40) : "";
  const note = content.note ? clip(content.note, 60) : "";
  const author = content.author ? clip(content.author, 30) : "";
  const brand = "ForkFiction 포크픽션";
  const badge = content.canon ? "정사" : "";

  const font = await loadFont([title, eyebrow, note, author, brand, badge].join(""));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#faf7f0",
          color: "#1c1917",
          fontFamily: font ? "Noto Serif KR" : "serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: "#78716c" }}>
          <span>{brand}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {(eyebrow || badge) && (
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, color: "#57534e" }}>
              {badge && (
                <span style={{ background: "#fde68a", color: "#78350f", borderRadius: 999, padding: "4px 18px", fontSize: 26 }}>
                  {badge}
                </span>
              )}
              {eyebrow && <span>{eyebrow}</span>}
            </div>
          )}
          <div style={{ fontSize: content.title ? 72 : 60, lineHeight: 1.25, fontWeight: 700 }}>{title}</div>
          {note && <div style={{ fontSize: 32, color: "#57534e", lineHeight: 1.4 }}>{note}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 30 }}>
          <span>{author}</span>
          {/* 갈래 지도를 떠올리게 하는 갈라지는 선 */}
          <svg width="160" height="80" viewBox="0 0 160 80">
            <path d="M0 60 H160" stroke="#1c1917" strokeWidth="6" fill="none" />
            <path d="M60 60 C90 60 90 20 120 20 H160" stroke="#f59e0b" strokeWidth="5" fill="none" />
          </svg>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: font ? [{ name: "Noto Serif KR", data: font, weight: 700, style: "normal" }] : undefined,
    },
  );
}
