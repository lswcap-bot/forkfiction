import { describe, expect, it } from "vitest";
import { draftKey, draftStatus, isDirty, parseDraft } from "./editor-draft";

const head = { id: "rev-1", title: "8장", body: "원작 본문" };

describe("isDirty", () => {
  it("본문이나 제목이 다르면 저장하지 않은 변경이 있다", () => {
    expect(isDirty(head, { title: "8장", body: "원작 본문" })).toBe(false);
    expect(isDirty(head, { title: "8장", body: "원작 본문 " })).toBe(true);
    expect(isDirty(head, { title: "새 8장", body: "원작 본문" })).toBe(true);
  });

  it("제목 앞뒤 공백은 저장할 때 지워지므로 변경으로 보지 않는다", () => {
    expect(isDirty(head, { title: "  8장 ", body: "원작 본문" })).toBe(false);
  });
});

describe("parseDraft", () => {
  it("형식이 맞는 임시 보관본만 읽는다", () => {
    const draft = { base: "rev-1", title: "8장", body: "고치는 중", savedAt: 1 };
    expect(parseDraft(JSON.stringify(draft))).toEqual(draft);
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("{깨진 json")).toBeNull();
    expect(parseDraft(JSON.stringify({ base: "rev-1", title: 1, body: "x", savedAt: 1 }))).toBeNull();
  });
});

describe("draftStatus", () => {
  it("임시 보관본이 없거나 저장본과 같으면 알릴 것이 없다", () => {
    expect(draftStatus(null, head)).toBe("none");
    expect(draftStatus({ base: "rev-1", title: "8장", body: "원작 본문", savedAt: 1 }, head)).toBe("none");
  });

  it("같은 수정본에서 시작한 임시 보관본은 이어 쓸 수 있다", () => {
    expect(draftStatus({ base: "rev-1", title: "8장", body: "고치는 중", savedAt: 1 }, head)).toBe("restorable");
  });

  it("그 뒤 다른 곳에서 저장했다면 낡은 임시 보관본으로 알린다", () => {
    expect(draftStatus({ base: "rev-0", title: "8장", body: "고치는 중", savedAt: 1 }, head)).toBe("stale");
  });
});

describe("draftKey", () => {
  it("장마다 따로 보관한다", () => {
    expect(draftKey("ch-1")).not.toBe(draftKey("ch-2"));
  });
});
