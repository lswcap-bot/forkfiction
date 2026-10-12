import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anon,
  cleanup,
  createTestUser,
  expectError,
  getChapters,
  getWork,
  runId,
  type TestUser,
} from "./helpers";

// a: 작가, b: 다른 사용자, n: 필명·약관 동의를 마치지 않은 사용자
let a: TestUser;
let b: TestUser;
let n: TestUser;

beforeAll(async () => {
  a = await createTestUser("a");
  b = await createTestUser("b");
  n = await createTestUser("n", { profile: false });
});

afterAll(async () => {
  await cleanup([a, b, n].filter(Boolean));
});

let seq = 0;
const newSlug = () => `cw-${runId}-${++seq}`;

const chapters = [
  { title: " 시작의 검 ", body: "첫 장 본문\n" },
  { title: "일곱 가지의 칼", body: "둘째 장 본문\n" },
  { title: "보이지 않는 날", body: "" },
];

function createWork(user: TestUser, overrides: Record<string, unknown> = {}) {
  return user.db.rpc("create_work", {
    p_title: " 칼의 여행 ",
    p_summary: "  ",
    p_slug: newSlug(),
    p_license: "CC-BY-SA-4.0",
    p_allow_fork: true,
    p_ai_usage: "mostly",
    p_visibility: "draft",
    p_chapters: chapters,
    ...overrides,
  });
}

describe("create_work", () => {
  it("작품·장·첫 수정본을 한 번에 만든다", async () => {
    const slug = newSlug();
    const res = await createWork(a, { p_slug: slug });
    expect(res.error).toBeNull();
    const workId = res.data as string;

    const work = await getWork(workId);
    expect(work).toMatchObject({
      owner_id: a.id,
      slug,
      title: "칼의 여행",
      summary: null,
      license: "CC-BY-SA-4.0",
      allow_fork: true,
      ai_usage: "mostly",
      visibility: "draft",
      parent_work_id: null,
      root_work_id: workId,
      first_published_at: null,
    });

    const rows = await getChapters(workId);
    expect(rows.map((c) => [c.position, c.state, c.origin_revision_id])).toEqual([
      [1, "new", null],
      [2, "new", null],
      [3, "new", null],
    ]);

    const revs = await admin
      .from("revisions")
      .select("id, chapter_id, author_id, title, body_md")
      .in("id", rows.map((c) => c.head_revision_id));
    expect(revs.error).toBeNull();
    for (const [i, c] of rows.entries()) {
      const rev = revs.data!.find((r) => r.id === c.head_revision_id)!;
      expect(rev).toMatchObject({
        chapter_id: c.id,
        author_id: a.id,
        title: chapters[i].title.trim(),
        body_md: chapters[i].body,
      });
    }
  });

  it("공개로 올리면 처음 공개된 때가 채워진다", async () => {
    const res = await createWork(a, { p_visibility: "public" });
    expect(res.error).toBeNull();
    expect((await getWork(res.data as string)).first_published_at).not.toBeNull();
  });

  it("비로그인은 쓸 수 없다", async () => {
    await expectError(createWork({ ...a, db: anon }), "42501");
  });

  it("필명·약관 동의를 마치지 않은 사용자는 올릴 수 없다", async () => {
    await expectError(createWork(n), "42501");
  });

  it("장이 없거나 장 모양이 틀리면 아무것도 만들지 않는다", async () => {
    const slug = newSlug();
    await expectError(createWork(a, { p_slug: slug, p_chapters: [] }), "22023");
    await expectError(createWork(a, { p_slug: slug, p_chapters: [{ title: "a", body: "b" }, { title: "c" }] }), "22023");
    const left = await admin.from("works").select("id").eq("slug", slug);
    expect(left.data).toHaveLength(0);
  });

  it("장 제목이 비면 수정본 제약에 걸려 작품도 남지 않는다", async () => {
    const slug = newSlug();
    await expectError(createWork(a, { p_slug: slug, p_chapters: [{ title: "  ", body: "b" }] }), "23514");
    const left = await admin.from("works").select("id").eq("slug", slug);
    expect(left.data).toHaveLength(0);
  });

  it("숨김으로는 올릴 수 없다", async () => {
    await expectError(createWork(a, { p_visibility: "hidden" }), "22023");
  });

  it("같은 주소가 있으면 unique 위반으로 실패한다", async () => {
    const slug = newSlug();
    expect((await createWork(a, { p_slug: slug })).error).toBeNull();
    await expectError(createWork(b, { p_slug: slug }), "23505");
  });
});

