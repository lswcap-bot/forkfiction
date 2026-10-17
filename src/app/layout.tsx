import type { Metadata } from "next";
import { IBM_Plex_Sans_KR, Noto_Serif_KR } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { siteUrl } from "@/lib/public-works";
import "./globals.css";

// UI·숫자·로고 글꼴(tokens.css의 --ff-font-ui). 한글 글자 파일은 구글이 쪼개 주므로 쓰는 글자만 받는다.
const plexSansKr = IBM_Plex_Sans_KR({
  variable: "--font-plex-kr",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

// 장 본문·작품 제목·장 제목용 한글 명조(--ff-font-reading). 글자 파일이 커서 미리 불러오지 않는다.
const notoSerifKr = Noto_Serif_KR({
  variable: "--font-noto-serif-kr",
  weight: ["400", "600", "700"],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "ForkFiction 포크픽션", template: "%s · ForkFiction" },
  description: "원작 소설을 장 단위로 읽고, 원하는 장에서 갈라져 나와 자기 버전을 이어 쓰는 소설 플랫폼. 이 이야기, 여기서부터 당신 버전으로.",
  applicationName: "ForkFiction",
  openGraph: { type: "website", siteName: "ForkFiction 포크픽션", locale: "ko_KR" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${plexSansKr.variable} ${notoSerifKr.variable} h-full antialiased`}
    >
      <body className="group/body flex min-h-full flex-col has-[[data-reading]]:bg-paper-read">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
