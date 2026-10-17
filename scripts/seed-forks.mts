// 비교·갈래 지도 개발용 시드: 시드 사용자가 만든 "[개발용] 시드 원작"과 갈래 5개(갈래의 갈래 1개 포함).
//
//   npm run seed:forks             만든다(시드 원작이 이미 있으면 건너뛴다)
//   npm run seed:forks -- --reset  시드 사용자(seed-*@forkfiction.test)와 그 작품·수정본을 모두 지운다
//
// 실제 『칼의 여행』(kalui-yeohaeng)이나 실제 사용자에게는 손대지 않는다. 시드 원작도 시드 사용자가 만들므로
// 갈래 공개 알림은 시드 사용자끼리만 오간다.
// 갈래는 규칙대로 fork_work()로만 만들고, 장도 save_chapter()·add_chapter()로 바꾼다. 그러려고 시드 사용자로 로그인한다.
// --reset은 CLAUDE.md에 적은 예외로, service role로 시드 사용자 범위의 수정본까지 지운다.

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { splitChapters } from "../src/lib/split-chapters.ts";

const ORIGINAL_SLUG = "dev-seed-original";
const SOURCE = new URL("../seed/kalui-yeohaeng-serial.md", import.meta.url);
const SEED_EMAIL = /^seed-[a-z0-9-]+@forkfiction\.test$/;
const NOTICE = "> 개발용 시드 갈래입니다. 비교·갈래 지도 확인용으로 만든 글입니다.";

const { values } = parseArgs({ options: { reset: { type: "boolean", default: false } } });

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경 변수를 직접 넣은 경우
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, noSession);

type SeedUser = { key: string; handle: string; name: string };
const USERS: SeedUser[] = [
  { key: "origin", handle: "seed_origin", name: "시드 원작자" },
  { key: "fork-1", handle: "seed_fork_1", name: "시드 갈래 작가 1" },
  { key: "fork-2", handle: "seed_fork_2", name: "시드 갈래 작가 2" },
  { key: "fork-3", handle: "seed_fork_3", name: "시드 갈래 작가 3" },
  { key: "fork-4", handle: "seed_fork_4", name: "시드 갈래 작가 4" },
];
const emailOf = (u: SeedUser) => `seed-${u.key}@forkfiction.test`;

async function seedUserIds(): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; ; page++) {
    const res = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (res.error) throw res.error;
    for (const u of res.data.users) if (u.email && SEED_EMAIL.test(u.email)) ids.push(u.id);
    if (res.data.users.length < 200) return ids;
  }
}

// ────────────────────────────────────────────────────────────
// --reset
// ────────────────────────────────────────────────────────────

/** 시드 사용자와 그 작품·수정본을 지운다 */
async function reset() {
  const ids = await seedUserIds();
  if (ids.length === 0) {
    console.log("지울 시드 사용자가 없습니다.");
    return;
  }
  const works = await admin.from("works").select("id").in("owner_id", ids);
  if (works.error) throw works.error;
  const workIds = works.data.map((w) => w.id);

  // 실제 사용자가 시드 작품에서 갈라졌으면 계보가 끊기므로 지우지 않는다
  if (workIds.length > 0) {
    const outside = await admin
      .from("works")
      .select("slug, owner_id")
      .in("parent_work_id", workIds)
      .not("owner_id", "in", `(${ids.join(",")})`);
    if (outside.error) throw outside.error;
    if (outside.data.length > 0) {
      console.error(`시드가 아닌 사용자가 시드 작품에서 갈라진 갈래가 있어 멈춥니다: ${outside.data.map((w) => w.slug).join(", ")}`);
      process.exitCode = 1;
      return;
    }
    // 원작과 갈래를 한 문장으로 지워 부모·뿌리 참조가 문장 끝에서 함께 풀리게 한다(장·별·알림은 cascade)
    const del = await admin.from("works").delete().in("id", workIds);
    if (del.error) throw del.error;
  }

  // CLAUDE.md의 예외: 시드 사용자 범위의 수정본만 service role로 지운다
  const revs = await admin.from("revisions").delete().in("author_id", ids);
  if (revs.error) throw revs.error;

  for (const id of ids) {
    const del = await admin.auth.admin.deleteUser(id);
    if (del.error) throw del.error;
  }
  console.log(`지웠습니다: 시드 사용자 ${ids.length}명, 작품 ${workIds.length}개`);
  return;
}

