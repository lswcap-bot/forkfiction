import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { getViewer } from "@/lib/auth";
import { UserMenuDropdown } from "./user-menu-dropdown";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          ForkFiction
        </Link>
        {/* 쿠키를 읽는 부분만 요청 때 그리고, 나머지 헤더는 정적으로 둔다 */}
        <Suspense fallback={<div className="h-8 w-16" />}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}

async function UserMenu() {
  const viewer = await getViewer();

  if (!viewer) {
    return (
      <Link href="/login" className={buttonVariants({ variant: "outline" })}>
        로그인
      </Link>
    );
  }

  if (!viewer.profile) {
    return (
      <Link href="/onboarding" className={buttonVariants()}>
        필명 정하기
      </Link>
    );
  }

  return (
    <UserMenuDropdown
      handle={viewer.profile.handle}
      displayName={viewer.profile.display_name}
    />
  );
}
