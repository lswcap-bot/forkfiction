"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { forkInputProblem } from "@/lib/fork-input";
import { validateSlug } from "@/lib/slug";
import { resolveSlug } from "@/lib/slug-actions";
import { createClient } from "@/lib/supabase/server";
import { isReportReason, REPORT_DETAIL_MAX } from "@/lib/work-meta";

export type OwnerActionResult = { error: string } | undefined;

// 임시 저장 작품의 주소 바꾸기. 공개한 적이 있으면 DB(works_guard)가 막는다.
// 화면에 보여 준 최종 주소를 그대로 저장한다(겹치면 unique 위반).
export async function changeSlug(workId: string, slugInput: string): Promise<OwnerActionResult> {
  const slug = validateSlug(slugInput);
  if (!slug.ok) return { error: slug.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("works")
    .update({ slug: slug.slug })
    .eq("id", workId)
    .select("slug")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return { error: "그 사이 다른 작품이 이 주소를 먼저 썼습니다. 다른 주소를 골라 주세요." };
    if (error.code === "42501") return { error: "공개한 작품의 주소는 바꿀 수 없습니다." };
    return { error: "주소를 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
  if (!data) return { error: "내 작품만 고칠 수 있습니다." };

  redirect(`/w/${data.slug}`);
}

// 임시 저장 작품 공개하기
export async function publishWork(workId: string): Promise<OwnerActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("works")
    .update({ visibility: "public" })
    .eq("id", workId)
    .eq("visibility", "draft")
    .select("slug")
    .maybeSingle();

  if (error || !data) return { error: "공개하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  redirect(`/w/${data.slug}`);
}

export type ForkInput = {
  sourceWorkId: string;
  position: number;
  title: string;
  note: string;
  /** resolveSlug로 확인해 보여 준 최종 주소. 그대로 저장한다. */
  slug: string;
  /** 작가가 적은 주소(번호를 붙이기 전). 주소가 겹쳤을 때 여기서 다시 정한다. */
  slugInput: string;
};

export type ForkResult = { error: string; slug?: string };

// 여기서 갈라지기. 갈래는 fork_work()로만 만든다. 만들면 작업실의 갈라진 장으로 간다.
export async function forkWork(input: ForkInput): Promise<ForkResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: "로그인해야 갈래를 낼 수 있습니다." };
  if (!viewer.profile) return { error: "필명을 먼저 정해 주세요." };

  const problem = forkInputProblem(input);
  if (problem) return { error: problem };
  const slug = validateSlug(input.slug);
  if (!slug.ok) return { error: slug.message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fork_work", {
    source_work_id: input.sourceWorkId,
    at_position: input.position,
    title: input.title.trim(),
    note: input.note.trim(),
    requested_slug: slug.slug,
  });

  if (error) {
    // 확인한 뒤 저장하기 전에 다른 작품이 그 주소를 먼저 썼다. 말없이 바꾸지 않고 새 주소를 보여 준다.
    if (error.code === "23505") {
      const next = await resolveSlug(input.slugInput);
      return {
        error: "그 사이 다른 작품이 이 주소를 먼저 썼습니다. 새 주소를 확인하고 다시 만들어 주세요.",
        slug: next.ok ? next.slug : undefined,
      };
    }
    if (error.code === "42501") return { error: "갈래를 허용하지 않는 작품입니다." };
    if (error.code === "P0002") return { error: "작품이나 장을 찾을 수 없습니다. 비공개로 바뀌었을 수 있습니다." };
    return { error: "갈래를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }

  redirect(`/w/${slug.slug}/edit?ch=${input.position}`);
}

// 한 번도 공개하지 않았고 갈래도 없는 내 작품 지우기
export async function deleteWork(workId: string): Promise<OwnerActionResult> {
  const viewer = await getViewer();
  if (!viewer?.profile) return { error: "로그인이 필요합니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_work", { p_work_id: workId });
  if (error) {
    if (error.code === "42501") return { error: "한 번이라도 공개한 작품이나 갈래가 있는 작품은 지울 수 없습니다." };
    return { error: "지우지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
  redirect(`/@${viewer.profile.handle}`);
}

// 별 주기·거두기. 작품당 한 사람 한 번(stars 기본키), star_count는 트리거가 센다.
export async function toggleStar(workId: string, on: boolean): Promise<OwnerActionResult> {
  const viewer = await getViewer();
  if (!viewer?.profile) return { error: "로그인해야 별을 줄 수 있습니다." };

  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("stars").insert({ user_id: viewer.userId, work_id: workId })
    : await supabase.from("stars").delete().eq("user_id", viewer.userId).eq("work_id", workId);
  // 이미 준 별을 다시 누른 경우(다른 탭)는 바라던 상태이므로 그대로 둔다
  if (error && error.code !== "23505") {
    if (error.code === "42501") return { error: "내 작품이나 공개되지 않은 작품에는 별을 줄 수 없습니다." };
    return { error: "별을 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
  refresh();
}

// 정사 인정·해제. 뿌리 원작자만 할 수 있고, DB 함수(set_canon)가 다시 확인한다.
export async function setCanon(workId: string, value: boolean): Promise<OwnerActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_canon", { p_work_id: workId, p_value: value });
  if (error) {
    if (error.code === "42501") {
      return { error: value ? "뿌리 원작자만 공개된 갈래를 정사로 인정할 수 있습니다." : "뿌리 원작자만 정사를 뗄 수 있습니다." };
    }
    return { error: "정사를 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
  refresh();
}

export type ReportInput = { workId: string; chapterId: string | null; reason: string; detail: string };

// 작품·장 신고. 누가 신고했는지는 관리자만 본다(reports는 관리자만 읽는다).
export async function reportContent(input: ReportInput): Promise<{ error: string } | { ok: true }> {
  const viewer = await getViewer();
  if (!viewer) return { error: "로그인해야 신고할 수 있습니다." };
  if (!viewer.profile) return { error: "필명을 먼저 정해 주세요." };
  if (!isReportReason(input.reason)) return { error: "신고 사유를 골라 주세요." };
  const detail = input.detail.trim();
  if (detail.length > REPORT_DETAIL_MAX) return { error: `내용은 ${REPORT_DETAIL_MAX}자까지 적을 수 있습니다.` };

  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: viewer.userId,
    work_id: input.workId,
    chapter_id: input.chapterId,
    reason: input.reason,
    detail: detail || null,
  });
  if (error) {
    if (error.code === "23505") return { error: "이미 신고했습니다. 관리자가 확인하고 있습니다." };
    if (error.code === "42501") return { error: "신고할 수 없는 작품입니다." };
    return { error: "신고하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
  return { ok: true };
}
