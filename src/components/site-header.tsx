import Link from "next/link";
import { Suspense } from "react";
import { Bell, LibraryBig, PenLine } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { UserMenuDropdown } from "./user-menu-dropdown";

// 사이트 헤더. 장 읽기 화면(본문에 data-reading이 있는 페이지)에서는 얇고 조용하게 줄인다:
// 작은 로고, 글자 없는 아이콘 메뉴, 읽기 바탕색. 어느 화면에서도 스크롤을 따라오지 않는다.
// body의 group/body와 group-has-[[data-reading]]/body 변형으로 고른다(layout.tsx).
// Tailwind가 소스에서 클래스 이름을 찾으므로 변형 이름을 줄이지 않고 그대로 쓴다.

/** 원형 아이콘 버튼(44px). 좁은 화면 메뉴와 알림 종에 쓴다 */
const circle = "relative inline-grid size-11 shrink-0 place-items-center rounded-full border border-line text-ink transition-colors hover:bg-ink/5 [&_svg]:size-5";

export function SiteHeader() {
  return (
    <header
      className={cn(
        "group/header",
        "group-has-[[data-reading]]/body:border-b group-has-[[data-reading]]/body:border-line-soft group-has-[[data-reading]]/body:bg-paper-read",
      )}
    >
      <div
        className={cn(
          "ff-container flex h-[68px] items-center justify-between gap-2 sm:h-[88px] sm:gap-4",
          "group-has-[[data-reading]]/body:h-14 sm:group-has-[[data-reading]]/body:h-14",
        )}
      >
        <Link
          href="/"
          className={cn("text-xl font-bold tracking-[-0.04em] sm:text-[23px]", "group-has-[[data-reading]]/body:text-[17px] sm:group-has-[[data-reading]]/body:text-[17px]")}
        >
          Fork<span className="font-normal">Fiction</span>
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="주 메뉴">
          {/* 전체 목록은 로그인과 상관없어 정적으로 그린다. 좁은 화면에서는 아이콘만 보인다. */}
          <Link
            href="/works"
            className={cn(
              circle,
              "sm:inline-flex sm:h-11 sm:w-auto sm:gap-2 sm:border-transparent sm:px-[18px] sm:text-sm sm:font-medium sm:[&_svg]:size-[18px]",
              "group-has-[[data-reading]]/body:border-transparent sm:group-has-[[data-reading]]/body:size-11 sm:group-has-[[data-reading]]/body:px-0 sm:group-has-[[data-reading]]/body:grid",
            )}
            aria-label="전체 목록"
          >
            <LibraryBig />
            <span className={cn("hidden sm:inline", "sm:group-has-[[data-reading]]/body:hidden")}>전체 목록</span>
          </Link>
          {/* 쿠키를 읽는 부분만 요청 때 그리고, 나머지 헤더는 정적으로 둔다 */}
          <Suspense fallback={<div className="h-11 w-24" />}>
            <UserMenu />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function UserMenu() {
  const viewer = await getViewer();

  if (!viewer) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <UploadLink href="/login?next=/new" />
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          로그인
        </Link>
      </div>
    );
  }

  if (!viewer.profile) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <UploadLink href="/onboarding?next=/new" />
        <Link href="/onboarding" className={buttonVariants({ variant: "outline" })}>
          필명 정하기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
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

// 작품 올리기(검은 알약): 로그인 전이면 로그인(필명 전이면 필명 정하기)을 거쳐 /new로 돌아온다.
// 좁은 화면과 장 읽기 화면에서는 아이콘만 보인다.
function UploadLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        circle,
        "border-ink bg-ink text-surface hover:bg-ink/85",
        "sm:inline-flex sm:h-11 sm:w-auto sm:gap-2 sm:px-5 sm:text-sm sm:font-semibold sm:[&_svg]:size-[18px]",
        "group-has-[[data-reading]]/body:border-transparent group-has-[[data-reading]]/body:bg-transparent group-has-[[data-reading]]/body:text-ink group-has-[[data-reading]]/body:hover:bg-ink/5",
        "sm:group-has-[[data-reading]]/body:size-11 sm:group-has-[[data-reading]]/body:px-0 sm:group-has-[[data-reading]]/body:grid",
      )}
      aria-label="작품 올리기"
    >
      <PenLine />
      <span className={cn("hidden sm:inline", "sm:group-has-[[data-reading]]/body:hidden")}>작품 올리기</span>
    </Link>
  );
}

// 종 아이콘. 안 읽은 알림이 있으면 빨간 점(F8). 개수는 접근성 이름에 담는다.
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
      className={cn(circle, "group-has-[[data-reading]]/body:border-transparent")}
      aria-label={unread > 0 ? `알림, 안 읽은 알림 ${unread}개` : "알림"}
    >
      <Bell />
      {unread > 0 && (
        <span
          className={cn("absolute top-[9px] right-[10px] size-[9px] rounded-full border-2 border-paper bg-alert", "group-has-[[data-reading]]/body:border-paper-read")}
          aria-hidden
        />
      )}
    </Link>
  );
}
