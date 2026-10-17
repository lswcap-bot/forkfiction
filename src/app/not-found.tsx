import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "찾을 수 없는 페이지" };

// 없는 주소, 비공개·숨김 작품, 없는 장·프로필
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-[40px] leading-none font-light tracking-[-0.04em] text-ink-3 tabular-nums">404</p>
      <h1 className="text-[28px] font-bold tracking-[-0.04em] sm:text-4xl">페이지를 찾을 수 없습니다</h1>
      <p className="text-[15px] leading-relaxed text-ink-2">
        주소가 틀렸거나, 작가가 작품을 비공개로 돌렸거나, 관리자가 숨긴 작품일 수 있습니다.
      </p>
      <Link href="/" className={buttonVariants()}>
        홈으로
      </Link>
    </main>
  );
}
