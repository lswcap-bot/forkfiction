import Link from "next/link";
import { Suspense } from "react";
import { Bell, LibraryBig, PenLine } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UserMenuDropdown } from "./user-menu-dropdown";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          ForkFiction
        </Link>
        <div className="flex items-center gap-1">
          {/* 전체 목록은 로그인과 상관없어 정적으로 그린다. 좁은 화면에서는 아이콘만 보인다. */}
          <Link href="/works" className={buttonVariants({ variant: "ghost" })} aria-label="전체 목록">
            <LibraryBig />
            <span className="hidden sm:inline">전체 목록</span>
          </Link>
          {/* 쿠키를 읽는 부분만 요청 때 그리고, 나머지 헤더는 정적으로 둔다 */}
          <Suspense fallback={<div className="h-8 w-16" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function UserMenu() {
  const viewer = await getViewer();

  if (!viewer) {
    return (
      <div className="flex items-center gap-1">
        <UploadLink href="/login?next=/new" />
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          로그인
        </Link>
      </div>
    );
  }

  if (!viewer.profile) {
    return (
      <div className="flex items-center gap-1">
        <UploadLink href="/onboarding?next=/new" />
        <Link href="/onboarding" className={buttonVariants()}>
          필명 정하기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <UploadLink href="/new" />
      <NotificationBell />
      <UserMenuDropdown
        handle={viewer.profile.handle}
        displayName={viewer.profile.display_name}
        isAdmin={viewer.profile.is_admin}
      />
    </div>
  );
}

// 작품 올리기: 로그인 전이면 로그인(필명 전이면 필명 정하기)을 거쳐 /new로 돌아온다.
// 좁은 화면에서는 아이콘만 보인다.
function UploadLink({ href }: { href: string }) {
  return (
    <Link href={href} className={buttonVariants({ variant: "ghost" })} aria-label="작품 올리기">
      <PenLine />
      <span className="hidden sm:inline">작품 올리기</span>
    </Link>
  );
}

// 종 아이콘과 안 읽은 알림 수(F8)
async function NotificationBell() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  const unread = count ?? 0;

  return (
    <Link
      href="/notifications"
      className={buttonVariants({ variant: "ghost", size: "icon", className: "relative" })}
      aria-label={unread > 0 ? `알림, 안 읽은 알림 ${unread}개` : "알림"}
    >
      <Bell />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] leading-none font-semibold text-white tabular-nums">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
