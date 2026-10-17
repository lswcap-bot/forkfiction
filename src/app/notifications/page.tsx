import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { notificationHref, notificationText, type NotificationKind, type NotificationView } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { MarkAllReadButton, NotificationItem } from "./notification-item";

export const metadata: Metadata = { title: "알림" };

const LIST_LIMIT = 100;

// 알림 목록(F8): 내 작품에서 새 갈래가 공개됨, 별, 정사 인정, 관리자 숨김·복구.
// 누르면 읽음으로 바뀌고 그 작품으로 간다.
export default function NotificationsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <Suspense fallback={null}>
        <NotificationList />
      </Suspense>
    </main>
  );
}

type Row = {
  id: string;
  kind: NotificationKind;
  read_at: string | null;
  created_at: string;
  actor: { display_name: string } | null;
  work: {
    slug: string;
    title: string;
    fork_chapter_position: number | null;
    parent: { title: string } | null;
  } | null;
};

async function NotificationList() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/notifications");

  const supabase = await createClient();
  // 지금 볼 수 없게 된 작품(비공개·숨김)은 RLS가 가려 work가 null로 온다
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, kind, read_at, created_at, actor:profiles!notifications_actor_id_fkey(display_name), " +
        "work:works(slug, title, fork_chapter_position, parent:parent_work_id(title))",
    )
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT)
    .returns<Row[]>();
  if (error) throw error;

  const unread = data.filter((n) => !n.read_at).length;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">알림</h1>
        {unread > 0 && <MarkAllReadButton />}
      </div>
      {data.length === 0 ? (
        <p className="rounded-lg bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
          아직 알림이 없습니다. 내 작품에서 갈래가 공개되거나 별을 받으면 여기에 알려 드립니다.
        </p>
      ) : (
        <ol className="flex flex-col divide-y rounded-lg border">
          {data.map((n) => {
            const view: NotificationView = {
              kind: n.kind,
              actorName: n.actor?.display_name ?? null,
              work: n.work && {
                title: n.work.title,
                slug: n.work.slug,
                forkPosition: n.work.fork_chapter_position,
                parentTitle: n.work.parent?.title ?? null,
              },
            };
            return (
              <li key={n.id}>
                <NotificationItem
                  id={n.id}
                  text={notificationText(view)}
                  href={notificationHref(view)}
                  unread={!n.read_at}
                  createdAt={n.created_at}
                />
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