// ────────────────────────────────────────────────────────────
// 만들기
// ────────────────────────────────────────────────────────────

/** 시드 원작·갈래·별을 만든다 */
async function seed() {
  const existing = await admin.from("works").select("id").eq("slug", ORIGINAL_SLUG).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    console.log(`이미 있습니다: /w/${ORIGINAL_SLUG}. 다시 만들려면 먼저 --reset 하세요.`);
    return;
  }

  /** 시드 사용자를 만들거나(있으면 비밀번호만 새로 정해) 로그인한 클라이언트를 돌려준다 */
  async function signIn(user: SeedUser): Promise<SupabaseClient> {
    const email = emailOf(user);
    const password = randomBytes(18).toString("base64url");

    const found = await admin.from("profiles").select("id").eq("handle", user.handle).maybeSingle();
    if (found.error) throw found.error;
    let id = found.data?.id as string | undefined;
    if (id) {
      const upd = await admin.auth.admin.updateUserById(id, { password });
      if (upd.error) throw upd.error;
      if (upd.data.user.email !== email) throw new Error(`필명 ${user.handle}이 시드 사용자가 아닙니다.`);
    } else {
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error) throw created.error;
      id = created.data.user.id;
      const profile = await admin.from("profiles").insert({
        id,
        handle: user.handle,
        display_name: user.name,
        terms_agreed_at: new Date().toISOString(),
      });
      if (profile.error) throw profile.error;
    }

    const db = createClient(url!, anonKey!, noSession);
    const res = await db.auth.signInWithPassword({ email, password });
    if (res.error) throw res.error;
    return db;
  }

  function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
    if (res.error) throw new Error(`${what}: ${res.error.message}`);
    return res.data;
  }

  const clients = Object.fromEntries(await Promise.all(USERS.map(async (u) => [u.key, await signIn(u)] as const)));

  // 1) 시드 원작
  const { chapters } = splitChapters(readFileSync(SOURCE, "utf8"));
  const originalId = check(
    await clients.origin.rpc("create_work", {
      p_title: "[개발용] 시드 원작",
      p_summary: "비교·갈래 지도 개발용 시드 원작입니다. 『칼의 여행』 연재본으로 만들었습니다. 실제 작품이 아닙니다.",
      p_slug: ORIGINAL_SLUG,
      p_license: "CC-BY-SA-4.0",
      p_allow_fork: true,
      p_ai_usage: "mostly",
      p_visibility: "public",
      p_chapters: chapters.map((ch) => ({ title: ch.title, body: ch.body })),
    }),
    "시드 원작",
  ) as string;
  console.log(`시드 원작: /w/${ORIGINAL_SLUG} (${chapters.length}개 장)`);

  // 2) 갈래
  type ForkSpec = {
    key: string;
    user: string;
    source: () => string;
    at: number;
    title: string;
    note: string;
    slug: string;
    /** 갈라진 장에 덧붙일 문장, 끼워 넣을 문단, 바꿀 마지막 문단 */
    aside: string;
    twist: string;
    ending: string;
    /** 갈림점 앞의 물려받은 장도 고친다(갈림점 자동 갱신 확인용) */
    alsoEdit?: number;
    newChapters: { title: string; body: string }[];
  };

  const ids: Record<string, string> = {};
  const FORKS: ForkSpec[] = [
    {
      key: "arsha",
      user: "fork-1",
      source: () => originalId,
      at: 6,
      title: "아르샤의 서쪽 길",
      note: "아르샤를 따라 서쪽으로 간다면",
      slug: "dev-seed-arsha",
      aside: "재하는 그때 처음으로, 서쪽으로 난 길이 칼보다 무겁게 느껴졌다.",
      twist: "아르샤가 대상단의 낙타 고삐를 쥐었을 때, 재하는 손을 내밀었다. \"같이 가자.\" 아르샤는 웃지 않았다. 대신 고삐 하나를 더 풀어 재하에게 건넸다.",
      ending: "그날 밤 다인철소의 불은 꺼지지 않았고, 재하 일행은 서쪽으로 첫 걸음을 옮겼다.",
      newChapters: [
        {
          title: "모래 위의 대장간",
          body: "사막의 밤은 쇠를 식히기에 너무 차가웠다.\n\n아르샤는 모래를 파서 화덕을 만들고, 재하는 낙타 뼈로 풀무를 엮었다. 두 사람 모두 그것이 칼을 벼리는 일인지, 길을 벼리는 일인지 알지 못했다.",
        },
      ],
    },
    {
      key: "dani",
      user: "fork-2",
      source: () => originalId,
      at: 7,
      title: "단이의 마을",
      note: "단이가 마을에 남았다면",
      slug: "dev-seed-dani",
      aside: "단이는 대답 대신 망치를 내려놓았다.",
      twist: "\"나는 여기 남을래요.\" 단이가 말했다. \"아버지가 숨긴 칼은 천 자루 중 하나였지만, 이 마을은 하나뿐이니까.\"",
      ending: "재하는 단이를 두고 한양으로 떠났다. 돌아보지 않으려 했지만, 마을 어귀의 연기가 보이지 않을 때까지 세 번을 돌아보았다.",
      alsoEdit: 6,
      newChapters: [
        {
          title: "남은 사람의 칼",
          body: "재하가 떠난 지 열흘, 다인철소에 다시 관리가 왔다.\n\n단이는 숨겨 둔 천 번째 칼을 꺼내지 않았다. 대신 마을 사람들과 함께 부러진 환도 백 자루를 다시 벼렸다.",
        },
      ],
    },
    {
      key: "ulla",
      user: "fork-3",
      source: () => originalId,
      at: 8,
      title: "울라의 길",
      note: "울라가 강무열을 따라가지 않았다면",
      slug: "dev-seed-ulla",
      aside: "울라는 활시위의 매듭을 풀었다.",
      twist: "강무열이 손을 내밀었지만 울라는 고개를 저었다. \"범은 산에서 자라야 해요.\" 소년은 새끼 범을 품에 안고 재하 쪽으로 걸어왔다.",
      ending: "그렇게 일행은 하나를 잃지 않고 범의 시간을 지나왔다. 재하는 그것이 다음 시대에 어떤 값을 치르게 할지 알지 못했다.",
      newChapters: [
        {
          title: "범과 함께 걷는 길",
          body: "새끼 범은 하루가 다르게 자랐다.\n\n울라는 매일 밤 범에게 산의 이름을 하나씩 가르쳤다. 재하는 그 이름들을 현장 기록 맨 뒤에 받아 적었다.",
        },
        {
          title: "두 개의 활",
          body: "울라가 처음으로 재하에게 활을 쥐여 주었다.\n\n\"칼은 가까운 것을 지키고, 활은 먼 것을 지켜요.\" 재하는 그 말을 오래 곱씹었다.",
        },
      ],
    },
    {
      key: "jina",
      user: "fork-4",
      source: () => originalId,
      at: 9,
      title: "진아의 실록",
      note: "진아가 실록 곁에 남는다면",
      slug: "dev-seed-jina",
      aside: "진아는 마지막 장을 덮으며 붓을 씻었다.",
      twist: "진아는 실록의 등을 쓸어내렸다. \"기록이 남아 있으면 끝이 아니에요. 그러니 나는 여기서 끝을 지킬게요.\"",
      ending: "재하는 진아가 남긴 한 줄을 품에 넣고 마지막 시대로 향했다.",
      newChapters: [],
    },
    {
      key: "tiger",
      user: "fork-1",
      source: () => ids.ulla,
      at: 10,
      title: "범의 아이",
      note: "울라가 새끼 범을 산에 돌려보낸다면",
      slug: "dev-seed-tiger",
      aside: "범은 한 번도 뒤를 돌아보지 않았다.",
      twist: "울라는 범을 산 어귀에 내려놓았다. 범이 먼저 숲으로 들어갔고, 울라는 오래 그 자리에 서 있었다.",
      ending: "그날 이후 울라의 활에는 매듭이 하나 더 생겼다.",
      newChapters: [
        {
          title: "산의 이름",
          body: "봄이 되자 산 너머에서 범의 울음이 들렸다.\n\n울라는 대답하지 않았다. 대답하지 않는 것이 그 범에게 줄 수 있는 마지막 가르침이었다.",
        },
      ],
    },
  ];

  /** 원작 장을 조금 고친다: 셋째 문단에 문장 덧붙이기, 끝 근처에 문단 끼우기, 넷째 문단 빼기, 마지막 문단 바꾸기 */
  function rewrite(body: string, spec: ForkSpec) {
    const paras = body.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/);
    if (paras.length > 2) paras[2] = `${paras[2].trimEnd()} ${spec.aside}`;
    if (paras.length > 6) paras.splice(3, 1);
    paras.splice(Math.max(paras.length - 2, 0), 0, spec.twist);
    paras[paras.length - 1] = spec.ending;
    return `${NOTICE}\n\n${paras.join("\n\n")}`;
  }

  /** 앞 장은 셋째 문단에 한 문장만 덧붙인다 */
  function touch(body: string, spec: ForkSpec) {
    const paras = body.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/);
    paras[Math.min(2, paras.length - 1)] += ` ${spec.aside}`;
    return paras.join("\n\n");
  }

  async function chapterAt(workId: string, position: number) {
    const res = await admin
      .from("chapters")
      .select("id, head:revisions!chapters_head_revision_id_fkey(id, title, body_md)")
      .eq("work_id", workId)
      .eq("position", position)
      .single<{ id: string; head: { id: string; title: string; body_md: string } }>();
    if (res.error) throw res.error;
    return res.data;
  }

  for (const spec of FORKS) {
    const db = clients[spec.user];
    const forkId = check(
      await db.rpc("fork_work", {
        source_work_id: spec.source(),
        at_position: spec.at,
        title: spec.title,
        note: spec.note,
        requested_slug: spec.slug,
      }),
      spec.title,
    ) as string;
    ids[spec.key] = forkId;

    for (const position of [spec.alsoEdit, spec.at].filter((p): p is number => p !== undefined)) {
      const ch = await chapterAt(forkId, position);
      check(
        await db.rpc("save_chapter", {
          p_chapter_id: ch.id,
          p_title: ch.head.title,
          p_body_md: position === spec.at ? rewrite(ch.head.body_md, spec) : touch(ch.head.body_md, spec),
          p_base_revision_id: ch.head.id,
          p_message: position === spec.at ? "갈래 시작" : "앞 장도 손보기",
        }),
        `${spec.title} ${position}장 저장`,
      );
    }

    const count = (await admin.from("chapters").select("id", { count: "exact", head: true }).eq("work_id", forkId)).count ?? 0;
    for (const [i, ch] of spec.newChapters.entries()) {
      check(
        await db.rpc("add_chapter", {
          p_work_id: forkId,
          p_position: count + i + 1,
          p_title: ch.title,
          p_body_md: `${NOTICE}\n\n${ch.body}`,
          p_message: "새로 쓰기",
        }),
        `${spec.title} 새 장`,
      );
    }

    check(await db.from("works").update({ visibility: "public" }).eq("id", forkId), `${spec.title} 공개`);
    const work = check(await admin.from("works").select("fork_chapter_position").eq("id", forkId).single(), spec.title);
    console.log(`갈래: /w/${spec.slug} 『${spec.title}』 갈림점 ${work?.fork_chapter_position}장`);
  }

  // 3) 별: 지도의 순서(별 많은 순)를 확인할 수 있게 갈래마다 다르게 준다
  const STARS: [string, string][] = [
    ["fork-2", "ulla"],
    ["fork-4", "ulla"],
    ["fork-1", "ulla"],
    ["fork-3", "arsha"],
    ["fork-3", "tiger"],
    ["fork-1", "jina"],
    ["fork-2", "jina"],
  ];
  for (const [user, key] of STARS) {
    const { data } = await clients[user].auth.getUser();
    check(await clients[user].from("stars").insert({ user_id: data.user!.id, work_id: ids[key] }), `별 ${user} → ${key}`);
  }

  console.log(`끝. 갈래 지도: /w/${ORIGINAL_SLUG}/tree`);
}

// process.exit()로 끝내면 Windows에서 열린 fetch 소켓을 닫다가 libuv assertion이 날 수 있어, 함수에서 return으로 끝낸다
if (values.reset) await reset();
else await seed();
