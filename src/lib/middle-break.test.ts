import { describe, expect, it } from "vitest";
import { splitAtMiddle } from "./middle-break";

const para = (n: number, size = 100) => Array.from({ length: n }, (_, i) => `${i}`.padEnd(size, "가"));

describe("splitAtMiddle", () => {
  it("기준보다 짧은 장은 나누지 않는다", () => {
    expect(splitAtMiddle("짧은 본문\n\n둘째 문단", 100)).toBeNull();
  });

  it("긴 장은 가운데에 가장 가까운 문단 경계에서 나눈다", () => {
    const body = para(10).join("\n\n");
    const result = splitAtMiddle(body, 500)!;
    expect(result).not.toBeNull();
    expect(result[0] + "\n\n" + result[1]).toBe(body);
    expect(result[0].split("\n\n")).toHaveLength(5);
  });

  it("코드 블록 안의 빈 줄에서는 나누지 않는다", () => {
    const body = [para(1, 400)[0], "```\n" + "코드\n\n".repeat(50) + "```", para(1, 400)[0]].join("\n\n");
    const result = splitAtMiddle(body, 500)!;
    expect(result).not.toBeNull();
    for (const part of result) {
      expect((part.match(/```/g) ?? []).length % 2).toBe(0);
    }
  });

  it("나눌 문단 경계가 없으면 나누지 않는다", () => {
    expect(splitAtMiddle("가".repeat(1000), 500)).toBeNull();
  });
});
