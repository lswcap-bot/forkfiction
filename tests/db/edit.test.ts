import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anon,
  cleanup,
  createOriginal,
  createTestUser,
  expectError,
  forkNotifications,
  getChapters,
  getWork,
  runId,
  saveChapter,
  setVisibility,
  type TestUser,
  lineageOf,
} from "./helpers";

// 4단계 규칙: 장 저장·되돌리기, 갈림점 자동 갱신, 공개 때 알림, 갈래 주소, 작품 삭제
// a: 원작자, b: 갈래 작가
let a: TestUser;
let b: TestUser;
let original: Awaited<ReturnType<typeof createOriginal>>;

beforeAll(async () => {
  a = await createTestUser("a");
  b = await createTestUser("b");
  original = await createOriginal(a, { chapters: 10 });
});

afterAll(async () => {
  await cleanup([a, b].filter(Boolean));
});

async function fork(user: TestUser, sourceId: string, at: number, extra: { requested_slug?: string } = {}) {
  const res = await user.db.rpc("fork_work", {
    source_work_id: sourceId,
    at_position: at,
    title: "갈래",
    note: "한 줄 소개",
    ...extra,
  });
  if (res.error) throw res.error;
  return res.data as string;
}

async function revisionsOf(chapterId: string) {
  const res = await admin
    .from("revisions")
    .select("id, title, body_md, parent_revision_id, message")
    .eq("chapter_id", chapterId)
    .order("created_at");
  if (res.error) throw res.error;
  return res.data;
}

async function headBody(chapterId: string) {
  const res = await admin
    .from("chapters")
    .select("head:revisions!chapters_head_revision_id_fkey(title, body_md)")
    .eq("id", chapterId)
    .single<{ head: { title: string; body_md: string } }>();
  if (res.error) throw res.error;
  return res.data.head;
}

const forkPoint = async (workId: string) => (await getWork(workId)).fork_chapter_position as number | null;
const positions = async (workId: string) => (await getChapters(workId)).map((c) => [c.position, c.state]);

describe("save_chapter: 저장할 때마다 수정본이 쌓인다", () => {
  it("수정본 하나를 쌓고 head를 옮긴다. 이전 head가 부모가 된다", async () => {
    const work = await createOriginal(a, { chapters: 1 });
    const [ch] = await getChapters(work.id);

    const r1 = await saveChapter(a, ch.id, "첫 고침", { message: "  다듬기 " });
    const r2 = await saveChapter(a, ch.id, "두 번째 고침", { title: "새 제목" });

    const [after] = await getChapters(work.id);
    expect(after.head_revision_id).toBe(r2);
    const revs = await revisionsOf(ch.id);
    expect(revs.map((r) => [r.id, r.parent_revision_id, r.body_md, r.message])).toEqual([
      [ch.head_revision_id, null, "1장 본문", null],
      [r1, ch.head_revision_id, "첫 고침", "다듬기"],
      [r2, r1, "두 번째 고침", null],
    ]);
    expect(await headBody(ch.id)).toEqual({ title: "새 제목", body_md: "두 번째 고침" });
  });

  it("그 사이 head가 바뀌었으면(낡은 base) 저장을 거절하고 아무것도 쌓지 않는다", async () => {
    const work = await createOriginal(a, { chapters: 1 });
    const [ch] = await getChapters(work.id);
    await saveChapter(a, ch.id, "다른 탭에서 저장");
    const before = await revisionsOf(ch.id);

    await expectError(
      a.db.rpc("save_chapter", {
        p_chapter_id: ch.id,
        p_title: "1장",
        p_body_md: "덮어쓰기",
        p_base_revision_id: ch.head_revision_id,
      }),
      "PT409",
    );
    expect(await revisionsOf(ch.id)).toEqual(before);
  });

  it("제목과 본문이 그대로면 새 수정본을 만들지 않는다", async () => {
    const work = await createOriginal(a, { chapters: 1 });
    const [ch] = await getChapters(work.id);
    const head = await saveChapter(a, ch.id, "1장 본문");
    expect(head).toBe(ch.head_revision_id);
    expect(await revisionsOf(ch.id)).toHaveLength(1);
  });

  it("빈 제목이나 너무 긴 메모는 거절한다", async () => {
    const [ch] = await getChapters(original.id);
    const base = { p_chapter_id: ch.id, p_body_md: "x", p_base_revision_id: ch.head_revision_id };
    await expectError(a.db.rpc("save_chapter", { ...base, p_title: "  " }), "23514");
    await expectError(a.db.rpc("save_chapter", { ...base, p_title: "1장", p_message: "가".repeat(101) }), "23514");
  });
});

