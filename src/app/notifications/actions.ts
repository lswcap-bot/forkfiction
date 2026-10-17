"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 알림 읽음 처리. RLS가 받는 사람 본인의 알림만 고치게 하고, read_at 말고는 바꿀 수 없다.

/** 알림 하나를 읽음으로 바꾸고 그 작품으로 간다(볼 수 없는 작품이면 목록에 머문다). */
export async function openNotification(id: string, href: string | null) {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  // 링크는 화면이 만든 작품 주소뿐이지만, 바깥 주소로 가지 않게 한 번 더 막는다
  if (href && /^\/w\/[a-z0-9-]+$/.test(href)) redirect(href);
  refresh();
}

export async function markAllRead() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) return { error: "읽음 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  refresh();
}
