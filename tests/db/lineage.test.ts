import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createOriginal, createTestUser, setVisibility, type TestUser } from "./helpers";

// 계보 표시 규칙. 계보는 라이선스의 출처 표시를 대신하므로 어떤 화면에서도 숨기거나 지울 수 없다.
//   - 뿌리 원작부터 이 작품까지 빠짐없이, 깊이·작가·갈림점이 맞게
//   - 조상이 임시 저장으로 돌아가도 자리·제목·작가가 남는다
//   - 숨겨진 조상은 자리를 남기고 제목·주소·작가만 비운다(그 작가·관리자는 원래 제목을 본다)
//   - 읽을 수 없는 작품의 계보는 비어 있다

type Row = {
  depth: number;
  ancestor_id: string;
  ancestor_slug: string | null;
  ancestor_title: string | null;
  ancestor_owner_handle: string | null;
  ancestor_owner_display_name: string | null;
  fork_chapter_position: number | null;
  ancestor_hidden: boolean;
};

/** 뿌리부터 이 작품까지의 계보(앱의 getLineage와 같은 조회) */
async function lineage(db: SupabaseClient, workId: string): Promise<Row[]> {
  const res = await db.rpc("work_lineage_of", { p_work_id: workId });
  if (res.error) throw res.error;
  return (res.data as (Row & { work_id: string })[]).map(({ work_id, ...row }) => {
    expect(work_id).toBe(workId);
    return row;
  });
}

let a: TestUser; // 원작자
let b: TestUser; // 갈래 작가
let c: TestUser; // 갈래의 갈래 작가
let m: TestUser; // 관리자
let original: Awaited<ReturnType<typeof createOriginal>>;
let forkB: string;
let forkC: string;

async function fork(user: TestUser, sourceId: string, at: number, title: string) {
  const res = await user.db.rpc("fork_work", { source_work_id: sourceId, at_position: at, title, note: "한 줄" });
  if (res.error) throw res.error;
  return res.data as string;
}

beforeAll(async () => {
  [a, b, c, m] = await Promise.all([createTestUser("a"), createTestUser("b"), createTestUser("c"), createTestUser("m")]);
  await admin.from("profiles").update({ is_admin: true }).eq("id", m.id);
  original = await createOriginal(a, { chapters: 4 });
  forkB = await fork(b, original.id, 3, "갈래 B");
  await setVisibility(b, forkB, "public");
  forkC = await fork(c, forkB, 2, "갈래 C");
  await setVisibility(c, forkC, "public");
});

afterAll(async () => {
  await cleanup([a, b, c, m].filter(Boolean));
});

describe("계보", () => {
  it("뿌리 원작부터 이 작품까지 순서대로, 깊이·작가·갈림점이 맞다", async () => {
    expect(await lineage(anon, forkC)).toEqual([
      {
        depth: 2,
        ancestor_id: original.id,
        ancestor_slug: original.slug,
        ancestor_title: `원작 ${original.slug}`,
        ancestor_owner_handle: a.handle,
        ancestor_owner_display_name: "테스트 a",
        fork_chapter_position: null,
        ancestor_hidden: false,
      },
      expect.objectContaining({ depth: 1, ancestor_id: forkB, ancestor_title: "갈래 B", ancestor_owner_handle: b.handle, fork_chapter_position: 3 }),
      expect.objectContaining({ depth: 0, ancestor_id: forkC, ancestor_title: "갈래 C", ancestor_owner_handle: c.handle, fork_chapter_position: 2 }),
    ]);
  });

  it("원작은 자기 자신 하나뿐이다", async () => {
    const rows = await lineage(anon, original.id);
    expect(rows.map((r) => [r.depth, r.ancestor_id])).toEqual([[0, original.id]]);
  });

  it("조상이 임시 저장으로 돌아가도 자리·제목·작가가 남는다(숨길 수 없음)", async () => {
    await setVisibility(a, original.id, "draft");
    try {
      const rows = await lineage(anon, forkC);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ ancestor_id: original.id, ancestor_title: `원작 ${original.slug}`, ancestor_owner_handle: a.handle, ancestor_hidden: false });
    } finally {
      await setVisibility(a, original.id, "public");
    }
  });

  it("숨겨진 조상은 자리를 남기고 제목·주소·작가만 비운다", async () => {
    await m.db.rpc("admin_hide_work", { p_work_id: forkB });
    try {
      for (const db of [anon, c.db, a.db]) {
        const rows = await lineage(db, forkC);
        expect(rows.map((r) => r.depth)).toEqual([2, 1, 0]);
        expect(rows[1]).toEqual({
          depth: 1,
          ancestor_id: forkB,
          ancestor_slug: null,
          ancestor_title: null,
          ancestor_owner_handle: null,
          ancestor_owner_display_name: null,
          fork_chapter_position: 3,
          ancestor_hidden: true,
        });
        expect(rows[0].ancestor_title).toBe(`원작 ${original.slug}`);
      }
      // 숨겨진 작품의 작가와 관리자는 원래 제목을 본다
      for (const db of [b.db, m.db]) {
        expect((await lineage(db, forkC))[1]).toMatchObject({ ancestor_title: "갈래 B", ancestor_owner_handle: b.handle, ancestor_hidden: true });
      }
      // 숨겨진 작품 자신의 계보: 남에게는 비어 있고, 작가에게는 보인다
      expect(await lineage(anon, forkB)).toEqual([]);
      expect((await lineage(b.db, forkB)).map((r) => r.depth)).toEqual([1, 0]);
    } finally {
      await m.db.rpc("admin_restore_work", { p_work_id: forkB });
    }
  });

  it("읽을 수 없는 작품(남의 임시 저장)의 계보는 비어 있다", async () => {
    const draft = await fork(b, original.id, 1, "임시 갈래");
    expect(await lineage(anon, draft)).toEqual([]);
    expect(await lineage(c.db, draft)).toEqual([]);
    expect((await lineage(b.db, draft)).map((r) => r.depth)).toEqual([1, 0]);
  });

  it("깊은 계보(6단)도 빠짐없이 나온다", async () => {
    let parent = original.id;
    const chain = [original.id];
    for (let i = 0; i < 5; i++) {
      const id = await fork(b, parent, 1, `깊은 갈래 ${i + 1}`);
      await setVisibility(b, id, "public");
      chain.push(id);
      parent = id;
    }
    const rows = await lineage(anon, parent);
    expect(rows.map((r) => r.ancestor_id)).toEqual(chain);
    expect(rows.map((r) => r.depth)).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it("없는 작품이면 비어 있다", async () => {
    expect(await lineage(anon, "00000000-0000-0000-0000-000000000000")).toEqual([]);
  });
});