describe("revert_chapter: 되돌리기", () => {
  it("이전 수정본의 내용으로 새 수정본을 쌓는다. 기록은 줄지 않는다", async () => {
    const work = await createOriginal(a, { chapters: 1 });
    const [ch] = await getChapters(work.id);
    const r1 = await saveChapter(a, ch.id, "고친 본문", { title: "고친 제목" });

    const res = await a.db.rpc("revert_chapter", {
      p_chapter_id: ch.id,
      p_revision_id: ch.head_revision_id,
      p_base_revision_id: r1,
    });
    expect(res.error).toBeNull();

    const revs = await revisionsOf(ch.id);
    expect(revs).toHaveLength(3);
    expect(revs[2]).toMatchObject({ id: res.data, parent_revision_id: r1, title: "1장", body_md: "1장 본문" });
    expect(revs[2].message).toMatch(/되돌/);
    expect(await headBody(ch.id)).toEqual({ title: "1장", body_md: "1장 본문" });
  });

  it("갈래의 장은 물려받은 원작 수정본으로 되돌릴 수 있지만, 다른 장의 수정본은 안 된다", async () => {
    const forkId = await fork(b, original.id, 3);
    const chapters = await getChapters(forkId);
    const ch3 = chapters[2];
    const r1 = await saveChapter(b, ch3.id, "갈래의 3장");

    const back = await b.db.rpc("revert_chapter", {
      p_chapter_id: ch3.id,
      p_revision_id: ch3.origin_revision_id,
      p_base_revision_id: r1,
    });
    expect(back.error).toBeNull();
    expect(await headBody(ch3.id)).toEqual({ title: "3장", body_md: "3장 본문" });
    // 되돌려도 원작과 달라졌던 기록은 남는다
    expect((await getChapters(forkId))[2].state).toBe("modified");

    await expectError(
      b.db.rpc("revert_chapter", {
        p_chapter_id: ch3.id,
        p_revision_id: chapters[0].head_revision_id,
        p_base_revision_id: back.data,
      }),
      "P0002",
    );
  });
});

