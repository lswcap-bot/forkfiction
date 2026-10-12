import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_KR } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
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
  title: "ForkFiction",
  description: "이 이야기, 여기서부터 당신 버전으로.",
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
