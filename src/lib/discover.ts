import type { ChapterCounts } from "@/lib/chapter-bar";
import { createClient } from "@/lib/supabase/server";
import { WORKS_PAGE_SIZE, type WorksQuery } from "@/lib/works-query";

// 홈·프로필 목록(F7). RLS가 읽을 수 있는 작품만 돌려준다. 쿠키를 읽으므로 <Suspense> 안에서 부른다.

export const HOME_LIST_SIZE = 12;
export const TRENDING_DAYS = 14;

export type WorkCardData = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  fork_note: string | null;
  parent_work_id: string | null;
  fork_chapter_position: number | null;
  is_canon: boolean;
  visibility: "draft" | "public" | "hidden";
  star_count: number;
  fork_count: number;
  first_published_at: string | null;
  created_at: string;
  owner: { handle: string; display_name: string };
  /** 장 상태별 개수(카드 막대). 읽을 수 없으면 없다 */
  chapterCounts?: ChapterCounts;
  /** 갈래면 바로 위 부모 제목. 숨겨진 작품이면 null(work_parent_titles가 가린다) */
  parentTitle?: string | null;
  /** 요즘 갈래가 많이 나는 원작: 최근 공개된 갈래 수 */
  recentForks?: number;
};

const CARD_COLUMNS =
  "id, slug, title, summary, fork_note, parent_work_id, fork_chapter_position, is_canon, visibility, star_count, fork_count, " +
  "first_published_at, created_at, " +
  "owner:profiles!works_owner_id_fkey(handle, display_name)";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** 받은 id를 100개씩 나눠 함수를 부르고 결과 줄을 모은다 */
async function rpcByChunks<T>(supabase: Supabase, fn: string, ids: string[]): Promise<T[]> {
  const chunks = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase.rpc(fn, { p_work_ids: chunk });
      if (error) throw error;
      return (data ?? []) as T[];
    }),
  );
  return results.flat();
}

/** 카드에 덧붙일 것을 함께 가져온다.
 *  - 갈래: '『부모』 N장에서 갈라짐'의 부모 제목(work_parent_titles, 계보와 같은 가림 규칙)
 *  - 모두: 막대에 쓸 장 상태별 개수(work_chapter_counts) */
async function withCardExtras(supabase: Supabase, cards: WorkCardData[]): Promise<WorkCardData[]> {
  if (cards.length === 0) return cards;
  const forkIds = cards.filter((c) => c.parent_work_id).map((c) => c.id);
  const [titleRows, countRows] = await Promise.all([
    rpcByChunks<{ work_id: string; parent_title: string | null }>(supabase, "work_parent_titles", forkIds),
    rpcByChunks<ChapterCounts & { work_id: string }>(supabase, "work_chapter_counts", cards.map((c) => c.id)),
  ]);
  const titles = new Map(titleRows.map((r) => [r.work_id, r.parent_title]));
  const counts = new Map(countRows.map(({ work_id, ...c }) => [work_id, c]));
  return cards.map((c) => ({
    ...c,
    // 장이 하나도 없으면 줄이 오지 않는다
    chapterCounts: counts.get(c.id) ?? { inherited: 0, modified: 0, new: 0 },
    ...(c.parent_work_id ? { parentTitle: titles.get(c.id) ?? null } : {}),
  }));
}

export type SiteStats = { originals: number; forks: number; newForksWeek: number };

/** 홈·전체 목록 위 통계: 공개 원작 수, 공개 갈래 수, 최근 7일에 처음 공개된 갈래 수(site_stats 한 번) */
export async function getSiteStats(): Promise<SiteStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("site_stats")
    .single<{ originals: number; forks: number; new_forks_week: number }>();
  if (error) throw error;
  return { originals: data.originals, forks: data.forks, newForksWeek: data.new_forks_week };
}

/** 새 원작: 최근 처음 공개된 순 */
export async function getNewOriginals(): Promise<WorkCardData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("works")
    .select(CARD_COLUMNS)
    .eq("visibility", "public")
    .is("parent_work_id", null)
    .order("first_published_at", { ascending: false, nullsFirst: false })
    .limit(HOME_LIST_SIZE)
    .returns<WorkCardData[]>();
  if (error) throw error;
  return withCardExtras(supabase, data);
}

