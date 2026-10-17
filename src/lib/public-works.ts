import { cacheLife } from "next/cache";
import { createClient } from "@supabase/supabase-js";

// 검색·공유용 조회(메타태그, OG 이미지, sitemap). 로그인 쿠키 없이 방문자(anon) 권한으로 읽으므로
// 공개된 작품만 나온다. 임시 저장·숨긴 작품은 본인이 보더라도 여기서는 없는 작품이다.

export function siteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type PublicWork = {
  slug: string;
  title: string;
  summary: string | null;
  fork_note: string | null;
  fork_chapter_position: number | null;
  is_canon: boolean;
  owner: { display_name: string };
  /** 갈래면 바로 위 부모 제목. 숨겨진 작품이면 null */
  parentTitle: string | null;
  isFork: boolean;
};

export async function getPublicWork(slug: string): Promise<PublicWork | null> {
  "use cache";
  cacheLife("minutes");

  const db = publicClient();
  const { data } = await db
    .from("works")
    .select("id, slug, title, summary, fork_note, fork_chapter_position, parent_work_id, is_canon, owner:profiles!works_owner_id_fkey(display_name)")
    .eq("slug", slug)
    .eq("visibility", "public")
    .maybeSingle<Omit<PublicWork, "parentTitle" | "isFork"> & { id: string; parent_work_id: string | null }>();
  if (!data) return null;

  let parentTitle: string | null = null;
  if (data.parent_work_id) {
    const { data: parent } = await db.rpc("work_parent_titles", { p_work_ids: [data.id] });
    parentTitle = (parent as { parent_title: string | null }[] | null)?.[0]?.parent_title ?? null;
  }
  return {
    slug: data.slug,
    title: data.title,
    summary: data.summary,
    fork_note: data.fork_note,
    fork_chapter_position: data.fork_chapter_position,
    is_canon: data.is_canon,
    owner: data.owner,
    parentTitle,
    isFork: data.parent_work_id !== null,
  };
}

export async function getPublicChapterTitle(slug: string, position: number): Promise<string | null> {
  "use cache";
  cacheLife("minutes");

  const { data } = await publicClient()
    .from("chapters")
    .select("head:revisions!chapters_head_revision_id_fkey(title), work:works!inner(slug, visibility)")
    .eq("work.slug", slug)
    .eq("work.visibility", "public")
    .eq("position", position)
    .maybeSingle<{ head: { title: string } }>();
  return data?.head.title ?? null;
}

export type SitemapWork = { slug: string; updated_at: string; positions: number[] };

const PAGE = 1000;

/** sitemap: 공개 작품과 그 장 번호 */
export async function getSitemapWorks(): Promise<SitemapWork[]> {
  "use cache";
  cacheLife("hours");

  const db = publicClient();
  const works: SitemapWork[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("works")
      .select("slug, updated_at, chapters(position)")
      .eq("visibility", "public")
      .order("created_at")
      .range(from, from + PAGE - 1)
      .returns<{ slug: string; updated_at: string; chapters: { position: number }[] }[]>();
    if (error) throw error;
    for (const w of data) {
      works.push({ slug: w.slug, updated_at: w.updated_at, positions: w.chapters.map((c) => c.position).sort((a, b) => a - b) });
    }
    if (data.length < PAGE) return works;
  }
}

/** 메타 설명에 쓸 한 줄: 줄바꿈을 펴고 길이를 줄인다 */
export function describe(text: string | null | undefined, max = 150) {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
