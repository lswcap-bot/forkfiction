import { createClient } from "@/lib/supabase/server";

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
  owner: { handle: string; display_name: string };
  /** 갈래면 바로 위 부모 제목. 숨겨진 작품이면 null(work_lineage가 가린다) */
  parentTitle?: string | null;
  /** 요즘 갈래가 많이 나는 원작: 최근 공개된 갈래 수 */
  recentForks?: number;
};

const CARD_COLUMNS =
  "id, slug, title, summary, fork_note, parent_work_id, fork_chapter_position, is_canon, visibility, star_count, fork_count, " +
  "owner:profiles!works_owner_id_fkey(handle, display_name)";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** 갈래 카드에 '『부모』 N장에서 갈라짐'을 적으려고 부모 제목을 붙인다(계보와 같은 가림 규칙). */
async function withParentTitles(supabase: Supabase, cards: WorkCardData[]): Promise<WorkCardData[]> {
  const forkIds = cards.filter((c) => c.parent_work_id).map((c) => c.id);
  if (forkIds.length === 0) return cards;
  const { data, error } = await supabase
    .from("work_lineage")
    .select("work_id, ancestor_title")
    .in("work_id", forkIds)
    .eq("depth", 1)
    .returns<{ work_id: string; ancestor_title: string | null }[]>();
  if (error) throw error;
  const titles = new Map(data.map((r) => [r.work_id, r.ancestor_title]));
  return cards.map((c) => (c.parent_work_id ? { ...c, parentTitle: titles.get(c.id) ?? null } : c));
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
  return data;
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
  const byId = new Map(data.map((w) => [w.id, w]));
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
  return withParentTitles(supabase, data);
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
  const cards = await withParentTitles(supabase, data);
  return {
    originals: cards.filter((c) => !c.parent_work_id),
    forks: cards.filter((c) => c.parent_work_id),
    /** 받은 별: 공개 작품의 별 합 */
    stars: cards.filter((c) => c.visibility === "public").reduce((sum, c) => sum + c.star_count, 0),
  };
}