/** 요즘 갈래가 많이 나는 원작: 최근 TRENDING_DAYS일에 공개된 갈래(갈래의 갈래 포함)가 많은 순 */
export async function getTrendingOriginals(): Promise<WorkCardData[]> {
  const supabase = await createClient();
  const res = await supabase.rpc("trending_originals", { p_days: TRENDING_DAYS, p_limit: HOME_LIST_SIZE });
  if (res.error) throw res.error;
  const ranked = (res.data ?? []) as { work_id: string; recent_forks: number }[];
  if (ranked.length === 0) return [];

  const { data, error } = await supabase
    .from("works")
    .select(CARD_COLUMNS)
    .in("id", ranked.map((r) => r.work_id))
    .returns<WorkCardData[]>();
  if (error) throw error;
  const byId = new Map((await withCardExtras(supabase, data)).map((w) => [w.id, w]));
  return ranked.flatMap((r) => {
    const w = byId.get(r.work_id);
    return w ? [{ ...w, recentForks: r.recent_forks }] : [];
  });
}

/** 별 많은 갈래: 별을 하나 이상 받은 공개 갈래 */
export async function getTopForks(): Promise<WorkCardData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("works")
    .select(CARD_COLUMNS)
    .eq("visibility", "public")
    .not("parent_work_id", "is", null)
    .gt("star_count", 0)
    .order("star_count", { ascending: false })
    .order("first_published_at", { ascending: false })
    .limit(HOME_LIST_SIZE)
    .returns<WorkCardData[]>();
  if (error) throw error;
  return withCardExtras(supabase, data);
}

/** 프로필: 이 사람의 원작과 갈래. 본인이 보면 임시 저장·숨긴 작품도 나온다(RLS). */
export async function getWorksByOwner(ownerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("works")
    .select(CARD_COLUMNS)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .returns<WorkCardData[]>();
  if (error) throw error;
  const cards = await withCardExtras(supabase, data);
  return {
    originals: cards.filter((c) => !c.parent_work_id),
    forks: cards.filter((c) => c.parent_work_id),
    /** 받은 별: 공개 작품의 별 합 */
    stars: cards.filter((c) => c.visibility === "public").reduce((sum, c) => sum + c.star_count, 0),
  };
}

const SORT_COLUMN = { new: "first_published_at", stars: "star_count", forks: "fork_count" } as const;

/** 전체 목록 한 쪽: 공개 작품만, 그 쪽의 20개와 전체 개수를 한 번에 가져온다(정렬 인덱스를 탄다). */
export async function getWorksPage(q: WorksQuery): Promise<{ works: WorkCardData[]; total: number }> {
  const supabase = await createClient();
  let query = supabase.from("works").select(CARD_COLUMNS, { count: "exact" }).eq("visibility", "public");
  if (q.tab === "original") query = query.is("parent_work_id", null);
  if (q.tab === "fork") query = query.not("parent_work_id", "is", null);
  // 같은 값이면 최신순, 그다음 id로 끊어 쪽이 바뀌어도 겹치거나 빠지지 않게 한다(정렬 인덱스와 같은 순서)
  if (q.sort !== "new") query = query.order(SORT_COLUMN[q.sort], { ascending: false });
  const from = (q.page - 1) * WORKS_PAGE_SIZE;
  const { data, count, error } = await query
    .order("first_published_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + WORKS_PAGE_SIZE - 1)
    .returns<WorkCardData[]>();
  // 마지막 쪽을 넘으면 PostgREST가 416(PGRST103)으로 답한다. 빈 쪽으로 다룬다.
  if (error?.code === "PGRST103") return { works: [], total: count ?? (await countWorks(q)) };
  if (error) throw error;
  return { works: await withCardExtras(supabase, data), total: count ?? 0 };
}

async function countWorks(q: WorksQuery) {
  const supabase = await createClient();
  let query = supabase.from("works").select("id", { count: "exact", head: true }).eq("visibility", "public");
  if (q.tab === "original") query = query.is("parent_work_id", null);
  if (q.tab === "fork") query = query.not("parent_work_id", "is", null);
  const { count } = await query;
  return count ?? 0;
}
