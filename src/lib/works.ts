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
  root_work_id: string;
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

export type ChapterListItem = { id: string; position: number; state: ChapterState; title: string };

export type ChapterContent = ChapterListItem & { body: string };

/** 숨겨진 조상은 그 작가·관리자가 아니면 제목·주소·작가가 null이다(work_lineage). */
export type LineageItem = {
  depth: number;
  ancestor_slug: string | null;
  ancestor_title: string | null;
  ancestor_owner_handle: string | null;
  ancestor_owner_display_name: string | null;
  fork_chapter_position: number | null;
  ancestor_hidden: boolean;
};

const WORK_COLUMNS =
  "id, slug, title, summary, license, allow_fork, ai_usage, parent_work_id, root_work_id, fork_chapter_position, fork_note, " +
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
    .select("id, position, state, head:revisions!chapters_head_revision_id_fkey(title)")
    .eq("work_id", workId)
    .order("position")
    .returns<{ id: string; position: number; state: ChapterState; head: { title: string } }[]>();
  if (error) throw error;
  return data.map((c) => ({ id: c.id, position: c.position, state: c.state, title: c.head.title }));
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

/** 지금 사용자가 이 작품에 별을 주었는지. 로그인 전이면 false(stars는 본인 것만 읽힌다). */
export async function hasStarred(workId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("stars").select("work_id").eq("work_id", workId).maybeSingle();
  return data !== null;
}

/** 뿌리 원작부터 이 작품까지. 원작이면 자기 자신 하나뿐이다. */
export async function getLineage(workId: string): Promise<LineageItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_lineage")
    .select(
      "depth, ancestor_slug, ancestor_title, ancestor_owner_handle, ancestor_owner_display_name, fork_chapter_position, ancestor_hidden",
    )
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

export type EditorChapter = ChapterListItem & {
  body: string;
  headRevisionId: string;
  originRevisionId: string | null;
};

/** 작업실에서 고칠 장. head 수정본 id를 함께 돌려줘 저장할 때 base로 쓴다. */
export async function getEditorChapter(workId: string, position: number): Promise<EditorChapter | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chapters")
    .select("id, position, state, origin_revision_id, head:revisions!chapters_head_revision_id_fkey(id, title, body_md)")
    .eq("work_id", workId)
    .eq("position", position)
    .maybeSingle<{
      id: string;
      position: number;
      state: ChapterState;
      origin_revision_id: string | null;
      head: { id: string; title: string; body_md: string };
    }>();
  if (!data) return null;
  return {
    id: data.id,
    position: data.position,
    state: data.state,
    title: data.head.title,
    body: data.head.body_md,
    headRevisionId: data.head.id,
    originRevisionId: data.origin_revision_id,
  };
}

export type HistoryItem = {
  id: string;
  title: string;
  message: string | null;
  created_at: string;
  /** 갈라질 때 원작에서 물려받은 수정본 */
  inherited: boolean;
};

const HISTORY_LIMIT = 100;

/** 장의 수정 기록. 최근 것부터, 맨 끝에 물려받은 원작 수정본. */
export async function getChapterHistory(chapter: { id: string; originRevisionId: string | null }): Promise<HistoryItem[]> {
  const supabase = await createClient();
  const own = await supabase
    .from("revisions")
    .select("id, title, message, created_at")
    .eq("chapter_id", chapter.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (own.error) throw own.error;
  const items: HistoryItem[] = own.data.map((r) => ({ ...r, inherited: false }));

  if (chapter.originRevisionId) {
    const origin = await supabase
      .from("revisions")
      .select("id, title, message, created_at")
      .eq("id", chapter.originRevisionId)
      .maybeSingle();
    if (origin.data) items.push({ ...origin.data, inherited: true });
  }
  return items;
}

/** 수정본 하나의 제목·본문(기록에서 미리 볼 때) */
export async function getRevision(revisionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("revisions")
    .select("id, title, body_md, message, created_at")
    .eq("id", revisionId)
    .maybeSingle();
  return data;
}

export type CompareChapter = {
  position: number;
  state: ChapterState;
  title: string;
  body: string;
  /** 갈라질 때 물려받은 원작 수정본. 새로 쓴 장이면 null */
  origin: { title: string; body: string } | null;
};

/** 비교 화면: 갈래의 장과 그 장이 처음 가져온 원작 수정본(origin_revision_id) */
export async function getCompareChapter(workId: string, position: number): Promise<CompareChapter | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chapters")
    .select(
      "position, state, head:revisions!chapters_head_revision_id_fkey(title, body_md), " +
        "origin:revisions!chapters_origin_revision_id_fkey(title, body_md)",
    )
    .eq("work_id", workId)
    .eq("position", position)
    .maybeSingle<{
      position: number;
      state: ChapterState;
      head: { title: string; body_md: string };
      origin: { title: string; body_md: string } | null;
    }>();
  if (!data) return null;
  return {
    position: data.position,
    state: data.state,
    title: data.head.title,
    body: data.head.body_md,
    origin: data.origin && { title: data.origin.title, body: data.origin.body_md },
  };
}

export type TreeEntry = {
  id: string;
  slug: string;
  title: string;
  fork_note: string | null;
  parent_work_id: string | null;
  fork_chapter_position: number | null;
  star_count: number;
  is_canon: boolean;
  created_at: string;
  owner: { handle: string; display_name: string };
  chapterCount: number;
};

/** 갈래 지도: 뿌리 원작과 그 아래 공개된 모든 갈래 */
export async function getTreeEntries(rootWorkId: string): Promise<TreeEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("works")
    .select(
      "id, slug, title, fork_note, parent_work_id, fork_chapter_position, star_count, is_canon, created_at, " +
        "owner:profiles!works_owner_id_fkey(handle, display_name), chapters(count)",
    )
    .eq("root_work_id", rootWorkId)
    .eq("visibility", "public")
    .returns<(Omit<TreeEntry, "chapterCount"> & { chapters: { count: number }[] })[]>();
  if (error) throw error;
  return data.map(({ chapters, ...w }) => ({ ...w, chapterCount: chapters[0]?.count ?? 0 }));
}
