import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Playwright 흐름 테스트용 로그인과 뒷정리.
//
// 테스트 전용 로그인 경로는 앱에 만들지 않는다(운영에서 열릴 일이 없게).
// 대신 service role로 @forkfiction.test 임시 사용자를 만들고, 비밀번호로 로그인해 받은 세션을
// @supabase/ssr과 같은 형식의 쿠키로 만들어 브라우저에 직접 넣는다.
// 가입 막기 트리거(forkfiction_signup_guard)는 @forkfiction.test만 이메일 사용자를 허용한다.

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
export const admin = createClient(url, serviceKey, noSession);

export const AUTH_DIR = "tests/e2e/.auth";
const RUN_FILE = `${AUTH_DIR}/run.json`;

export type E2EUser = { key: string; id: string; email: string; handle: string; displayName: string; storageState: string };

export type E2ERun = {
  runId: string;
  users: Record<"a" | "b", E2EUser>;
  /** 모바일 점검용으로 DB 함수로 미리 만들어 둔 원작·갈래 */
  fixture: { originalSlug: string; forkSlug: string };
};

export function readRun(): E2ERun {
  return JSON.parse(readFileSync(RUN_FILE, "utf8"));
}

/** 사용자를 만들고 프로필을 넣은 뒤, 로그인 쿠키를 Playwright storageState 파일로 남긴다. */
async function createUser(runId: string, key: "a" | "b", baseURL: string): Promise<E2EUser & { db: SupabaseClient }> {
  const email = `ff-e2e-${runId}-${key}@forkfiction.test`;
  const password = randomBytes(18).toString("base64url");
  const handle = `e2e_${runId}_${key}`;
  const displayName = `흐름 테스트 ${key.toUpperCase()}`;

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const id = created.data.user.id;
  const profile = await admin
    .from("profiles")
    .insert({ id, handle, display_name: displayName, terms_agreed_at: new Date().toISOString() });
  if (profile.error) throw profile.error;

  // 앱(@supabase/ssr)이 읽는 쿠키를 그대로 만든다
  const jar = new Map<string, string>();
  const ssr = createServerClient(url!, anonKey!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const signedIn = await ssr.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  await new Promise((r) => setTimeout(r, 50));
  if (jar.size === 0) throw new Error("로그인 쿠키를 만들지 못했습니다.");

  const host = new URL(baseURL).hostname;
  const storageState = `${AUTH_DIR}/${key}.json`;
  writeFileSync(
    storageState,
    JSON.stringify({
      cookies: [...jar].map(([name, value]) => ({
        name,
        value,
        domain: host,
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 3600,
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      })),
      origins: [],
    }),
  );

  const db = createClient(url!, anonKey!, noSession);
  const plain = await db.auth.signInWithPassword({ email, password });
  if (plain.error) throw plain.error;
  return { key, id, email, handle, displayName, storageState, db };
}

const CHAPTERS = [1, 2, 3, 4].map((n) => ({
  title: `${n}장 시험 장`,
  body: `${n}장의 첫 문단입니다. 바람이 불었다.\n\n${n}장의 두 번째 문단입니다. 모바일 화면에서 줄이 넘치는지 보려고 조금 길게 적은 문장입니다. 아주아주아주아주긴낱말이한줄을넘을때도화면이옆으로밀리면안됩니다.`,
}));

export async function setupRun(baseURL: string): Promise<E2ERun> {
  mkdirSync(AUTH_DIR, { recursive: true });
  const runId = randomBytes(3).toString("hex");
  const a = await createUser(runId, "a", baseURL);
  const b = await createUser(runId, "b", baseURL);
  // 관리 화면 점검용
  const promote = await admin.from("profiles").update({ is_admin: true }).eq("id", a.id);
  if (promote.error) throw promote.error;

  // 모바일 점검용 원작과 갈래(화면 흐름은 fork-flow.spec.ts가 따로 확인한다)
  const originalSlug = `e2e-${runId}-fixture`;
  const work = await a.db.rpc("create_work", {
    p_title: `모바일 점검 원작 ${runId}`,
    p_summary: "375px 화면 점검용 원작입니다.",
    p_slug: originalSlug,
    p_license: "CC-BY-SA-4.0",
    p_allow_fork: true,
    p_ai_usage: "none",
    p_visibility: "public",
    p_chapters: CHAPTERS,
  });
  if (work.error) throw work.error;

  const forkSlug = `e2e-${runId}-fixture-fork`;
  const fork = await b.db.rpc("fork_work", {
    source_work_id: work.data,
    at_position: 2,
    title: `모바일 점검 갈래 ${runId}`,
    note: "2장부터 다르게 가는 갈래",
    requested_slug: forkSlug,
  });
  if (fork.error) throw fork.error;
  const ch = await admin
    .from("chapters")
    .select("id, head_revision_id, head:revisions!chapters_head_revision_id_fkey(title)")
    .eq("work_id", fork.data)
    .eq("position", 2)
    .single<{ id: string; head_revision_id: string; head: { title: string } }>();
  if (ch.error) throw ch.error;
  const saved = await b.db.rpc("save_chapter", {
    p_chapter_id: ch.data.id,
    p_title: ch.data.head.title,
    p_body_md: "2장의 첫 문단입니다. 바람이 멎었다.\n\n갈래에서 새로 쓴 문단입니다.",
    p_base_revision_id: ch.data.head_revision_id,
  });
  if (saved.error) throw saved.error;
  const pub = await b.db.from("works").update({ visibility: "public" }).eq("id", fork.data);
  if (pub.error) throw pub.error;

  const strip = (u: E2EUser & { db: SupabaseClient }): E2EUser => ({
    key: u.key,
    id: u.id,
    email: u.email,
    handle: u.handle,
    displayName: u.displayName,
    storageState: u.storageState,
  });
  const run: E2ERun = { runId, users: { a: strip(a), b: strip(b) }, fixture: { originalSlug, forkSlug } };
  writeFileSync(RUN_FILE, JSON.stringify(run, null, 2));
  return run;
}

/** 이번 실행에서 만든 사용자의 작품·수정본·계정을 지운다(CLAUDE.md의 @forkfiction.test 예외 범위). */
export async function cleanupRun(run: E2ERun) {
  const ids = Object.values(run.users).map((u) => u.id);
  const works = await admin.from("works").select("id").in("owner_id", ids);
  if (works.error) throw works.error;
  if (works.data.length > 0) {
    const del = await admin.from("works").delete().in("id", works.data.map((w) => w.id));
    if (del.error) throw del.error;
  }
  const revs = await admin.from("revisions").delete().in("author_id", ids);
  if (revs.error) throw revs.error;
  for (const id of ids) {
    const del = await admin.auth.admin.deleteUser(id);
    if (del.error) throw del.error;
  }
}
