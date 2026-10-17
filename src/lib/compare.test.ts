import { describe, expect, it } from "vitest";
import { compareChapters, compareSummary, splitParagraphs } from "./compare";

describe("splitParagraphs", () => {
  it("빈 줄로 문단을 나누고, 앞뒤 공백과 빈 문단은 버린다", () => {
    expect(splitParagraphs("첫 문단.\n\n\n둘째 문단.\n  \n셋째 문단.  \n")).toEqual(["첫 문단.", "둘째 문단.", "셋째 문단."]);
  });

  it("문단 안의 줄바꿈은 그대로 두고, CRLF는 LF로 맞춘다", () => {
    expect(splitParagraphs("한 줄\r\n이어진 줄\r\n\r\n다음 문단")).toEqual(["한 줄\n이어진 줄", "다음 문단"]);
  });

  it("비어 있으면 문단도 없다", () => {
    expect(splitParagraphs("  \n\n ")).toEqual([]);
  });
});

describe("compareChapters", () => {
  it("똑같으면 모든 문단이 같음이다", () => {
    const md = "울라는 활을 들었다.\n\n재하는 칼을 들었다.";
    expect(compareChapters(md, md)).toEqual([
      { kind: "same", text: "울라는 활을 들었다." },
      { kind: "same", text: "재하는 칼을 들었다." },
    ]);
  });

  it("줄바꿈 방식만 다르면 같은 것으로 본다", () => {
    expect(compareChapters("가.\r\n\r\n나.", "가.\n\n나.").every((r) => r.kind === "same")).toBe(true);
  });

  it("한 문단의 한 문장만 고치면 그 문단은 바뀜이고, 고친 문장만 표시한다", () => {
    const origin = "첫 문단.\n\n울라는 강무열을 따라갔다. 재하는 말없이 보았다.\n\n끝 문단.";
    const fork = "첫 문단.\n\n울라는 강무열을 따라가지 않았다. 재하는 말없이 보았다.\n\n끝 문단.";
    const rows = compareChapters(origin, fork);

    expect(rows.map((r) => r.kind)).toEqual(["same", "changed", "same"]);
    const changed = rows[1];
    if (changed.kind !== "changed") throw new Error("바뀐 문단이어야 한다");
    expect(changed.origin.filter((s) => s.changed).map((s) => s.text.trim())).toEqual(["울라는 강무열을 따라갔다."]);
    expect(changed.fork.filter((s) => s.changed).map((s) => s.text.trim())).toEqual(["울라는 강무열을 따라가지 않았다."]);
    // 조각을 이으면 원래 문단이 된다
    expect(changed.origin.map((s) => s.text).join("")).toBe("울라는 강무열을 따라갔다. 재하는 말없이 보았다.");
    expect(changed.fork.map((s) => s.text).join("")).toBe("울라는 강무열을 따라가지 않았다. 재하는 말없이 보았다.");
    expect(changed.fork.find((s) => s.text.includes("재하는"))?.changed).toBe(false);
  });

  it("문단을 끼워 넣거나 빼도 나머지 문단은 그대로 짝이 맞는다", () => {
    const origin = "하나.\n\n둘.\n\n셋.";
    expect(compareChapters(origin, "하나.\n\n새 문단.\n\n둘.\n\n셋.")).toEqual([
      { kind: "same", text: "하나." },
      { kind: "added", text: "새 문단." },
      { kind: "same", text: "둘." },
      { kind: "same", text: "셋." },
    ]);
    expect(compareChapters(origin, "하나.\n\n셋.")).toEqual([
      { kind: "same", text: "하나." },
      { kind: "removed", text: "둘." },
      { kind: "same", text: "셋." },
    ]);
  });

  it("빠진 문단보다 들어온 문단이 많으면 앞에서부터 바뀜으로 짝짓고 남은 것은 새 문단이다", () => {
    const rows = compareChapters("하나.\n\n둘.\n\n끝.", "하나.\n\n둘이었다.\n\n덧붙인 문단.\n\n끝.");
    expect(rows.map((r) => r.kind)).toEqual(["same", "changed", "added", "same"]);
  });

  it("마침표 없이 끝나는 한국어 문장도 비교한다", () => {
    const rows = compareChapters("울라는 떠났다", "울라는 남았다");
    expect(rows).toHaveLength(1);
    const [row] = rows;
    if (row.kind !== "changed") throw new Error("바뀐 문단이어야 한다");
    expect(row.origin.map((s) => s.text).join("")).toBe("울라는 떠났다");
    expect(row.fork.map((s) => s.text).join("")).toBe("울라는 남았다");
    expect(row.fork.some((s) => s.changed)).toBe(true);
  });

  it("원작이 비어 있으면 모두 새 문단이다", () => {
    expect(compareChapters("", "새 글.")).toEqual([{ kind: "added", text: "새 글." }]);
  });
});

describe("compareSummary", () => {
  it("바뀐·더한·뺀 문단 수를 센다", () => {
    const rows = compareChapters("하나.\n\n둘.\n\n셋.", "하나.\n\n둘이다.\n\n넷.\n\n다섯.");
    expect(compareSummary(rows)).toEqual({ same: 1, changed: 2, added: 1, removed: 0 });
  });
});
