import Link from "next/link";
import { Suspense } from "react";
import { Bell } from "lucide-react";
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
    <div className="flex items-center gap-1">
      <NotificationBell />
      <UserMenuDropdown
        handle={viewer.profile.handle}
        displayName={viewer.profile.display_name}
        isAdmin={viewer.profile.is_admin}
      />
    </div>
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
