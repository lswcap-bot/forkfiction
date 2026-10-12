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

// a: 원작자, b: 갈래 작가, c: 갈래의 갈래 작가
let a: TestUser;
let b: TestUser;
let c: TestUser;
let original: Awaited<ReturnType<typeof createOriginal>>;
let forkB: string;
let forkC: string;

beforeAll(async () => {
  a = await createTestUser("a");
  b = await createTestUser("b");
  c = await createTestUser("c");
  original = await createOriginal(a, { chapters: 5 });
});

afterAll(async () => {
  await cleanup([a, b, c].filter(Boolean));
});

async function countWorks(ownerId: string) {
  const res = await admin.from("works").select("id", { count: "exact", head: true }).eq("owner_id", ownerId);
  return res.count ?? 0;
}

describe("fork_work", () => {
  it("3장에서 갈라지면 1~2장은 물려받고 3장은 고칠 장, 4장 이후는 없다", async () => {
    const res = await b.db.rpc("fork_work", {
      source_work_id: original.id,
      at_position: 3,
      title: "  울라의 길 ",
      note: "울라가 떠나지 않았다면",
    });
    expect(res.error).toBeNull();
    forkB = res.data as string;

    const work = await getWork(forkB);
    expect(work).toMatchObject({
      owner_id: b.id,
      title: "울라의 길",
      parent_work_id: original.id,
      root_work_id: original.id,
      fork_chapter_position: 3,
      fork_note: "울라가 떠나지 않았다면",
      license: "CC-BY-SA-4.0",
      visibility: "draft",
      is_canon: false,
    });

    const src = await getChapters(original.id);
    const chapters = await getChapters(forkB);
    expect(chapters.map((ch) => [ch.position, ch.state])).toEqual([
      [1, "inherited"],
      [2, "inherited"],
      [3, "modified"],
    ]);
    // 본문은 복사하지 않고 같은 수정본을 가리킨다
    chapters.forEach((ch, i) => {
      expect(ch.head_revision_id).toBe(src[i].head_revision_id);
      expect(ch.origin_revision_id).toBe(src[i].head_revision_id);
    });
    const copied = await admin.from("revisions").select("id").in("chapter_id", chapters.map((ch) => ch.id));
    expect(copied.data).toHaveLength(0);
  });

  it("원작의 fork_count가 오르고 원작자에게 알림이 간다", async () => {
    expect((await getWork(original.id)).fork_count).toBe(1);
    const notes = await a.db.from("notifications").select("kind, work_id, actor_id").eq("kind", "fork");
    expect(notes.data).toEqual([{ kind: "fork", work_id: forkB, actor_id: b.id }]);
  });

  it("원작자가 나중에 고쳐도 갈래의 물려받은 장은 그대로다", async () => {
    const [srcCh1] = await getChapters(original.id);
    const rev = await a.db
      .from("revisions")
      .insert({ chapter_id: srcCh1.id, author_id: a.id, title: "1장", body_md: "원작 개정판" })
      .select("id")
      .single();
    expect(rev.error).toBeNull();
    await a.db.from("chapters").update({ head_revision_id: rev.data!.id }).eq("id", srcCh1.id);

    const [forkCh1] = await getChapters(forkB);
    expect(forkCh1.head_revision_id).toBe(srcCh1.head_revision_id);
  });

  it("물려받은 장에 새 수정본을 올리면 고친 장이 된다", async () => {
    const [, ch2] = await getChapters(forkB);
    const rev = await b.db
      .from("revisions")
      .insert({
        chapter_id: ch2.id,
        author_id: b.id,
        title: "2장",
        body_md: "갈래에서 고친 2장",
        parent_revision_id: ch2.head_revision_id,
      })
      .select("id")
      .single();
    expect(rev.error).toBeNull();
    const move = await b.db.from("chapters").update({ head_revision_id: rev.data!.id }).eq("id", ch2.id);
    expect(move.error).toBeNull();

    const after = (await getChapters(forkB))[1];
    expect(after.state).toBe("modified");
    expect(after.origin_revision_id).toBe(ch2.origin_revision_id);
  });

  it("갈래의 갈래도 뿌리 원작을 기억하고, 계보 뷰가 뿌리까지 이어진다", async () => {
    await b.db.from("works").update({ visibility: "public" }).eq("id", forkB);

    const res = await c.db.rpc("fork_work", {
      source_work_id: forkB,
      at_position: 2,
      title: "단이의 마을",
      note: "울라 대신 단이가 남는다",
    });
    expect(res.error).toBeNull();
    forkC = res.data as string;

    const work = await getWork(forkC);
    expect(work.parent_work_id).toBe(forkB);
    expect(work.root_work_id).toBe(original.id);
    expect(work.license).toBe("CC-BY-SA-4.0");

    const lineage = await c.db
      .from("work_lineage")
      .select("depth, ancestor_id, ancestor_owner_handle, fork_chapter_position")
      .eq("work_id", forkC)
      .order("depth", { ascending: false });
    expect(lineage.error).toBeNull();
    expect(lineage.data).toEqual([
      { depth: 2, ancestor_id: original.id, ancestor_owner_handle: a.handle, fork_chapter_position: null },
      { depth: 1, ancestor_id: forkB, ancestor_owner_handle: b.handle, fork_chapter_position: 3 },
      { depth: 0, ancestor_id: forkC, ancestor_owner_handle: c.handle, fork_chapter_position: 2 },
    ]);

    // 임시 저장 갈래의 계보는 남에게 보이지 않는다
    const hidden = await anon.from("work_lineage").select("depth").eq("work_id", forkC);
    expect(hidden.data).toHaveLength(0);
  });

  it("갈래는 라이선스를 바꿀 수 없다", async () => {
    await expectError(b.db.from("works").update({ license: "CC-BY-NC-SA-4.0" }).eq("id", forkB), "42501");
  });

  it("거부되는 경우에는 아무것도 남지 않는다", async () => {
    const before = { works: await countWorks(b.id), forkCount: (await getWork(original.id)).fork_count };
    const base = { source_work_id: original.id, at_position: 1, title: "갈래", note: "한 줄" };

    await expectError(anon.rpc("fork_work", base));
    await expectError(b.db.rpc("fork_work", { ...base, at_position: 99 }), "P0002");
    await expectError(b.db.rpc("fork_work", { ...base, note: "   " }), "23514");
    await expectError(b.db.rpc("fork_work", { ...base, title: "" }), "23514");

    const draft = await createOriginal(a, { chapters: 1, visibility: "draft" });
    await expectError(b.db.rpc("fork_work", { ...base, source_work_id: draft.id }), "P0002");

    const closed = await createOriginal(a, { chapters: 1, allowFork: false });
    await expectError(b.db.rpc("fork_work", { ...base, source_work_id: closed.id }), "42501");

    const arr = await createOriginal(a, { chapters: 1, license: "ARR" });
    await expectError(b.db.rpc("fork_work", { ...base, source_work_id: arr.id }), "42501");

    expect(await countWorks(b.id)).toBe(before.works);
    expect((await getWork(original.id)).fork_count).toBe(before.forkCount);
  });
});

