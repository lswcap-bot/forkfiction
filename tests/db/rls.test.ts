import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anon,
  cleanup,
  createOriginal,
  createTestUser,
  expectError,
  getChapters,
  getWork,
  type TestUser,
} from "./helpers";

// a: 원작자, b: 다른 사용자
let a: TestUser;
let b: TestUser;
let pub: Awaited<ReturnType<typeof createOriginal>>;
let draft: Awaited<ReturnType<typeof createOriginal>>;

beforeAll(async () => {
  a = await createTestUser("a");
  b = await createTestUser("b");
  pub = await createOriginal(a, { chapters: 2 });
  draft = await createOriginal(a, { chapters: 1, visibility: "draft" });
});

afterAll(async () => {
  await cleanup([a, b].filter(Boolean));
});

describe("works", () => {
  it("공개 작품은 누구나, 임시 저장 작품은 본인만 읽는다", async () => {
    const anonPub = await anon.from("works").select("id").eq("id", pub.id);
    expect(anonPub.data).toHaveLength(1);

    for (const client of [anon, b.db]) {
      const res = await client.from("works").select("id").eq("id", draft.id);
      expect(res.error).toBeNull();
      expect(res.data).toHaveLength(0);
    }
    const own = await a.db.from("works").select("id").eq("id", draft.id);
    expect(own.data).toHaveLength(1);
  });

  it("비로그인은 작품을 만들 수 없고, 남의 이름으로도 만들 수 없다", async () => {
    await expectError(
      anon.from("works").insert({ owner_id: a.id, slug: `x-${a.handle.replaceAll("_", "-")}`, title: "x" }),
      "42501",
    );
    await expectError(
      b.db.from("works").insert({ owner_id: a.id, slug: `y-${b.handle.replaceAll("_", "-")}`, title: "y" }),
      "42501",
    );
  });

  it("갈래 컬럼을 직접 넣어 갈래를 만들 수 없다", async () => {
    await expectError(
      b.db.from("works").insert({
        owner_id: b.id,
        slug: `fake-fork-${b.handle.replaceAll("_", "-")}`,
        title: "가짜 갈래",
        parent_work_id: pub.id,
        fork_chapter_position: 1,
        fork_note: "몰래",
      }),
      "42501",
    );
  });

  it("is_canon, star_count, fork_count는 주인도 직접 못 바꾼다", async () => {
    await expectError(a.db.from("works").update({ is_canon: true }).eq("id", pub.id), "42501");
    await expectError(a.db.from("works").update({ star_count: 999 }).eq("id", pub.id), "42501");
    await expectError(a.db.from("works").update({ fork_count: 999 }).eq("id", pub.id), "42501");
  });

  it("숨김 처리는 주인도 못 한다", async () => {
    await expectError(a.db.from("works").update({ visibility: "hidden" }).eq("id", pub.id), "42501");
  });

  it("남의 작품은 고칠 수 없다", async () => {
    const res = await b.db.from("works").update({ title: "빼앗김" }).eq("id", pub.id).select();
    expect(res.data ?? []).toHaveLength(0);
    expect((await getWork(pub.id)).title).not.toBe("빼앗김");
  });

  it("작품은 지울 수 없다(주인도)", async () => {
    await expectError(a.db.from("works").delete().eq("id", pub.id), "42501");
  });

  it("갈래 금지로 바꾸면 갈래 허용이 꺼진다", async () => {
    const res = await a.db
      .from("works")
      .update({ license: "ARR" })
      .eq("id", draft.id)
      .select("license, allow_fork")
      .single();
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ license: "ARR", allow_fork: false });
  });
});

describe("chapters", () => {
  it("장을 직접 넣을 수 없다(add_chapter로만)", async () => {
    const [ch] = await getChapters(pub.id);
    await expectError(
      a.db.from("chapters").insert({ work_id: pub.id, position: 9, head_revision_id: ch.head_revision_id }),
      "42501",
    );
  });

  it("남의 작품에는 add_chapter를 못 쓴다", async () => {
    await expectError(
      b.db.rpc("add_chapter", { p_work_id: pub.id, p_position: 9, p_title: "끼어들기", p_body_md: "..." }),
      "42501",
    );
  });

  it("남의 장은 고치거나 지울 수 없다", async () => {
    const before = await getChapters(pub.id);
    const [ch] = before;
    await expectError(b.db.rpc("move_chapter", { p_chapter_id: ch.id, p_to_position: 2 }), "42501");
    await expectError(b.db.rpc("delete_chapter", { p_chapter_id: ch.id }), "42501");
    expect(await getChapters(pub.id)).toEqual(before);
  });

  it("임시 저장 작품의 장은 남이 못 읽는다", async () => {
    const res = await anon.from("chapters").select("id").eq("work_id", draft.id);
    expect(res.data).toHaveLength(0);
  });

  it("주인도 장을 직접 고치거나 지울 수 없다(장 함수로만)", async () => {
    const [ch1, ch2] = await getChapters(pub.id);
    await expectError(
      a.db.from("chapters").update({ head_revision_id: ch2.head_revision_id }).eq("id", ch1.id),
      "42501",
    );
    await expectError(a.db.from("chapters").update({ position: 10 }).eq("id", ch1.id), "42501");
    await expectError(a.db.from("chapters").delete().eq("id", ch1.id), "42501");
  });
});

