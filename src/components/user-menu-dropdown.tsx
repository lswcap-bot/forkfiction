"use client";

import Link from "next/link";
import { useTransition } from "react";
import { signOut } from "@/app/auth/actions";
import { initials } from "@/components/ff";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = { handle: string; displayName: string; isAdmin: boolean };

export function UserMenuDropdown({ handle, displayName, isAdmin }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      {/* 아바타 + 이름 알약. 좁은 화면과 장 읽기 화면에서는 아바타만 보이고, 이름은 접근성 이름으로 남는다 */}
      <DropdownMenuTrigger
        aria-label={displayName}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-kind-original text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto sm:gap-2 sm:border sm:border-line sm:bg-surface sm:py-0 sm:pr-4 sm:pl-1 sm:group-has-[[data-reading]]/body:w-11 sm:group-has-[[data-reading]]/body:border-0 sm:group-has-[[data-reading]]/body:bg-kind-original sm:group-has-[[data-reading]]/body:p-0"
      >
        <span
          aria-hidden
          className="grid size-[34px] place-items-center rounded-full text-[13px] sm:bg-kind-original sm:group-has-[[data-reading]]/body:size-11"
        >
          {initials(displayName)}
        </span>
        <span aria-hidden className="hidden max-w-32 truncate sm:inline sm:group-has-[[data-reading]]/body:hidden">
          {displayName}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">@{handle}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={`/@${handle}`} />}>내 프로필</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/notifications" />}>알림</DropdownMenuItem>
        {isAdmin && <DropdownMenuItem render={<Link href="/admin" />}>관리</DropdownMenuItem>}
        <DropdownMenuItem
          disabled={pending}
          onClick={() => startTransition(() => signOut())}
        >
          {pending ? "로그아웃하는 중…" : "로그아웃"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
