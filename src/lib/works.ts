import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ChapterState } from "@/lib/work-meta";

// 작품 대문·장 읽기에서 쓰는 조회. RLS가 읽을 수 있는 작품(공개, 본인, 관리자)만 돌려준다.
// 쿠키를 읽으므로 <Suspense> 안에서 부른다.

export type WorkSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  license: string;
  allow_fork: boolean;
  ai_usage: string;
  parent_work_id: string | null;
  fork_chapter_position: number | null;
  fork_note: string | null;
  is_canon: boolean;
  visibility: "draft" | "public" | "hidden";
  star_count: number;
  fork_count: number;
  first_published_at: string | null;
  owner_id: string;
  owner: { handle: string; display_name: string };
};

export type ChapterListItem = { position: number; state: ChapterState; title: string };

export type ChapterContent = ChapterListItem & { id: string; body: string };

export type LineageItem = {
  depth: number;
  ancestor_slug: string;
  ancestor_title: string;
  ancestor_owner_handle: string;
  ancestor_owner_display_name: string;
  fork_chapter_position: number | null;
};

const WORK_COLUMNS =
  "id, slug, title, summary, license, allow_fork, ai_usage, parent_work_id, fork_chapter_position, fork_note, " +
  "is_canon, visibility, star_count, fork_count, first_published_at, owner_id, " +
  "owner:profiles!works_owner_id_fkey(handle, display_name)";

export const getWorkBySlug = cache(async (slug: string): Promise<WorkSummary | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("works")
    .select(WORK_COLUMNS)
    .eq("slug", slug)
    .maybeSingle<WorkSummary>();
  return data;
});

export const getChapterList = cache(async (workId: string): Promise<ChapterListItem[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chapters")
    .select("position, state, head:revisions!chapters_head_revision_id_fkey(title)")
    .eq("work_id", workId)
    .order("position")
    .returns<{ position: number; state: ChapterState; head: { title: string } }[]>();
  if (error) throw error;
  return data.map((c) => ({ position: c.position, state: c.state, title: c.head.title }));
});

export async function getChapter(workId: string, position: number): Promise<ChapterContent | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chapters")
    .select("id, position, state, head:revisions!chapters_head_revision_id_fkey(title, body_md)")
    .eq("work_id", workId)
    .eq("position", position)
    .maybeSingle<{ id: string; position: number; state: ChapterState; head: { title: string; body_md: string } }>();
  if (!data) return null;
  return { id: data.id, position: data.position, state: data.state, title: data.head.title, body: data.head.body_md };
}

/** 뿌리 원작부터 이 작품까지. 원작이면 자기 자신 하나뿐이다. */
export async function getLineage(workId: string): Promise<LineageItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_lineage")
    .select("depth, ancestor_slug, ancestor_title, ancestor_owner_handle, ancestor_owner_display_name, fork_chapter_position")
    .eq("work_id", workId)
    .order("depth", { ascending: false })
    .returns<LineageItem[]>();
  if (error) throw error;
  return data;
}

/** 이 작품의 position장에서 갈라진 공개 갈래 수 */
export async function countForksAt(workId: string, position: number): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("works")
    .select("id", { count: "exact", head: true })
    .eq("parent_work_id", workId)
    .eq("fork_chapter_position", position)
    .eq("visibility", "public");
  return count ?? 0;
}