describe("갈림점 자동 갱신", () => {
  it("물려받은 장을 고치면 modified가 되고 갈림점이 그 장으로 당겨진다", async () => {
    const forkId = await fork(b, original.id, 8);
    expect(await forkPoint(forkId)).toBe(8);

    const ch3 = (await getChapters(forkId))[2];
    await saveChapter(b, ch3.id, "3장부터 달라진다");
    expect((await getChapters(forkId))[2].state).toBe("modified");
    expect(await forkPoint(forkId)).toBe(3);

    // 갈림점 뒤의 장을 고쳐도 갈림점은 그대로다
    const ch5 = (await getChapters(forkId))[4];
    await saveChapter(b, ch5.id, "5장도 고침");
    expect(await forkPoint(forkId)).toBe(3);
  });

  it("물려받은 장을 지우면 그 장이 갈림점이 되고, 장 번호는 빈칸 없이 당겨진다", async () => {
    const forkId = await fork(b, original.id, 8);
    const ch5 = (await getChapters(forkId))[4];
    const res = await b.db.rpc("delete_chapter", { p_chapter_id: ch5.id });
    expect(res.error).toBeNull();

    expect(await forkPoint(forkId)).toBe(5);
    expect((await getChapters(forkId)).map((c) => c.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("장 순서를 바꾸면 물려받은 장이 처음 움직인 자리가 갈림점이 된다", async () => {
    const forkId = await fork(b, original.id, 8);
    const ch8 = (await getChapters(forkId))[7];
    const res = await b.db.rpc("move_chapter", { p_chapter_id: ch8.id, p_to_position: 2 });
    expect(res.error).toBeNull();

    expect(await positions(forkId)).toEqual([
      [1, "inherited"],
      [2, "modified"],
      [3, "inherited"],
      [4, "inherited"],
      [5, "inherited"],
      [6, "inherited"],
      [7, "inherited"],
      [8, "inherited"],
    ]);
    expect(await forkPoint(forkId)).toBe(2);
  });

  it("물려받은 장 앞에 새 장을 넣으면 그 자리가 갈림점이 된다", async () => {
    const forkId = await fork(b, original.id, 8);
    const res = await b.db.rpc("add_chapter", { p_work_id: forkId, p_position: 4, p_title: "끼워 넣은 장", p_body_md: "새 글" });
    expect(res.error).toBeNull();

    expect((await positions(forkId)).slice(2, 6)).toEqual([
      [3, "inherited"],
      [4, "new"],
      [5, "inherited"],
      [6, "inherited"],
    ]);
    expect(await forkPoint(forkId)).toBe(4);
  });

  it("뒤에 새 장을 이어 쓰면 갈림점은 그대로다", async () => {
    const forkId = await fork(b, original.id, 8);
    for (const p of [9, 10, 11]) {
      const res = await b.db.rpc("add_chapter", { p_work_id: forkId, p_position: p, p_title: `${p}장`, p_body_md: "새 글" });
      expect(res.error).toBeNull();
    }
    expect(await forkPoint(forkId)).toBe(8);
  });

  it("원작은 장을 고치거나 옮겨도 갈림점이 없다", async () => {
    const work = await createOriginal(a, { chapters: 3 });
    const [c1, c2, c3] = await getChapters(work.id);
    await saveChapter(a, c1.id, "원작 고침");
    const move = await a.db.rpc("move_chapter", { p_chapter_id: c3.id, p_to_position: 1 });
    expect(move.error).toBeNull();
    expect(await forkPoint(work.id)).toBeNull();
    expect((await getChapters(work.id)).map((c) => c.id)).toEqual([c3.id, c1.id, c2.id]);
  });

  it("장 번호를 벗어나거나 마지막 장을 지우는 것은 거절한다", async () => {
    const work = await createOriginal(a, { chapters: 1 });
    const [ch] = await getChapters(work.id);
    await expectError(a.db.rpc("move_chapter", { p_chapter_id: ch.id, p_to_position: 2 }), "22023");
    await expectError(
      a.db.rpc("add_chapter", { p_work_id: work.id, p_position: 3, p_title: "x", p_body_md: "" }),
      "22023",
    );
    await expectError(a.db.rpc("delete_chapter", { p_chapter_id: ch.id }), "22023");
  });
});

describe("새 갈래 알림은 처음 공개될 때", () => {
  it("만들 때는 없고, 처음 공개하면 부모 작가에게 한 번, 다시 공개해도 한 번뿐이다", async () => {
    const before = (await forkNotifications(a)).length;
    const forkId = await fork(b, original.id, 2);
    expect(await forkNotifications(a)).toHaveLength(before);

    await setVisibility(b, forkId, "public");
    await setVisibility(b, forkId, "draft");
    await setVisibility(b, forkId, "public");

    const notes = (await forkNotifications(a)).filter((n) => n.work_id === forkId);
    expect(notes).toEqual([{ work_id: forkId, actor_id: b.id }]);
  });

  it("작가가 자기 작품에서 갈라질 수 있고, 그때는 공개해도 알림이 없다", async () => {
    const before = (await forkNotifications(a)).length;
    const selfFork = await fork(a, original.id, 4);
    expect((await getWork(selfFork)).parent_work_id).toBe(original.id);

    await setVisibility(a, selfFork, "public");
    expect(await forkNotifications(a)).toHaveLength(before);
  });
});

describe("갈래 주소", () => {
  it("요청한 주소로 만들고, 임시 저장 동안 바꿀 수 있으며, 공개 뒤에는 잠긴다", async () => {
    const slug = `ullaui-gil-${runId}`;
    const forkId = await fork(b, original.id, 5, { requested_slug: slug });
    expect((await getWork(forkId)).slug).toBe(slug);

    const renamed = `${slug}-2`;
    const change = await b.db.from("works").update({ slug: renamed }).eq("id", forkId);
    expect(change.error).toBeNull();

    await setVisibility(b, forkId, "public");
    await expectError(b.db.from("works").update({ slug: `${slug}-3` }).eq("id", forkId), "42501");
    expect((await getWork(forkId)).slug).toBe(renamed);
  });

  it("이미 쓰는 주소를 요청하면 거절하고 아무것도 남기지 않는다", async () => {
    const before = (await getWork(original.id)).fork_count;
    await expectError(
      b.db.rpc("fork_work", {
        source_work_id: original.id,
        at_position: 1,
        title: "갈래",
        note: "한 줄",
        requested_slug: original.slug,
      }),
      "23505",
    );
    expect((await getWork(original.id)).fork_count).toBe(before);
  });

  it("주소를 주지 않으면 무작위 주소를 쓴다", async () => {
    const forkId = await fork(b, original.id, 1);
    expect((await getWork(forkId)).slug).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("delete_work: 한 번도 공개하지 않은 작품 지우기", () => {
  it("공개한 적 없는 원작은 작가가 지울 수 있다", async () => {
    const draft = await createOriginal(a, { chapters: 2, visibility: "draft" });
    const res = await a.db.rpc("delete_work", { p_work_id: draft.id });
    expect(res.error).toBeNull();

    const gone = await admin.from("works").select("id").eq("id", draft.id);
    expect(gone.data).toHaveLength(0);
    const chapters = await admin.from("chapters").select("id").eq("work_id", draft.id);
    expect(chapters.data).toHaveLength(0);
  });

  it("공개한 적 없는 갈래를 지워도 부모의 갈래 수와 물려받은 원작 수정본은 그대로다", async () => {
    const before = (await getWork(original.id)).fork_count;
    const forkId = await fork(b, original.id, 3);

    const res = await b.db.rpc("delete_work", { p_work_id: forkId });
    expect(res.error).toBeNull();
    expect((await getWork(original.id)).fork_count).toBe(before);

    const src = await getChapters(original.id);
    const revs = await admin.from("revisions").select("id").in("id", src.map((c) => c.head_revision_id));
    expect(revs.data).toHaveLength(src.length);
  });

  it("공개한 적이 있으면(지금 임시 저장이어도) 지울 수 없다", async () => {
    const work = await createOriginal(a, { chapters: 1 });
    await setVisibility(a, work.id, "draft");
    await expectError(a.db.rpc("delete_work", { p_work_id: work.id }), "42501");
  });

  it("남의 작품은 지울 수 없고, 직접 delete도 막혀 있다", async () => {
    const draft = await createOriginal(a, { chapters: 1, visibility: "draft" });
    await expectError(b.db.rpc("delete_work", { p_work_id: draft.id }), "42501");
    await expectError(anon.rpc("delete_work", { p_work_id: draft.id }));
    await a.db.from("works").delete().eq("id", draft.id);
    expect((await admin.from("works").select("id").eq("id", draft.id)).data).toHaveLength(1);
  });
});

describe("완료 기준: 8장에서 갈라져 8장을 고치고 11장까지 새로 쓴 뒤 공개", () => {
  it("원작자에게 알림이 가고, 누구에게나 갈래의 계보가 보인다", async () => {
    const before = (await forkNotifications(a)).length;
    const forkId = await fork(b, original.id, 8);

    const ch8 = (await getChapters(forkId))[7];
    await saveChapter(b, ch8.id, "울라는 강무열을 따라가지 않았다.", { message: "8장 고쳐 쓰기" });
    for (const p of [9, 10, 11]) {
      const res = await b.db.rpc("add_chapter", { p_work_id: forkId, p_position: p, p_title: `${p}장`, p_body_md: `${p}장 새 글` });
      expect(res.error).toBeNull();
    }
    expect(await forkNotifications(a)).toHaveLength(before);

    await setVisibility(b, forkId, "public");

    expect(await positions(forkId)).toEqual([
      ...[1, 2, 3, 4, 5, 6, 7].map((p) => [p, "inherited"]),
      [8, "modified"],
      [9, "new"],
      [10, "new"],
      [11, "new"],
    ]);
    expect(await forkPoint(forkId)).toBe(8);

    const notes = (await forkNotifications(a)).filter((n) => n.work_id === forkId);
    expect(notes).toEqual([{ work_id: forkId, actor_id: b.id }]);

    const lineage = await lineageOf(anon, forkId, ["depth", "ancestor_id", "ancestor_owner_handle", "fork_chapter_position"]);
    expect(lineage).toEqual([
      { depth: 1, ancestor_id: original.id, ancestor_owner_handle: a.handle, fork_chapter_position: null },
      { depth: 0, ancestor_id: forkId, ancestor_owner_handle: b.handle, fork_chapter_position: 8 },
    ]);
  });

  it("원작이 나중에 비공개가 돼도 갈래의 계보는 남는다", async () => {
    const work = await createOriginal(a, { chapters: 2 });
    const forkId = await fork(b, work.id, 2);
    await setVisibility(b, forkId, "public");
    await setVisibility(a, work.id, "draft");

    const lineage = await lineageOf(anon, forkId, ["ancestor_id"]);
    expect(lineage.map((l) => l.ancestor_id)).toEqual([work.id, forkId]);
    await expectError(b.db.from("works").update({ parent_work_id: null }).eq("id", forkId));
  });
});
