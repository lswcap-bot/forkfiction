import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anon,
  cleanup,
  createOriginal,
  createTestUser,
  expectError,
  getWork,
  setVisibility,
  type TestUser,
  lineageOf,
} from "./helpers";

// a: 원작자, b: 갈래 작가, c: 갈래의 갈래 작가, m: 관리자
let a: TestUser;
let b: TestUser;
let c: TestUser;
let m: TestUser;
let original: Awaited<ReturnType<typeof createOriginal>>;

beforeAll(async () => {
  [a, b, c, m] = await Promise.all([
    createTestUser("a"),
    createTestUser("b"),
    createTestUser("c"),
    createTestUser("m"),
  ]);
  const promote = await admin.from("profiles").update({ is_admin: true }).eq("id", m.id);
  if (promote.error) throw promote.error;
  original = await createOriginal(a, { chapters: 3 });
});

afterAll(async () => {
  await cleanup([a, b, c, m].filter(Boolean));
});

async function fork(user: TestUser, sourceId: string, at: number) {
  const res = await user.db.rpc("fork_work", { source_work_id: sourceId, at_position: at, title: "갈래", note: "한 줄" });
  if (res.error) throw res.error;
  return res.data as string;
}

async function notificationsOf(user: TestUser, workId: string) {
  const res = await user.db.from("notifications").select("kind, actor_id").eq("work_id", workId).order("created_at");
  if (res.error) throw res.error;
  return res.data;
}

describe("fork_count: 공개된 직접 갈래 수", () => {
  it("만들 때가 아니라 공개될 때 오르고, 공개를 거두면 내려간다", async () => {
    const before = (await getWork(original.id)).fork_count;
    const forkId = await fork(b, original.id, 2);
    expect((await getWork(original.id)).fork_count).toBe(before);

    await setVisibility(b, forkId, "public");
    expect((await getWork(original.id)).fork_count).toBe(before + 1);

    await setVisibility(b, forkId, "draft");
    expect((await getWork(original.id)).fork_count).toBe(before);

    await setVisibility(b, forkId, "public");
    expect((await getWork(original.id)).fork_count).toBe(before + 1);

    // 관리자가 숨기면 빠지고, 복구하면 다시 센다
    await m.db.rpc("admin_hide_work", { p_work_id: forkId });
    expect((await getWork(original.id)).fork_count).toBe(before);
    await m.db.rpc("admin_restore_work", { p_work_id: forkId });
    expect((await getWork(original.id)).fork_count).toBe(before + 1);
  });

  it("갈래의 갈래는 바로 위 부모에만 센다", async () => {
    const before = (await getWork(original.id)).fork_count;
    const mid = await fork(b, original.id, 3);
    await setVisibility(b, mid, "public");
    const leaf = await fork(c, mid, 3);
    await setVisibility(c, leaf, "public");

    expect((await getWork(original.id)).fork_count).toBe(before + 1);
    expect((await getWork(mid)).fork_count).toBe(1);
  });
});

describe("관리자 숨김·복구", () => {
  it("관리자가 아니면 숨기거나 복구할 수 없다", async () => {
    const target = await createOriginal(a, { chapters: 1 });
    await expectError(a.db.rpc("admin_hide_work", { p_work_id: target.id }), "42501");
    await expectError(b.db.rpc("admin_hide_work", { p_work_id: target.id }), "42501");
    await expectError(anon.rpc("admin_hide_work", { p_work_id: target.id }));
    expect((await getWork(target.id)).visibility).toBe("public");

    await m.db.rpc("admin_hide_work", { p_work_id: target.id });
    await expectError(a.db.rpc("admin_restore_work", { p_work_id: target.id }), "42501");
    // 작가도 직접 숨김을 풀 수 없다
    await expectError(a.db.from("works").update({ visibility: "public" }).eq("id", target.id), "42501");
    expect((await getWork(target.id)).visibility).toBe("hidden");
  });

  it("숨기면 열린 신고가 처리되고 작가에게 알림이 간다. 작가 말고는 읽을 수 없다", async () => {
    const target = await createOriginal(a, { chapters: 2 });
    const report = await b.db.from("reports").insert({ reporter_id: b.id, work_id: target.id, reason: "plagiarism" });
    expect(report.error).toBeNull();

    const hide = await m.db.rpc("admin_hide_work", { p_work_id: target.id });
    expect(hide.error).toBeNull();

    expect(await getWork(target.id)).toMatchObject({ visibility: "hidden", hidden_from: "public" });
    const reports = await admin.from("reports").select("status, resolved_by").eq("work_id", target.id);
    expect(reports.data).toEqual([{ status: "resolved", resolved_by: m.id }]);
    // 관리자가 누구인지는 알리지 않는다
    expect(await notificationsOf(a, target.id)).toEqual([{ kind: "hidden", actor_id: null }]);

    const byAnon = await anon.from("works").select("id").eq("id", target.id);
    expect(byAnon.data).toHaveLength(0);
    const byOther = await b.db.from("works").select("id").eq("id", target.id);
    expect(byOther.data).toHaveLength(0);
    const chapters = await b.db.from("chapters").select("id").eq("work_id", target.id);
    expect(chapters.data).toHaveLength(0);
    const byOwner = await a.db.from("works").select("visibility").eq("id", target.id).single();
    expect(byOwner.data).toEqual({ visibility: "hidden" });
  });

  it("복구하면 숨기기 직전 상태로 돌아가고 작가에게 알림이 간다", async () => {
    const pub = await createOriginal(a, { chapters: 1 });
    const draft = await createOriginal(a, { chapters: 1, visibility: "draft" });

    for (const w of [pub, draft]) {
      await m.db.rpc("admin_hide_work", { p_work_id: w.id });
      const res = await m.db.rpc("admin_restore_work", { p_work_id: w.id });
      expect(res.error).toBeNull();
    }

    expect(await getWork(pub.id)).toMatchObject({ visibility: "public", hidden_from: null, hidden_at: null });
    expect(await getWork(draft.id)).toMatchObject({ visibility: "draft", hidden_from: null });
    expect(await notificationsOf(a, pub.id)).toEqual([
      { kind: "hidden", actor_id: null },
      { kind: "restored", actor_id: null },
    ]);

    // 숨겨지지 않은 작품은 복구할 수 없다
    await expectError(m.db.rpc("admin_restore_work", { p_work_id: pub.id }), "22023");
  });
});