describe("revisions", () => {
  it("누구도 수정본을 고칠 수 없다(service role 포함)", async () => {
    const [ch] = await getChapters(pub.id);
    await expectError(
      a.db.from("revisions").update({ body_md: "고침" }).eq("id", ch.head_revision_id),
      "42501",
    );
    await expectError(
      admin.from("revisions").update({ body_md: "고침" }).eq("id", ch.head_revision_id),
      "42501",
    );
  });

  it("작가도 수정본을 지울 수 없다", async () => {
    const [ch] = await getChapters(pub.id);
    await expectError(a.db.from("revisions").delete().eq("id", ch.head_revision_id), "42501");
    const still = await admin.from("revisions").select("id").eq("id", ch.head_revision_id);
    expect(still.data).toHaveLength(1);
  });

  it("수정본은 직접 넣을 수 없다(save_chapter로만)", async () => {
    const [ch] = await getChapters(pub.id);
    await expectError(
      a.db.from("revisions").insert({ chapter_id: ch.id, author_id: a.id, title: "1장", body_md: "몰래" }),
      "42501",
    );
  });

  it("남의 장에는 save_chapter를 못 쓴다", async () => {
    const [ch] = await getChapters(pub.id);
    await expectError(
      b.db.rpc("save_chapter", {
        p_chapter_id: ch.id,
        p_title: "끼어들기",
        p_body_md: "...",
        p_base_revision_id: ch.head_revision_id,
      }),
      "42501",
    );
  });

  it("임시 저장 작품의 수정본은 남이 못 읽는다", async () => {
    const [ch] = await getChapters(draft.id);
    const res = await b.db.from("revisions").select("id").eq("id", ch.head_revision_id);
    expect(res.data).toHaveLength(0);
    const pubCh = (await getChapters(pub.id))[0];
    const ok = await anon.from("revisions").select("id, body_md").eq("id", pubCh.head_revision_id);
    expect(ok.data).toHaveLength(1);
  });
});

describe("stars", () => {
  it("별을 누르면 star_count가 오르고 원작자에게 알림이 한 번 간다", async () => {
    const add = await b.db.from("stars").insert({ user_id: b.id, work_id: pub.id });
    expect(add.error).toBeNull();
    expect((await getWork(pub.id)).star_count).toBe(1);

    await expectError(b.db.from("stars").insert({ user_id: b.id, work_id: pub.id }), "23505");

    const del = await b.db.from("stars").delete().eq("work_id", pub.id);
    expect(del.error).toBeNull();
    expect((await getWork(pub.id)).star_count).toBe(0);

    // 다시 눌러도 알림은 늘지 않는다
    await b.db.from("stars").insert({ user_id: b.id, work_id: pub.id });
    const notes = await a.db.from("notifications").select("kind, actor_id").eq("work_id", pub.id).eq("kind", "star");
    expect(notes.data).toEqual([{ kind: "star", actor_id: b.id }]);
  });

  it("내 작품, 남의 이름, 임시 저장 작품에는 별을 못 누른다", async () => {
    await expectError(a.db.from("stars").insert({ user_id: a.id, work_id: pub.id }), "42501");
    await expectError(b.db.from("stars").insert({ user_id: a.id, work_id: pub.id }), "42501");
    await expectError(b.db.from("stars").insert({ user_id: b.id, work_id: draft.id }), "42501");
  });
});

describe("notifications", () => {
  it("받는 사람만 보고, 읽음 표시만 바꿀 수 있다", async () => {
    const others = await b.db.from("notifications").select("id").eq("user_id", a.id);
    expect(others.data).toHaveLength(0);

    const mine = await a.db.from("notifications").select("id").limit(1).single();
    expect(mine.error).toBeNull();
    const read = await a.db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", mine.data!.id);
    expect(read.error).toBeNull();

    await expectError(a.db.from("notifications").update({ kind: "canon" }).eq("id", mine.data!.id), "42501");
    await expectError(
      a.db.from("notifications").insert({ user_id: a.id, kind: "fork", work_id: pub.id }),
      "42501",
    );
  });
});

describe("reports", () => {
  it("신고는 관리자만 보고, 처리 상태는 관리자만 바꾼다", async () => {
    const add = await b.db
      .from("reports")
      .insert({ reporter_id: b.id, work_id: pub.id, reason: "other", detail: "테스트 신고" });
    expect(add.error).toBeNull();
    const created = await admin.from("reports").select("id").eq("reporter_id", b.id).eq("work_id", pub.id).single();
    const id = created.data!.id;

    const byOwner = await a.db.from("reports").select("id").eq("id", id);
    expect(byOwner.data).toHaveLength(0);

    await b.db.from("reports").update({ status: "resolved" }).eq("id", id);
    const row = await admin.from("reports").select("status").eq("id", id).single();
    expect(row.data!.status).toBe("open");
  });

  it("읽을 수 없는 작품은 신고할 수 없다", async () => {
    await expectError(
      b.db.from("reports").insert({ reporter_id: b.id, work_id: draft.id, reason: "other" }),
      "42501",
    );
  });
});