describe("set_canon", () => {
  it("뿌리 원작자가 아니면 정사를 정할 수 없다", async () => {
    await c.db.from("works").update({ visibility: "public" }).eq("id", forkC);
    // 바로 위 부모의 작가라도 뿌리 원작자가 아니면 안 된다
    await expectError(b.db.rpc("set_canon", { p_work_id: forkC, p_value: true }), "42501");
    await expectError(c.db.rpc("set_canon", { p_work_id: forkC, p_value: true }), "42501");
    expect((await getWork(forkC)).is_canon).toBe(false);
  });

  it("뿌리 원작자는 갈래의 갈래까지 정사로 인정하고 뗄 수 있다", async () => {
    const on = await a.db.rpc("set_canon", { p_work_id: forkC, p_value: true });
    expect(on.error).toBeNull();
    expect((await getWork(forkC)).is_canon).toBe(true);

    const notes = await c.db.from("notifications").select("kind, work_id, actor_id").eq("kind", "canon");
    expect(notes.data).toEqual([{ kind: "canon", work_id: forkC, actor_id: a.id }]);

    const off = await a.db.rpc("set_canon", { p_work_id: forkC, p_value: false });
    expect(off.error).toBeNull();
    expect((await getWork(forkC)).is_canon).toBe(false);
  });

  it("원작 자체나 비공개 갈래는 정사가 될 수 없다", async () => {
    await expectError(a.db.rpc("set_canon", { p_work_id: original.id, p_value: true }), "P0002");
    await b.db.from("works").update({ visibility: "draft" }).eq("id", forkB);
    await expectError(a.db.rpc("set_canon", { p_work_id: forkB, p_value: true }), "42501");
  });
});
