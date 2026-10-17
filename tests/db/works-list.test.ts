import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createOriginal, createTestUser, setVisibility, type TestUser } from "./helpers";

// work_parent_titles: 목록 카드의 부모 제목. 가림 규칙은 work_lineage와 같다.

let a: TestUser;
let b: TestUser;
let m: TestUser;
let original: Awaited<ReturnType<typeof createOriginal>>;
let fork1: string;
let fork2: string;
let draftFork: string;

async function fork(user: TestUser, sourceId: string, title: string) {
  const res = await user.db.rpc("fork_work", { source_work_id: sourceId, at_position: 1, title, note: "한 줄" });
  if (res.error) throw res.error;
  return res.data as string;
}

beforeAll(async () => {
  [a, b, m] = await Promise.all([createTestUser("a"), createTestUser("b"), createTestUser("m")]);
  await admin.from("profiles").update({ is_admin: true }).eq("id", m.id);
  original = await createOriginal(a, { chapters: 2 });
  fork1 = await fork(b, original.id, "첫 갈래");
  await setVisibility(b, fork1, "public");
  fork2 = await fork(b, fork1, "갈래의 갈래");
  await setVisibility(b, fork2, "public");
  draftFork = await fork(b, original.id, "임시 갈래");
});

afterAll(async () => {
  await cleanup([a, b, m].filter(Boolean));
});

type Row = { work_id: string; parent_title: string | null; parent_hidden: boolean };
async function titles(db: typeof anon, ids: string[]) {
  const res = await db.rpc("work_parent_titles", { p_work_ids: ids });
  if (res.error) throw res.error;
  return Object.fromEntries((res.data as Row[]).map((r) => [r.work_id, r]));
}

describe("work_parent_titles", () => {
  it("받은 갈래의 바로 위 부모 제목만 돌려준다(원작은 부모가 없어 빠진다)", async () => {
    const rows = await titles(anon, [original.id, fork1, fork2]);
    expect(Object.keys(rows).sort()).toEqual([fork1, fork2].sort());
    expect(rows[fork1]).toEqual({ work_id: fork1, parent_title: `원작 ${original.slug}`, parent_hidden: false });
    expect(rows[fork2].parent_title).toBe("첫 갈래");
  });

  it("읽을 수 없는 작품(남의 임시 저장)은 빠진다", async () => {
    expect(await titles(anon, [draftFork])).toEqual({});
    expect(Object.keys(await titles(b.db, [draftFork]))).toEqual([draftFork]);
  });

  it("부모가 임시 저장으로 돌아가도 제목은 보인다(계보와 같은 규칙)", async () => {
    await setVisibility(a, original.id, "draft");
    try {
      expect((await titles(anon, [fork1]))[fork1].parent_title).toBe(`원작 ${original.slug}`);
    } finally {
      await setVisibility(a, original.id, "public");
    }
  });

  it("숨겨진 부모는 그 작가·관리자가 아니면 제목이 없다", async () => {
    await m.db.rpc("admin_hide_work", { p_work_id: fork1 });
    try {
      expect((await titles(anon, [fork2]))[fork2]).toEqual({ work_id: fork2, parent_title: null, parent_hidden: true });
      expect((await titles(a.db, [fork2]))[fork2].parent_title).toBeNull();
      expect((await titles(b.db, [fork2]))[fork2].parent_title).toBe("첫 갈래");
      expect((await titles(m.db, [fork2]))[fork2].parent_title).toBe("첫 갈래");
    } finally {
      await m.db.rpc("admin_restore_work", { p_work_id: fork1 });
    }
  });
});
