import { describe, expect, it } from "vitest";
import { chapterBar, MAX_BAR_CELLS } from "./chapter-bar";

const counts = (inherited: number, modified: number, fresh: number) => ({ inherited, modified, new: fresh });

describe("chapterBar", () => {
  it("원작은 장마다 진한 칸 하나, 캡션은 장 수", () => {
    const bar = chapterBar(counts(0, 0, 10), false);
    expect(bar.cells).toEqual(Array(10).fill("inherited"));
    expect(bar.caption).toBe("10장");
  });

  it("갈래는 물려받은 장(진한 칸) 다음에 고친·새 장(연한 칸)", () => {
    const bar = chapterBar(counts(7, 1, 3), true);
    expect(bar.cells).toEqual([...Array(7).fill("inherited"), ...Array(4).fill("new")]);
    expect(bar.caption).toBe("7장 물려받음 · 1장 고침 · 3장 새로 씀");
  });

  it("0인 항목은 캡션에서 뺀다", () => {
    expect(chapterBar(counts(2, 1, 0), true).caption).toBe("2장 물려받음 · 1장 고침");
    expect(chapterBar(counts(0, 0, 4), true).caption).toBe("4장 새로 씀");
  });

  it("장이 없으면 칸도 없다", () => {
    expect(chapterBar(counts(0, 0, 0), false)).toEqual({ cells: [], caption: "아직 장이 없음" });
    expect(chapterBar(undefined, true)).toEqual({ cells: [], caption: null });
  });

  it("장이 많으면 칸 수를 줄이되 비율과 두 종류가 모두 보이게 한다", () => {
    const bar = chapterBar(counts(299, 0, 1), true);
    expect(bar.cells).toHaveLength(MAX_BAR_CELLS);
    expect(bar.cells.at(-1)).toBe("new");
    expect(bar.cells.filter((c) => c === "inherited")).toHaveLength(MAX_BAR_CELLS - 1);

    const half = chapterBar(counts(50, 25, 25), true);
    expect(half.cells.filter((c) => c === "inherited")).toHaveLength(MAX_BAR_CELLS / 2);
    expect(half.caption).toBe("50장 물려받음 · 25장 고침 · 25장 새로 씀");
  });

  it("원작도 칸 수 상한을 지킨다", () => {
    expect(chapterBar(counts(0, 0, 120), false).cells).toHaveLength(MAX_BAR_CELLS);
  });
});