describe("계보의 숨겨진 작품", () => {
  it("작가·관리자 말고는 제목·주소·작가 없이 보이고, 그 갈래는 그대로 남는다", async () => {
    const mid = await fork(b, original.id, 2);
    await setVisibility(b, mid, "public");
    const leaf = await fork(c, mid, 2);
    await setVisibility(c, leaf, "public");
    await m.db.rpc("admin_hide_work", { p_work_id: mid });

    const lineageAs = (db: typeof anon) =>
      lineageOf(db, leaf, [
        "depth",
        "ancestor_slug",
        "ancestor_title",
        "ancestor_owner_handle",
        "ancestor_owner_display_name",
        "ancestor_hidden",
      ]);

    const seen = await lineageAs(anon);
    expect(seen).toHaveLength(3);
    expect(seen[0]).toMatchObject({ depth: 2, ancestor_slug: original.slug, ancestor_hidden: false });
    expect(seen[1]).toEqual({
      depth: 1,
      ancestor_slug: null,
      ancestor_title: null,
      ancestor_owner_handle: null,
      ancestor_owner_display_name: null,
      ancestor_hidden: true,
    });
    expect(seen[2]).toMatchObject({ depth: 0, ancestor_owner_handle: c.handle });
    expect(await lineageAs(c.db)).toEqual(seen);

    // 숨겨진 작품의 작가와 관리자는 제목을 본다
    for (const db of [b.db, m.db]) {
      const own = await lineageAs(db);
      expect(own[1]).toMatchObject({ ancestor_owner_handle: b.handle, ancestor_hidden: true });
    }

    // 숨겨진 갈래의 갈래는 그대로 읽힌다
    const leafRow = await anon.from("works").select("id").eq("id", leaf);
    expect(leafRow.data).toHaveLength(1);
  });
});

describe("신고", () => {
  it("신고는 관리자만 읽는다: 신고자 본인, 작가, 다른 사용자, 방문자는 못 읽는다", async () => {
    const target = await createOriginal(a, { chapters: 1 });
    const add = await b.db.from("reports").insert({ reporter_id: b.id, work_id: target.id, reason: "other", detail: "확인 부탁" });
    expect(add.error).toBeNull();

    for (const db of [a.db, b.db, c.db, anon]) {
      const res = await db.from("reports").select("id, reporter_id").eq("work_id", target.id);
      expect(res.data ?? []).toHaveLength(0);
    }
    const byAdmin = await m.db.from("reports").select("reporter_id, detail").eq("work_id", target.id);
    expect(byAdmin.data).toEqual([{ reporter_id: b.id, detail: "확인 부탁" }]);
  });

  it("같은 작품·장에 열린 신고를 두 번 넣지 못하고, 처리된 뒤에는 다시 신고할 수 있다", async () => {
    const target = await createOriginal(a, { chapters: 2 });
    const report = (chapterId: string | null) =>
      c.db.from("reports").insert({ reporter_id: c.id, work_id: target.id, chapter_id: chapterId, reason: "illegal" });

    expect((await report(null)).error).toBeNull();
    await expectError(report(null), "23505");
    // 장 신고는 작품 신고와 따로 센다
    expect((await report(target.chapterIds[0])).error).toBeNull();
    await expectError(report(target.chapterIds[0]), "23505");
    // 다른 사람은 따로 신고할 수 있다
    const other = await b.db.from("reports").insert({ reporter_id: b.id, work_id: target.id, reason: "illegal" });
    expect(other.error).toBeNull();

    const dismiss = await m.db
      .from("reports")
      .update({ status: "dismissed", resolved_at: new Date().toISOString(), resolved_by: m.id })
      .eq("work_id", target.id)
      .eq("reporter_id", c.id)
      .is("chapter_id", null);
    expect(dismiss.error).toBeNull();
    expect((await report(null)).error).toBeNull();
  });
});

describe("trending_originals", () => {
  it("최근 공개된 갈래 수(갈래의 갈래 포함)를 뿌리 원작별로 센다", async () => {
    const root = await createOriginal(a, { chapters: 2 });
    const f1 = await fork(b, root.id, 1);
    const f2 = await fork(c, root.id, 2);
    await fork(c, root.id, 1); // 임시 저장은 세지 않는다
    await setVisibility(b, f1, "public");
    await setVisibility(c, f2, "public");
    const f3 = await fork(c, f1, 1);
    await setVisibility(c, f3, "public");

    const res = await anon.rpc("trending_originals", { p_days: 14, p_limit: 50 });
    expect(res.error).toBeNull();
    const row = (res.data as { work_id: string; recent_forks: number }[]).find((r) => r.work_id === root.id);
    expect(row?.recent_forks).toBe(3);
  });
});
