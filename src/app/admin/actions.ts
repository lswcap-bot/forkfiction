"use server";

import { refresh } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// 관리자 화면(F9)의 숨김·복구·기각. 숨김·복구는 DB 함수가, 기각은 RLS가 관리자인지 다시 확인한다.

export type AdminActionResult = { error: string } | undefined;

async function requireAdmin() {
  const viewer = await getViewer();
  return viewer?.profile?.is_admin ? viewer : null;
}

/** 작품을 숨긴다. 그 작품의 열린 신고는 처리됨으로 닫히고 작가에게 알림이 간다. */
export async function hideWork(workId: string): Promise<AdminActionResult> {
  if (!(await requireAdmin())) return { error: "관리자만 할 수 있습니다." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_hide_work", { p_work_id: workId });
  if (error) return { error: error.code === "42501" ? "관리자만 할 수 있습니다." : "숨기지 못했습니다." };
  refresh();
}

/** 숨기기 직전 상태(공개·임시 저장)로 돌린다. 작가에게 알림이 간다. */
export async function restoreWork(workId: string): Promise<AdminActionResult> {
  if (!(await requireAdmin())) return { error: "관리자만 할 수 있습니다." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_restore_work", { p_work_id: workId });
  if (error) {
    if (error.code === "22023") return { error: "이미 복구된 작품입니다." };
    return { error: error.code === "42501" ? "관리자만 할 수 있습니다." : "복구하지 못했습니다." };
  }
  refresh();
}

/** 신고를 기각한다(작품은 그대로 둔다). */
export async function dismissReport(reportId: string): Promise<AdminActionResult> {
  const viewer = await requireAdmin();
  if (!viewer) return { error: "관리자만 할 수 있습니다." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .update({ status: "dismissed", resolved_at: new Date().toISOString(), resolved_by: viewer.userId })
    .eq("id", reportId)
    .eq("status", "open")
    .select("id");
  if (error || data.length === 0) return { error: "기각하지 못했습니다. 이미 처리된 신고일 수 있습니다." };
  refresh();
}
