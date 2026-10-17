import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, createOriginal, createTestUser, expectError, getWork, type TestUser } from "./helpers";

// AI 활용 표기: 갈래는 만들 때 원작의 표기를 물려받고, 그 뒤에는 작가가 직접 고친다.

let a: TestUser;
let b: TestUser;
let original: Awaited<ReturnType<typeof createOriginal>>;
let forkId: string;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestUser("a"), createTestUser("b")]);
  original = await createOriginal(a, { chapters: 2 });
  const mostly = await a.db.from("works").update({ ai_usage: "mostly" }).eq("id", original.id);
  if (mostly.error) throw mostly.error;
  const fork = await b.db.rpc("fork_work", { source_work_id: original.id, at_position: 1, title: "갈래", note: "한 줄" });
  if (fork.error) throw fork.error;
  forkId = fork.data as string;
});

afterAll(async () => {
  await cleanup([a, b].filter(Boolean));
});

describe("AI 활용 표기 고치기", () => {
  it("갈래는 원작의 표기를 물려받는다", async () => {
    expect((await getWork(forkId)).ai_usage).toBe("mostly");
  });

  it("갈래 작가는 자기 갈래의 표기를 바꿀 수 있고, 원작은 그대로다", async () => {
    const res = await b.db.from("works").update({ ai_usage: "none" }).eq("id", forkId).select("ai_usage").single();
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ ai_usage: "none" });
    expect((await getWork(original.id)).ai_usage).toBe("mostly");
  });

  it("공개한 뒤에도 바꿀 수 있다", async () => {
    await b.db.from("works").update({ visibility: "public" }).eq("id", forkId);
    const res = await b.db.from("works").update({ ai_usage: "partial" }).eq("id", forkId);
    expect(res.error).toBeNull();
    expect((await getWork(forkId)).ai_usage).toBe("partial");
  });

  it("남의 작품 표기는 바꿀 수 없다", async () => {
    const res = await a.db.from("works").update({ ai_usage: "none" }).eq("id", forkId).select("id");
    expect(res.data).toEqual([]);
    expect((await getWork(forkId)).ai_usage).toBe("partial");
  });

  it("정해진 값(none·partial·mostly)만 받는다", async () => {
    await expectError(b.db.from("works").update({ ai_usage: "half" }).eq("id", forkId), "23514");
  });
});
