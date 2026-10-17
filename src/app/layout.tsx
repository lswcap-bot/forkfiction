import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_KR } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { siteUrl } from "@/lib/public-works";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 장 읽기 본문용 한글 명조. 글자 파일이 커서 미리 불러오지 않는다.
const notoSerifKr = Noto_Serif_KR({
  variable: "--font-serif",
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
      className={`${geistSans.variable} ${geistMono.variable} ${notoSerifKr.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
