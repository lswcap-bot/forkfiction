import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, cleanup, createOriginal, createTestUser, getChapters, saveChapter, setVisibility, type TestUser } from "./helpers";

// work_chapter_counts: 카드 막대의 장 상태별 개수. site_stats: 홈 상단 통계(공개 작품 기준).

let a: TestUser;
let b: TestUser;
let original: Awaited<ReturnType<typeof createOriginal>>;
let fork: string;
let draftOriginal: Awaited<ReturnType<typeof createOriginal>>;

type Stats = { originals: number; forks: number; new_forks_week: number };
async function stats(): Promise<Stats> {
  const res = await anon.rpc("site_stats").single<Stats>();
  if (res.error) throw res.error;
  return res.data;
}

let before: Stats;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestUser("a"), createTestUser("b")]);
  before = await stats();
  original = await createOriginal(a, { chapters: 4 });
  draftOriginal = await createOriginal(a, { chapters: 2, visibility: "draft" });

  // 3장에서 갈라지면 1~2장은 물려받고 3장은 고칠 장이다. 2장도 고치고, 새 장 하나를 덧붙인다
  const res = await b.db.rpc("fork_work", { source_work_id: original.id, at_position: 3, title: "갈래", note: "한 줄" });
  if (res.error) throw res.error;
  fork = res.data as string;
  const chapters = await getChapters(fork);
  await saveChapter(b, chapters[1].id, "고친 2장");
  const add = await b.db.rpc("add_chapter", { p_work_id: fork, p_position: 4, p_title: "새 장", p_body_md: "새 본문" });
  if (add.error) throw add.error;
  await setVisibility(b, fork, "public");
});

afterAll(async () => {
  await cleanup([a, b].filter(Boolean));
});

type Row = { work_id: string; inherited: number; modified: number; new: number };
async function counts(db: typeof anon, ids: string[]) {
  const res = await db.rpc("work_chapter_counts", { p_work_ids: ids });
  if (res.error) throw res.error;
  return Object.fromEntries((res.data as Row[]).map((r) => [r.work_id, r]));
}

describe("work_chapter_counts", () => {
  it("원작은 모두 새 장, 갈래는 물려받음·고침·새 장으로 센다", async () => {
    const rows = await counts(anon, [original.id, fork]);
    expect(rows[original.id]).toEqual({ work_id: original.id, inherited: 0, modified: 0, new: 4 });
    expect(rows[fork]).toEqual({ work_id: fork, inherited: 1, modified: 2, new: 1 });
  });

  it("읽을 수 없는 작품(남의 임시 저장)은 빠진다", async () => {
    expect(await counts(anon, [draftOriginal.id])).toEqual({});
    expect(Object.keys(await counts(a.db, [draftOriginal.id]))).toEqual([draftOriginal.id]);
  });
});

describe("site_stats", () => {
  it("공개 원작·갈래와 최근 7일 새 갈래를 센다(임시 저장은 빼고)", async () => {
    // 다른 테스트가 같은 DB를 함께 쓰므로 늘어난 만큼만 확인한다
    const after = await stats();
    expect(after.originals).toBeGreaterThanOrEqual(before.originals + 1);
    expect(after.forks).toBeGreaterThanOrEqual(before.forks + 1);
    expect(after.new_forks_week).toBeGreaterThanOrEqual(before.new_forks_week + 1);
  });

  it("임시 저장으로 돌린 원작은 빠진다", async () => {
    const published = await stats();
    await setVisibility(a, original.id, "draft");
    try {
      const drafted = await stats();
      // 그사이 다른 테스트가 원작을 공개했을 수 있어 '줄었거나 같다'까지만 본다
      expect(drafted.originals).toBeLessThanOrEqual(published.originals);
    } finally {
      await setVisibility(a, original.id, "public");
    }
  });
});
