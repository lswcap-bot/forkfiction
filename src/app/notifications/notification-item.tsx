"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markAllRead, openNotification } from "./actions";

// 서버와 브라우저에서 같은 글자가 나오도록 시간대를 정해 둔다
const dateFormat = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" });

export function NotificationItem({
  id,
  text,
  href,
  unread,
  createdAt,
}: {
  id: string;
  text: string;
  href: string | null;
  unread: boolean;
  createdAt: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => openNotification(id, href))}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 disabled:opacity-60 ${unread ? "bg-muted/30" : ""}`}
    >
      <span
        aria-hidden
        className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? "bg-destructive" : "bg-transparent"}`}
      />
      <span className="flex flex-col gap-0.5">
        <span className={unread ? "font-medium" : "text-muted-foreground"}>
          {unread && <span className="sr-only">안 읽음: </span>}
          {text}
        </span>
        <time dateTime={createdAt} className="text-xs text-muted-foreground">
          {dateFormat.format(new Date(createdAt))}
        </time>
      </span>
    </button>
  );
}

export function MarkAllReadButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(async () => void (await markAllRead()))}
    >
      {pending ? "처리하는 중…" : "모두 읽음"}
    </Button>
  );
}
