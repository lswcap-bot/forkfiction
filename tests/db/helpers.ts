import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect } from "vitest";

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI 등에서는 환경 변수를 직접 넣는다
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** RLS를 거치지 않는 관리용 클라이언트. 준비와 뒷정리에만 쓴다. */
export const admin = createClient(url, serviceKey, noSession);

/** 로그인하지 않은 방문자 */
export const anon = createClient(url, anonKey, noSession);

export type TestUser = { id: string; handle: string; db: SupabaseClient };

/** 테스트 실행마다 겹치지 않는 접두사 */
export const runId = randomBytes(3).toString("hex");

/** 임시 사용자를 만들고 프로필을 넣은 뒤, 그 사용자로 로그인한 클라이언트를 돌려준다. */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `ff-test-${runId}-${label}@forkfiction.test`;
  const password = randomBytes(18).toString("base64url");
  const handle = `t_${runId}_${label}`;

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const id = created.data.user.id;

  const profile = await admin.from("profiles").insert({
    id,
    handle,
    display_name: `테스트 ${label}`,
    terms_agreed_at: new Date().toISOString(),
  });
  if (profile.error) throw profile.error;

  const db = createClient(url!, anonKey!, noSession);
  const signedIn = await db.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;

  return { id, handle, db };
}

/** 테스트 사용자가 만든 데이터와 계정을 지운다. */
export async function cleanup(users: TestUser[]) {
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;

  // 갈래와 원작을 한 문장으로 지워 부모·뿌리 참조가 문장 끝에서 함께 풀리게 한다.
  // chapters, stars, notifications, reports는 cascade로 함께 지워진다.
  const works = await admin.from("works").select("id").in("owner_id", ids);
  if (works.error) throw works.error;
  if (works.data.length > 0) {
    const del = await admin.from("works").delete().in("id", works.data.map((w) => w.id));
    if (del.error) throw del.error;
  }

  // 수정본 삭제는 service_role에게만 열려 있다
  const revs = await admin.from("revisions").delete().in("author_id", ids);
  if (revs.error) throw revs.error;

  for (const id of ids) {
    const del = await admin.auth.admin.deleteUser(id);
    if (del.error) throw del.error;
  }
}

/** 원작 하나를 만들고 장을 count개 붙인다. 기본은 공개. */
export async function createOriginal(
  owner: TestUser,
  opts: { chapters?: number; visibility?: "draft" | "public"; allowFork?: boolean; license?: string } = {},
) {
  const { chapters = 3, visibility = "public", allowFork = true, license = "CC-BY-SA-4.0" } = opts;
  const slug = `t-${runId}-${randomUUID().slice(0, 8)}`;

  const work = await owner.db
    .from("works")
    .insert({ owner_id: owner.id, slug, title: `원작 ${slug}`, license, allow_fork: allowFork })
    .select()
    .single();
  if (work.error) throw work.error;

  const chapterIds: string[] = [];
  for (let i = 1; i <= chapters; i++) {
    const ch = await owner.db.rpc("add_chapter", {
      p_work_id: work.data.id,
      p_position: i,
      p_title: `${i}장`,
      p_body_md: `${i}장 본문`,
    });
    if (ch.error) throw ch.error;
    chapterIds.push(ch.data as string);
  }

  if (visibility === "public") {
    const pub = await owner.db.from("works").update({ visibility: "public" }).eq("id", work.data.id);
    if (pub.error) throw pub.error;
  }

  return { id: work.data.id as string, slug, chapterIds };
}

export async function getChapters(workId: string) {
  const res = await admin
    .from("chapters")
    .select("id, position, state, head_revision_id, origin_revision_id")
    .eq("work_id", workId)
    .order("position");
  if (res.error) throw res.error;
  return res.data;
}

export async function getWork(workId: string) {
  const res = await admin.from("works").select("*").eq("id", workId).single();
  if (res.error) throw res.error;
  return res.data;
}

/** 요청이 실패했는지 확인한다. code를 주면 Postgres 오류 코드까지 맞춰 본다. */
export async function expectError(
  request: PromiseLike<{ error: { code?: string; message: string } | null }>,
  code?: string,
) {
  const { error } = await request;
  expect(error, "요청이 성공했지만 실패해야 했다").not.toBeNull();
  if (code) expect(error!.code).toBe(code);
  return error!;
}
