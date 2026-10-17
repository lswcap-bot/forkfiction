"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { chapterProblem, CHAPTERS_MAX } from "@/lib/work-meta";
import { getRevision } from "@/lib/works";

// 작업실의 장 바꾸기. 모두 DB 함수(save_chapter 등)로 하고, 권한은 DB가 확인한다.

export type SaveResult =
  | { ok: true; headRevisionId: string }
  | { ok: false; error: string; conflict?: boolean };

export type ChapterActionResult = { ok: true } | { ok: false; error: string };

const MESSAGE_MAX = 100;

function failure(error: { code?: string } | null, fallback: string): { ok: false; error: string; conflict?: boolean } {
  switch (error?.code) {
    case "PT409":
      return {
        ok: false,
        conflict: true,
        error: "그 사이 이 장이 다른 곳(다른 탭이나 기기)에서 저장되었습니다. 지금 글은 이 브라우저에 임시 보관해 두었으니, 새로 불러온 뒤 다시 저장해 주세요.",
      };
    case "42501":
      return { ok: false, error: "내 작품만 고칠 수 있습니다. 다시 로그인해 주세요." };
    case "22023":
      return { ok: false, error: "장 번호가 맞지 않습니다. 새로 불러와 주세요." };
    case "23514":
      return { ok: false, error: "제목(1~100자), 본문(10만 자), 메모(100자) 길이를 확인해 주세요." };
    case "P0002":
      return { ok: false, error: "장을 찾을 수 없습니다. 새로 불러와 주세요." };
    default:
      return { ok: false, error: fallback };
  }
}

export async function saveChapter(input: {
  chapterId: string;
  title: string;
  body: string;
  baseRevisionId: string;
  message: string;
}): Promise<SaveResult> {
  const problem = chapterProblem(input);
  if (problem) return { ok: false, error: problem };
  if (input.message.trim().length > MESSAGE_MAX) return { ok: false, error: `메모는 ${MESSAGE_MAX}자까지입니다.` };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_chapter", {
    p_chapter_id: input.chapterId,
    p_title: input.title.trim(),
    p_body_md: input.body,
    p_base_revision_id: input.baseRevisionId,
    p_message: input.message.trim() || null,
  });
  if (error) return failure(error, "저장하지 못했습니다. 지금 글은 이 브라우저에 임시 보관해 두었습니다.");
  refresh();
  return { ok: true, headRevisionId: data as string };
}

export async function revertChapter(input: {
  chapterId: string;
  revisionId: string;
  baseRevisionId: string;
}): Promise<SaveResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revert_chapter", {
    p_chapter_id: input.chapterId,
    p_revision_id: input.revisionId,
    p_base_revision_id: input.baseRevisionId,
  });
  if (error) return failure(error, "되돌리지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  refresh();
  return { ok: true, headRevisionId: data as string };
}

/** 기록에서 고른 수정본의 본문을 미리 본다 */
export async function loadRevision(revisionId: string) {
  const rev = await getRevision(revisionId);
  return rev ? { title: rev.title, body: rev.body_md } : null;
}

export async function addChapter(input: {
  workId: string;
  position: number;
  title: string;
  chapterCount: number;
}): Promise<ChapterActionResult> {
  if (input.chapterCount >= CHAPTERS_MAX) return { ok: false, error: `장은 ${CHAPTERS_MAX}개까지 둘 수 있습니다.` };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_chapter", {
    p_work_id: input.workId,
    p_position: input.position,
    p_title: input.title,
    p_body_md: "",
  });
  if (error) return failure(error, "장을 더하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  refresh();
  return { ok: true };
}

export async function deleteChapter(chapterId: string): Promise<ChapterActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_chapter", { p_chapter_id: chapterId });
  if (error) {
    if (error.code === "22023") return { ok: false, error: "마지막 남은 장은 지울 수 없습니다." };
    return failure(error, "장을 지우지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }
  refresh();
  return { ok: true };
}

export async function moveChapter(chapterId: string, toPosition: number): Promise<ChapterActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_chapter", { p_chapter_id: chapterId, p_to_position: toPosition });
  if (error) return failure(error, "장 순서를 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  refresh();
  return { ok: true };
}