describe("resolve_slug", () => {
  it("비어 있는 주소는 그대로, 겹치면 -2, -3을 붙인다", async () => {
    const slug = newSlug();
    expect((await b.db.rpc("resolve_slug", { p_slug: slug })).data).toBe(slug);

    // 남의 임시 저장 작품 주소도 피한다(RLS로는 보이지 않는 작품)
    const first = await createWork(a, { p_slug: slug });
    expect(first.error).toBeNull();
    expect((await b.db.rpc("resolve_slug", { p_slug: slug })).data).toBe(`${slug}-2`);

    expect((await createWork(a, { p_slug: `${slug}-2` })).error).toBeNull();
    expect((await b.db.rpc("resolve_slug", { p_slug: slug })).data).toBe(`${slug}-3`);
  });

  it("내 작품 주소를 고칠 때는 자기 자신을 빼고 본다", async () => {
    const slug = newSlug();
    const res = await createWork(a, { p_slug: slug });
    const own = await a.db.rpc("resolve_slug", { p_slug: slug, p_except_work_id: res.data });
    expect(own.data).toBe(slug);
  });

  it("80자 주소에 번호를 붙여도 80자를 넘지 않는다", async () => {
    const long = `cw-${runId}-`.padEnd(80, "x");
    expect((await createWork(a, { p_slug: long })).error).toBeNull();
    const res = await b.db.rpc("resolve_slug", { p_slug: long });
    expect(res.data).toHaveLength(80);
    expect(res.data).toMatch(/-2$/);
  });

  it("형식이 틀린 주소는 거절한다", async () => {
    await expectError(b.db.rpc("resolve_slug", { p_slug: "칼의-여행" }), "22023");
  });

  it("비로그인은 쓸 수 없다", async () => {
    await expectError(anon.rpc("resolve_slug", { p_slug: "abc" }), "42501");
  });
});

describe("작품 주소 바꾸기", () => {
  it("한 번도 공개하지 않은 작품은 주소를 바꿀 수 있다", async () => {
    const res = await createWork(a);
    const next = newSlug();
    const upd = await a.db.from("works").update({ slug: next }).eq("id", res.data).select("slug").single();
    expect(upd.error).toBeNull();
    expect(upd.data!.slug).toBe(next);
  });

  it("공개하면서 주소를 함께 바꾸는 것은 된다", async () => {
    const res = await createWork(a);
    const next = newSlug();
    const upd = await a.db.from("works").update({ slug: next, visibility: "public" }).eq("id", res.data);
    expect(upd.error).toBeNull();
    expect(await getWork(res.data as string)).toMatchObject({ slug: next, visibility: "public" });
  });

  it("공개한 뒤에는 임시 저장으로 돌려도 주소를 바꿀 수 없다", async () => {
    const res = await createWork(a, { p_visibility: "public" });
    const id = res.data as string;
    await expectError(a.db.from("works").update({ slug: newSlug() }).eq("id", id), "42501");

    expect((await a.db.from("works").update({ visibility: "draft" }).eq("id", id)).error).toBeNull();
    await expectError(a.db.from("works").update({ slug: newSlug() }).eq("id", id), "42501");
  });

  it("처음 공개된 때는 다시 공개해도 바뀌지 않고, 직접 고칠 수 없다", async () => {
    const res = await createWork(a, { p_visibility: "public" });
    const id = res.data as string;
    const first = (await getWork(id)).first_published_at;

    await a.db.from("works").update({ visibility: "draft" }).eq("id", id);
    await a.db.from("works").update({ visibility: "public" }).eq("id", id);
    expect((await getWork(id)).first_published_at).toBe(first);

    await expectError(a.db.from("works").update({ first_published_at: null }).eq("id", id), "42501");
  });

  it("남의 작품 주소는 바꿀 수 없다", async () => {
    const res = await createWork(a);
    const before = (await getWork(res.data as string)).slug;
    await b.db.from("works").update({ slug: newSlug() }).eq("id", res.data);
    expect((await getWork(res.data as string)).slug).toBe(before);
  });
});
