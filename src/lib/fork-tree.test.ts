import { describe, expect, it } from "vitest";
import { layoutForkTree, type TreeWork } from "./fork-tree";

const ROOT: TreeWork = { id: "root", parentId: null, forkPoint: null, chapterCount: 10, stars: 0, isCanon: false, createdAt: "2026-01-01" };

let seq = 0;
function fork(id: string, parentId: string, forkPoint: number, extra: Partial<TreeWork> = {}): TreeWork {
  seq += 1;
  return {
    id,
    parentId,
    forkPoint,
    chapterCount: forkPoint + 1,
    stars: 0,
    isCanon: false,
    createdAt: `2026-02-${String(seq).padStart(2, "0")}`,
    ...extra,
  };
}

const lanesOf = (layout: ReturnType<typeof layoutForkTree>) =>
  Object.fromEntries(layout.branches.map((b) => [b.id, b.lane]));

describe("layoutForkTree", () => {
  it("갈래가 없으면 원작 줄 하나가 1장부터 마지막 장까지 이어진다", () => {
    const layout = layoutForkTree(ROOT, []);
    expect(layout.branches).toEqual([
      { id: "root", parentId: null, lane: 0, depth: 0, start: 1, end: 10, parentLane: null },
    ]);
    expect(layout.lanes).toBe(1);
    expect(layout.maxChapter).toBe(10);
    expect(layout.hidden).toBe(0);
  });

  it("갈래는 부모 줄의 갈림점에서 뻗어 자기 마지막 장까지 이어진다", () => {
    const layout = layoutForkTree(ROOT, [fork("ulla", "root", 8, { chapterCount: 11 })]);
    expect(layout.branches[1]).toEqual({ id: "ulla", parentId: "root", lane: 1, depth: 1, start: 8, end: 11, parentLane: 0 });
    // 원작보다 길게 이어 쓴 갈래가 있으면 가로축도 늘어난다
    expect(layout.maxChapter).toBe(11);
  });

  it("형제 갈래는 정사, 별 많은 순, 먼저 만든 순으로 위에서부터 놓는다", () => {
    const layout = layoutForkTree(ROOT, [
      fork("old", "root", 6),
      fork("starred", "root", 8, { stars: 5 }),
      fork("canon", "root", 9, { isCanon: true }),
      fork("new", "root", 7),
    ]);
    expect(lanesOf(layout)).toEqual({ root: 0, canon: 1, starred: 2, old: 3, new: 4 });
  });

  it("갈래의 갈래는 부모 갈래 바로 아래 줄에 온다", () => {
    const layout = layoutForkTree(ROOT, [
      fork("a", "root", 6, { stars: 3 }),
      fork("b", "root", 8, { stars: 2 }),
      fork("a1", "a", 7),
      fork("b1", "b", 10),
    ]);
    expect(lanesOf(layout)).toEqual({ root: 0, a: 1, a1: 2, b: 3, b1: 4 });
    const b1 = layout.branches.find((x) => x.id === "b1")!;
    expect(b1).toMatchObject({ depth: 2, parentLane: 3, start: 10 });
  });

  it("줄마다 장별로 그 줄에서 직접 갈라진 갈래 수를 센다(갈래의 갈래는 부모 갈래 줄에서)", () => {
    const layout = layoutForkTree(ROOT, [
      fork("a", "root", 8),
      fork("b", "root", 8),
      fork("c", "root", 6),
      fork("a1", "a", 9),
    ]);
    expect(layout.forksAt).toEqual({ root: { 6: 1, 8: 2 }, a: { 9: 1 } });
  });

  it("가지가 limit을 넘으면 별 많은 순으로 남기고, 남긴 갈래의 조상은 함께 남긴다", () => {
    const forks = [
      fork("weak-parent", "root", 5, { stars: 0 }),
      fork("strong-child", "weak-parent", 6, { stars: 9 }),
      fork("mid", "root", 7, { stars: 5 }),
      fork("low", "root", 8, { stars: 1 }),
    ];
    const layout = layoutForkTree(ROOT, forks, { limit: 2 });
    expect(layout.branches.map((b) => b.id).sort()).toEqual(["mid", "root", "strong-child", "weak-parent"]);
    expect(layout.hidden).toBe(1);
    // 잘린 갈래도 장별 갈래 수에는 들어간다
    expect(layout.forksAt.root[8]).toBe(1);
  });

  it("부모가 보이지 않는(비공개로 바뀐) 갈래는 지도에서 빼고 숨긴 수에 센다", () => {
    const layout = layoutForkTree(ROOT, [fork("orphan", "gone", 3), fork("ok", "root", 4)]);
    expect(layout.branches.map((b) => b.id)).toEqual(["root", "ok"]);
    expect(layout.hidden).toBe(1);
  });

  it("어떤 두 가지도 같은 줄을 쓰지 않는다", () => {
    const forks = Array.from({ length: 20 }, (_, i) => fork(`f${i}`, i % 3 === 0 || i < 3 ? "root" : `f${i - 3}`, 1 + (i % 9)));
    const layout = layoutForkTree(ROOT, forks);
    const lanes = layout.branches.map((b) => b.lane);
    expect(new Set(lanes).size).toBe(lanes.length);
    expect(layout.lanes).toBe(lanes.length);
  });
});
